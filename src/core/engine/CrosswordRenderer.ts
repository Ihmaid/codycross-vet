import * as PIXI from 'pixi.js';
import { Level, HorizontalWord } from '../models/Level';

export class CrosswordRenderer {
  private app: PIXI.Application;
  private level: Level;
  private container: PIXI.Container;
  private cells: PIXI.Graphics[][] = [];
  private textFields: PIXI.Text[][] = [];
  private cellSize: number = 40;
  private padding: number = 5;
  private selectedCell: { row: number, col: number } | null = null;
  private selectedWord: HorizontalWord | null = null;
  private onCellSelect: (row: number, col: number) => void;
  private onWordComplete: (row: number, isCorrect: boolean) => void;

  constructor(
    app: PIXI.Application,
    level: Level,
    onCellSelect: (row: number, col: number) => void,
    onWordComplete: (row: number, isCorrect: boolean) => void
  ) {
    console.log("Inicializando CrosswordRenderer");
    this.app = app;
    this.level = level;
    this.container = new PIXI.Container();
    this.onCellSelect = onCellSelect;
    this.onWordComplete = onWordComplete;
    
    this.app.stage.addChild(this.container);
    this.createGrid();
    this.setupInteraction();
    console.log("CrosswordRenderer inicializado com sucesso");
  }

  public resize(width: number, height: number): void {
    const gridWidth = this.getGridWidth();
    const gridHeight = this.level.horizontalWords.length;
    
    const maxCellWidth = Math.floor((width - this.padding * 2) / gridWidth);
    const maxCellHeight = Math.floor((height - this.padding * 2) / gridHeight);
    
    this.cellSize = Math.min(maxCellWidth, maxCellHeight, 60);
    
    this.updateGridLayout();
    
    // Centralizar o grid
    const gridPixelWidth = gridWidth * this.cellSize;
    const gridPixelHeight = gridHeight * this.cellSize;
    
    this.container.x = (width - gridPixelWidth) / 2;
    this.container.y = (height - gridPixelHeight) / 2;
  }

  public selectCell(row: number, col: number): void {
    console.log(`Selecionando célula: ${row}, ${col}`);
    if (!this.isCellValid(row, col)) {
      console.log(`Célula inválida: ${row}, ${col}`);
      return;
    }
    
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
    console.log(`Inserindo letra: ${letter}`);
    if (!this.selectedCell) {
      console.log("Nenhuma célula selecionada para inserir letra");
      return;
    }
    
    const { row, col } = this.selectedCell;
    
    // Atualizar texto na célula
    if (this.textFields[row] && this.textFields[row][col]) {
      this.textFields[row][col].text = letter.toUpperCase();
      console.log(`Letra ${letter.toUpperCase()} inserida na célula ${row}, ${col}`);
    }
    
    // Verificar se a palavra horizontal está completa
    this.checkWordCompletion(row);
    
    // Verificar se a palavra vertical está completa
    this.checkVerticalWordCompletion();
    
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
    console.log(`Definindo valor da célula ${row}, ${col} para ${letter}`);
    if (!this.isCellValid(row, col)) {
      console.log(`Célula inválida: ${row}, ${col}`);
      return;
    }
    
    if (this.textFields[row] && this.textFields[row][col]) {
      this.textFields[row][col].text = letter.toUpperCase();
    }
    
    // Verificar se a palavra horizontal está completa
    this.checkWordCompletion(row);
    
    // Verificar se a palavra vertical está completa
    this.checkVerticalWordCompletion();
  }

  public getCellValue(row: number, col: number): string {
    if (!this.isCellValid(row, col)) return '';
    
    if (this.textFields[row] && this.textFields[row][col]) {
      return this.textFields[row][col].text;
    }
    return '';
  }

