import * as PIXI from 'pixi.js';
import { Level } from '../models/Level';

const COLORS = {
  cell: 0xffffff,
  border: 0x000000,
  text: 0x000000,
  selected: 0x4a6fa5,
  solved: 0x28a745,
};
const MAX_CELL_SIZE = 60;
const PADDING = 5;

export type CellPosition = { row: number; col: number };

/** Desenha a grade no canvas (PIXI). Não contém regras do jogo: só exibe o que o GameEngine manda. */
export class CrosswordRenderer {
  private readonly level: Level;
  private readonly container = new PIXI.Container();
  private readonly textStyle = new PIXI.TextStyle({ fontFamily: 'Arial', fill: COLORS.text, align: 'center' });
  private readonly cells: (PIXI.Graphics | null)[][] = [];
  private readonly texts: (PIXI.Text | null)[][] = [];
  private readonly solvedRows = new Set<number>();
  private readonly gridWidth: number;
  private cellSize = 40;
  private selected: CellPosition | null = null;

  constructor(
    app: PIXI.Application,
    level: Level,
    private readonly onCellSelect: (row: number, col: number) => void
  ) {
    this.level = level;
    this.gridWidth = Math.max(...level.horizontalWords.map((w) => w.intersectionIndex + w.word.length));

    app.stage.addChild(this.container);
    this.createGrid();

    // Um único listener: o clique em qualquer célula (ou letra) sobe até o container.
    this.container.eventMode = 'static';
    this.container.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
      const pos = event.getLocalPosition(this.container);
      this.selectCell(Math.floor(pos.y / this.cellSize), Math.floor(pos.x / this.cellSize));
    });
  }

  public resize(width: number, height: number): void {
    const rows = this.level.horizontalWords.length;
    const maxByWidth = Math.floor((width - PADDING * 2) / this.gridWidth);
    const maxByHeight = Math.floor((height - PADDING * 2) / rows);
    this.cellSize = Math.max(1, Math.min(maxByWidth, maxByHeight, MAX_CELL_SIZE));

    this.textStyle.fontSize = this.cellSize * 0.6;
    this.forEachCell((cell, row, col) => {
      this.drawCell(cell, row, col);
      const text = this.texts[row][col];
      if (text) text.position.set((col + 0.5) * this.cellSize, (row + 0.5) * this.cellSize);
    });

    this.container.x = (width - this.gridWidth * this.cellSize) / 2;
    this.container.y = (height - rows * this.cellSize) / 2;
  }

  public getSelectedCell(): CellPosition | null {
    return this.selected;
  }

  public selectCell(row: number, col: number): void {
    if (!this.isCell(row, col)) return;

    const previous = this.selected;
    this.selected = { row, col };
    if (previous) this.updateTint(previous.row, previous.col);
    this.updateTint(row, col);

    this.onCellSelect(row, col);
  }

  public setCellValue(row: number, col: number, letter: string): void {
    const text = this.texts[row]?.[col];
    if (text) text.text = letter.toUpperCase();
  }

  public markRowSolved(row: number): void {
    this.solvedRows.add(row);
    this.forEachCell((_, r, col) => {
      if (r === row) this.updateTint(r, col);
    });
  }

  /** Limpa letras e destaques (usado ao reiniciar o nível). Mantém a célula selecionada. */
  public reset(): void {
    this.solvedRows.clear();
    this.forEachCell((_, row, col) => {
      this.setCellValue(row, col, '');
      this.updateTint(row, col);
    });
  }

  private createGrid(): void {
    this.level.horizontalWords.forEach((word, row) => {
      this.cells[row] = Array(this.gridWidth).fill(null);
      this.texts[row] = Array(this.gridWidth).fill(null);

      for (let col = word.intersectionIndex; col < word.intersectionIndex + word.word.length; col++) {
        const cell = new PIXI.Graphics();
        cell.eventMode = 'static';
        cell.cursor = 'pointer';
        this.drawCell(cell, row, col);
        this.container.addChild(cell);
        this.cells[row][col] = cell;

        const text = new PIXI.Text('', this.textStyle);
        text.anchor.set(0.5);
        text.position.set((col + 0.5) * this.cellSize, (row + 0.5) * this.cellSize);
        this.container.addChild(text);
        this.texts[row][col] = text;
      }
    });
  }

  private drawCell(cell: PIXI.Graphics, row: number, col: number): void {
    cell.clear();
    cell.beginFill(COLORS.cell);
    cell.lineStyle(1, COLORS.border);
    cell.drawRect(0, 0, this.cellSize, this.cellSize);
    cell.endFill();
    cell.position.set(col * this.cellSize, row * this.cellSize);
  }

  /** Cor da célula: azul se selecionada; senão verde se a palavra está resolvida; senão branca. */
  private updateTint(row: number, col: number): void {
    const cell = this.cells[row]?.[col];
    if (!cell) return;
    const isSelected = this.selected?.row === row && this.selected.col === col;
    cell.tint = isSelected ? COLORS.selected : this.solvedRows.has(row) ? COLORS.solved : COLORS.cell;
  }

  private isCell(row: number, col: number): boolean {
    return !!this.cells[row]?.[col];
  }

  private forEachCell(fn: (cell: PIXI.Graphics, row: number, col: number) => void): void {
    this.cells.forEach((cols, row) =>
      cols.forEach((cell, col) => {
        if (cell) fn(cell, row, col);
      })
    );
  }
}
