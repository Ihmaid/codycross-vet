import * as PIXI from 'pixi.js';
import { CrosswordGrid } from '../ui/components/CrosswordGrid';
import { Level } from './models/Level';
import { GameManager } from './engine/GameManager';
import { GameStore } from './services/GameStore';

export class GameController {
  private app: PIXI.Application;
  private level: Level;
  private crosswordGrid: CrosswordGrid;
  private gameManager: GameManager;
  private container: HTMLElement;
  private clueElement: HTMLElement | null = null;
  private timerElement: HTMLElement | null = null;
  private scoreElement: HTMLElement | null = null;
  private hintButton: HTMLElement | null = null;
  private gameStore = GameStore.getInstance();

  constructor(container: HTMLElement, level: Level) {
    this.container = container;
    this.level = level;
    
    // Criar elementos da UI
    this.createUIElements();
    
    // Inicializar a aplicação PIXI
    this.app = new PIXI.Application({
      width: this.container.clientWidth,
      height: this.container.clientHeight - 150, // Espaço para UI
      backgroundColor: 0xf8f9fa,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });
    
    this.container.appendChild(this.app.view as HTMLCanvasElement);
    
    // Inicializar o gerenciador de jogo
    this.gameManager = new GameManager(
      level,
      this.updateTimer.bind(this),
      this.handleGameComplete.bind(this)
    );
    
    // Inicializar a grade de palavras cruzadas
    this.crosswordGrid = new CrosswordGrid(
      level,
      this.handleCellSelect.bind(this),
      this.handleLetterInput.bind(this)
    );
    
    this.app.stage.addChild(this.crosswordGrid.getContainer());
    
    // Configurar eventos de teclado
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    // Configurar redimensionamento
    window.addEventListener('resize', this.handleResize.bind(this));
    this.handleResize();
    
    // Iniciar o jogo
    this.startGame();
  }

  public startGame(): void {
    this.gameManager.startGame();
    this.gameStore.setLevel(this.level);
    this.gameStore.setGameActive(true);
    this.updateTimer(this.level.timeLimit);
    this.updateScore(0);
  }

  public pauseGame(): void {
    this.gameManager.pauseGame();
    this.gameStore.setGameActive(false);
  }

  public resumeGame(): void {
    this.gameManager.resumeGame();
    this.gameStore.setGameActive(true);
  }

  public useHint(): void {
    const selectedCell = this.gameStore.getSelectedCell();
    if (!selectedCell) return;
    
    const { row } = selectedCell;
    const word = this.gameManager.useHint(row);
    
    if (word) {
      const horizontalWord = this.level.horizontalWords.find(w => w.position === row);
      if (!horizontalWord) return;
      
      const wordStart = horizontalWord.intersectionIndex;
      
      // Preencher a palavra na grade
      for (let i = 0; i < word.length; i++) {
        const col = wordStart + i;
        const letter = word[i];
        
        this.crosswordGrid.setCellValue(row, col, letter);
        this.gameManager.setLetter(row, col, letter);
      }
      
      this.gameStore.incrementHintsUsed();
      this.updateHintsUsed();
    }
  }

  private createUIElements(): void {
    // Criar elemento para exibir a dica
    this.clueElement = document.createElement('div');
    this.clueElement.className = 'clue-container';
    this.clueElement.innerHTML = '<p>Selecione uma célula para ver a dica</p>';
    this.container.appendChild(this.clueElement);
    
    // Criar elemento para exibir o tempo
    this.timerElement = document.createElement('div');
    this.timerElement.className = 'timer';
    this.timerElement.innerHTML = 'Tempo: 00:00';
    this.container.appendChild(this.timerElement);
    
    // Criar elemento para exibir a pontuação
    this.scoreElement = document.createElement('div');
    this.scoreElement.className = 'score';
    this.scoreElement.innerHTML = 'Pontuação: 0';
    this.container.appendChild(this.scoreElement);
    
    // Criar botão de dica
    this.hintButton = document.createElement('button');
    this.hintButton.className = 'btn btn-hint';
    this.hintButton.innerHTML = 'Usar Dica';
    this.hintButton.addEventListener('click', () => this.useHint());
    this.container.appendChild(this.hintButton);
  }

  private handleCellSelect(row: number, col: number): void {
    this.gameStore.setSelectedCell(row, col);
    
    // Atualizar a dica exibida
    const horizontalWord = this.level.horizontalWords.find(word => word.position === row);
    if (horizontalWord && this.clueElement) {
      this.clueElement.innerHTML = `<p><strong>Dica:</strong> ${horizontalWord.clue}</p>`;
      this.gameStore.setSelectedClue(horizontalWord.clue);
    }
  }

