import { Level } from '../models/Level';

export class GameStore {
  private level: Level | null = null;
  private score: number = 0;
  private hintsUsed: number = 0;
  private timeRemaining: number = 0;
  private isGameActive: boolean = false;
  private isGameComplete: boolean = false;
  private selectedCell: { row: number, col: number } | null = null;
  private selectedClue: string = '';
  
  // Singleton pattern
  private static instance: GameStore;
  
  private constructor() {}
  
  public static getInstance(): GameStore {
    if (!GameStore.instance) {
      GameStore.instance = new GameStore();
    }
    return GameStore.instance;
  }
  
  // Getters
  public getLevel(): Level | null {
    return this.level;
  }
  
  public getScore(): number {
    return this.score;
  }
  
  public getHintsUsed(): number {
    return this.hintsUsed;
  }
  
  public getTimeRemaining(): number {
    return this.timeRemaining;
  }
  
  public isActive(): boolean {
    return this.isGameActive;
  }
  
  public isComplete(): boolean {
    return this.isGameComplete;
  }
  
  public getSelectedCell(): { row: number, col: number } | null {
    return this.selectedCell;
  }
  
  public getSelectedClue(): string {
    return this.selectedClue;
  }
  
  // Setters
  public setLevel(level: Level): void {
    this.level = level;
    this.timeRemaining = level.timeLimit;
    this.isGameActive = false;
    this.isGameComplete = false;
    this.score = 0;
    this.hintsUsed = 0;
    this.selectedCell = null;
    this.selectedClue = '';
  }
  
  public setScore(score: number): void {
    this.score = score;
  }
  
  public incrementHintsUsed(): void {
    this.hintsUsed++;
  }
  
  public setTimeRemaining(time: number): void {
    this.timeRemaining = time;
  }
  
  public setGameActive(active: boolean): void {
    this.isGameActive = active;
  }
  
  public setGameComplete(complete: boolean): void {
    this.isGameComplete = complete;
  }
  
  public setSelectedCell(row: number, col: number | null): void {
    this.selectedCell = col !== null ? { row, col } : null;
  }
  
  public setSelectedClue(clue: string): void {
    this.selectedClue = clue;
  }
  
  public resetGame(): void {
    if (!this.level) return;
    
    this.isGameActive = false;
    this.isGameComplete = false;
    this.score = 0;
    this.hintsUsed = 0;
    this.timeRemaining = this.level.timeLimit;
    this.selectedCell = null;
    this.selectedClue = '';
  }
  
  // Estado completo para compatibilidade com código existente
  public getState(): any {
    return {
      currentLevel: this.level,
      score: this.score,
      hintsUsed: this.hintsUsed,
      timeRemaining: this.timeRemaining,
      isGameActive: this.isGameActive,
      isGameComplete: this.isGameComplete,
      selectedCell: this.selectedCell,
      selectedClue: this.selectedClue
    };
  }
  
  // Método para atualizar múltiplos estados de uma vez
  public setState(state: Partial<{
    currentLevel: Level,
    score: number,
    hintsUsed: number,
    timeRemaining: number,
    isGameActive: boolean,
    isGameComplete: boolean,
    selectedCell: { row: number, col: number } | null,
    selectedClue: string
  }>): void {
    if (state.currentLevel) this.level = state.currentLevel;
    if (state.score !== undefined) this.score = state.score;
    if (state.hintsUsed !== undefined) this.hintsUsed = state.hintsUsed;
    if (state.timeRemaining !== undefined) this.timeRemaining = state.timeRemaining;
    if (state.isGameActive !== undefined) this.isGameActive = state.isGameActive;
    if (state.isGameComplete !== undefined) this.isGameComplete = state.isGameComplete;
    if (state.selectedCell !== undefined) this.selectedCell = state.selectedCell;
    if (state.selectedClue !== undefined) this.selectedClue = state.selectedClue;
  }
}
