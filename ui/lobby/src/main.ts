import { init, classModule, attributesModule, eventListenersModule } from 'snabbdom';
import { LobbyOpts } from './interfaces';

import makeCtrl from './ctrl';
import appView from './view/main';
import tableView from './view/table';

export const patch = init([classModule, attributesModule, eventListenersModule]);

export default function main(opts: LobbyOpts) {
  const ctrl = new makeCtrl(opts, redraw);

  opts.appElement.innerHTML = '';
  let appVNode = patch(opts.appElement, appView(ctrl));
  opts.tableElement.innerHTML = '';
  let tableVNode = patch(opts.tableElement, tableView(ctrl));

  function redraw() {
    appVNode = patch(appVNode, appView(ctrl));
    tableVNode = patch(tableVNode, tableView(ctrl));
  }

  arrange();
  window.addEventListener('resize', arrange);

  return ctrl;
}

let cols = 0;

function arrange() {
  // just reattach a few things to escape row boundary constraints in the css grid
  const lobby = document.querySelector('.lobby') as HTMLElement;
  const newCols = Number(window.getComputedStyle(lobby).getPropertyValue('--cols'));

  if (newCols === cols) return;
  cols = newCols;

  const forum = lobby.querySelector('.lobby__forum') as HTMLElement;
  const table = lobby.querySelector('.lobby__table') as HTMLElement;
  const timeline = lobby.querySelector('.lobby__timeline') as HTMLElement;
  const side = lobby.querySelector('.lobby__side') as HTMLElement;
  const tableForum = lobby.querySelector('.lobby__table-forum') as HTMLElement;
  const sideTimeline = lobby.querySelector('.lobby__side-timeline') as HTMLElement;

  lobby.append(side, table, timeline, forum);

  forum.classList.toggle('none', cols === 3);
  tableForum.classList.toggle('none', cols !== 4);
  sideTimeline.classList.toggle('none', cols < 3);

  if (cols > 2) sideTimeline.append(side, timeline);
  if (cols === 4) tableForum.append(table, forum);
}
