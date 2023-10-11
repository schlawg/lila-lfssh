import { Work } from '../types';
import { CevalWorker, CevalState } from './worker';
import { Protocol } from '../protocol';
import { objectStorage } from 'common/objectStorage';
import type StockfishWeb from 'stockfish-web';

const version = '000001';

export class WasmWorker implements CevalWorker {
  private failed = false;
  private protocol = new Protocol();
  private worker: StockfishWeb;

  constructor(
    readonly wasmMemory: WebAssembly.Memory,
    readonly nnueProgress?: (mb: number) => void,
  ) {
    this.boot().catch(e => {
      console.error(e);
      this.failed = true;
    });
  }

  async boot() {
    const module = await import(lichess.assetUrl('npm/stockfish-web/stockfishWeb.js', { version }));
    const worker = await module.default({
      wasmMemory: this.wasmMemory,
      locateFile: (name: string) =>
        lichess.assetUrl(`npm/stockfish-web/${name}`, { version, sameDomain: name.endsWith('.worker.js') }),
    });
    if (this.nnueProgress) {
      const nnueStore = await objectStorage<Uint8Array>({ store: 'nnue' });
      const nnueFilename = worker.getRecommendedNnue();
      const nnueVersion = nnueFilename.slice(3, 9);

      let nnueBuffer = await nnueStore.get(nnueVersion).catch(() => undefined);
      if (!nnueBuffer) {
        const req = new XMLHttpRequest();
        req.open('get', lichess.assetUrl(`lifat/nnue/${nnueFilename}`, { version: nnueVersion }), true);
        req.responseType = 'arraybuffer';
        req.onprogress = e => this.nnueProgress?.(e.loaded);

        nnueBuffer = await new Promise((resolve, reject) => {
          req.onerror = event => reject(event);
          req.onload = _ => resolve(new Uint8Array(req.response));
          req.send();
        });
        this.nnueProgress(0);
        nnueStore.put(nnueVersion, nnueBuffer!).catch(() => console.warn('IDB store failed'));
      }
      worker.setNnueBuffer(nnueBuffer!);
    }
    worker.addMessageListener((data: string) => this.protocol.received(data));
    this.protocol.connected(cmd => worker.postMessage(cmd));
    this.worker = worker;
  }

  getState() {
    return this.failed
      ? CevalState.Failed
      : !this.worker
      ? CevalState.Loading
      : this.protocol.isComputing()
      ? CevalState.Computing
      : CevalState.Idle;
  }

  start = (work?: Work) => this.protocol.compute(work);
  stop = () => this.protocol.compute(undefined);
  engineName = () => this.protocol.engineName;
  destroy = () => this.stop();
}
