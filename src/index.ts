import './ui/styles/main.scss';
import { stageIndex, STAGES } from './core/content';
import { Notebook } from './core/notebook';
import { Progress } from './core/progress';
import { $, replayAnimation, show } from './ui/dom';
import { GameView } from './ui/gameView';
import { HomeView } from './ui/homeView';
import { LibraryView } from './ui/libraryView';
import { navigate, parseRoute } from './ui/router';

const progress = Progress.load(STAGES);
const notebook = Notebook.load();

let lastPoints = progress.totalPoints();

/** Cabeçalho: pontos e fases concluídas. */
function renderHeader(): void {
  const points = progress.totalPoints();
  $('total-points').textContent = `${points} pts`;
  $('top-count').textContent = `${progress.finishedCount()} de ${STAGES.length} fases`;
  if (points > lastPoints) replayAnimation($('total-points'), 'bump');
  lastPoints = points;
}

const home = new HomeView(progress);
const game = new GameView(progress, (unlockedIndex) => {
  renderHeader();
  if (unlockedIndex !== undefined) home.highlightUnlocked(unlockedIndex);
});
const library = new LibraryView(progress, notebook, () => {
  renderHeader();
  home.render();
});

const views = { home: $('home'), stage: $('game'), library: $('library') };
/** Tela/aba atual: só rola ao topo quando ela muda (escolher outro tema na biblioteca não rola). */
let currentScreen = '';

function route(): void {
  const r = parseRoute(location.hash);
  if (r.view === 'stage') {
    const index = stageIndex(r.id);
    // Fase inexistente ou ainda bloqueada (link antigo/compartilhado): volta ao mapa.
    if (index < 0 || !progress.isAvailable(index)) {
      navigate({ view: 'home' }, { replace: true });
      return;
    }
  }

  for (const [name, el] of Object.entries(views)) show(el, name === r.view);
  if (r.view !== 'stage') game.close();

  const screen = r.view === 'library' ? `library:${r.tab}` : r.view;
  if (screen !== currentScreen && r.view !== 'stage') window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  currentScreen = screen;

  if (r.view === 'home') home.render();
  else if (r.view === 'stage') game.open(stageIndex(r.id), r.mode);
  else library.open(r.tab, r.id);
  renderHeader();
}

window.addEventListener('hashchange', route);
route();

// Modo offline / instalável (PWA). Só em HTTPS ou localhost.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
