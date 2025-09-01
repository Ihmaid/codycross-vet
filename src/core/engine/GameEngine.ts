import * as PIXI from 'pixi.js';
import { Level } from '../models/Level';
import { CrosswordRenderer } from './CrosswordRenderer';
import { WordValidator } from './WordValidator';
import { GameStore } from '../services/GameStore';

type EngineOptions = {
  onComplete?: () => void;      // called when the level is fully solved
  autoAdvanceDelayMs?: number;  // optional delay before auto-calling onComplete
};

export class GameEngine {
  private app: PIXI.Application;
  private level: Level;
  private renderer: CrosswordRenderer;
  private validator: WordValidator;
  private container: HTMLElement;
  private timerInterval: NodeJS.Timeout | null = null;
  private gameStore = GameStore.getInstance();
  private hintsUsed: number = 0;
  private isGameComplete: boolean = false;
  private onComplete?: () => void;
  private autoAdvanceDelayMs = 0;
  private boundKeyDown = this.handleKeyDown.bind(this);
  private boundResize = this.handleResize.bind(this);

constructor(container: HTMLElement, level: Level, opts?: EngineOptions) {
  console.log("Inicializando GameEngine");
  this.container = container;
  this.level = level;

  // NEW: options
  this.onComplete = opts?.onComplete;
  this.autoAdvanceDelayMs = opts?.autoAdvanceDelayMs ?? 1000; // 1s by default

  console.log("Criando aplicação PIXI");
  this.app = new PIXI.Application({
    width: this.container.clientWidth || 800,
    height: this.container.clientHeight || 600,
    backgroundColor: 0xf8f9fa,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
  });

  console.log(`Dimensões do container: ${this.container.clientWidth}x${this.container.clientHeight}`);
  console.log(`Dimensões da aplicação PIXI: ${this.app.screen.width}x${this.app.screen.height}`);

  console.log("Anexando canvas ao container");
  this.container.appendChild(this.app.view as HTMLCanvasElement);

  console.log("Inicializando renderer");
  this.renderer = new CrosswordRenderer(
    this.app,
    level,
    this.handleCellSelect.bind(this),
    this.handleWordComplete.bind(this)
  );

  console.log("Inicializando validador");
  this.validator = new WordValidator(
    level,
    this.handleWordValidated.bind(this),
    this.handleVerticalWordValidated.bind(this),
    this.handleGameCompleted.bind(this)
  );

  console.log("Configurando eventos de teclado");
  // USE STORED BOUND HANDLERS (so we can remove later)
  window.addEventListener('keydown', this.boundKeyDown);

  console.log("Configurando redimensionamento");
  window.addEventListener('resize', this.boundResize);
  this.handleResize();

  console.log("Inicializando estado do jogo");
  this.gameStore.setState({
    currentLevel: level,
    timeRemaining: level.timeLimit,
    isGameActive: false,
    isGameComplete: false,
    selectedCell: null,
    selectedClue: ''
  });

  console.log("GameEngine inicializado com sucesso");
}

  public startGame(): void {
    console.log("Iniciando jogo");
    // Resetar o estado do jogo
    this.validator.reset();
    this.renderer.clearHighlights();
    this.hintsUsed = 0;
    this.isGameComplete = false;
    
    // Atualizar o estado global
    this.gameStore.setState({
      timeRemaining: this.level.timeLimit,
      isGameActive: true,
      isGameComplete: false,
      score: 0,
      hintsUsed: 0
    });
    
    // Iniciar o temporizador
    this.startTimer();
    
    // Atualizar a UI
    this.updateTimerDisplay();
    this.updateScoreDisplay();
    this.updateHintButton();
    
    console.log("Jogo iniciado com sucesso");
  }

  public pauseGame(): void {
    console.log("Pausando jogo");
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    this.gameStore.setState({ isGameActive: false });
  }

  public resumeGame(): void {
    console.log("Retomando jogo");
    if (!this.timerInterval && !this.isGameComplete) {
      this.startTimer();
      this.gameStore.setState({ isGameActive: true });
    }
  }

