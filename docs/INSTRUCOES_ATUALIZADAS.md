# Instruções Atualizadas para Executar o Jogo CodyCross Veterinária

Este documento contém instruções detalhadas e atualizadas para executar o jogo CodyCross Veterinária sem erros.

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
   ou
   ```
   npm i
   ```
   Este processo pode levar alguns minutos, dependendo da sua conexão com a internet.

### 2. Iniciar o Servidor de Desenvolvimento

1. No mesmo terminal, execute o comando:
   ```
   npm start
   ```
2. Aguarde até ver uma mensagem indicando que o servidor está rodando (algo como "Project is running at http://localhost:3000/")
3. O navegador deve abrir automaticamente. Caso não abra, acesse manualmente o endereço: http://localhost:3000

### Solução de Problemas Comuns

Se você encontrar erros durante a execução, tente as seguintes soluções:

1. **Erro relacionado à pasta "public"**:
   - A pasta "public" é criada automaticamente se não existir
   - Não é necessário criar manualmente esta pasta

2. **Erro de módulo não encontrado**:
   - Todos os arquivos necessários estão incluídos nesta versão atualizada
   - Se ainda encontrar este erro, tente executar `npm install` novamente

3. **Avisos sobre funções SASS depreciadas**:
   - Estes avisos foram corrigidos na versão atual
   - Você pode ignorar avisos restantes, pois não afetam o funcionamento do jogo

4. **Erro ao carregar arquivos JSON**:
   - A configuração do webpack foi atualizada para lidar corretamente com arquivos JSON
   - Os arquivos de níveis agora são carregados corretamente da pasta src/data

5. **Se nada funcionar**:
   - Tente limpar o cache do npm: `npm cache clean --force`
   - Remova a pasta node_modules e o arquivo package-lock.json
   - Execute `npm install` novamente
   - Reinicie o servidor com `npm start`

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
