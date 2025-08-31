import * as PIXI from 'pixi.js';
import { Level } from '../models/Level';
import { GameState } from '../models/GameState';
import { LevelService } from '../services/LevelService';
import { ScoreService } from '../services/ScoreService';
import { GameConfig } from '../../config/GameConfig';

export class Game {
  private app: PIXI.Application;
  private currentLevel: Level | null = null;
  private gameState: GameState;
  private levelService: LevelService;
  private scoreService: ScoreService;

  constructor(private config: GameConfig) {
    // Inicializar a aplicação PIXI
    this.app = new PIXI.Application({
      width: config.width,
      height: config.height,
      backgroundColor: config.backgroundColor,
      antialias: config.antialias,
      resolution: config.resolution,
      autoDensity: true
    });

    // Inicializar serviços
    this.levelService = new LevelService();
    this.scoreService = new ScoreService();
    
    // Inicializar estado do jogo
    this.gameState = {
      currentLevelId: config.initialLevel,
      score: 0,
      hintsUsed: 0,
      timeRemaining: 0,
      completedLevels: []
    };

    // Configurar redimensionamento responsivo
    if (config.autoResize) {
      window.addEventListener('resize', this.resize.bind(this));
    }
  }

  public async start(): Promise<void> {
    // Adicionar o canvas ao DOM
    document.getElementById('app')?.appendChild(this.app.view as HTMLCanvasElement);
    
    // Configurar tamanho inicial
    this.resize();
    
    // Carregar o nível inicial
    try {
      this.currentLevel = await this.levelService.loadLevel(this.gameState.currentLevelId);
      this.initLevel();
    } catch (error) {
      console.error('Erro ao carregar o nível:', error);
    }
  }

  private initLevel(): void {
    if (!this.currentLevel) return;
    
    // Configurar tempo restante
    this.gameState.timeRemaining = this.currentLevel.timeLimit;
    
    // Inicializar a interface do nível
    // Implementação a ser adicionada
    
    // Iniciar o temporizador
    // Implementação a ser adicionada
  }

  private resize(): void {
    const parent = this.app.view.parentNode as HTMLElement;
    if (!parent) return;
    
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    
    this.app.renderer.resize(width, height);
    
    // Redimensionar elementos do jogo
    // Implementação a ser adicionada
  }
}
