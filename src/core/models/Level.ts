export interface VerticalWord {
  word: string;
  clue: string;
}

export interface HorizontalWord {
  word: string;
  clue: string;
  intersectionIndex: number;
  position: number;
}

export interface PointsConfig {
  base: number;
  timeBonus: number;
  hintPenalty: number;
}

export interface Level {
  id: string;
  theme: string;
  verticalWord: VerticalWord;
  horizontalWords: HorizontalWord[];
  difficulty: 'fácil' | 'médio' | 'difícil';
  timeLimit: number;
  points: PointsConfig;
}

export interface GameState {
  currentLevelId: string;
  score: number;
  hintsUsed: number;
  timeRemaining: number;
  completedLevels: string[];
}
