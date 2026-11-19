import { STAGES } from '../core/content';
import { Progress } from '../core/progress';
import { $ } from './dom';
import { navigate } from './router';

/** Capa: apresenta o projeto e leva às partes do site. O botão principal abre a próxima fase. */
export class CoverView {
  constructor(private readonly progress: Progress) {
    $('continue-btn').addEventListener('click', () => {
      navigate({ view: 'stage', id: STAGES[this.progress.nextStageIndex()].id, mode: 'cross' });
    });
  }

  render(): void {
    const finished = this.progress.finishedCount();
    const next = this.progress.nextStageIndex();
    $('continue-btn').textContent = finished === 0 ? 'Começar' : `Continuar na fase ${next + 1}, ${STAGES[next].title}`;
  }
}