  public useHint(): void {
    console.log("Usando dica");
    const selectedCell = this.gameStore.getState().selectedCell;
    if (!selectedCell) {
      console.log("Nenhuma célula selecionada para usar dica");
      
      // Se nenhuma célula estiver selecionada, selecionar a primeira célula da primeira palavra
      if (this.level.horizontalWords.length > 0) {
        const firstWord = this.level.horizontalWords[0];
        const row = firstWord.position;
        const col = firstWord.intersectionIndex;
        
        console.log(`Selecionando primeira célula disponível: ${row}, ${col}`);
        this.renderer.selectCell(row, col);
        return;
      }
      return;
    }
    
    const { row } = selectedCell;
    const horizontalWord = this.level.horizontalWords.find(w => w.position === row);
    if (!horizontalWord) {
      console.log(`Nenhuma palavra horizontal encontrada na linha ${row}`);
      return;
    }
    
    // Incrementar contador de dicas
    this.hintsUsed++;
    this.gameStore.setState({ hintsUsed: this.hintsUsed });
    
    // Preencher a palavra na grade
    const word = horizontalWord.word.toUpperCase();
    const wordStart = horizontalWord.intersectionIndex;
    
    console.log(`Preenchendo palavra "${word}" na linha ${row}`);
    
    for (let i = 0; i < word.length; i++) {
      const col = wordStart + i;
      const letter = word[i];
      
      this.renderer.setCellValue(row, col, letter);
      this.validator.setLetter(row, col, letter);
    }
    
    // Atualizar a UI
    this.updateHintButton();
    
    // Validar a palavra
    this.validator.validateHorizontalWord(row);
  }

  public resize(width: number, height: number): void {
    console.log(`Redimensionando para ${width}x${height}`);
    this.app.renderer.resize(width, height);
    this.renderer.resize(width, height);
  }

  private handleCellSelect(row: number, col: number): void {
    console.log(`Célula selecionada: ${row}, ${col}`);
    if (!this.gameStore.getState().isGameActive) {
      console.log("Jogo não está ativo, ativando...");
      this.gameStore.setState({ isGameActive: true });
    }
    
    this.gameStore.setState({ selectedCell: { row, col } });
    
    // Atualizar a dica exibida
    const horizontalWord = this.level.horizontalWords.find(word => word.position === row);
    if (horizontalWord) {
      const clueElement = document.querySelector('.clue-container');
      if (clueElement) {
        clueElement.innerHTML = `<p><strong>Dica:</strong> ${horizontalWord.clue}</p>`;
        console.log(`Dica atualizada: ${horizontalWord.clue}`);
      } else {
        console.error("Elemento de dica não encontrado no DOM");
      }
      
      this.gameStore.setState({ selectedClue: horizontalWord.clue });
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    console.log(`Tecla pressionada: ${event.key}`);
    const selectedCell = this.gameStore.getState().selectedCell;
    if (!selectedCell) {
      console.log("Nenhuma célula selecionada para processar entrada de teclado");
      return;
    }
    
    // Se o jogo não estiver ativo, ativá-lo
    if (!this.gameStore.getState().isGameActive) {
      console.log("Jogo não está ativo, ativando...");
      this.gameStore.setState({ isGameActive: true });
    }
    
    const { row, col } = selectedCell;
    
    if (/^[a-zA-Z]$/.test(event.key)) {
      // Entrada de letra
      console.log(`Inserindo letra: ${event.key.toUpperCase()}`);
      this.renderer.setCellValue(row, col, event.key);
      this.validator.setLetter(row, col, event.key);
      
      // Avançar para a próxima célula
      const horizontalWord = this.level.horizontalWords.find(w => w.position === row);
      if (horizontalWord) {
        const wordStart = horizontalWord.intersectionIndex;
        const wordEnd = wordStart + horizontalWord.word.length - 1;
        
        if (col < wordEnd) {
          this.renderer.selectCell(row, col + 1);
        }
      }
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      // Apagar letra
      console.log(`Apagando letra na célula ${row}, ${col}`);
      this.renderer.setCellValue(row, col, '');
      this.validator.setLetter(row, col, '');
    } else if (event.key === 'ArrowRight') {
      // Mover para a direita
      const horizontalWord = this.level.horizontalWords.find(w => w.position === row);
      if (horizontalWord) {
        const wordStart = horizontalWord.intersectionIndex;
        const wordEnd = wordStart + horizontalWord.word.length - 1;
        
        if (col < wordEnd) {
          this.renderer.selectCell(row, col + 1);
        }
      }
    } else if (event.key === 'ArrowLeft') {
      // Mover para a esquerda
      const horizontalWord = this.level.horizontalWords.find(w => w.position === row);
      if (horizontalWord) {
        const wordStart = horizontalWord.intersectionIndex;
        
        if (col > wordStart) {
          this.renderer.selectCell(row, col - 1);
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
            this.renderer.selectCell(row + 1, col);
          } else {
            this.renderer.selectCell(row + 1, nextWord.intersectionIndex);
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
            this.renderer.selectCell(row - 1, col);
          } else {
            this.renderer.selectCell(row - 1, prevWord.intersectionIndex);
          }
        }
      }
    }
  }

