# Documentação Detalhada do Projeto CodyCross Veterinária

Este documento fornece uma visão geral completa da estrutura de pastas, arquivos, fluxo de dados, lógica de funcionamento e tecnologias utilizadas no jogo CodyCross Veterinária. O objetivo é capacitar outros desenvolvedores ou IAs a continuar e otimizar o projeto.

## 1. Estrutura de Pastas e Arquivos Principais

A estrutura do projeto foi organizada para promover a modularidade e a separação de responsabilidades. Abaixo está uma descrição das principais pastas e seus conteúdos:

```
/projeto-codycross-vet
├── dist/                     # Arquivos compilados para produção/distribuição
├── node_modules/             # Dependências do Node.js (gerenciadas pelo npm)
├── public/                   # Arquivos estáticos (se houver, como imagens não processadas pelo webpack)
├── src/                      # Código-fonte principal do jogo
│   ├── assets/               # Recursos estáticos como imagens, fontes, sons
│   │   ├── fonts/
│   │   └── images/
│   │   └── sounds/
│   ├── config/               # Arquivos de configuração do jogo
│   │   └── GameConfig.ts     # Configurações globais do jogo (ex: temas, dificuldades)
│   ├── core/                 # Lógica central e motor do jogo
│   │   ├── engine/           # Componentes do motor do jogo (renderização, validação, etc.)
│   │   │   ├── CrosswordRenderer.ts # Responsável por desenhar o tabuleiro e elementos visuais com PixiJS
│   │   │   ├── Game.ts         # Classe principal do jogo (obsoleta ou menos usada após refatorações)
│   │   │   ├── GameEngine.ts   # Orquestra a lógica do jogo, interações e estado
│   │   │   ├── GameManager.ts  # Gerencia o ciclo de vida do jogo, níveis e transições (pode ter sido mesclado com GameEngine)
│   │   │   └── WordValidator.ts# Valida as palavras inseridas pelo usuário
│   │   ├── models/           # Definições de tipos e interfaces de dados
│   │   │   ├── GameState.ts    # Define a estrutura do estado do jogo (nível atual, pontuação, etc.)
│   │   │   └── Level.ts        # Define a estrutura de um nível do jogo (palavras, dicas, etc.)
│   │   ├── services/         # Serviços auxiliares (carregamento de níveis, pontuação, estado)
│   │   │   ├── GameStore.ts    # Gerencia o estado global do jogo (usando Zustand ou similar, agora um Singleton)
│   │   │   ├── LevelService.ts # Responsável por carregar e gerenciar dados de níveis
│   │   │   └── ScoreService.ts # Gerencia a lógica de pontuação
│   │   └── GameController.ts # Controla o fluxo principal do jogo, ligando UI e lógica (pode ter sido integrado ao GameEngine)
│   ├── data/                 # Dados do jogo, como definições de níveis
│   │   ├── levels/           # Arquivos JSON definindo cada nível
│   │   │   └── level1.json   # Exemplo de arquivo de nível
│   │   └── templates/        # Templates para geração de níveis (se aplicável)
│   ├── ui/                   # Componentes e estilos da interface do usuário
│   │   ├── components/       # Componentes reutilizáveis da UI (ex: grid, botões específicos)
│   │   │   └── CrosswordGrid.ts# Componente visual do tabuleiro (pode ser parte do Renderer)
│   │   ├── screens/          # Telas do jogo (menu principal, tela de jogo, game over - se aplicável)
│   │   └── styles/           # Arquivos SCSS para estilização
│   │       ├── main.scss       # Ponto de entrada principal dos estilos
│   │       ├── _animations.scss
│   │       ├── _components.scss
│   │       ├── _game.scss      # Estilos específicos da tela de jogo
│   │       ├── _layout.scss
│   │       ├── _reset.scss
│   │       ├── _responsive.scss
│   │       ├── _typography.scss
│   │       └── _variables.scss # Variáveis SCSS (cores, fontes, espaçamentos)
│   ├── utils/                # Funções utilitárias genéricas
│   ├── index.html            # Arquivo HTML principal que carrega o jogo
│   └── index.ts              # Ponto de entrada principal do TypeScript, onde o jogo é inicializado
├── .gitignore                # Especifica arquivos e pastas a serem ignorados pelo Git
├── CORRECOES_INTERATIVIDADE.md # Documentação das últimas correções de interatividade
├── INSTRUCOES_ATUALIZADAS.md # Instruções de teste atualizadas
├── INSTRUCOES_TESTE.md       # Instruções de teste originais
├── README.md                 # Documentação principal do projeto (a ser criada/melhorada)
├── analise_tecnica.md        # Análise técnica inicial do projeto
├── decisoes_tecnicas.md      # Documento com as decisões técnicas tomadas
├── package-lock.json         # Gerado pelo npm, registra as versões exatas das dependências
├── package.json              # Define metadados do projeto, scripts npm e dependências
├── plano_correcao_interatividade.js # Plano de ação para corrigir interatividade (arquivo de trabalho)
├── plano_execucao.md         # Plano de execução inicial do projeto
├── todo.md                   # Lista de tarefas do projeto
├── tsconfig.json             # Configurações do compilador TypeScript
└── webpack.config.js         # Configurações do Webpack para build do projeto
```

