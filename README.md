# Virologia em Jogo

Jogo educacional de Virologia Veterinária — projeto acadêmico da Universidade de Vassouras. Une estudo e jogo:

- **28 fases** (introdução + 27 doenças virais), liberadas em sequência ou todas pelo *modo exploração*;
- **duas modalidades por fase**: palavras-cruzadas livres e caça-palavras;
- **biblioteca** com as páginas do e-book, transcrição pesquisável, perguntas de revisão e o PDF original;
- **caderno de estudos**: favoritos, revisados e anotações, com backup (exportar/importar);
- **funciona offline** e pode ser instalado no celular (PWA).

**Jogar agora:** https://codycross-vet.vercel.app (funciona no computador e no celular, sem instalar nada).

O conteúdo segue o protótipo **V5 aprovado pela equipe** de estudantes (mesmas fases, perguntas e grades); esta versão o reescreve em TypeScript com testes.

O visual segue o próprio e-book: moldura verde `#03602A`, página cor de papel `#DDD8CC`, texto preto, Comic Neue nos títulos de capítulo e Poppins no texto (cores medidas nas páginas do PDF; fontes servidas pelo site). As palavras-cruzadas imitam as de revista e o caça-palavras marca as palavras com "marca-texto". O sumário lista as fases como o sumário do livro. Os textos do site, com o antes e depois, estão em `docs/textos-do-site.md`.

## Passo a passo: baixar e rodar no seu computador

Não é preciso saber programar. Você vai instalar um programa (o Node.js), baixar os arquivos e digitar três comandos.

**1. Instale o Node.js (só na primeira vez).**
Entre em [nodejs.org](https://nodejs.org), baixe a versão **LTS** e instale clicando em "Avançar" até o fim. Serve a versão 20 ou mais recente.

**2. Baixe os arquivos do jogo.**
Nesta página do GitHub, clique no botão verde **Code** e depois em **Download ZIP**. Descompacte o arquivo numa pasta fácil de achar, por exemplo na Área de Trabalho. A pasta vai se chamar `codycross-vet-main`.
(Quem usa Git pode clonar: `git clone https://github.com/Ihmaid/codycross-vet.git`.)

**3. Abra um terminal dentro da pasta.**
- Windows: abra a pasta descompactada, clique com o botão direito num espaço vazio e escolha **Abrir no Terminal**. (Outra forma: clique na barra de endereço da pasta, digite `cmd` e aperte Enter.)
- Mac: abra o app **Terminal**, digite `cd ` (com um espaço no fim), arraste a pasta para a janela e aperte Enter.

**4. Instale as dependências (só na primeira vez).**
Digite e aperte Enter:

```bash
npm install
```

Leva um ou dois minutos. Avisos em amarelo (`npm warn`) são normais e podem ser ignorados.

**5. Inicie o jogo.**

```bash
npm start
```

Quando aparecer `compiled successfully`, abra o navegador em **http://localhost:3000**. O jogo fica no ar enquanto o terminal estiver aberto; para parar, volte ao terminal e aperte `Ctrl + C`.

**Da próxima vez**, basta repetir os passos 3 e 5.

### Problemas comuns

| O que aparece | O que fazer |
|---|---|
| `'npm' não é reconhecido` ou `command not found: npm` | O Node.js não foi instalado ou o terminal foi aberto antes da instalação. Instale (passo 1), feche o terminal e abra de novo. |
| `ENOENT ... package.json` | O terminal não está dentro da pasta do jogo. Refaça o passo 3 na pasta que tem o arquivo `package.json`. |
| `EADDRINUSE: address already in use :::3000` | O jogo já está aberto em outro terminal. Use esse, ou feche-o com `Ctrl + C`. |
| O progresso sumiu | O progresso fica salvo no navegador. `localhost:3000` e o site publicado guardam progressos separados. |

## Comandos para desenvolvimento

```bash
npm start          # servidor de desenvolvimento em http://localhost:3000
npm run build      # versão final em dist/ (é a pasta publicada no site)
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
  ui/                         telas: homeView (sumário), gameView (fase), libraryView (biblioteca), winModal (carimbo)
  ui/styles/                  _base (cores, fontes, moldura), _home, _game, _library, _modal
  sw.template.js              modo offline (o build gera dist/sw.js)
public/                       ilustrações, páginas do e-book, ícones, manifesto e PDF (copiados como estão)
tests/                        testes automatizados
docs/                         textos do site aprovados pelo time (antes e depois)
```

## Como editar o conteúdo

As fases ficam em `src/data/stages.json`. Cada fase tem `cross` e `hunt`, listas de `["RESPOSTA", "Pista"]`.
Depois de editar, rode `npm test`: os testes conferem se todas as palavras se cruzam, se cabem no caça-palavras e se as imagens existem.
Se o conteúdo de uma fase mudar de propósito, o teste de fidelidade ao V5 vai acusar diferença naquela fase — atualize o gabarito ou remova a fase do teste.

## Créditos

Conteúdo, ilustrações e referências: e-book *Livro de Jogos — Virologia Veterinária* e TCCs fornecidos pela equipe. Revisões, notas e perguntas não substituem a revisão científica final da equipe.
