# Instruções para Testar o Jogo CodyCross Veterinária

Este documento contém instruções detalhadas para executar e testar a versão inicial do jogo CodyCross Veterinária.

## Requisitos

- Node.js (versão 14 ou superior)
- NPM (normalmente instalado com o Node.js)
- Navegador web moderno (Chrome, Firefox, Edge ou Safari)

## Passos para Executar o Jogo

### 1. Preparar o Ambiente

1. Extraia o arquivo zip do projeto em uma pasta de sua preferência
2. Abra um terminal ou prompt de comando
3. Navegue até a pasta do projeto:
   ```
   cd caminho/para/projeto-codycross-vet
   ```
4. Instale as dependências do projeto:
   ```
   npm install
   ```
   Este processo pode levar alguns minutos, dependendo da sua conexão com a internet.

### 2. Iniciar o Servidor de Desenvolvimento

1. No mesmo terminal, execute o comando:
   ```
   npm start
   ```
2. Aguarde até ver uma mensagem indicando que o servidor está rodando (algo como "Project is running at http://localhost:3000/")
3. O navegador deve abrir automaticamente. Caso não abra, acesse manualmente o endereço: http://localhost:3000

## Como Jogar

### Objetivo do Jogo

O objetivo do CodyCross Veterinária é preencher todas as palavras horizontais baseadas nas dicas fornecidas. Ao preencher corretamente as palavras horizontais, você formará uma palavra vertical relacionada à Medicina Veterinária.

### Controles

- **Mouse**: Clique em uma célula para selecioná-la
- **Teclado**:
  - Letras (A-Z): Digite para preencher a célula selecionada
  - Setas (←→↑↓): Navegue entre as células
  - Backspace/Delete: Apague a letra da célula selecionada

### Funcionalidades

1. **Seleção de Células**: Clique em uma célula para selecioná-la. A dica correspondente à palavra será exibida abaixo do tabuleiro.

2. **Preenchimento de Palavras**: Digite as letras para preencher as palavras horizontais. Quando uma palavra estiver correta, ela será destacada em verde.

3. **Palavra Vertical**: À medida que você preenche as palavras horizontais, a palavra vertical vai sendo formada pelas letras nas interseções.

4. **Sistema de Dicas**: Clique no botão "Usar Dica" para revelar automaticamente uma palavra horizontal completa. Cada dica utilizada reduz sua pontuação final.

5. **Temporizador**: Você tem um tempo limitado para completar o nível. O tempo restante é exibido no topo da tela.

6. **Pontuação**: Sua pontuação é calculada com base no tempo restante e na quantidade de dicas utilizadas.

7. **Reiniciar**: A qualquer momento, você pode clicar no botão "Reiniciar" para começar o nível novamente.

## Testando Funcionalidades Específicas

### 1. Teste de Preenchimento de Palavras

1. Selecione uma célula da primeira linha
2. Leia a dica exibida abaixo do tabuleiro
3. Digite a resposta letra por letra
4. Observe se a palavra é destacada em verde quando estiver correta

### 2. Teste do Sistema de Dicas

1. Selecione uma célula de uma linha que você não saiba a resposta
2. Clique no botão "Usar Dica"
3. Observe se a palavra é preenchida automaticamente
4. Verifique se o contador de dicas é incrementado

### 3. Teste da Palavra Vertical

1. Preencha várias palavras horizontais
2. Observe a formação da palavra vertical no display acima do tabuleiro
3. Verifique se as letras nas interseções são corretamente transferidas para a palavra vertical

### 4. Teste de Conclusão do Jogo

1. Complete todas as palavras horizontais
2. Observe se uma mensagem de parabéns é exibida
3. Verifique se a pontuação final é calculada corretamente
4. Teste o botão "Jogar Novamente" para reiniciar o jogo

### 5. Teste de Tempo Esgotado

1. Inicie um novo jogo
2. Aguarde o temporizador chegar a zero (ou modifique o código para acelerar o tempo)
3. Verifique se uma mensagem de tempo esgotado é exibida
4. Teste o botão "Tentar Novamente" para reiniciar o jogo

## Problemas Conhecidos na Versão Inicial

- A responsividade em dispositivos muito pequenos pode precisar de ajustes
- Algumas animações e efeitos visuais ainda serão implementados em versões futuras
- O carregamento de níveis adicionais será implementado posteriormente

## Feedback

Após testar o jogo, por favor, forneça feedback sobre:

1. Facilidade de uso da interface
2. Clareza das instruções e dicas
3. Desempenho e responsividade
4. Quaisquer bugs ou comportamentos inesperados encontrados
5. Sugestões para melhorias futuras

Este feedback será valioso para orientar o desenvolvimento das próximas versões do jogo.