  public highlightWord(row: number, isCorrect: boolean = true): void {
    const word = this.level.horizontalWords.find(w => w.position === row);
    if (!word) return;
    
    const wordStart = word.intersectionIndex;
    const wordEnd = wordStart + word.word.length;
    
    for (let col = wordStart; col < wordEnd; col++) {
      if (this.cells[row] && this.cells[row][col]) {
        this.cells[row][col].tint = isCorrect ? 0x28a745 : 0xdc3545; // Verde ou vermelho
      }
    }
  }

  public highlightVerticalWord(isCorrect: boolean = true): void {
    for (let row = 0; row < this.level.horizontalWords.length; row++) {
      const word = this.level.horizontalWords[row];
      const col = word.intersectionIndex;
      
      if (this.cells[row] && this.cells[row][col]) {
        this.cells[row][col].tint = isCorrect ? 0x28a745 : 0xdc3545; // Verde ou vermelho
      }
    }
  }

  public clearHighlights(): void {
    for (let row = 0; row < this.cells.length; row++) {
      for (let col = 0; col < (this.cells[row] || []).length; col++) {
        if (this.cells[row] && this.cells[row][col]) {
          this.cells[row][col].tint = 0xffffff;
        }
      }
    }
    
    // Restaurar célula selecionada
    if (this.selectedCell) {
      this.updateCellAppearance(this.selectedCell.row, this.selectedCell.col, true);
    }
  }

  private getGridWidth(): number {
    let maxWidth = 0;
    
    for (const word of this.level.horizontalWords) {
      const wordEnd = word.intersectionIndex + word.word.length;
      maxWidth = Math.max(maxWidth, wordEnd);
    }
    
    return maxWidth;
  }

