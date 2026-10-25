import { Level } from '../models/Level';

/**
 * Estado das respostas do jogador. Lógica pura (sem DOM/PIXI): diz quais linhas estão
 * resolvidas e se o nível foi concluído.
 */
export class WordValidator {
  private readonly level: Level;
  private answers: string[][] = [];
  private solved: boolean[] = [];

  constructor(level: Level) {
    this.level = level;
    this.reset();
  }

  public reset(): void {
    this.answers = this.level.horizontalWords.map(() => []);
    this.solved = this.level.horizontalWords.map(() => false);
  }

  /** Define a letra de uma célula. Retorna true se essa jogada acabou de resolver a linha. */
  public setLetter(row: number, col: number, letter: string): boolean {
    const word = this.level.horizontalWords[row];
    if (!word || this.solved[row] || !this.isInWord(row, col)) return false;

    this.answers[row][col] = letter.toUpperCase();
    this.solved[row] = this.readRow(row) === word.word.toUpperCase();
    return this.solved[row];
  }

  public getLetter(row: number, col: number): string {
    return this.answers[row]?.[col] ?? '';
  }

  public isRowSolved(row: number): boolean {
    return this.solved[row] ?? false;
  }

  /** Células (colunas) ocupadas pela palavra da linha. */
  public isInWord(row: number, col: number): boolean {
    const word = this.level.horizontalWords[row];
    return !!word && col >= word.intersectionIndex && col < word.intersectionIndex + word.word.length;
  }

  public hasVerticalWord(): boolean {
    return this.level.verticalWord.word.trim().length > 0;
  }

  /** Letras da palavra vertical já reveladas (linhas resolvidas); '' nas demais. */
  public getVerticalLetters(): string[] {
    return this.level.horizontalWords.map((w, row) =>
      this.solved[row] ? this.getLetter(row, w.intersectionIndex) : ''
    );
  }

  public isLevelComplete(): boolean {
    if (!this.solved.every(Boolean)) return false;
    if (!this.hasVerticalWord()) return true;
    return this.getVerticalLetters().join('') === this.level.verticalWord.word.toUpperCase();
  }

  private readRow(row: number): string {
    const { word, intersectionIndex } = this.level.horizontalWords[row];
    let result = '';
    for (let i = 0; i < word.length; i++) result += this.getLetter(row, intersectionIndex + i) || ' ';
    return result;
  }
}
