# CodyCross Veterinária

Jogo de palavras cruzadas no estilo CodyCross com tema de Medicina Veterinária, feito para a apresentação de um projeto na Universidade de Vassouras.

## Como rodar

Requer Node.js 20 ou mais recente.

```bash
npm install
npm start          # servidor de desenvolvimento em http://localhost:3000
npm run build      # gera a versão final em dist/
```

## Verificações

```bash
npm test           # testes automatizados (Jest)
npm run typecheck  # checagem de tipos (TypeScript)
npm run lint       # padrões de código (ESLint)
npm run check      # tudo acima
```

## Estrutura

```
src/
  index.ts                     sequência de níveis e botões da página
  index.html                   página do jogo
  core/
    engine/GameEngine.ts       regras da partida (teclado, dicas, tempo, fim de nível)
    engine/CrosswordRenderer.ts desenho da grade no canvas (PixiJS)
    engine/WordValidator.ts    respostas do jogador e conclusão do nível (lógica pura)
    engine/CountdownTimer.ts   cronômetro
    levels.ts                  validação dos arquivos de nível
    scoring.ts, input.ts, progress.ts
  data/levels/                 níveis em JSON (+ index.ts com a ordem)
  ui/GameHud.ts                textos da página (tempo, pontuação, dicas)
  ui/mobileInput.ts            teclado virtual no celular
  ui/styles/                   estilos (SCSS)
tests/                         testes automatizados
docs/                          documentação e anotações do projeto
```

## Como criar um nível

1. Crie `src/data/levels/levelN.json` seguindo o formato dos existentes.
2. Adicione-o à lista em `src/data/levels/index.ts`.
3. Rode `npm test`: os testes conferem se o nível é válido.

Regras de um nível:

- Palavras só com letras A-Z, sem acentos nem espaços (ex.: `IMUNIZACAO`).
- `position` numera as linhas a partir de 0.
- `intersectionIndex` é a coluna onde a palavra começa.
- A palavra vertical, se houver, é formada pela primeira letra de cada palavra horizontal, em ordem. Deixe `"word": ""` para um nível sem palavra vertical.
