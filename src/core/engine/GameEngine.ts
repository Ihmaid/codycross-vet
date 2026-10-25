import * as PIXI from 'pixi.js';
import { Level } from '../models/Level';
import { CrosswordRenderer } from './CrosswordRenderer';
import { WordValidator } from './WordValidator';
import { CountdownTimer } from './CountdownTimer';
import { calculateScore, calculateStars } from '../scoring';
import { normalizeLetter } from '../input';
import { GameHud, formatTime } from '../../ui/GameHud';
import { DialogAction, showDialog } from '../../ui/Dialog';

export type GameEngineOptions = {
  /** Chamado para avançar ao próximo nível (automaticamente ou pelo botão). */
  onComplete?: () => void;
  /** Espera (a partir da conclusão) antes de avançar sozinho. Negativo = não avança sozinho. */
  autoAdvanceDelayMs?: number;
};

type Status = 'playing' | 'complete' | 'timeup';

/** Tempo da comemoração na grade antes do pop-up aparecer. */
const CELEBRATION_MS = 700;
const SUCCESS_MESSAGES = ['Acertou!', 'Muito bem!', 'Mandou bem!', 'Excelente!', 'Isso aí!'];

/** Regras de uma partida: liga o teclado, a grade (renderer), as respostas (validator) e o HUD. */
export class GameEngine {
  private readonly app: PIXI.Application;
  private readonly renderer: CrosswordRenderer;
  private readonly validator: WordValidator;
  private readonly timer: CountdownTimer;
  private readonly onComplete?: () => void;
  private readonly autoAdvanceDelayMs: number;
  private status: Status = 'playing';
  private hintsUsed = 0;
  private overlay: HTMLElement | null = null;
  private pending: ReturnType<typeof setTimeout>[] = [];
  private readonly handleKeyDown = (event: KeyboardEvent) => this.onKeyDown(event);
  private readonly handleResize = () => this.resize();

  constructor(
    private readonly container: HTMLElement,
    private readonly level: Level,
    private readonly hud: GameHud,
    options: GameEngineOptions = {}
  ) {
    this.onComplete = options.onComplete;
    this.autoAdvanceDelayMs = options.autoAdvanceDelayMs ?? 3000;

    this.app = new PIXI.Application({
      width: container.clientWidth || 800,
      height: container.clientHeight || 600,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    container.appendChild(this.app.view as HTMLCanvasElement);

    this.renderer = new CrosswordRenderer(this.app, level, (row) => this.onCellSelect(row));
    this.validator = new WordValidator(level);
    this.timer = new CountdownTimer(
      (seconds) => this.hud.setTime(seconds),
      () => this.onTimeUp()
    );

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('resize', this.handleResize);
    this.resize();
  }

  /** Começa (ou recomeça do zero) o nível. */
  public startGame(): void {
    this.cancelPending();
    this.closeOverlay();
    this.validator.reset();
    this.renderer.reset();
    this.hintsUsed = 0;
    this.status = 'playing';

    this.hud.setScore(0);
    this.hud.setHintsUsed(0);
    this.hud.setProgress(0, this.level.horizontalWords.length);
    this.hud.setVerticalLetters(this.validator.getVerticalLetters());
    this.timer.start(this.level.timeLimit);
  }

  /** Revela a palavra da linha selecionada (ou seleciona a primeira palavra ainda não resolvida). */
  public useHint(): void {
    if (this.status !== 'playing') return;

    const selected = this.renderer.getSelectedCell();
    if (!selected) {
      const row = this.level.horizontalWords.findIndex((_, r) => !this.validator.isRowSolved(r));
      if (row >= 0) this.renderer.selectCell(row, this.level.horizontalWords[row].intersectionIndex);
      return;
    }
    if (this.validator.isRowSolved(selected.row)) return;

    this.hintsUsed++;
    this.hud.setHintsUsed(this.hintsUsed);

    const { word, intersectionIndex } = this.level.horizontalWords[selected.row];
    for (let i = 0; i < word.length; i++) {
      this.placeLetter(selected.row, intersectionIndex + i, word[i], { quiet: true });
    }
  }

  public destroy(): void {
    this.timer.stop();
    this.cancelPending();
    this.closeOverlay();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('resize', this.handleResize);
    this.app.destroy(true, { children: true, texture: true, baseTexture: true });
  }

  private resize(): void {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    this.app.renderer.resize(width, height);
    this.renderer.resize(width, height);
  }

  private onCellSelect(row: number): void {
    this.hud.showClue(this.level.horizontalWords[row].clue);
  }

  private onKeyDown(event: KeyboardEvent): void {
    // Atalhos do navegador (Ctrl+R, Ctrl+C...) não são jogadas.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const selected = this.renderer.getSelectedCell();
    if (this.status !== 'playing' || !selected) return;

    const { row, col } = selected;
    const word = this.level.horizontalWords[row];
    const firstCol = word.intersectionIndex;
    const lastCol = firstCol + word.word.length - 1;
    const letter = normalizeLetter(event.key);

    if (letter) {
      this.placeLetter(row, col, letter);
      if (col < lastCol) this.renderer.selectCell(row, col + 1);
    } else if (event.key === 'Backspace') {
      // Célula vazia: apaga a anterior, como em palavras cruzadas tradicionais.
      if (!this.validator.getLetter(row, col) && col > firstCol) {
        this.renderer.selectCell(row, col - 1);
        this.placeLetter(row, col - 1, '');
      } else {
        this.placeLetter(row, col, '');
      }
    } else if (event.key === 'Delete') {
      this.placeLetter(row, col, '');
    } else if (event.key === 'ArrowRight') {
      this.renderer.selectCell(row, Math.min(col + 1, lastCol));
    } else if (event.key === 'ArrowLeft') {
      this.renderer.selectCell(row, Math.max(col - 1, firstCol));
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const target = this.level.horizontalWords[row + (event.key === 'ArrowDown' ? 1 : -1)];
      if (!target) return;
      const targetRow = target.position;
      this.renderer.selectCell(targetRow, this.validator.isInWord(targetRow, col) ? col : target.intersectionIndex);
    } else {
      return;
    }
    event.preventDefault(); // evita rolar a página com as setas
  }

  /** Escreve uma letra na grade. Linhas já resolvidas ficam travadas. `quiet` = sem aviso de erro (dica). */
  private placeLetter(row: number, col: number, letter: string, { quiet = false } = {}): void {
    if (this.validator.isRowSolved(row)) return;

    this.renderer.setCellValue(row, col, letter);
    if (this.validator.setLetter(row, col, letter)) {
      this.onRowSolved(row);
    } else if (!quiet && letter && this.validator.isRowFilled(row)) {
      this.renderer.flashRowError(row);
      this.hud.toast('Quase! Confira as letras.', 'error');
    }
  }

  private onRowSolved(row: number): void {
    const word = this.level.horizontalWords[row].word;
    const message = SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)];
    this.renderer.markRowSolved(row);
    this.hud.toast(`${message} ${word} ✓`, 'success');
    this.hud.setProgress(this.validator.solvedCount(), this.level.horizontalWords.length);
    this.hud.setVerticalLetters(this.validator.getVerticalLetters());
    if (this.validator.isLevelComplete()) this.onLevelComplete();
  }

