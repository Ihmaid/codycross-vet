import { assetPath, FAMILIES, STAGES, STUDY } from '../core/content';
import { Progress } from '../core/progress';
import { normalize } from '../core/text';
import { $, html, setHtml } from './dom';
import { navigate } from './router';

/** Sumário: a lista de fases, como o sumário do e-book. */
export class HomeView {
  private readonly search = $<HTMLInputElement>('stage-search');
  private readonly family = $<HTMLSelectElement>('family-filter');
  private readonly explore = $<HTMLInputElement>('free-explore');
  private readonly list = $('stage-map');
  /** Fase recém-liberada, marcada uma vez ao voltar ao sumário. */
  private highlight: number | null = null;

  constructor(private readonly progress: Progress) {
    for (const name of FAMILIES) this.family.add(new Option(name, name));
    this.search.addEventListener('input', () => this.render());
    this.family.addEventListener('change', () => this.render());
    this.explore.addEventListener('change', () => {
      this.progress.state.explore = this.explore.checked;
      this.progress.save();
      this.render();
    });
    $('continue-btn').addEventListener('click', () => {
      navigate({ view: 'stage', id: STAGES[this.progress.nextStageIndex()].id, mode: 'cross' });
    });
    this.list.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-stage]');
      if (row && !row.disabled) navigate({ view: 'stage', id: row.dataset.stage!, mode: 'cross' });
    });
  }

  highlightUnlocked(index: number): void {
    this.highlight = index;
  }

  render(): void {
    const p = this.progress;
    const finished = p.finishedCount();
    $('home-count').textContent = `${finished} de ${STAGES.length} fases concluídas`;
    this.explore.checked = p.state.explore;

    const next = p.nextStageIndex();
    $('continue-btn').textContent =
      finished === 0 ? 'Começar' : `Continuar na fase ${next + 1}, ${STAGES[next].title}`;

    const query = normalize(this.search.value);
    const family = this.family.value;
    const visible = STAGES.map((s, i) => ({ s, i })).filter(
      ({ s }) =>
        (!family || s.tag === family) &&
        (!query || normalize([s.title, s.short, s.tag, s.intro, s.description, s.review].join(' ')).includes(query))
    );
    $('filter-count').textContent = `${visible.length} de ${STAGES.length} fases`;

    if (!visible.length) {
      setHtml(this.list, html`<li class="toc-empty">Nada encontrado. Tente outro nome ou outra família.</li>`);
      return;
    }
    setHtml(
      this.list,
      html`${visible.map(({ s, i }) => {
        const done = p.isStageDone(s);
        const open = p.isAvailable(i);
        const modes = p.modesDone(s);
        const status = !open ? 'bloqueada' : modes > 0 ? `${modes} de 2 jogos` : '';
        const classes = ['toc-row', done && 'is-done', !open && 'is-locked', this.highlight === i && 'is-new']
          .filter(Boolean)
          .join(' ');
        return html`<li class="${classes}">
          <button type="button" data-stage="${s.id}" ${open ? '' : html`disabled`}>
            <span class="toc-num">${i + 1}</span>
            <img src="${assetPath(s.image)}" alt="" loading="lazy">
            <span class="toc-title">${s.title} <i>${s.tag}</i></span>
            <span class="toc-leader" aria-hidden="true"></span>
            <span class="toc-status">${status}</span>
            <span class="toc-page" title="Página no e-book">${STUDY[s.id]?.pages[0] ?? ''}</span>
          </button>
        </li>`;
      })}`
    );
    if (this.highlight !== null) {
      this.list.querySelector('.is-new')?.scrollIntoView({ block: 'center' });
      this.highlight = null;
    }
  }
}