  private handleLetterInput(row: number, col: number, letter: string): void {
    this.gameManager.setLetter(row, col, letter);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const selectedCell = this.gameStore.getSelectedCell();
    if (!selectedCell || !this.gameStore.isActive()) return;
    
    const { row, col } = selectedCell;
    
    if (/^[a-zA-Z]$/.test(event.key)) {
      // Entrada de letra
      this.crosswordGrid.inputLetter(event.key);
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      // Apagar letra
      this.crosswordGrid.setCellValue(row, col, '');
      this.gameManager.setLetter(row, col, '');
    } else if (event.key === 'ArrowRight') {
      // Mover para a direita
      const horizontalWord = this.level.horizontalWords.find(w => w.position === row);
      if (horizontalWord) {
        const wordStart = horizontalWord.intersectionIndex;
        const wordEnd = wordStart + horizontalWord.word.length - 1;
        
        if (col < wordEnd) {
          this.crosswordGrid.selectCell(row, col + 1);
        }
      }
    } else if (event.key === 'ArrowLeft') {
      // Mover para a esquerda
      const horizontalWord = this.level.horizontalWords.find(w => w.position === row);
      if (horizontalWord) {
        const wordStart = horizontalWord.intersectionIndex;
        
        if (col > wordStart) {
          this.crosswordGrid.selectCell(row, col - 1);
        }
      }
    } else if (event.key === 'ArrowDown') {
      // Mover para baixo
      if (row < this.level.horizontalWords.length - 1) {
        const nextWord = this.level.horizontalWords[row + 1];
        if (nextWord) {
          const isInRange = col >= nextWord.intersectionIndex && 
                           col < nextWord.intersectionIndex + nextWord.word.length;
          
          if (isInRange) {
            this.crosswordGrid.selectCell(row + 1, col);
          } else {
            this.crosswordGrid.selectCell(row + 1, nextWord.intersectionIndex);
          }
        }
      }
    } else if (event.key === 'ArrowUp') {
      // Mover para cima
      if (row > 0) {
        const prevWord = this.level.horizontalWords[row - 1];
        if (prevWord) {
          const isInRange = col >= prevWord.intersectionIndex && 
                           col < prevWord.intersectionIndex + prevWord.word.length;
          
          if (isInRange) {
            this.crosswordGrid.selectCell(row - 1, col);
          } else {
            this.crosswordGrid.selectCell(row - 1, prevWord.intersectionIndex);
          }
        }
      }
    }
  }

  private handleResize(): void {
    // Redimensionar a aplicação PIXI
    const width = this.container.clientWidth;
    const height = this.container.clientHeight - 150; // Espaço para UI
    
    this.app.renderer.resize(width, height);
    this.crosswordGrid.resize(width, height);
  }

  private updateTimer(timeRemaining: number): void {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    
    if (this.timerElement) {
      this.timerElement.innerHTML = `Tempo: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    this.gameStore.setTimeRemaining(timeRemaining);
  }

  private updateScore(score: number): void {
    if (this.scoreElement) {
      this.scoreElement.innerHTML = `Pontuação: ${score}`;
    }
    this.gameStore.setScore(score);
  }

  private updateHintsUsed(): void {
    const hintsUsed = this.gameStore.getHintsUsed();
    if (this.hintButton) {
      this.hintButton.innerHTML = `Usar Dica (${hintsUsed})`;
    }
  }

  private handleGameComplete(score: number, timeRemaining: number, hintsUsed: number): void {
    this.updateScore(score);
    this.gameStore.setGameComplete(true);
    this.gameStore.setGameActive(false);
    
    // Exibir mensagem de conclusão
    const message = document.createElement('div');
    message.className = 'game-complete-message';
    message.innerHTML = `
      <h2>Parabéns!</h2>
      <p>Você completou o nível!</p>
      <p>Pontuação: ${score}</p>
      <p>Tempo restante: ${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')}</p>
      <p>Dicas usadas: ${hintsUsed}</p>
      <button class="btn btn-primary">Jogar Novamente</button>
    `;
    
    message.querySelector('button')?.addEventListener('click', () => {
      this.container.removeChild(message);
      this.gameStore.resetGame();
      this.startGame();
    });
    
    this.container.appendChild(message);
  }
}
