import * as PIXI from 'pixi.js';
import { Level, HorizontalWord } from '../../core/models/Level';

export class CrosswordGrid {
  private container: PIXI.Container;
  private cells: PIXI.Graphics[][] = [];
  private textFields: PIXI.Text[][] = [];
  private level: Level;
  private cellSize: number = 40;
  private padding: number = 5;
  private selectedCell: { row: number, col: number } | null = null;
  private selectedWord: HorizontalWord | null = null;
  private onCellSelect: (row: number, col: number) => void;
  private onLetterInput: (row: number, col: number, letter: string) => void;

  constructor(
    level: Level, 
    onCellSelect: (row: number, col: number) => void,
    onLetterInput: (row: number, col: number, letter: string) => void
  ) {
    this.level = level;
    this.container = new PIXI.Container();
    this.onCellSelect = onCellSelect;
    this.onLetterInput = onLetterInput;
    this.createGrid();
  }

  public getContainer(): PIXI.Container {
    return this.container;
  }

  public resize(width: number, height: number): void {
    // Ajustar tamanho da célula com base no espaço disponível
    const gridWidth = this.level.verticalWord.word.length;
    const gridHeight = this.level.horizontalWords.length;
    
    const maxCellWidth = Math.floor((width - this.padding * 2) / gridWidth);
    const maxCellHeight = Math.floor((height - this.padding * 2) / gridHeight);
    
    this.cellSize = Math.min(maxCellWidth, maxCellHeight, 60); // Limitar tamanho máximo
    
    // Recriar o grid com o novo tamanho
    this.container.removeChildren();
    this.cells = [];
    this.textFields = [];
    this.createGrid();
    
    // Centralizar o grid
    const gridPixelWidth = gridWidth * this.cellSize;
    const gridPixelHeight = gridHeight * this.cellSize;
    
    this.container.x = (width - gridPixelWidth) / 2;
    this.container.y = (height - gridPixelHeight) / 2;
  }

  public selectCell(row: number, col: number): void {
    // Desselecionar célula anterior
    if (this.selectedCell) {
      const { row: prevRow, col: prevCol } = this.selectedCell;
      this.updateCellAppearance(prevRow, prevCol, false);
    }
    
    // Selecionar nova célula
    this.selectedCell = { row, col };
    this.updateCellAppearance(row, col, true);
    
    // Encontrar a palavra horizontal correspondente
    this.selectedWord = this.level.horizontalWords.find(word => word.position === row) || null;
    
    // Chamar callback
    this.onCellSelect(row, col);
  }

  public inputLetter(letter: string): void {
    if (!this.selectedCell) return;
    
    const { row, col } = this.selectedCell;
    
    // Atualizar texto na célula
    if (this.textFields[row] && this.textFields[row][col]) {
      this.textFields[row][col].text = letter.toUpperCase();
    }
    
    // Chamar callback
    this.onLetterInput(row, col, letter);
    
    // Avançar para a próxima célula se estiver em uma palavra horizontal
    if (this.selectedWord) {
      const wordStart = this.selectedWord.intersectionIndex;
      const wordEnd = wordStart + this.selectedWord.word.length - 1;
      
      if (col < wordEnd) {
        this.selectCell(row, col + 1);
      }
    }
  }

  public setCellValue(row: number, col: number, letter: string): void {
    if (this.textFields[row] && this.textFields[row][col]) {
      this.textFields[row][col].text = letter.toUpperCase();
    }
  }

  public getCellValue(row: number, col: number): string {
    if (this.textFields[row] && this.textFields[row][col]) {
      return this.textFields[row][col].text;
    }
    return '';
  }

  public highlightWord(row: number): void {
    const word = this.level.horizontalWords.find(w => w.position === row);
    if (!word) return;
    
    const wordStart = word.intersectionIndex;
    const wordEnd = wordStart + word.word.length;
    
    for (let col = wordStart; col < wordEnd; col++) {
      this.cells[row][col].tint = 0xffeb3b; // Amarelo claro
    }
  }

  public clearHighlights(): void {
    for (let row = 0; row < this.cells.length; row++) {
      for (let col = 0; col < this.cells[row].length; col++) {
        this.cells[row][col].tint = 0xffffff;
      }
    }
    
    // Restaurar célula selecionada
    if (this.selectedCell) {
      this.updateCellAppearance(this.selectedCell.row, this.selectedCell.col, true);
    }
  }

  private createGrid(): void {
    const verticalWordLength = this.level.verticalWord.word.length;
    const horizontalWordsCount = this.level.horizontalWords.length;
    
    // Criar células para cada posição no grid
    for (let row = 0; row < horizontalWordsCount; row++) {
      this.cells[row] = [];
      this.textFields[row] = [];
      
      const horizontalWord = this.level.horizontalWords[row];
      const wordStart = horizontalWord.intersectionIndex;
      const wordLength = horizontalWord.word.length;
      
      for (let col = 0; col < verticalWordLength; col++) {
        // Verificar se esta célula faz parte da palavra horizontal
        const isPartOfHorizontalWord = col >= wordStart && col < wordStart + wordLength;
        
        // Verificar se esta célula é uma interseção com a palavra vertical
        const isIntersection = col === horizontalWord.intersectionIndex;
        
        if (isPartOfHorizontalWord || isIntersection) {
          // Criar célula
          const cell = new PIXI.Graphics();
          cell.beginFill(0xffffff);
          cell.lineStyle(1, 0x000000);
          cell.drawRect(0, 0, this.cellSize, this.cellSize);
          cell.endFill();
          cell.x = col * this.cellSize;
          cell.y = row * this.cellSize;
          cell.interactive = true;
          cell.cursor = 'pointer';
          
          // Adicionar evento de clique
          cell.on('pointerdown', () => this.selectCell(row, col));
          
          this.container.addChild(cell);
          this.cells[row][col] = cell;
          
          // Criar campo de texto
          const textField = new PIXI.Text('', {
            fontFamily: 'Arial',
            fontSize: this.cellSize * 0.6,
            fill: 0x000000,
            align: 'center'
          });
          
          textField.anchor.set(0.5);
          textField.x = col * this.cellSize + this.cellSize / 2;
          textField.y = row * this.cellSize + this.cellSize / 2;
          
          this.container.addChild(textField);
          this.textFields[row][col] = textField;
        }
      }
    }
  }

  private updateCellAppearance(row: number, col: number, isSelected: boolean): void {
    if (!this.cells[row] || !this.cells[row][col]) return;
    
    const cell = this.cells[row][col];
    
    if (isSelected) {
      cell.tint = 0x4a6fa5; // Cor primária
    } else {
      cell.tint = 0xffffff; // Branco
    }
  }
}
