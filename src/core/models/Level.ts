export interface VerticalWord {
  /** Palavra formada pela primeira letra de cada palavra horizontal. Vazia = nível sem palavra vertical. */
  word: string;
  clue: string;
}

export interface HorizontalWord {
  word: string;
  clue: string;
  /** Coluna da grade onde a palavra começa (a letra dessa coluna compõe a palavra vertical). */
  intersectionIndex: number;
  /** Linha da grade (0, 1, 2...). */
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
