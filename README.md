# Virologia em Jogo

Jogo educacional de Virologia Veterinária — projeto acadêmico da Universidade de Vassouras. Une estudo e jogo:

- **28 fases** (introdução + 27 doenças virais), liberadas em sequência ou todas pelo *modo exploração*;
- **duas modalidades por fase**: palavras-cruzadas livres e caça-palavras;
- **biblioteca** com as páginas do e-book, transcrição pesquisável, perguntas de revisão e o PDF original;
- **caderno de estudos**: favoritos, revisados e anotações, com backup (exportar/importar);
- **funciona offline** e pode ser instalado no celular (PWA).

O conteúdo e o visual seguem o protótipo **V5 aprovado pela equipe** de estudantes; esta versão o reescreve em TypeScript com testes, mantendo as mesmas fases, grades e textos.

## Como rodar

Requer Node.js 20 ou mais recente.

```bash
npm install
npm start          # servidor de desenvolvimento em http://localhost:3000
npm run build      # versão final em dist/
```

## Verificações

```bash
npm test           # testes automatizados (Jest)
npm run typecheck  # checagem de tipos (TypeScript)
npm run lint       # padrões de código (ESLint)
npm run check      # tudo acima
```

Os testes de `tests/parity.test.ts` garantem que as palavras-cruzadas e os caça-palavras gerados são **idênticos** aos do protótipo V5 (o gabarito `tests/fixtures/v5-layouts.json` foi gerado com o código original).

## Publicação (Vercel)

O `vercel.json` já está configurado (build `npm run build`, pasta `dist`). Para publicar:

1. Entre em [vercel.com](https://vercel.com) com a conta do GitHub.
2. **Add New → Project** e importe o repositório `codycross-vet`.
3. Clique em **Deploy** (não precisa alterar nenhuma configuração).

Depois disso, cada `git push` na branch `main` publica uma nova versão automaticamente.

## Estrutura

```
src/
  index.html, index.ts        página e inicialização (rotas por #: #/fase/raiva, #/biblioteca, #/caderno...)
  data/                       conteúdo do e-book: stages.json (fases), study.json (páginas), references.json
  core/                       lógica pura e testada
    crossword.ts              montagem das palavras-cruzadas
    wordSearch.ts             montagem do caça-palavras
    progress.ts               progresso, pontuação e desbloqueio
    notebook.ts               caderno de estudos e backup
    content.ts, text.ts, types.ts
  ui/                         telas: homeView (mapa), gameView (fase), libraryView (biblioteca), winModal, effects
  ui/styles/                  estilos do V5 (_v5-*.scss) + _extras.scss (efeitos e ajustes)
  sw.template.js              modo offline (o build gera dist/sw.js)
public/                       ilustrações, páginas do e-book, ícones, manifesto e PDF (copiados como estão)
tests/                        testes automatizados
docs/                         anotações históricas da versão anterior (CodyCross)
```

## Como editar o conteúdo

As fases ficam em `src/data/stages.json`. Cada fase tem `cross` e `hunt`, listas de `["RESPOSTA", "Pista"]`.
Depois de editar, rode `npm test`: os testes conferem se todas as palavras se cruzam, se cabem no caça-palavras e se as imagens existem.
Se o conteúdo de uma fase mudar de propósito, o teste de fidelidade ao V5 vai acusar diferença naquela fase — atualize o gabarito ou remova a fase do teste.

## Créditos

Conteúdo, ilustrações e referências: e-book *Livro de Jogos — Virologia Veterinária* e TCCs fornecidos pela equipe. Revisões, notas e perguntas não substituem a revisão científica final da equipe.