### Descrição dos Arquivos Chave:

*   **`src/index.ts`**: É o coração da aplicação no lado do cliente. Ele é responsável por:
    *   Importar os estilos principais.
    *   Esperar o DOM estar completamente carregado.
    *   Buscar os dados do nível (atualmente `level1.json`).
    *   Instanciar o `GameEngine` com o container HTML e os dados do nível.
    *   Configurar os event listeners para os botões de "Usar Dica" e "Reiniciar".
    *   Exibir a dica da palavra vertical e inicializar sua estrutura visual.
    *   Iniciar o jogo através do `gameEngine.startGame()`.
*   **`src/index.html`**: Define a estrutura básica da página do jogo, incluindo:
    *   Meta tags, título e link para fontes externas.
    *   O container principal `<div id="app">` e a estrutura interna da tela do jogo (`game-container`, `game-header`, `game-board`, etc.).
    *   Placeholders para o temporizador, pontuação, tabuleiro (`crossword-container`), exibição da palavra vertical e dicas.
    *   Os botões de controle ("Usar Dica", "Reiniciar").
*   **`src/core/engine/GameEngine.ts`**: Orquestra a maior parte da lógica do jogo.
    *   Inicializa a aplicação PixiJS para renderização.
    *   Cria instâncias do `CrosswordRenderer` (para desenhar) e `WordValidator` (para verificar respostas).
    *   Gerencia o estado do jogo através do `GameStore` (nível atual, tempo, pontuação, célula selecionada, etc.).
    *   Manipula eventos de teclado (`handleKeyDown`) para entrada de letras e navegação.
    *   Lida com a seleção de células (`handleCellSelect`) e atualiza a dica exibida.
    *   Controla o temporizador do jogo.
    *   Gerencia o uso de dicas (`useHint`).
    *   Calcula a pontuação e exibe mensagens de conclusão ou tempo esgotado.
*   **`src/core/engine/CrosswordRenderer.ts`**: Responsável por toda a renderização do tabuleiro de palavras cruzadas usando PixiJS.
    *   Cria a grade de células (`createGrid`) e os campos de texto dentro delas.
    *   Lida com a seleção visual das células (`selectCell`, `updateCellAppearance`).
    *   Atualiza o conteúdo das células com as letras inseridas (`setCellValue`).
    *   Realça palavras corretas ou a palavra vertical (`highlightWord`, `highlightVerticalWord`).
    *   Configura a interatividade das células para capturar cliques (`setupInteraction`).
    *   Adapta o layout do grid ao redimensionar a janela (`resize`).
*   **`src/core/models/Level.ts`**: Define a interface para a estrutura de dados de um nível, incluindo palavras horizontais (com suas posições, dicas e respostas) e a palavra vertical.
*   **`src/core/services/GameStore.ts`**: Implementado como um Singleton, gerencia o estado global do jogo de forma centralizada. Componentes podem acessar e modificar o estado através dele.
*   **`src/data/levels/level1.json`**: Um arquivo JSON que contém os dados para o primeiro nível do jogo, como o tema, limite de tempo, palavras, dicas e a palavra vertical.
*   **`webpack.config.js`**: Configura como o projeto é empacotado pelo Webpack, incluindo o ponto de entrada (`src/index.ts`), regras para processar TypeScript e SCSS, e a configuração do `HtmlWebpackPlugin` para gerar o `index.html` final na pasta `dist`.
*   **`package.json`**: Lista todas as dependências do projeto (como PixiJS, TypeScript, Webpack, loaders, etc.) e define scripts úteis (como `npm start` para rodar o servidor de desenvolvimento e `npm run build` para compilar para produção).





## 2. Fluxo Geral do Jogo e Ligação entre Componentes

O jogo CodyCross Veterinária segue um fluxo de inicialização e execução bem definido, com diferentes componentes interagindo para criar a experiência do usuário.