  private createGrid(): void {
    console.log("Criando grid de palavras cruzadas");
    const gridWidth = this.getGridWidth();
    const gridHeight = this.level.horizontalWords.length;
    
    // Inicializar arrays
    this.cells = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(null));
    this.textFields = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(null));
    
    // Criar células para cada posição no grid
    for (let row = 0; row < gridHeight; row++) {
      const horizontalWord = this.level.horizontalWords[row];
      const wordStart = horizontalWord.intersectionIndex;
      const wordLength = horizontalWord.word.length;
      
      for (let col = 0; col < gridWidth; col++) {
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
          
          // Configurar interatividade
          cell.eventMode = 'static'; // Novo em PIXI v7+
          cell.cursor = 'pointer';
          
          // Adicionar à célula o índice para referência
          (cell as any).cellIndex = { row, col };
          
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
    console.log(`Grid criado com ${gridHeight} linhas e ${gridWidth} colunas`);
  }

  private updateGridLayout(): void {
    for (let row = 0; row < this.cells.length; row++) {
      for (let col = 0; col < (this.cells[row] || []).length; col++) {
        if (this.cells[row] && this.cells[row][col]) {
          const cell = this.cells[row][col];
          cell.clear();
          cell.beginFill(0xffffff);
          cell.lineStyle(1, 0x000000);
          cell.drawRect(0, 0, this.cellSize, this.cellSize);
          cell.endFill();
          cell.x = col * this.cellSize;
          cell.y = row * this.cellSize;
          
          const textField = this.textFields[row][col];
          if (textField) {
            textField.x = col * this.cellSize + this.cellSize / 2;
            textField.y = row * this.cellSize + this.cellSize / 2;
            textField.style.fontSize = this.cellSize * 0.6;
          }
        }
      }
    }
  }

  private setupInteraction(): void {
    console.log("Configurando interatividade");
    
    // Tornar cada célula interativa individualmente
    for (let row = 0; row < this.cells.length; row++) {
      for (let col = 0; col < (this.cells[row] || []).length; col++) {
        if (this.cells[row] && this.cells[row][col]) {
          const cell = this.cells[row][col];
          
          // Garantir que a célula seja interativa
          cell.eventMode = 'static'; // Novo em PIXI v7+
          cell.cursor = 'pointer';
          
          // Adicionar evento de clique diretamente na célula
          cell.on('pointerdown', () => {
            console.log(`Célula clicada: ${row}, ${col}`);
            this.selectCell(row, col);
          });
        }
      }
    }
    
    // Configurar interatividade no container principal
    this.container.eventMode = 'static';
    this.container.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
      const localPos = event.getLocalPosition(this.container);
      const col = Math.floor(localPos.x / this.cellSize);
      const row = Math.floor(localPos.y / this.cellSize);
      
      console.log(`Container clicado, calculado: ${row}, ${col}`);
      if (this.isCellValid(row, col)) {
        this.selectCell(row, col);
      }
    });
    
    // Configurar interatividade no stage como fallback
    this.app.stage.eventMode = 'static';
    this.app.stage.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
      const localPos = this.container.toLocal(event.global);
      const col = Math.floor(localPos.x / this.cellSize);
      const row = Math.floor(localPos.y / this.cellSize);
      
      console.log(`Stage clicado, calculado: ${row}, ${col}`);
      if (this.isCellValid(row, col)) {
        this.selectCell(row, col);
      }
    });
    
    console.log("Interatividade configurada");
  }

  private updateCellAppearance(row: number, col: number, isSelected: boolean): void {
    if (!this.isCellValid(row, col)) return;
    
    const cell = this.cells[row][col];
    if (!cell) return;
    
    if (isSelected) {
      cell.tint = 0x4a6fa5; // Cor primária
    } else {
      cell.tint = 0xffffff; // Branco
    }
  }

  private isCellValid(row: number, col: number): boolean {
    if (row < 0 || row >= this.cells.length) return false;
    if (!this.cells[row]) return false;
    if (col < 0 || col >= this.cells[row].length) return false;
    return this.cells[row][col] !== null;
  }

  private checkWordCompletion(row: number): void {
    const horizontalWord = this.level.horizontalWords.find(word => word.position === row);
    if (!horizontalWord) return;
    
    const wordStart = horizontalWord.intersectionIndex;
    const correctWord = horizontalWord.word.toUpperCase();
    
    let userWord = '';
    let isComplete = true;
    
    for (let i = 0; i < correctWord.length; i++) {
      const col = wordStart + i;
      const letter = this.getCellValue(row, col);
      
      if (!letter) {
        isComplete = false;
      }
      
      userWord += letter;
    }
    
    if (isComplete) {
      const isCorrect = userWord === correctWord;
      console.log(`Palavra completa na linha ${row}: "${userWord}", correta: ${isCorrect}`);
      this.onWordComplete(row, isCorrect);
      
      if (isCorrect) {
        this.highlightWord(row, true);
      }
    }
  }

  private checkVerticalWordCompletion(): void {
    const verticalWord = this.level.verticalWord.word.toUpperCase();
    let userVerticalWord = '';
    let isComplete = true;
    
    for (let i = 0; i < this.level.horizontalWords.length; i++) {
      const horizontalWord = this.level.horizontalWords[i];
      const intersectionCol = horizontalWord.intersectionIndex;
      const letter = this.getCellValue(i, intersectionCol);
      
      if (!letter) {
        isComplete = false;
      }
      
      userVerticalWord += letter || '';
    }
    
    if (isComplete) {
      const isCorrect = userVerticalWord === verticalWord;
      console.log(`Palavra vertical completa: "${userVerticalWord}", correta: ${isCorrect}`);
      
      if (isCorrect) {
        this.highlightVerticalWord(true);
        // Atualizar a exibição da palavra vertical no DOM
        this.updateVerticalWordDisplay(userVerticalWord);
      }
    }
  }

  private updateVerticalWordDisplay(word: string): void {
    const verticalWordElement = document.getElementById('vertical-word');
    if (!verticalWordElement) {
      console.error("Elemento vertical-word não encontrado no DOM");
      return;
    }
    
    for (let i = 0; i < word.length; i++) {
      const letterElement = verticalWordElement.querySelector(`[data-index="${i}"]`);
      if (letterElement) {
        letterElement.textContent = word[i];
        letterElement.classList.remove('empty');
        letterElement.classList.add('filled');
      }
    }
    console.log(`Exibição da palavra vertical atualizada: ${word}`);
  }
}
