import { Level } from '../core/models/Level';

/** Textos da página fora do canvas: tempo, pontuação, dicas e palavra vertical. */
export class GameHud {
  private readonly timer = document.querySelector<HTMLElement>('.timer');
  private readonly score = document.querySelector<HTMLElement>('.score');
  private readonly hintButton = document.getElementById('hint-button');
  private readonly clue = document.querySelector<HTMLElement>('.clue-container');
  private readonly verticalSection = document.querySelector<HTMLElement>('.vertical-word-display');
  private readonly verticalWord = document.getElementById('vertical-word');
  private readonly verticalClue = document.getElementById('vertical-clue');

  public showLevel(level: Level): void {
    const hasVertical = level.verticalWord.word.trim().length > 0;
    if (this.verticalSection) this.verticalSection.hidden = !hasVertical;
    if (this.verticalClue) this.verticalClue.textContent = level.verticalWord.clue;
    this.setVerticalLetters(level.horizontalWords.map(() => ''));

    this.showClue(level.horizontalWords[0].clue);
    this.clue?.append(paragraph('Clique em uma célula e digite para preencher as palavras cruzadas.', 'instructions'));
  }

  public showClue(text: string): void {
    if (!this.clue) return;
    const p = paragraph(` ${text}`);
    const label = document.createElement('strong');
    label.textContent = 'Dica:';
    p.prepend(label);
    this.clue.replaceChildren(p);
  }

  public setTime(seconds: number): void {
    if (this.timer) this.timer.textContent = `Tempo: ${formatTime(seconds)}`;
  }

  public setScore(score: number): void {
    if (this.score) this.score.textContent = `Pontuação: ${score}`;
  }

  public setHintsUsed(count: number): void {
    if (this.hintButton) this.hintButton.textContent = `Usar Dica (${count})`;
  }

  /** Uma caixa por linha; letras vazias aparecem como caixa cinza. */
  public setVerticalLetters(letters: string[]): void {
    if (!this.verticalWord) return;
    this.verticalWord.replaceChildren(
      ...letters.map((letter, i) => {
        const span = document.createElement('span');
        span.className = letter ? 'letter filled' : 'letter empty';
        span.dataset.index = String(i);
        span.textContent = letter;
        return span;
      })
    );
  }
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function paragraph(text: string, className?: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  if (className) p.className = className;
  return p;
}
