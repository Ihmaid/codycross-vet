export interface GameState {
  currentLevelId: string;
  score: number;
  hintsUsed: number;
  timeRemaining: number;
  completedLevels: string[];
}
