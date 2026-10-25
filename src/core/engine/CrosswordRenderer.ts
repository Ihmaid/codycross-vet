import * as PIXI from 'pixi.js';
import { Level } from '../models/Level';

/** Paleta da grade (cores da Universidade de Vassouras: bordô, cinza quente e branco + dourado). */
const COLORS = {
  cell: 0xffffff,
  cellBorder: 0xd9d1cf,
  cellShadow: 0xe7dfdc,
  keyCell: 0xf6eaea,
  keyBorder: 0xc9a2a3,
  activeRow: 0xfcf2f1,
  activeBorder: 0xd8aeaf,
  selectedBorder: 0x803031,
  solved: 0x803031,
  solvedBorder: 0x5c1a1d,
  solvedKey: 0xd9a441,
  solvedKeyBorder: 0xb5832a,
  error: 0xfdecea,
  errorBorder: 0xc0392b,
  text: 0x2b2324,
  textOnColor: 0xffffff,
  sparks: [0xd9a441, 0xf3d58c, 0x803031, 0xffffff],
};
const MAX_CELL_SIZE = 56;
const PADDING = 8;
const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export type CellPosition = { row: number; col: number };

type Cell = {
  row: number;
  col: number;
  node: PIXI.Container;
  bg: PIXI.Graphics;
  text: PIXI.Text;
};

type Tween = {
  start: number;
  delay: number;
  duration: number;
  update: (t: number) => void;
  done?: () => void;
};

