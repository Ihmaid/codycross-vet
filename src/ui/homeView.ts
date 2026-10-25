import { assetPath, FAMILIES, STAGES } from '../core/content';
import { Progress } from '../core/progress';
import { normalize } from '../core/text';
import { $, html, setHtml } from './dom';
import { navigate } from './router';

/** Mapa de fases: busca, filtro por família, modo exploração e cartões das 28 fases. */
export class HomeView {
  private readonly search = $<HTMLInputElement>('stage-search');
  private readonly family = $<HTMLSelectElement>('family-filter');
  private readonly explore = $<HTMLInputElement>('free-explore');
  private readonly map = $('stage-map');
  /** Fase recém-liberada, destacada uma vez ao voltar ao mapa. */
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
    this.map.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-stage]');
      if (card && !card.disabled) navigate({ view: 'stage', id: card.dataset.stage!, mode: 'cross' });
    });
  }

  highlightUnlocked(index: number): void {
    this.highlight = index;
  }

  render(): void {
    const p = this.progress;
    const finished = p.finishedCount();
    $('home-count').textContent = `${finished} / ${STAGES.length}`;
    this.explore.checked = p.state.explore;

    const query = normalize(this.search.value);
    const family = this.family.value;
    const visible = STAGES.map((s, i) => ({ s, i })).filter(
      ({ s }) =>
        (!family || s.tag === family) &&
        (!query || normalize([s.title, s.short, s.tag, s.description, s.review].join(' ')).includes(query))
    );
    $('filter-count').textContent = `${visible.length} de ${STAGES.length} fases exibidas`;

    if (!visible.length) {
      setHtml(this.map, html`<p class="empty-state">Nenhuma fase encontrada. Experimente outro termo ou selecione todas as famílias.</p>`);
      return;
    }
    setHtml(
      this.map,
      html`${visible.map(({ s, i }) => {
        const done = p.isStageDone(s);
        const open = p.isAvailable(i);
        const label = done ? '✓ CONCLUÍDA' : open ? `FASE ${String(i + 1).padStart(2, '0')}` : '🔒 BLOQUEADA';
        const action = open ? (done ? 'Revisar →' : 'Jogar →') : 'Conclua a anterior';
        const classes = ['stage-card', done && 'done', this.highlight === i && 'just-unlocked'].filter(Boolean).join(' ');
        return html`<button type="button" class="${classes}" data-stage="${s.id}" ${open ? '' : html`disabled`}>
          <div class="card-top"><span class="stage-number">${label}</span><img src="${assetPath(s.image)}" alt="Ilustração de ${s.title}" loading="lazy"></div>
          <span class="eyebrow">${s.tag}</span><h3>${s.title}</h3><p>${s.description}</p>
          <div class="card-bottom"><span>${p.modesDone(s)} / 2 modalidades</span><span>${action}</span></div>
        </button>`;
      })}`
    );
    if (this.highlight !== null) {
      this.map.querySelector('.just-unlocked')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      this.highlight = null;
    }
  }
}
