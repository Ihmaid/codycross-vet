import { Level } from '../models/Level';

export class WordValidator {
  private level: Level;
  private userAnswers: string[][] = [];
  private correctWords: boolean[] = [];
  private verticalWordCorrect: boolean = false;
  private onWordValidated: (row: number, isCorrect: boolean) => void;
  private onVerticalWordValidated: (isCorrect: boolean) => void;
  private onGameCompleted: () => void;

  constructor(
    level: Level,
    onWordValidated: (row: number, isCorrect: boolean) => void,
    onVerticalWordValidated: (isCorrect: boolean) => void,
    onGameCompleted: () => void
  ) {
    this.level = level;
    this.onWordValidated = onWordValidated;
    this.onVerticalWordValidated = onVerticalWordValidated;
    this.onGameCompleted = onGameCompleted;
    this.initializeArrays();
  }

  public setLetter(row: number, col: number, letter: string): void {
    if (!this.userAnswers[row]) {
      this.userAnswers[row] = [];
    }
    
    this.userAnswers[row][col] = letter.toUpperCase();
    
    // Validar a palavra horizontal
    this.validateHorizontalWord(row);
    
    // Validar a palavra vertical
    this.validateVerticalWord();
    
    // Verificar se o jogo foi completado
    this.checkGameCompletion();
  }

  public validateHorizontalWord(row: number): boolean {
    const horizontalWord = this.level.horizontalWords.find(word => word.position === row);
    if (!horizontalWord) return false;
    
    const wordStart = horizontalWord.intersectionIndex;
    const correctWord = horizontalWord.word.toUpperCase();
    
    let userWord = '';
    let isComplete = true;
    
    for (let i = 0; i < correctWord.length; i++) {
      const col = wordStart + i;
      const letter = this.getLetter(row, col);
      
      if (!letter) {
        isComplete = false;
      }
      
      userWord += letter || '';
    }
    
    if (isComplete) {
      const isCorrect = userWord === correctWord;
      this.correctWords[row] = isCorrect;
      this.onWordValidated(row, isCorrect);
      return isCorrect;
    }
    
    return false;
  }

  public validateVerticalWord(): boolean {
    const verticalWord = this.level.verticalWord.word.toUpperCase();
    let userVerticalWord = '';
    let isComplete = true;
    
    for (let i = 0; i < this.level.horizontalWords.length; i++) {
      const horizontalWord = this.level.horizontalWords[i];
      const intersectionCol = horizontalWord.intersectionIndex;
      const letter = this.getLetter(i, intersectionCol);
      
      if (!letter) {
        isComplete = false;
      }
      
      userVerticalWord += letter || '';
    }
    
    if (isComplete) {
      const isCorrect = userVerticalWord === verticalWord;
      this.verticalWordCorrect = isCorrect;
      this.onVerticalWordValidated(isCorrect);
      return isCorrect;
    }
    
    return false;
  }

  public getLetter(row: number, col: number): string {
    if (!this.userAnswers[row]) return '';
    return this.userAnswers[row][col] || '';
  }

  public isWordCorrect(row: number): boolean {
    return this.correctWords[row] || false;
  }

  public isVerticalWordCorrect(): boolean {
    return this.verticalWordCorrect;
  }

  public getVerticalWordProgress(): { word: string, complete: boolean } {
    const verticalWord = this.level.verticalWord.word.toUpperCase();
    let userVerticalWord = '';
    let complete = true;
    
    for (let i = 0; i < this.level.horizontalWords.length; i++) {
      const horizontalWord = this.level.horizontalWords[i];
      const intersectionCol = horizontalWord.intersectionIndex;
      const letter = this.getLetter(i, intersectionCol);
      
      if (!letter) {
        complete = false;
        userVerticalWord += ' ';
      } else {
        userVerticalWord += letter;
      }
    }
    
    return { word: userVerticalWord, complete };
  }

  public reset(): void {
    this.initializeArrays();
  }

  private initializeArrays(): void {
    this.userAnswers = [];
    this.correctWords = [];
    
    for (let i = 0; i < this.level.horizontalWords.length; i++) {
      this.userAnswers[i] = [];
      this.correctWords[i] = false;
    }
    
    this.verticalWordCorrect = false;
  }

  private checkGameCompletion(): void {
    // Verificar se todas as palavras horizontais estão corretas
    for (let i = 0; i < this.level.horizontalWords.length; i++) {
      if (!this.correctWords[i]) {
        return;
      }
    }
    
    // Verificar se a palavra vertical está correta
    if (!this.verticalWordCorrect) {
      return;
    }
    
    // Se chegou aqui, o jogo foi completado
    this.onGameCompleted();
  }
}
