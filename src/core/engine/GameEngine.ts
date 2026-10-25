import * as PIXI from 'pixi.js';
import { Level } from '../models/Level';
import { CrosswordRenderer } from './CrosswordRenderer';
import { WordValidator } from './WordValidator';
import { CountdownTimer } from './CountdownTimer';
import { calculateScore } from '../scoring';
import { normalizeLetter } from '../input';
import { GameHud, formatTime } from '../../ui/GameHud';

export type GameEngineOptions = {
  /** Chamado para avançar ao próximo nível (automaticamente ou pelo botão). */
  onComplete?: () => void;
  /** Espera antes de avançar automaticamente. Negativo = não avança sozinho. */
  autoAdvanceDelayMs?: number;
};

type Status = 'playing' | 'complete' | 'timeup';

/** Regras de uma partida: liga o teclado, a grade (renderer), as respostas (validator) e o HUD. */
export class GameEngine {
  private readonly app: PIXI.Application;
  private readonly renderer: CrosswordRenderer;
  private readonly validator: WordValidator;
  private readonly timer: CountdownTimer;
  private readonly hud = new GameHud();
  private readonly onComplete?: () => void;
  private readonly autoAdvanceDelayMs: number;
  private status: Status = 'playing';
  private hintsUsed = 0;
  private overlay: HTMLElement | null = null;
  private advanceTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly handleKeyDown = (event: KeyboardEvent) => this.onKeyDown(event);
  private readonly handleResize = () => this.resize();

  constructor(
    private readonly container: HTMLElement,
    private readonly level: Level,
    options: GameEngineOptions = {}
  ) {
    this.onComplete = options.onComplete;
    this.autoAdvanceDelayMs = options.autoAdvanceDelayMs ?? 1000;

    this.app = new PIXI.Application({
      width: container.clientWidth || 800,
      height: container.clientHeight || 600,
      backgroundColor: 0xf8f9fa,
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
    this.hud.showLevel(level);
  }

  /** Começa (ou recomeça do zero) o nível. */
  public startGame(): void {
    this.cancelAutoAdvance();
    this.closeOverlay();
    this.validator.reset();
    this.renderer.reset();
    this.hintsUsed = 0;
    this.status = 'playing';

    this.hud.setScore(0);
    this.hud.setHintsUsed(0);
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
      this.placeLetter(selected.row, intersectionIndex + i, word[i]);
    }
  }

  public destroy(): void {
    this.timer.stop();
    this.cancelAutoAdvance();
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

  /** Escreve uma letra na grade. Linhas já resolvidas ficam travadas. */
  private placeLetter(row: number, col: number, letter: string): void {
    if (this.validator.isRowSolved(row)) return;

    this.renderer.setCellValue(row, col, letter);
    if (this.validator.setLetter(row, col, letter)) {
      this.renderer.markRowSolved(row);
      this.hud.setVerticalLetters(this.validator.getVerticalLetters());
      if (this.validator.isLevelComplete()) this.onLevelComplete();
    }
  }

  private onLevelComplete(): void {
    this.status = 'complete';
    this.timer.stop();
    const timeRemaining = this.timer.secondsLeft();
    const score = calculateScore(this.level.points, timeRemaining, this.hintsUsed);
    this.hud.setScore(score);

    const actions: OverlayAction[] = [{ label: 'Jogar Novamente', className: 'btn btn-primary', onClick: () => this.startGame() }];
    if (this.onComplete) {
      actions.push({ label: 'Próximo Nível ▶', className: 'btn btn-hint', onClick: () => this.advance() });
      if (this.autoAdvanceDelayMs >= 0) {
        this.advanceTimeout = setTimeout(() => this.advance(), this.autoAdvanceDelayMs);
      }
    }

    this.showOverlay(
      'Parabéns!',
      ['Você completou o nível!', `Pontuação: ${score}`, `Tempo restante: ${formatTime(timeRemaining)}`, `Dicas usadas: ${this.hintsUsed}`],
      actions
    );
  }

  private onTimeUp(): void {
    this.status = 'timeup';
    this.showOverlay('Tempo Esgotado!', ['Infelizmente o tempo acabou.', 'Pontuação: 0'], [
      { label: 'Tentar Novamente', className: 'btn btn-primary', onClick: () => this.startGame() },
    ]);
  }

  private advance(): void {
    this.cancelAutoAdvance();
    this.closeOverlay();
    this.onComplete?.();
  }

  private cancelAutoAdvance(): void {
    if (this.advanceTimeout) clearTimeout(this.advanceTimeout);
    this.advanceTimeout = null;
  }

  private showOverlay(title: string, lines: string[], actions: OverlayAction[]): void {
    this.closeOverlay();
    const overlay = document.createElement('div');
    overlay.className = 'game-complete-message';
    overlay.setAttribute('role', 'dialog');

    const heading = document.createElement('h2');
    heading.textContent = title;
    overlay.append(heading);
    for (const line of lines) {
      const p = document.createElement('p');
      p.textContent = line;
      overlay.append(p);
    }

    const buttons = document.createElement('div');
    buttons.className = 'overlay-actions';
    for (const action of actions) {
      const button = document.createElement('button');
      button.className = action.className;
      button.textContent = action.label;
      button.addEventListener('click', action.onClick);
      buttons.append(button);
    }
    overlay.append(buttons);

    this.container.append(overlay);
    this.overlay = overlay;
  }

  private closeOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}

type OverlayAction = { label: string; className: string; onClick: () => void };
