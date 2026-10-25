import { Level } from '../core/models/Level';

const WARNING_SECONDS = 30;
const CRITICAL_SECONDS = 10;

/** Textos e efeitos da página fora do canvas: cabeçalho, nível, dicas, palavra-chave e avisos. */
export class GameHud {
  private readonly timer = byId('timer-value');
  private readonly timerChip = document.querySelector<HTMLElement>('.stat--timer');
  private readonly score = byId('score-value');
  private readonly scoreChip = document.querySelector<HTMLElement>('.stat--score');
  private readonly hintCount = byId('hint-count');
  private readonly levelLabel = byId('level-label');
  private readonly levelTheme = byId('level-theme');
  private readonly progressFill = byId('progress-fill');
  private readonly progressBar = byId('progress');
  private readonly progressText = byId('progress-text');
  private readonly clue = document.querySelector<HTMLElement>('.clue-container');
  private readonly verticalSection = document.querySelector<HTMLElement>('.vertical-word-display');
  private readonly verticalWord = byId('vertical-word');
  private readonly verticalClue = byId('vertical-clue');
  private readonly toastHost = byId('toast');
  private readonly boardCard = document.querySelector<HTMLElement>('.board-card');
  private verticalShown: string[] = [];
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Prepara a página para um nível (número, tema, palavra-chave e primeira dica). */
  public setLevel(index: number, total: number, level: Level): void {
    setText(this.levelLabel, `Nível ${index + 1}/${total}`);
    setText(this.levelTheme, level.theme);

    const hasVertical = level.verticalWord.word.trim().length > 0;
    if (this.verticalSection) this.verticalSection.hidden = !hasVertical;
    setText(this.verticalClue, level.verticalWord.clue);
    this.verticalShown = [];
    this.setVerticalLetters(level.horizontalWords.map(() => ''));

    this.showClue(level.horizontalWords[0].clue, 'Clique em uma célula e digite para preencher as palavras.');
    this.setProgress(0, level.horizontalWords.length);
  }

  /** Banner "Nível X" que aparece por cima da grade ao começar um nível. */
  public showLevelIntro(index: number, theme: string): void {
    if (!this.boardCard) return;
    this.boardCard.querySelector('.level-intro')?.remove();
    const intro = document.createElement('div');
    intro.className = 'level-intro';
    intro.setAttribute('aria-hidden', 'true');
    const title = document.createElement('strong');
    title.textContent = `Nível ${index + 1}`;
    const subtitle = document.createElement('span');
    subtitle.textContent = theme;
    intro.append(title, subtitle);
    intro.addEventListener('animationend', () => intro.remove());
    this.boardCard.append(intro);
  }

  public showClue(text: string, instructions?: string): void {
    if (!this.clue) return;
    const label = document.createElement('span');
    label.className = 'clue-label';
    label.textContent = 'Dica';
    const p = document.createElement('p');
    p.className = 'clue-text';
    p.textContent = text;
    this.clue.replaceChildren(label, p);
    if (instructions) {
      const hint = document.createElement('p');
      hint.className = 'instructions';
      hint.textContent = instructions;
      this.clue.append(hint);
    }
    restartAnimation(this.clue, 'is-updated');
  }

  public setTime(seconds: number): void {
    setText(this.timer, formatTime(seconds));
    this.timerChip?.classList.toggle('is-warning', seconds <= WARNING_SECONDS && seconds > CRITICAL_SECONDS);
    this.timerChip?.classList.toggle('is-critical', seconds <= CRITICAL_SECONDS);
  }

  public setScore(score: number): void {
    setText(this.score, String(score));
    if (score > 0 && this.scoreChip) restartAnimation(this.scoreChip, 'is-bumped');
  }

  public setHintsUsed(count: number): void {
    setText(this.hintCount, String(count));
  }

  public setProgress(solved: number, total: number): void {
    if (this.progressFill) this.progressFill.style.width = `${(solved / total) * 100}%`;
    this.progressBar?.setAttribute('aria-valuenow', String(solved));
    this.progressBar?.setAttribute('aria-valuemax', String(total));
    setText(this.progressText, `${solved}/${total} palavras`);
  }

  /** Uma caixa por linha; letras recém-reveladas giram ao aparecer. */
  public setVerticalLetters(letters: string[]): void {
    if (!this.verticalWord) return;
    this.verticalWord.replaceChildren(
      ...letters.map((letter, i) => {
        const span = document.createElement('span');
        span.className = letter ? 'letter filled' : 'letter empty';
        if (letter && !this.verticalShown[i]) span.classList.add('reveal');
        span.dataset.index = String(i);
        span.textContent = letter;
        return span;
      })
    );
    this.verticalShown = [...letters];
  }

  /** Aviso rápido no topo da grade (acertos e erros). */
  public toast(message: string, kind: 'success' | 'error'): void {
    if (!this.toastHost) return;
    this.toastHost.textContent = message;
    this.toastHost.className = `toast toast--${kind}`;
    restartAnimation(this.toastHost, 'is-visible');
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.toastHost?.classList.remove('is-visible'), 1600);
  }
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function setText(el: HTMLElement | null, text: string): void {
  if (el) el.textContent = text;
}

/** Reaplica uma classe de animação CSS mesmo que ela já esteja no elemento. */
function restartAnimation(el: HTMLElement, className: string): void {
  el.classList.remove(className);
  void el.offsetWidth; // força o navegador a "esquecer" a animação anterior
  el.classList.add(className);
}
