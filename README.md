# Virologia em Jogo

Jogo educacional de Virologia Veterinária — projeto acadêmico da Universidade de Vassouras. Une estudo e jogo:

- **28 fases** (introdução + 27 doenças virais), liberadas em sequência ou todas pelo *modo exploração*;
- **duas modalidades por fase**: palavras-cruzadas livres e caça-palavras;
- **biblioteca** com as páginas do e-book, transcrição pesquisável, perguntas de revisão e o PDF original;
- **caderno de estudos**: favoritos, revisados e anotações, com backup (exportar/importar);
- **competição**: salas privadas para até 30 jogadores ao mesmo tempo, como no Gartic, com placar ao vivo e pódio;
- **funciona offline** e pode ser instalado no celular (PWA).

**Jogar agora:** https://codycross-vet.vercel.app (funciona no computador e no celular, sem instalar nada).

O conteúdo segue o protótipo **V5 aprovado pela equipe** de estudantes (mesmas fases, perguntas e grades); esta versão o reescreve em TypeScript com testes.

O site abre numa capa com a apresentação do projeto e os links para cada parte (sumário de fases, biblioteca, caderno e competição).

O visual segue o próprio e-book: moldura verde `#03602A`, página cor de papel `#DDD8CC`, texto preto, Comic Neue nos títulos de capítulo e Poppins no texto (cores medidas nas páginas do PDF; fontes servidas pelo site). As palavras-cruzadas imitam as de revista e o caça-palavras marca as palavras com "marca-texto". O sumário (`#/fases`) lista as fases como o sumário do livro. Os textos do site, com o antes e depois, estão em `docs/textos-do-site.md`.

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

**Para testar a competição no computador**, use `npm run dev` no lugar de `npm start`. Ele liga o site e o servidor da competição juntos. Para simular vários jogadores, abra a Competição numa janela normal e em uma ou mais janelas anônimas (cada janela é um jogador).

### Problemas comuns

| O que aparece | O que fazer |
|---|---|
| `'npm' não é reconhecido` ou `command not found: npm` | O Node.js não foi instalado ou o terminal foi aberto antes da instalação. Instale (passo 1), feche o terminal e abra de novo. |
| `ENOENT ... package.json` | O terminal não está dentro da pasta do jogo. Refaça o passo 3 na pasta que tem o arquivo `package.json`. |
| `EADDRINUSE: address already in use :::3000` (ou `:::3001`) | O jogo já está aberto em outro terminal. Use esse, ou feche-o com `Ctrl + C`. |
| Competição fica em "Conectando ao servidor" no computador | Você usou `npm start`. Feche e rode `npm run dev`. |
| O progresso sumiu | O progresso fica salvo no navegador. `localhost:3000` e o site publicado guardam progressos separados. |

## Comandos para desenvolvimento

```bash
npm start          # site em http://localhost:3000
npm run dev        # site + servidor da competição (porta 3001)
npm run server     # só o servidor da competição
npm run build      # versão final do site em dist/ (é a pasta publicada na Vercel)
npm run build:server && npm run start:server   # servidor da competição como no Render
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

## Competição

O site continua estático na Vercel. A competição usa um servidor separado (Node.js + Socket.IO, pasta `server/`), publicado no Render.

**Como funciona**

- Quem cria a sala organiza a partida e também joga: escolhe palavras-cruzadas ou caça-palavras, de 1 a 5 rodadas (um tema por rodada, ou sorteado), o tempo de cada rodada e se vale pedir dica.
- A turma entra pelo código de 5 letras, pelo link ou pelo QR code. Até 30 jogadores por sala.
- Pontos: 100 por palavra certa, 1 por segundo que sobrou para quem termina antes, menos 25 por dica. No empate, fica na frente quem chegou primeiro à pontuação.
- O servidor guarda as respostas e o cronômetro: o navegador recebe só a grade e as pistas, e cada palavra é conferida no servidor.
- Se a internet cair, o jogador volta para a sala com os pontos ao abrir o site de novo.

**Publicar o servidor no Render (só na primeira vez)**

1. Entre em [render.com](https://render.com) com a conta do GitHub.
2. **New → Blueprint**, escolha o repositório `codycross-vet` e a branch `main`. O Render lê o `render.yaml` e cria o serviço `virologia-em-jogo` no plano gratuito.
3. Clique em **Apply** e espere o primeiro deploy terminar. O endereço será `https://virologia-em-jogo.onrender.com`, que é o que o site já usa.

Se o Render der outro endereço (por exemplo, porque o nome já estava em uso), cadastre-o na Vercel em **Settings → Environment Variables** como `COMPETITION_SERVER_URL` e faça um novo deploy do site.

**Limites do plano gratuito**

- O servidor "dorme" depois de uns 15 minutos sem uso e leva cerca de um minuto para acordar. Antes da aula, abra a Competição uns minutos antes para acordá-lo.
- As salas ficam na memória do servidor: se ele reiniciar (por exemplo, num novo deploy), as partidas em andamento se perdem. Evite publicar mudanças durante uma aula.

## Estrutura

```
src/
  index.html, index.ts        página e inicialização (rotas por #: #/ capa, #/fases, #/fase/raiva, #/biblioteca, #/caderno...)
  data/                       conteúdo do e-book: stages.json (fases), study.json (páginas), references.json
  core/                       lógica pura e testada
    crossword.ts              montagem das palavras-cruzadas
    wordSearch.ts             montagem do caça-palavras
    progress.ts               progresso, pontuação e desbloqueio
    notebook.ts               caderno de estudos e backup
    content.ts, text.ts, types.ts
    match.ts, protocol.ts     regras e mensagens da competição (usadas pelo site e pelo servidor)
  competition/connection.ts   conexão com o servidor da competição (reconecta sozinha)
  ui/                         telas: coverView (capa), homeView (sumário), gameView (fase), libraryView (biblioteca), winModal (carimbo)
  ui/competition/             competição: competitionView (salas), crossBoard e huntBoard (grades), qr
  ui/styles/                  _base (cores, fontes, moldura), _cover, _home, _game, _library, _modal, _competition
  sw.template.js              modo offline (o build gera dist/sw.js)
server/                       servidor da competição: room.ts (regras da sala), app.ts (conexões), index.ts
render.yaml                   configuração do servidor no Render
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