### 2.1. Inicialização do Jogo

1.  **Carregamento da Página (`index.html`)**: O navegador carrega o arquivo `index.html`, que contém a estrutura básica da interface do usuário (UI) e importa o bundle JavaScript gerado pelo Webpack.
2.  **Execução do Ponto de Entrada (`src/index.ts`)**:
    *   Assim que o DOM está pronto (`DOMContentLoaded`), o script `index.ts` é executado.
    *   Ele realiza uma requisição `fetch` para carregar os dados do nível atual (ex: `src/data/levels/level1.json`).
    *   Após o carregamento bem-sucedido do JSON do nível, ele identifica o container principal do tabuleiro no HTML (`<div id="crossword-container">`).
3.  **Instanciação do `GameEngine` (`src/core/engine/GameEngine.ts`)**:
    *   Uma instância do `GameEngine` é criada, recebendo o container HTML e os dados do nível carregado.
    *   Dentro do construtor do `GameEngine`:
        *   Uma aplicação PixiJS (`PIXI.Application`) é criada e seu canvas é anexado ao container HTML.
        *   O `CrosswordRenderer` é instanciado, recebendo a aplicação PixiJS, os dados do nível e callbacks para seleção de célula e completude de palavra. O `CrosswordRenderer` imediatamente desenha a grade inicial.
        *   O `WordValidator` é instanciado, recebendo os dados do nível e callbacks para validação de palavras e conclusão do jogo.
        *   Event listeners globais são configurados: `keydown` para entrada de teclado e `resize` para adaptar o layout.
        *   O estado inicial do jogo é configurado no `GameStore` (nível, tempo limite, jogo inativo).
4.  **Configuração da UI em `index.ts`**:
    *   Os event listeners para os botões "Usar Dica" e "Reiniciar" são associados às funções correspondentes no `GameEngine` (`useHint()`, `startGame()`).
    *   A dica da palavra vertical e a estrutura visual da palavra vertical são populadas no HTML.
5.  **Início do Jogo (`gameEngine.startGame()`)**:
    *   A função `startGame()` no `GameEngine` é chamada.
    *   Isso reseta o validador, limpa destaques no renderer, zera dicas usadas e marca o jogo como incompleto.
    *   O `GameStore` é atualizado para refletir que o jogo está ativo, com o tempo e pontuação iniciais.
    *   O temporizador do jogo é iniciado.
    *   A UI (timer, pontuação, botão de dica) é atualizada.
    *   Como melhoria de UX, a primeira célula da primeira palavra é selecionada automaticamente (através de um `setTimeout` e chamando `useHint()` que, por sua vez, seleciona a célula se nenhuma estiver selecionada).

### 2.2. Ciclo de Interação do Usuário

1.  **Seleção de Célula**:
    *   O usuário clica em uma célula no tabuleiro renderizado pelo PixiJS.
    *   O `CrosswordRenderer`, através do seu método `setupInteraction`, captura o evento de `pointerdown` na célula específica (ou no container/stage como fallback).
    *   O `CrosswordRenderer` calcula a linha e coluna clicadas e chama seu método `selectCell(row, col)`.
    *   `selectCell` atualiza a aparência da célula selecionada (destaque) e da anteriormente selecionada.
    *   Ele invoca o callback `onCellSelect` passado pelo `GameEngine`, que é o método `handleCellSelect` do `GameEngine`.
    *   `GameEngine.handleCellSelect` atualiza o `GameStore` com a nova célula selecionada e a dica correspondente à palavra horizontal da célula.
    *   A UI no HTML (área de dicas) é atualizada para mostrar a dica da palavra selecionada.
2.  **Entrada de Teclado**:
    *   O usuário digita uma letra, backspace, ou usa as teclas de seta.
    *   O event listener global de `keydown` no `window`, configurado pelo `GameEngine`, captura o evento e chama `GameEngine.handleKeyDown`.
    *   `handleKeyDown` verifica se uma célula está selecionada e se o jogo está ativo.
    *   Se uma letra é digitada:
        *   `CrosswordRenderer.setCellValue(row, col, letter)` é chamado para exibir a letra na célula.
        *   `WordValidator.setLetter(row, col, letter)` é chamado para registrar a letra na lógica de validação.
        *   O `CrosswordRenderer` tenta avançar para a próxima célula da palavra horizontal.
    *   Se Backspace/Delete é pressionado, a letra é removida da célula no renderer e no validator.
    *   Se teclas de seta são pressionadas, `CrosswordRenderer.selectCell` é chamado para mover a seleção.