  private onLevelComplete(): void {
    this.status = 'complete';
    this.timer.stop();
    const timeRemaining = this.timer.secondsLeft();
    const score = calculateScore(this.level.points, timeRemaining, this.hintsUsed);
    const stars = calculateStars(timeRemaining, this.level.timeLimit, this.hintsUsed);
    this.hud.setScore(score);
    this.renderer.celebrate();

    const actions: DialogAction[] = [];
    let countdownMs = 0;
    if (this.onComplete) {
      actions.push({ label: 'Próximo nível ▶', variant: 'primary', onClick: () => this.advance() });
      if (this.autoAdvanceDelayMs >= 0) {
        countdownMs = Math.max(0, this.autoAdvanceDelayMs - CELEBRATION_MS);
        this.later(() => this.advance(), this.autoAdvanceDelayMs);
      }
    }
    actions.push({ label: 'Jogar novamente', variant: 'secondary', onClick: () => this.startGame() });

    const verticalWord = this.level.verticalWord.word;
    this.later(() => {
      this.showOverlay({
        icon: '🏆',
        title: 'Nível concluído!',
        message: verticalWord ? `Palavra-chave: ${verticalWord}` : 'Você completou todas as palavras!',
        stars,
        stats: [
          ['Pontuação', String(score)],
          ['Tempo restante', formatTime(timeRemaining)],
          ['Dicas usadas', String(this.hintsUsed)],
        ],
        actions,
        countdownMs,
        countdownLabel: countdownMs ? 'Próximo nível em instantes…' : undefined,
        confetti: true,
      });
    }, CELEBRATION_MS);
  }

  private onTimeUp(): void {
    this.status = 'timeup';
    this.showOverlay({
      icon: '⏰',
      title: 'Tempo esgotado!',
      message: 'Não foi dessa vez, mas você está quase lá. Que tal tentar de novo?',
      tone: 'warning',
      actions: [{ label: 'Tentar novamente', variant: 'primary', onClick: () => this.startGame() }],
    });
  }

  private advance(): void {
    this.cancelPending();
    this.closeOverlay();
    this.onComplete?.();
  }

  /** setTimeout que é cancelado ao reiniciar ou destruir o nível. */
  private later(fn: () => void, ms: number): void {
    this.pending.push(setTimeout(fn, ms));
  }

  private cancelPending(): void {
    this.pending.forEach(clearTimeout);
    this.pending = [];
  }

  private showOverlay(options: Parameters<typeof showDialog>[1]): void {
    this.closeOverlay();
    this.overlay = showDialog(this.container, options);
  }

  private closeOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}
