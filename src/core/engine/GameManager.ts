import { Level } from '../models/Level';

export class GameManager {
  private level: Level;
  private userAnswers: string[][] = [];
  private hintsUsed: number = 0;
  private startTime: number = 0;
  private timeRemaining: number = 0;
  private timerInterval: NodeJS.Timeout | null = null;
  private onTimeUpdate: (timeRemaining: number) => void;
  private onGameComplete: (score: number, timeRemaining: number, hintsUsed: number) => void;

  constructor(
    level: Level,
    onTimeUpdate: (timeRemaining: number) => void,
    onGameComplete: (score: number, timeRemaining: number, hintsUsed: number) => void
  ) {
    this.level = level;
    this.onTimeUpdate = onTimeUpdate;
    this.onGameComplete = onGameComplete;
    this.timeRemaining = level.timeLimit;
    this.initializeUserAnswers();
  }

  public startGame(): void {
    this.startTime = Date.now();
    this.startTimer();
  }

  public pauseGame(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public resumeGame(): void {
    if (!this.timerInterval) {
      this.startTimer();
    }
  }

  public setLetter(row: number, col: number, letter: string): void {
    if (!this.userAnswers[row]) {
      this.userAnswers[row] = [];
    }
    this.userAnswers[row][col] = letter.toUpperCase();
    
    // Verificar se o jogo foi completado
    if (this.checkGameCompletion()) {
      this.pauseGame();
      const score = this.calculateScore();
      this.onGameComplete(score, this.timeRemaining, this.hintsUsed);
    }
  }

  public getLetter(row: number, col: number): string {
    if (!this.userAnswers[row]) return '';
    return this.userAnswers[row][col] || '';
  }

  public useHint(row: number): string {
    const horizontalWord = this.level.horizontalWords.find(word => word.position === row);
    if (!horizontalWord) return '';
    
    this.hintsUsed++;
    return horizontalWord.word;
  }

  public checkWordCorrectness(row: number): boolean {
    const horizontalWord = this.level.horizontalWords.find(word => word.position === row);
    if (!horizontalWord) return false;
    
    const wordStart = horizontalWord.intersectionIndex;
    const correctWord = horizontalWord.word.toUpperCase();
    
    let userWord = '';
    for (let i = 0; i < correctWord.length; i++) {
      const col = wordStart + i;
      userWord += this.getLetter(row, col);
    }
    
    return userWord === correctWord;
  }

  public getVerticalWordProgress(): { word: string, complete: boolean } {
    const verticalWord = this.level.verticalWord.word.toUpperCase();
    let userVerticalWord = '';
    let complete = true;
    
    for (let i = 0; i < verticalWord.length; i++) {
      const horizontalWord = this.level.horizontalWords.find(word => word.position === i);
      if (!horizontalWord) {
        complete = false;
        userVerticalWord += ' ';
        continue;
      }
      
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

  public calculateScore(): number {
    const { base, timeBonus, hintPenalty } = this.level.points;
    
    // Pontuação base + bônus de tempo - penalidade por dicas
    let score = base + (this.timeRemaining * timeBonus) - (this.hintsUsed * hintPenalty);
    
    // Garantir que a pontuação não seja negativa
    return Math.max(0, score);
  }

  private initializeUserAnswers(): void {
    this.userAnswers = [];
    for (let i = 0; i < this.level.horizontalWords.length; i++) {
      this.userAnswers[i] = [];
    }
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      if (this.timeRemaining > 0) {
        this.timeRemaining--;
        this.onTimeUpdate(this.timeRemaining);
      } else {
        // Tempo esgotado
        this.pauseGame();
        const score = this.calculateScore();
        this.onGameComplete(score, 0, this.hintsUsed);
      }
    }, 1000);
  }

  private checkGameCompletion(): boolean {
    // Verificar se todas as palavras horizontais estão corretas
    for (let i = 0; i < this.level.horizontalWords.length; i++) {
      if (!this.checkWordCorrectness(i)) {
        return false;
      }
    }
    
    // Verificar se a palavra vertical está completa
    const { complete } = this.getVerticalWordProgress();
    return complete;
  }
}