3.  **Validação de Palavras**:
    *   Após cada letra ser inserida (em `CrosswordRenderer.setCellValue`), os métodos `checkWordCompletion` (para palavras horizontais) e `checkVerticalWordCompletion` são chamados internamente pelo `CrosswordRenderer`.
    *   `checkWordCompletion` verifica se a palavra horizontal atual está completa. Se sim, chama o callback `onWordComplete` (que é `GameEngine.handleWordComplete`).
    *   O `GameEngine` não faz a validação diretamente em `handleWordComplete`, mas o `WordValidator` é o responsável final. A validação da palavra horizontal é disparada explicitamente em `GameEngine.useHint()` após preencher a palavra, ou deveria ser chamada após a entrada do usuário no `GameEngine.handleKeyDown` (atualmente, a validação parece mais acoplada ao `CrosswordRenderer` e `WordValidator` internamente, o que pode ser um ponto de refatoração para centralizar no `GameEngine`).
    *   Quando o `WordValidator` (`validateHorizontalWord` ou `validateVerticalWord`) determina que uma palavra está correta:
        *   Ele chama os callbacks `handleWordValidated` ou `handleVerticalWordValidated` no `GameEngine`.
        *   O `GameEngine` então instrui o `CrosswordRenderer` a destacar a palavra como correta.
        *   A exibição da palavra vertical na UI HTML é atualizada.
4.  **Conclusão do Jogo**:
    *   Quando o `WordValidator` detecta que todas as palavras horizontais e a vertical estão corretas, ele chama o callback `handleGameCompleted` no `GameEngine`.
    *   `GameEngine.handleGameCompleted` para o temporizador, calcula a pontuação final, atualiza o `GameStore` e exibe uma mensagem de conclusão na tela.

### 2.3. Principais Componentes e Suas Responsabilidades

*   **`index.ts`**: Ponto de entrada, orquestração inicial, configuração de eventos DOM básicos.
*   **`GameEngine.ts`**: Cérebro do jogo. Gerencia o fluxo, estado (via `GameStore`), interações principais (teclado, botões de UI), e coordena o `Renderer` e `Validator`.
*   **`CrosswordRenderer.ts`**: Responsável pela apresentação visual. Desenha o tabuleiro, células, letras usando PixiJS. Captura interações de mouse/toque no canvas e as comunica ao `GameEngine` via callbacks. Não contém lógica de jogo, apenas de exibição.
*   **`WordValidator.ts`**: Contém a lógica para verificar se as palavras inseridas pelo usuário estão corretas. Informa o `GameEngine` sobre o status da validação via callbacks.
*   **`GameStore.ts`**: Repositório centralizado para o estado do jogo. Permite que diferentes componentes acessem e modifiquem dados como pontuação, tempo, nível atual, célula selecionada, de forma desacoplada.
*   **`Level.ts` (e arquivos JSON de nível)**: Define a estrutura e fornece os dados para cada fase do jogo (palavras, dicas, etc.).
*   **Arquivos de Estilo SCSS (`src/ui/styles/`)**: Definem a aparência visual dos elementos HTML do jogo.

### Diagrama Simplificado de Interação (Conceitual):

```mermaid
graph TD
    Usuario[Usuário] -- Interage com --> UI_HTML[UI HTML (Botões, etc.)]
    Usuario -- Interage com (Cliques, Teclado) --> Canvas_PixiJS[Canvas PixiJS]

    UI_HTML -- Eventos DOM --> IndexTS[index.ts]
    IndexTS -- Inicializa e coordena --> GameEngine

    Canvas_PixiJS -- Eventos PixiJS --> CrosswordRenderer
    CrosswordRenderer -- Renderiza --> Canvas_PixiJS
    CrosswordRenderer -- Notifica seleção/input --> GameEngine

    GameEngine -- Controla --> CrosswordRenderer
    GameEngine -- Usa --> WordValidator
    GameEngine -- Gerencia estado via --> GameStore
    GameEngine -- Atualiza --> UI_HTML_Stats[UI HTML (Timer, Score, Dicas)]

    WordValidator -- Valida dados de --> LevelData[Dados do Nível (JSON)]
    WordValidator -- Informa resultado --> GameEngine

    GameStore -- Armazena --> EstadoDoJogo
    LevelData -- Carregado por --> IndexTS
    LevelData -- Usado por --> GameEngine
    LevelData -- Usado por --> CrosswordRenderer
```

Este fluxo garante uma separação de preocupações, onde a lógica do jogo, a renderização e a validação são tratadas por módulos distintos, comunicando-se através de callbacks e um store de estado centralizado.


