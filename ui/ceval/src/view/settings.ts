import { h, VNode } from 'snabbdom';
import { ParentCtrl } from '../types';
import { toggle, ToggleSettings, rangeConfig } from 'common/controls';
import { onInsert, bind } from 'common/snabbdom';
import { onClickAway } from 'common';

const ctrlToggle = (t: ToggleSettings, ctrl: ParentCtrl) =>
  toggle(t, ctrl.trans, ctrl.getCeval().opts.redraw);

const formatHashSize = (v: number): string => (v < 1000 ? v + 'MB' : Math.round(v / 1024) + 'GB');

export function renderCevalSettings(ctrl: ParentCtrl): VNode | null {
  const ceval = ctrl.getCeval(),
    noarg = ctrl.trans.noarg,
    notSupported = (ceval?.technology == 'external' ? 'Engine' : 'Browser') + ' does not support this option';

  return ceval.showEnginePrefs()
    ? h(
        'div#ceval-settings-anchor',
        h(
          'div#ceval-settings',
          { hook: onInsert(onClickAway(() => (ceval.showEnginePrefs(false), ceval.opts.redraw()))) },
          [
            (id => {
              const max = 5;
              return h('div.setting', [
                h('label', { attrs: { for: id } }, noarg('multipleLines')),
                h('input#' + id, {
                  attrs: {
                    type: 'range',
                    min: 0,
                    max,
                    step: 1,
                  },
                  hook: rangeConfig(() => ceval!.multiPv(), ctrl.cevalSetMultiPv ?? (() => {})),
                }),
                h('div.range_value', ceval.multiPv() + ' / ' + max),
              ]);
            })('analyse-multipv'),
            (id => {
              return h('div.setting', [
                h('label', { attrs: { for: id } }, noarg('cpus')),
                h('input#' + id, {
                  attrs: {
                    type: 'range',
                    min: 1,
                    max: ceval.platform.maxThreads,
                    step: 1,
                    disabled: ceval.platform.maxThreads <= 1,
                    ...(ceval.platform.maxThreads <= 1 ? { title: notSupported } : null),
                  },
                  hook: rangeConfig(
                    () => ceval.threads(),
                    x => (ceval.setThreads(x), ctrl.cevalReset?.()),
                  ),
                }),
                h('div.range_value', `${ceval.threads ? ceval.threads() : 1} / ${ceval.platform.maxThreads}`),
              ]);
            })('analyse-threads'),
            (id =>
              h('div.setting', [
                h('label', { attrs: { for: id } }, noarg('memory')),
                h('input#' + id, {
                  attrs: {
                    type: 'range',
                    min: 4,
                    max: Math.floor(Math.log2(ceval.platform.maxHashSize())),
                    step: 1,
                    disabled: ceval.platform.maxHashSize() <= 16,
                    ...(ceval.platform.maxHashSize() <= 16 ? { title: notSupported } : null),
                  },
                  hook: rangeConfig(
                    () => Math.floor(Math.log2(ceval.hashSize())),
                    v => (ceval.setHashSize(Math.pow(2, v)), ctrl.cevalReset?.()),
                  ),
                }),
                h('div.range_value', formatHashSize(ceval.hashSize())),
              ]))('analyse-memory'),
            h('hr'),
            ceval.technology !== 'external'
              ? ctrlToggle(
                  {
                    name: 'Best Eval (NNUE)',
                    title: ceval.platform.supportsNnue
                      ? 'Downloads 40 MB neural network evaluation file (page reload required after change)'
                      : notSupported,
                    id: 'enable-nnue',
                    checked: ceval.platform.supportsNnue && ceval.enableNnue(),
                    change: ceval.enableNnue,
                    disabled: !ceval.platform.supportsNnue,
                  },
                  ctrl,
                )
              : null,
            ctrlToggle(
              {
                name: 'infiniteAnalysis',
                title: 'removesTheDepthLimit',
                id: 'infinite',
                checked: ceval.infinite(),
                change: x => (ceval.infinite(x), ctrl.cevalReset?.()),
              },
              ctrl,
            ),
            ...engineSelection(ctrl),
          ],
        ),
      )
    : null;
}

function engineSelection(ctrl: ParentCtrl) {
  const engines = ctrl.externalEngines?.(),
    ceval = ctrl.getCeval();
  if (!engines?.length || !ceval.possible || !ceval.allowed()) return [];
  return [
    h('hr'),
    h(
      'select.external__select.setting',
      {
        hook: bind('change', e => ctrl.getCeval().selectEngine((e.target as HTMLSelectElement).value)),
      },
      [
        h('option', { attrs: { value: 'lichess' } }, 'Lichess'),
        ...engines.map(engine =>
          h(
            'option',
            {
              attrs: {
                value: engine.id,
                selected: ctrl.getCeval().externalEngine?.id == engine.id,
              },
            },
            engine.name,
          ),
        ),
      ],
    ),
  ];
}
