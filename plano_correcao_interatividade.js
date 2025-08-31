// Plano de correção para problemas de interatividade no jogo CodyCross Veterinária

// 1. Problema identificado no CrosswordRenderer.ts:
// - Eventos de interação do PIXI.js podem não estar funcionando corretamente
// - Possível problema com a configuração de interatividade

// Solução: Atualizar a configuração de interatividade e garantir que os eventos sejam registrados corretamente

// Modificar o método setupInteraction para garantir interatividade em cada célula individual
private setupInteraction(): void {
  // Tornar cada célula interativa individualmente
  for (let row = 0; row < this.cells.length; row++) {
    for (let col = 0; col < (this.cells[row] || []).length; col++) {
      if (this.cells[row] && this.cells[row][col]) {
        const cell = this.cells[row][col];
        
        // Garantir que a célula seja interativa
        cell.interactive = true;
        cell.cursor = 'pointer';
        
        // Adicionar evento de clique diretamente na célula
        cell.on('pointerdown', () => {
          console.log(`Célula clicada: ${row}, ${col}`);
          this.selectCell(row, col);
        });
      }
    }
  }
  
  // Manter também a interatividade no stage como fallback
  this.app.stage.interactive = true;
  this.app.stage.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
    const localPos = this.container.toLocal(event.global);
    const col = Math.floor(localPos.x / this.cellSize);
    const row = Math.floor(localPos.y / this.cellSize);
    
    console.log(`Stage clicado, calculado: ${row}, ${col}`);
    if (this.isCellValid(row, col)) {
      this.selectCell(row, col);
    }
  });
}

// 2. Problema identificado no GameEngine.ts:
// - Possível problema na inicialização ou na comunicação entre componentes

// Solução: Adicionar logs de depuração e garantir que o jogo seja inicializado corretamente

// Modificar o construtor para garantir inicialização correta
constructor(container: HTMLElement, level: Level) {
  console.log("Inicializando GameEngine");
  this.container = container;
  this.level = level;
  
  console.log("Criando aplicação PIXI");
  // Inicializar a aplicação PIXI
  this.app = new PIXI.Application({
    width: this.container.clientWidth,
    height: this.container.clientHeight,
    backgroundColor: 0xf8f9fa,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
  });
  
  console.log("Anexando canvas ao container");
  this.container.appendChild(this.app.view as HTMLCanvasElement);
  
  console.log("Inicializando renderer");
  // Inicializar o renderer
  this.renderer = new CrosswordRenderer(
    this.app,
    level,
    this.handleCellSelect.bind(this),
    this.handleWordComplete.bind(this)
  );
  
  console.log("Inicializando validador");
  // Inicializar o validador
  this.validator = new WordValidator(
    level,
    this.handleWordValidated.bind(this),
    this.handleVerticalWordValidated.bind(this),
    this.handleGameCompleted.bind(this)
  );
  
  console.log("Configurando eventos de teclado");
  // Configurar eventos de teclado
  window.addEventListener('keydown', this.handleKeyDown.bind(this));
  
  console.log("Configurando redimensionamento");
  // Configurar redimensionamento
  window.addEventListener('resize', this.handleResize.bind(this));
  this.handleResize();
  
  console.log("Inicializando estado do jogo");
  // Inicializar o estado do jogo
  this.gameStore.setState({
    currentLevel: level,
    timeRemaining: level.timeLimit,
    isGameActive: false,
    isGameComplete: false
  });
  
  console.log("GameEngine inicializado com sucesso");
}

// 3. Problema identificado na inicialização do jogo:
// - Possível problema na inicialização do jogo no index.ts

// Solução: Adicionar logs de depuração e garantir que o jogo seja inicializado corretamente

// Modificar o código de inicialização no index.ts
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM carregado, inicializando jogo");
  
  // Remover o loader se existir
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.remove();
  }
  
  console.log("Verificando container do jogo");
  const container = document.getElementById('crossword-container');
  if (!container) {
    console.error('Container do jogo não encontrado!');
    document.body.innerHTML += '<div style="color: red; padding: 20px;">Erro: Container do jogo não encontrado!</div>';
    return;
  }
  
  console.log("Carregando nível do jogo");
  // Carregar o nível do jogo
  fetch('./data/levels/level1.json')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Erro ao carregar nível: ${response.statusText}`);
      }
      console.log("Resposta recebida, convertendo para JSON");
      return response.json();
    })
    .then((level) => {
      console.log("Nível carregado:", level);
      
      // Inicializar o motor do jogo
      console.log("Inicializando motor do jogo");
      const gameEngine = new GameEngine(container, level);
      
      // Configurar botões
      console.log("Configurando botões");
      const hintButton = document.getElementById('hint-button');
      if (hintButton) {
        console.log("Botão de dica encontrado, adicionando evento");
        hintButton.addEventListener('click', () => {
          console.log("Botão de dica clicado");
          gameEngine.useHint();
        });
      } else {
        console.error("Botão de dica não encontrado!");
      }
      
      const resetButton = document.getElementById('reset-button');
      if (resetButton) {
        console.log("Botão de reiniciar encontrado, adicionando evento");
        resetButton.addEventListener('click', () => {
          console.log("Botão de reiniciar clicado");
          gameEngine.startGame();
        });
      } else {
        console.error("Botão de reiniciar não encontrado!");
      }
      
      // Exibir a dica da palavra vertical
      console.log("Configurando dica da palavra vertical");
      const verticalClue = document.getElementById('vertical-clue');
      if (verticalClue) {
        verticalClue.textContent = level.verticalWord.clue;
      } else {
        console.error("Elemento de dica vertical não encontrado!");
      }
      
      // Criar a exibição da palavra vertical
      console.log("Configurando exibição da palavra vertical");
      const verticalWordElement = document.getElementById('vertical-word');
      if (verticalWordElement) {
        const verticalWord = level.verticalWord.word;
        let html = '';
        
        for (let i = 0; i < verticalWord.length; i++) {
          html += `<span class="letter empty" data-index="${i}"></span>`;
        }
        
        verticalWordElement.innerHTML = html;
      } else {
        console.error("Elemento da palavra vertical não encontrado!");
      }
      
      // Iniciar o jogo
      console.log("Iniciando o jogo");
      gameEngine.startGame();
      console.log("Jogo iniciado com sucesso");
    })
    .catch(error => {
      console.error('Erro ao inicializar o jogo:', error);
      const container = document.getElementById('crossword-container');
      if (container) {
        container.innerHTML = `<div class="error-message">Erro ao carregar o jogo: ${error.message}</div>`;
      }
    });
});