const easeOutBack = (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
/** Sobe até 1 no meio e volta a 0 (para "pulos"). */
const bump = (t: number) => Math.sin(Math.PI * t);

/** Desenha a grade no canvas (PIXI) e suas animações. Não contém regras do jogo. */
export class CrosswordRenderer {
  private readonly level: Level;
  private readonly board = new PIXI.Container();
  private readonly fx = new PIXI.Container();
  private readonly cells: (Cell | null)[][] = [];
  private readonly solvedRows = new Set<number>();
  private readonly errorRows = new Set<number>();
  private readonly tweens = new Set<Tween>();
  private readonly gridWidth: number;
  private readonly hasKeyColumn: boolean;
  private cellSize = 40;
  private selected: CellPosition | null = null;
  private readonly step = () => this.runTweens();

  constructor(
    app: PIXI.Application,
    level: Level,
    private readonly onCellSelect: (row: number, col: number) => void
  ) {
    this.level = level;
    this.gridWidth = Math.max(...level.horizontalWords.map((w) => w.intersectionIndex + w.word.length));
    this.hasKeyColumn = level.verticalWord.word.trim().length > 0;

    this.fx.eventMode = 'none';
    app.stage.addChild(this.board, this.fx);
    this.createGrid();
    app.ticker.add(this.step);

    // Um único listener: o clique em qualquer célula sobe até o container da grade.
    this.board.eventMode = 'static';
    this.board.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
      const pos = event.getLocalPosition(this.board);
      this.selectCell(Math.floor(pos.y / this.cellSize), Math.floor(pos.x / this.cellSize));
    });

    this.playIntro();
  }

  public resize(width: number, height: number): void {
    const rows = this.level.horizontalWords.length;
    const maxByWidth = Math.floor((width - PADDING * 2) / this.gridWidth);
    const maxByHeight = Math.floor((height - PADDING * 2) / rows);
    this.cellSize = Math.max(1, Math.min(maxByWidth, maxByHeight, MAX_CELL_SIZE));

    this.forEachCell((cell) => {
      cell.node.position.set(this.cellX(cell.col), this.cellY(cell.row));
      cell.text.style.fontSize = Math.round(this.cellSize * 0.56);
      this.drawCell(cell);
    });

    const x = (width - this.gridWidth * this.cellSize) / 2;
    const y = (height - rows * this.cellSize) / 2;
    this.board.position.set(x, y);
    this.fx.position.set(x, y);
  }

  public getSelectedCell(): CellPosition | null {
    return this.selected;
  }

  public selectCell(row: number, col: number): void {
    const cell = this.cells[row]?.[col];
    if (!cell) return;

    const previousRow = this.selected?.row;
    this.selected = { row, col };
    // Redesenha a linha antiga e a nova (destaque da palavra ativa).
    this.forEachCell((c) => {
      if (c.row === row || c.row === previousRow) this.drawCell(c);
    });

    this.onCellSelect(row, col);
  }

  public setCellValue(row: number, col: number, letter: string): void {
    const cell = this.cells[row]?.[col];
    if (!cell) return;
    cell.text.text = letter.toUpperCase();
    if (letter) this.animate(140, (t) => cell.node.scale.set(1 + 0.12 * bump(t)));
  }

  /** Palavra certa: onda de cor pelas células, com faíscas. */
  public markRowSolved(row: number): void {
    this.solvedRows.add(row);
    this.errorRows.delete(row);
    this.rowCells(row).forEach((cell, i) => {
      let colored = false;
      this.animate(
        320,
        (t) => {
          cell.node.scale.set(1 + 0.28 * bump(t));
          if (!colored && t >= 0.4) {
            colored = true;
            this.drawCell(cell);
            this.burst(cell);
          }
        },
        { delay: i * 55 }
      );
    });
  }

  /** Linha cheia mas errada: treme em vermelho. */
  public flashRowError(row: number): void {
    const cells = this.rowCells(row);
    this.errorRows.add(row);
    cells.forEach((c) => this.drawCell(c));
    this.animate(
      450,
      (t) => {
        const offset = Math.sin(t * Math.PI * 6) * (1 - t) * this.cellSize * 0.14;
        cells.forEach((c) => (c.node.x = this.cellX(c.col) + offset));
      },
      {
        done: () => {
          this.errorRows.delete(row);
          cells.forEach((c) => this.drawCell(c));
        },
      }
    );
  }

  /** Nível concluído: todas as células pulam em sequência diagonal. */
  public celebrate(): void {
    this.forEachCell((cell) =>
      this.animate(420, (t) => cell.node.scale.set(1 + 0.22 * bump(t)), { delay: (cell.row + cell.col) * 35 })
    );
  }

  /** Limpa letras e destaques (usado ao reiniciar o nível). Mantém a célula selecionada. */
  public reset(): void {
    this.solvedRows.clear();
    this.errorRows.clear();
    this.forEachCell((cell) => {
      cell.text.text = '';
      this.drawCell(cell);
    });
  }

  private playIntro(): void {
    this.forEachCell((cell) => {
      cell.node.scale.set(0);
      this.animate(380, (t) => cell.node.scale.set(Math.max(0, easeOutBack(t))), {
        delay: cell.row * 45 + (cell.col - this.level.horizontalWords[cell.row].intersectionIndex) * 18,
      });
    });
  }

  private createGrid(): void {
    this.level.horizontalWords.forEach((word, row) => {
      this.cells[row] = Array(this.gridWidth).fill(null);
      for (let col = word.intersectionIndex; col < word.intersectionIndex + word.word.length; col++) {
        const node = new PIXI.Container();
        const bg = new PIXI.Graphics();
        bg.eventMode = 'static';
        bg.cursor = 'pointer';
        const text = new PIXI.Text('', {
          fontFamily: ['Nunito', 'Arial', 'sans-serif'],
          fontWeight: '800',
          fill: COLORS.text,
          align: 'center',
        });
        text.anchor.set(0.5);
        node.addChild(bg, text);
        this.board.addChild(node);
        this.cells[row][col] = { row, col, node, bg, text };
      }
    });
  }

  private drawCell(cell: Cell): void {
    const { row, col, bg, text } = cell;
    const isKey = this.hasKeyColumn && col === this.level.horizontalWords[row].intersectionIndex;
    const isSolved = this.solvedRows.has(row);
    const isSelected = this.selected?.row === row && this.selected.col === col;
    const isActiveRow = this.selected?.row === row;

    let fill = isKey ? COLORS.keyCell : COLORS.cell;
    let border = isKey ? COLORS.keyBorder : COLORS.cellBorder;
    let borderWidth = 1.5;
    if (isActiveRow && !isSolved) {
      fill = isKey ? COLORS.keyCell : COLORS.activeRow;
      border = COLORS.activeBorder;
    }
    if (isSolved) {
      fill = isKey ? COLORS.solvedKey : COLORS.solved;
      border = isKey ? COLORS.solvedKeyBorder : COLORS.solvedBorder;
    }
    if (this.errorRows.has(row)) {
      fill = COLORS.error;
      border = COLORS.errorBorder;
      borderWidth = 2.5;
    }
    if (isSelected) {
      border = isSolved ? COLORS.solvedKey : COLORS.selectedBorder;
      borderWidth = 3;
    }

    const size = this.cellSize;
    const gap = Math.max(1, size * 0.07);
    const half = size / 2 - gap;
    const radius = size * 0.2;
    bg.clear();
    bg.beginFill(COLORS.cellShadow);
    bg.drawRoundedRect(-half, -half + 2, half * 2, half * 2, radius);
    bg.endFill();
    bg.lineStyle({ width: borderWidth, color: border, alignment: 1 });
    bg.beginFill(fill);
    bg.drawRoundedRect(-half, -half, half * 2, half * 2, radius);
    bg.endFill();

    text.style.fill = isSolved ? COLORS.textOnColor : COLORS.text;
  }

  /** Faíscas saindo do centro da célula. */
  private burst(cell: Cell): void {
    if (REDUCED_MOTION) return;
    for (let i = 0; i < 6; i++) {
      const spark = new PIXI.Graphics();
      spark.beginFill(COLORS.sparks[i % COLORS.sparks.length]);
      spark.drawCircle(0, 0, Math.max(1.5, this.cellSize * 0.07));
      spark.endFill();
      const x0 = this.cellX(cell.col);
      const y0 = this.cellY(cell.row);
      spark.position.set(x0, y0);
      this.fx.addChild(spark);

      const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.6;
      const distance = this.cellSize * (0.7 + Math.random() * 0.5);
      this.animate(
        520,
        (t) => {
          const ease = 1 - Math.pow(1 - t, 3);
          spark.position.set(x0 + Math.cos(angle) * distance * ease, y0 + Math.sin(angle) * distance * ease);
          spark.alpha = 1 - t;
        },
        { done: () => spark.destroy() }
      );
    }
  }

  /** Mini sistema de animação sobre o ticker do PIXI. */
  private animate(duration: number, update: (t: number) => void, opts: { delay?: number; done?: () => void } = {}): void {
    if (REDUCED_MOTION) {
      update(1);
      opts.done?.();
      return;
    }
    this.tweens.add({ start: performance.now(), delay: opts.delay ?? 0, duration, update, done: opts.done });
  }

  private runTweens(): void {
    const now = performance.now();
    for (const tween of this.tweens) {
      const elapsed = now - tween.start - tween.delay;
      if (elapsed < 0) continue;
      const t = Math.min(1, elapsed / tween.duration);
      tween.update(t);
      if (t === 1) {
        this.tweens.delete(tween);
        tween.done?.();
      }
    }
  }

  private cellX(col: number): number {
    return (col + 0.5) * this.cellSize;
  }

  private cellY(row: number): number {
    return (row + 0.5) * this.cellSize;
  }

  private rowCells(row: number): Cell[] {
    return (this.cells[row] ?? []).filter((c): c is Cell => c !== null);
  }

  private forEachCell(fn: (cell: Cell) => void): void {
    this.cells.forEach((cols) => cols.forEach((cell) => cell && fn(cell)));
  }
}