  private handleWordComplete(row: number, isCorrect: boolean): void {
    // Este método é chamado pelo renderer quando uma palavra é completada
    console.log(`Palavra na linha ${row} completada, correta: ${isCorrect}`);
    // A validação real é feita pelo validator
  }

  private handleWordValidated(row: number, isCorrect: boolean): void {
    console.log(`Palavra na linha ${row} validada, correta: ${isCorrect}`);
    if (isCorrect) {
      this.renderer.highlightWord(row, true);
      
      // Atualizar a exibição da palavra vertical
      this.updateVerticalWordDisplay();
    }
  }

  private handleVerticalWordValidated(isCorrect: boolean): void {
    console.log(`Palavra vertical validada, correta: ${isCorrect}`);
    if (isCorrect) {
      this.renderer.highlightVerticalWord(true);
      
      // Atualizar a exibição da palavra vertical
      this.updateVerticalWordDisplay();
    }
  }

  private handleGameCompleted(): void {
    console.log("Jogo completado!");
    this.isGameComplete = true;
    this.pauseGame();

    // Calcular pontuação
    const timeRemaining = this.gameStore.getState().timeRemaining;
    const score = this.calculateScore(timeRemaining);

    // Atualizar estado
    this.gameStore.setState({
      isGameComplete: true,
      score: score
    });

    // Atualizar UI
    this.updateScoreDisplay();

    // Exibir mensagem de conclusão com botão "Próximo nível"
    this.showGameCompleteMessage(score, timeRemaining);

    // Auto-advance (optional delay)
    if (this.onComplete && this.autoAdvanceDelayMs >= 0) {
      setTimeout(() => {
        // If message still present, remove it to avoid stacking
        const msg = this.container.querySelector('.game-complete-message');
        msg?.parentElement?.removeChild(msg);
        this.onComplete?.();
      }, this.autoAdvanceDelayMs);
    }
  }

  private handleResize(): void {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    
    console.log(`Redimensionando para ${width}x${height}`);
    this.resize(width, height);
  }

  private startTimer(): void {
    console.log("Iniciando temporizador");
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    this.timerInterval = setInterval(() => {
      const currentTime = this.gameStore.getState().timeRemaining;
      
      if (currentTime > 0) {
        const newTime = currentTime - 1;
        this.gameStore.setState({ timeRemaining: newTime });
        this.updateTimerDisplay();
      } else {
        // Tempo esgotado
        console.log("Tempo esgotado!");
        this.pauseGame();
        this.showTimeUpMessage();
      }
    }, 1000);
  }

