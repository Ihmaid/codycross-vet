import './ui/styles/main.scss';
import { GameEngine } from './core/engine/GameEngine';
import { Level } from './core/models/Level';

// Função para inicializar o jogo quando o DOM estiver carregado
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
  
  // Adicionar classe de estilo para garantir que o container tenha dimensões adequadas
  container.classList.add('crossword-container-active');
  
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
      
      // Adicionar instruções de jogo
      const clueContainer = document.querySelector('.clue-container');
      if (clueContainer) {
        clueContainer.innerHTML = `
          <p><strong>Dica:</strong> ${level.horizontalWords[0].clue}</p>
          <p class="instructions">Clique em uma célula e digite para preencher as palavras cruzadas.</p>
        `;
      }
      
      // Iniciar o jogo
      console.log("Iniciando o jogo");
      gameEngine.startGame();
      
      // Selecionar a primeira célula automaticamente para melhorar a experiência do usuário
      setTimeout(() => {
        const firstWord = level.horizontalWords[0];
        const row = firstWord.position;
        const col = firstWord.intersectionIndex;
        console.log(`Selecionando primeira célula automaticamente: ${row}, ${col}`);
        gameEngine.useHint(); // Isso vai selecionar a primeira célula automaticamente
      }, 500);
      
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
