export interface GameConfig {
  width: number;
  height: number;
  backgroundColor: number;
  antialias: boolean;
  resolution: number;
  autoResize: boolean;
  initialLevel: string;
  debug: boolean;
}

// Configuração padrão do jogo
export const GameConfig: GameConfig = {
  width: 800,
  height: 600,
  backgroundColor: 0xf8f9fa,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoResize: true,
  initialLevel: 'level1',
  debug: false
};