  private updateTimerDisplay(): void {
    const timeRemaining = this.gameStore.getState().timeRemaining;
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    
    const timerElement = document.querySelector('.timer');
    if (timerElement) {
      timerElement.textContent = `Tempo: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      console.error("Elemento de temporizador não encontrado no DOM");
    }
  }

  private updateScoreDisplay(): void {
    const score = this.gameStore.getState().score;
    
    const scoreElement = document.querySelector('.score');
    if (scoreElement) {
      scoreElement.textContent = `Pontuação: ${score}`;
    } else {
      console.error("Elemento de pontuação não encontrado no DOM");
    }
  }

  private updateHintButton(): void {
    const hintButton = document.getElementById('hint-button');
    if (hintButton) {
      hintButton.textContent = `Usar Dica (${this.hintsUsed})`;
    } else {
      console.error("Botão de dica não encontrado no DOM");
    }
  }

  private updateVerticalWordDisplay(): void {
    const { word } = this.validator.getVerticalWordProgress();
    const verticalWordElement = document.getElementById('vertical-word');
    
    if (!verticalWordElement) {
      console.error("Elemento vertical-word não encontrado no DOM");
      return;
    }
    
    let html = '';
    for (let i = 0; i < word.length; i++) {
      const letter = word[i];
      const className = letter !== ' ' ? 'letter filled' : 'letter empty';
      html += `<span class="${className}" data-index="${i}">${letter !== ' ' ? letter : ''}</span>`;
    }
    
    verticalWordElement.innerHTML = html;
    console.log(`Exibição da palavra vertical atualizada: ${word}`);
  }

  private calculateScore(timeRemaining: number): number {
    const { base, timeBonus, hintPenalty } = this.level.points;
    
    // Pontuação base + bônus de tempo - penalidade por dicas
    let score = base + (timeRemaining * timeBonus) - (this.hintsUsed * hintPenalty);
    
    // Garantir que a pontuação não seja negativa
    return Math.max(0, score);
  }

  private showGameCompleteMessage(score: number, timeRemaining: number): void {
    console.log("Exibindo mensagem de conclusão do jogo");
    const message = document.createElement('div');
    message.className = 'game-complete-message';
    message.innerHTML = `
      <h2>Parabéns!</h2>
      <p>Você completou o nível!</p>
      <p>Pontuação: ${score}</p>
      <p>Tempo restante: ${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')}</p>
      <p>Dicas usadas: ${this.hintsUsed}</p>
      <div style="display:flex; gap:8px; justify-content:center; margin-top:12px;">
        <button id="btn-replay" class="btn btn-primary">Jogar Novamente</button>
        <button id="btn-next" class="btn btn-hint">Próximo Nível ▶</button>
      </div>
    `;

    message.querySelector('#btn-replay')?.addEventListener('click', () => {
      this.container.removeChild(message);
      this.startGame();
    });

    message.querySelector('#btn-next')?.addEventListener('click', () => {
      // Cancel auto-advance and go immediately
      this.onComplete?.();
      // remove the popup if still present
      if (message.parentElement) this.container.removeChild(message);
    });

    this.container.appendChild(message);
  }

  private showTimeUpMessage(): void {
    console.log("Exibindo mensagem de tempo esgotado");
    const message = document.createElement('div');
    message.className = 'game-complete-message';
    message.innerHTML = `
      <h2>Tempo Esgotado!</h2>
      <p>Infelizmente o tempo acabou.</p>
      <p>Pontuação: 0</p>
      <button class="btn btn-primary">Tentar Novamente</button>
    `;
    
    message.querySelector('button')?.addEventListener('click', () => {
      this.container.removeChild(message);
      this.startGame();
    });
    
    this.container.appendChild(message);
  }

  public destroy(): void {
  try {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('resize', this.boundResize);

    // Remove any overlay messages we created
    const messages = this.container.querySelectorAll('.game-complete-message');
    messages.forEach((n) => n.parentElement?.removeChild(n));

    // Remove PIXI canvas
    if (this.app?.view) {
      const viewEl = this.app.view as unknown as Element; // canvas element
      if (this.container.contains(viewEl)) {
        this.container.removeChild(viewEl);
      }
    }
    // Destroy PIXI application
    this.app?.destroy(true, { children: true, texture: true, baseTexture: true } as any);
  } catch (e) {
    console.warn('GameEngine destroy() warning:', e);
  }
}
}
