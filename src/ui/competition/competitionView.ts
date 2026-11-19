import { Connection, ConnectionStatus, savedName, saveName } from '../../competition/connection';
import { STAGES } from '../../core/content';
import {
  cleanCode,
  cleanName,
  CODE_LENGTH,
  HINT_COST,
  MatchSettings,
  MAX_PLAYERS,
  MAX_ROUNDS,
  RANDOM_STAGE,
  ROUND_SECONDS,
} from '../../core/match';
import { PlayerView, RoomView, RoundView } from '../../core/protocol';
import { $, html, Html, replayAnimation, setHtml, show } from '../dom';
import { navigate } from '../router';
import { CrossBoard } from './crossBoard';
import { HuntBoard } from './huntBoard';
import { qrSvg } from './qr';

type Screen = 'entry' | 'lobby' | 'play' | 'final';
type FeedbackKind = '' | 'good' | 'bad';

const stageTitle = (id: string): string => STAGES.find((s) => s.id === id)?.title ?? id;
const minutes = (seconds: number): string => (seconds % 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : `${seconds / 60}`);
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const DEFAULT_TITLE = document.title;
/** Tempo em que quem acabou de entrar fica destacado na lista. */
const FRESH_MS = 6000;

/** "Bia", "Bia e Caio", "Bia, Caio e Duda". */
function joinNames(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : (names[0] ?? '');
}

/** Competição: criar ou entrar numa sala, esperar a turma, jogar as rodadas e ver o pódio. */
export class CompetitionView {
  private readonly conn: Connection;
  private readonly cross: CrossBoard;
  private readonly hunt: HuntBoard;
  private room: RoomView | null = null;
  private round: RoundView | null = null;
  /** Rodada já montada na tela. */
  private loadedRound = 0;
  private solutionShown = 0;
  /** Diferença entre o relógio do servidor e o deste aparelho. */
  private clockOffset = 0;
  private ticker: number | null = null;
  private renderedRules = '';
  private renderedQr = '';
  private visible = false;
  private announcedFinish = 0;
  /** O carimbo do pódio aparece uma vez por partida. */
  private stamped = false;
  /** Jogadores vistos na sala de espera (id → apelido), para avisar quem entrou ou saiu. */
  private lobbyPlayers: Map<string, string> | null = null;
  /** Quem acabou de entrar fica destacado na lista por alguns segundos. */
  private readonly freshPlayers = new Map<string, number>();
  private freshTimer: number | null = null;

  constructor() {
    this.conn = new Connection({
      status: (s) => this.renderStatus(s),
      state: (v) => this.onState(v),
      round: (r) => this.onRound(r),
      left: (reason) => this.onLeft(reason),
    });
    const say = (m: string, k?: FeedbackKind) => this.say(m, k);
    const progress = (done: number, total: number) => this.setProgress(done, total);
    this.cross = new CrossBoard($('match-cross-board'), $('match-clues'), {
      say,
      progress,
      submit: async (index, answer) => {
        const r = await this.conn.request('answer', { round: this.round?.number ?? 0, index, answer });
        if (!r.ok) {
          this.say(r.error, 'bad');
          return undefined;
        }
        return r.correct ? (r.word ?? answer) : null;
      },
    });
    this.hunt = new HuntBoard($('match-hunt-board'), $('match-clues'), {
      say,
      progress,
      select: async (from, to) => {
        const r = await this.conn.request('select', { round: this.round?.number ?? 0, from, to });
        if (!r.ok) {
          this.say(r.error, 'bad');
          return undefined;
        }
        return r.index >= 0 && r.word && r.coords ? { index: r.index, word: r.word, coords: r.coords } : null;
      },
    });
    this.bind();
  }

  /** Aberta pelo roteador: #/competicao ou #/sala/CODIGO. */
  open(code?: string): void {
    this.visible = true;
    this.conn.connect();
    const wanted = code ? cleanCode(code) : '';
    const session = this.conn.session;
    if (session && (!wanted || wanted === session.code)) {
      if (this.room) {
        if (location.hash !== `#/sala/${this.room.code}`) history.replaceState(null, '', `#/sala/${this.room.code}`);
        this.render();
      } else {
        this.showScreen('entry');
        this.entryMessage('Voltando para a sala…');
      }
      return;
    }
    this.showScreen('entry');
    this.entryMessage(session && wanted ? `Ao entrar na sala ${wanted}, você sai da sala ${session.code}.` : '');
    const name = savedName();
    for (const id of ['comp-create-name', 'comp-join-name']) {
      const input = $<HTMLInputElement>(id);
      if (!input.value) input.value = name;
    }
    if (wanted) {
      $<HTMLInputElement>('comp-join-code').value = wanted;
      $<HTMLInputElement>('comp-join-name').focus();
    }
  }

  close(): void {
    this.visible = false;
    document.title = DEFAULT_TITLE;
  }

  // ---------------------------------------------------------------- eventos do servidor

  private onState(v: RoomView): void {
    const firstState = !this.room;
    this.room = v;
    this.clockOffset = v.serverNow - Date.now();
    if (v.status !== 'final') this.stamped = false;
    if (v.status === 'lobby') {
      this.loadedRound = 0;
      this.solutionShown = 0;
    }
    // Endereço da sala na barra do navegador (para compartilhar ou recarregar).
    if (this.visible && location.hash !== `#/sala/${v.code}`) history.replaceState(null, '', `#/sala/${v.code}`);
    if (firstState) this.entryMessage('');
    this.render();
  }

  private onRound(r: RoundView): void {
    this.round = r;
    if (this.loadedRound === r.number) return;
    this.loadedRound = r.number;
    this.solutionShown = 0;
    this.announcedFinish = 0;
    if (r.puzzle.kind === 'cross') this.cross.load(r.puzzle);
    else this.hunt.load(r.puzzle);
    show($('match-cross'), r.puzzle.kind === 'cross');
    show($('match-hunt-board'), r.puzzle.kind === 'hunt');
    $('match-clues-title').textContent = r.puzzle.kind === 'cross' ? 'Pistas' : 'Palavras escondidas';
    $('match-instructions').textContent =
      r.puzzle.kind === 'cross'
        ? 'Toque numa casa ou numa pista e escreva a resposta sem acentos. Quando a palavra fica completa, ela é conferida.'
        : 'Arraste de uma ponta à outra da palavra. Vale na horizontal, vertical e diagonal, em qualquer sentido.';
    this.say('');
    if (this.visible && r.number > 1) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    if (this.room) this.render();
  }

  private onLeft(reason: 'kicked' | 'closed' | 'gone'): void {
    this.room = null;
    this.round = null;
    this.loadedRound = 0;
    this.stopTicker();
    this.resetLobbyNews();
    document.title = DEFAULT_TITLE;
    const message = {
      kicked: 'Você foi removido da sala pelo organizador.',
      closed: 'A sala foi encerrada.',
      gone: 'Essa sala não existe mais. Crie uma nova ou entre em outra.',
    }[reason];
    if (this.visible) {
      history.replaceState(null, '', '#/competicao');
      this.showScreen('entry');
    }
    this.entryMessage(message, 'bad');
  }

  // ---------------------------------------------------------------- telas

  private showScreen(screen: Screen): void {
    show($('comp-entry'), screen === 'entry');
    show($('comp-lobby'), screen === 'lobby');
    show($('comp-play'), screen === 'play');
    show($('comp-final'), screen === 'final');
  }

  private render(): void {
    const v = this.room;
    if (!v) return;
    if (v.status !== 'lobby') {
      this.resetLobbyNews();
      if (this.visible) document.title = DEFAULT_TITLE;
    }
    if (v.status === 'lobby') {
      this.showScreen('lobby');
      this.renderLobby(v);
      this.stopTicker();
    } else if (v.status === 'final') {
      this.showScreen('final');
      this.renderFinal(v);
      this.stopTicker();
    } else {
      this.showScreen('play');
      this.renderPlay(v);
      this.startTicker();
    }
  }

  private renderStatus(status: ConnectionStatus): void {
    const el = $('comp-status');
    const text =
      status === 'connecting'
        ? 'Conectando ao servidor da competição. Na primeira vez do dia isso pode levar até um minuto.'
        : status === 'offline'
          ? 'Sem conexão com o servidor. Tentando de novo…'
          : '';
    el.textContent = text;
    el.className = `comp-status ${status === 'offline' ? 'is-offline' : ''}`;
    show(el, !!text);
    const online = status === 'online';
    document.querySelectorAll<HTMLButtonElement>('#comp-entry button[type="submit"]').forEach((b) => (b.disabled = !online));
  }

  private me(v: RoomView): PlayerView | undefined {
    return v.players.find((p) => p.id === v.you.id);
  }

  private isHost(v: RoomView): boolean {
    return !!this.me(v)?.host;
  }

  private hostName(v: RoomView): string {
    return v.players.find((p) => p.host)?.name ?? 'o organizador';
  }

  private roomLink(code: string): string {
    return `${location.origin}${location.pathname}#/sala/${code}`;
  }

  // ---------------------------------------------------------------- sala de espera

  private renderLobby(v: RoomView): void {
    const host = this.isHost(v);
    $('lobby-code').textContent = v.code;
    const link = this.roomLink(v.code);
    $('lobby-link').textContent = link;
    if (this.renderedQr !== link) {
      setHtml($('lobby-qr'), qrSvg(link));
      this.renderedQr = link;
    }
    $('lobby-count').textContent = `(${v.players.length} de ${MAX_PLAYERS})`;
    this.lobbyNews(v);
    // Na aba do navegador, para quem foi mandar o link e voltou.
    if (this.visible) document.title = `Sala ${v.code} (${plural(v.players.length, 'jogador', 'jogadores')})`;
    const now = Date.now();
    setHtml(
      $('lobby-players'),
      html`${v.players.map(
        (p) => html`<li class="${p.online ? '' : 'is-offline'} ${p.id === v.you.id ? 'is-you' : ''} ${(this.freshPlayers.get(p.id) ?? 0) > now ? 'is-new' : ''}">
          <span class="player-name">${p.name}</span>
          ${p.host ? html`<i>organiza a partida</i>` : ''}
          ${p.id === v.you.id ? html`<i>você</i>` : ''}
          ${p.online ? '' : html`<i>sem conexão</i>`}
          ${host && p.id !== v.you.id ? html`<button type="button" class="link-button" data-kick="${p.id}">Remover</button>` : ''}
        </li>`
      )}`
    );
    this.renderRules(v, host);
    show($('lobby-start'), host);
    $('lobby-wait').textContent = host
      ? v.players.length === 1
        ? 'Você pode começar sozinho para testar, ou esperar a turma entrar.'
        : ''
      : `Esperando ${this.hostName(v)} começar a partida.`;
  }

  /** Avisa quem entrou ou saiu desde a última atualização (não na primeira vez que a sala aparece). */
  private lobbyNews(v: RoomView): void {
    const before = this.lobbyPlayers;
    this.lobbyPlayers = new Map(v.players.map((p) => [p.id, p.name]));
    if (!before) return;
    const joined = v.players.filter((p) => !before.has(p.id) && p.id !== v.you.id);
    const left = [...before].filter(([id]) => !this.lobbyPlayers!.has(id)).map(([, name]) => name);
    if (!joined.length && !left.length) return;
    const until = Date.now() + FRESH_MS;
    for (const p of joined) this.freshPlayers.set(p.id, until);
    const news = [
      joined.length ? `${joinNames(joined.map((p) => p.name))} ${joined.length === 1 ? 'entrou' : 'entraram'} na sala.` : '',
      left.length ? `${joinNames(left)} ${left.length === 1 ? 'saiu' : 'saíram'}.` : '',
    ]
      .filter(Boolean)
      .join(' ');
    $('lobby-news').textContent = news;
    if (joined.length) replayAnimation($('lobby-news'), 'bump-in');
    // Tira o destaque depois de alguns segundos.
    if (this.freshTimer) clearTimeout(this.freshTimer);
    this.freshTimer = window.setTimeout(() => {
      this.freshTimer = null;
      this.freshPlayers.clear();
      if (this.room?.status === 'lobby') this.renderLobby(this.room);
    }, FRESH_MS);
  }

  private resetLobbyNews(): void {
    this.lobbyPlayers = null;
    this.freshPlayers.clear();
    if (this.freshTimer) clearTimeout(this.freshTimer);
    this.freshTimer = null;
    const news = document.getElementById('lobby-news');
    if (news) news.textContent = '';
  }

  private renderRules(v: RoomView, host: boolean): void {
    const key = JSON.stringify([host, v.settings]);
    if (key === this.renderedRules) return;
    this.renderedRules = key;
    const s = v.settings;
    if (!host) {
      setHtml(
        $('lobby-rules'),
        html`<p>${s.mode === 'cross' ? 'Palavras-cruzadas' : 'Caça-palavras'}, ${plural(s.stages.length, 'rodada', 'rodadas')} de ${minutes(
          s.seconds
        )} min, ${s.hints ? 'com dicas' : 'sem dicas'}.</p>
        <ol class="round-summary">${s.stages.map((id) => html`<li>${id === RANDOM_STAGE ? 'Tema sorteado' : stageTitle(id)}</li>`)}</ol>`
      );
      return;
    }
    const options = (selected: string): Html =>
      html`<option value="${RANDOM_STAGE}" ${selected === RANDOM_STAGE ? html`selected` : ''}>Sortear um tema</option>${STAGES.map(
        (st, i) => html`<option value="${st.id}" ${st.id === selected ? html`selected` : ''}>${i + 1}. ${st.title}</option>`
      )}`;
    setHtml(
      $('lobby-rules'),
      html`<form id="rules-form" class="rules-form">
        <fieldset class="mode-choice">
          <legend>Jogo</legend>
          <label class="check"><input type="radio" name="mode" value="cross" ${s.mode === 'cross' ? html`checked` : ''}> Palavras-cruzadas</label>
          <label class="check"><input type="radio" name="mode" value="hunt" ${s.mode === 'hunt' ? html`checked` : ''}> Caça-palavras</label>
        </fieldset>
        <fieldset>
          <legend>Temas (um por rodada)</legend>
          <ol class="round-list">${s.stages.map(
            (id, i) => html`<li>
              <label class="visually-hidden" for="round-${i}">Tema da rodada ${i + 1}</label>
              <select id="round-${i}" data-round="${i}">${options(id)}</select>
              ${s.stages.length > 1 ? html`<button type="button" class="link-button" data-remove="${i}" aria-label="Tirar a rodada ${i + 1}">Tirar</button>` : ''}
            </li>`
          )}</ol>
          ${s.stages.length < MAX_ROUNDS ? html`<button type="button" class="button button-quiet" id="add-round">Adicionar rodada</button>` : ''}
        </fieldset>
        <label class="rules-time">Tempo de cada rodada
          <select name="seconds">${ROUND_SECONDS.map(
            (sec) => html`<option value="${sec}" ${sec === s.seconds ? html`selected` : ''}>${minutes(sec)} minutos</option>`
          )}</select>
        </label>
        <label class="check"><input type="checkbox" name="hints" ${s.hints ? html`checked` : ''}> Permitir dicas (cada uma tira ${HINT_COST} pontos)</label>
      </form>`
    );
  }

  /** Lê o formulário do organizador e envia as regras novas. */
  private async sendRules(change?: (s: MatchSettings) => void): Promise<void> {
    const form = document.getElementById('rules-form') as HTMLFormElement | null;
    if (!form || !this.room) return;
    const settings: MatchSettings = {
      mode: (form.querySelector<HTMLInputElement>('input[name="mode"]:checked')?.value as MatchSettings['mode']) ?? 'cross',
      stages: [...form.querySelectorAll<HTMLSelectElement>('select[data-round]')].map((el) => el.value),
      seconds: Number(form.querySelector<HTMLSelectElement>('select[name="seconds"]')!.value),
      hints: form.querySelector<HTMLInputElement>('input[name="hints"]')!.checked,
    };
    change?.(settings);
    const r = await this.conn.request('settings', { settings });
    if (!r.ok) {
      this.renderedRules = '';
      this.renderLobby(this.room);
      $('lobby-wait').textContent = r.error;
    }
  }

  // ---------------------------------------------------------------- partida

  private renderPlay(v: RoomView): void {
    const round = v.round!;
    const me = this.me(v);
    const place = v.players.findIndex((p) => p.id === v.you.id) + 1;
    $('match-round').textContent = `Rodada ${round.number} de ${round.total}`;
    $('match-title').textContent = stageTitle(round.stageId);
    $('match-score').textContent = plural(me?.score ?? 0, 'ponto', 'pontos');
    $('match-place').textContent = place ? `${place}º lugar de ${v.players.length}` : '';

    // A grade chega pelo evento "round"; se faltar (raro), espera.
    if (this.loadedRound === round.number) {
      if (this.round?.puzzle.kind === 'cross') this.cross.sync(v.you);
      else this.hunt.sync(v.you);
    }

    const playing = v.status === 'playing';
    const finished = !!me?.finished;
    show($('match-hint'), playing && v.settings.hints && !finished);
    show($('match-results'), !playing);
    if (!playing) {
      this.showSolution(v);
      $('results-title').textContent = `Fim da rodada ${round.number} de ${round.total}`;
      show($('results-next'), this.isHost(v));
    } else if (finished && this.announcedFinish !== round.number) {
      this.announcedFinish = round.number;
      this.say('Você terminou! Agora é esperar o tempo acabar ou os colegas terminarem.', 'good');
    }
    this.renderRanking($('match-ranking'), v, !playing);
    this.tick();
  }

  private showSolution(v: RoomView): void {
    if (!v.solution || this.solutionShown === v.round?.number || this.loadedRound !== v.round?.number) return;
    this.solutionShown = v.round.number;
    if (v.solution.kind === 'cross') this.cross.showSolution(v.solution.words);
    else this.hunt.showSolution(v.solution.words, v.solution.coords);
    this.say('');
  }

  private renderRanking(el: HTMLElement, v: RoomView, showRound: boolean): void {
    const words = v.round?.words ?? 0;
    setHtml(
      el,
      html`${v.players.map(
        (p, i) => html`<li class="rank-row ${p.id === v.you.id ? 'is-you' : ''} ${p.online ? '' : 'is-offline'}">
          <span class="rank-pos">${i + 1}º</span>
          <span class="rank-name">${p.name}${p.id === v.you.id ? html` <i>você</i>` : ''}</span>
          <span class="rank-solved">${
            showRound ? `+${p.roundScore} na rodada` : p.finished ? 'terminou' : `${p.solved} de ${words}`
          }</span>
          <span class="rank-score">${p.score}</span>
        </li>`
      )}`
    );
  }

  private renderFinal(v: RoomView): void {
    const podium = v.players.slice(0, 3);
    setHtml(
      $('final-podium'),
      html`${podium.map(
        (p, i) => html`<li class="podium-place place-${i + 1} ${p.id === v.you.id ? 'is-you' : ''}">
          <span class="podium-pos">${i + 1}º</span>
          <span class="podium-name">${p.name}</span>
          <span class="podium-score">${plural(p.score, 'ponto', 'pontos')}</span>
        </li>`
      )}`
    );
    this.renderRanking($('final-ranking'), v, false);
    const host = this.isHost(v);
    show($('final-again'), host);
    $('final-wait').textContent = host ? '' : `Esperando ${this.hostName(v)} decidir se vai ter outra partida.`;
    if (!this.stamped) {
      this.stamped = true;
      replayAnimation(document.querySelector('#comp-final .stamp')!, 'stamp');
    }
  }

  // ---------------------------------------------------------------- cronômetro

  private startTicker(): void {
    if (this.ticker === null) this.ticker = window.setInterval(() => this.tick(), 250);
  }

  private stopTicker(): void {
    if (this.ticker !== null) clearInterval(this.ticker);
    this.ticker = null;
  }

  private tick(): void {
    const v = this.room;
    if (!v?.round) return;
    const now = Date.now() + this.clockOffset;
    const clock = $('match-timer');
    if (v.status === 'playing') {
      const left = Math.max(0, Math.ceil((v.round.endsAt - now) / 1000));
      clock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      clock.parentElement!.classList.toggle('is-ending', left <= 30);
    } else {
      clock.textContent = '0:00';
      clock.parentElement!.classList.remove('is-ending');
      const me = this.me(v);
      const next = v.round.nextAt ? Math.max(0, Math.ceil((v.round.nextAt - now) / 1000)) : null;
      $('results-text').textContent = `Você fez ${plural(me?.roundScore ?? 0, 'ponto', 'pontos')} nesta rodada.${
        next !== null ? ` A próxima começa em ${next} s.` : ''
      }`;
    }
  }

  // ---------------------------------------------------------------- ações

  private say(message: string, kind: FeedbackKind = ''): void {
    const fb = $('match-feedback');
    fb.textContent = message;
    fb.className = `feedback ${kind}`;
  }

  private entryMessage(message: string, kind: FeedbackKind = ''): void {
    const el = $('comp-entry-message');
    el.textContent = message;
    el.className = `feedback ${kind}`;
  }

  private setProgress(done: number, total: number): void {
    $('match-solved').textContent = `${done} de ${total}`;
    $('match-progress').style.width = `${total ? (done / total) * 100 : 0}%`;
    $('match-progress').parentElement!.setAttribute('aria-valuenow', String(total ? Math.round((done / total) * 100) : 0));
  }

  private async enter(event: 'create' | 'join'): Promise<void> {
    const nameInput = $<HTMLInputElement>(event === 'create' ? 'comp-create-name' : 'comp-join-name');
    const name = cleanName(nameInput.value);
    if (!name) {
      this.entryMessage('Escolha um apelido de até 16 letras.', 'bad');
      nameInput.focus();
      return;
    }
    const code = cleanCode($<HTMLInputElement>('comp-join-code').value);
    if (event === 'join' && code.length !== CODE_LENGTH) {
      this.entryMessage(`O código da sala tem ${CODE_LENGTH} letras e números.`, 'bad');
      $('comp-join-code').focus();
      return;
    }
    saveName(name);
    $<HTMLInputElement>('comp-create-name').value = $<HTMLInputElement>('comp-join-name').value = name;
    this.entryMessage(event === 'create' ? 'Criando a sala…' : 'Entrando…');
    if (this.conn.session) await this.conn.leave();
    this.room = null;
    this.resetLobbyNews();
    const r = await this.conn.enter(event, { name, code });
    if (!r.ok) this.entryMessage(r.error, 'bad');
    else navigate({ view: 'competition', code: r.code }, { replace: true });
  }

  private async leave(): Promise<void> {
    const playing = this.room && this.room.status !== 'lobby' && this.room.status !== 'final';
    if (playing && !confirm('Sair da sala? Você sai da classificação desta partida.')) return;
    await this.conn.leave();
    this.room = null;
    this.round = null;
    this.loadedRound = 0;
    this.stopTicker();
    this.resetLobbyNews();
    document.title = DEFAULT_TITLE;
    navigate({ view: 'competition' });
    this.showScreen('entry');
    this.entryMessage('');
  }

  private async act(event: 'start' | 'next' | 'restart', errorTarget: string): Promise<void> {
    const r = await this.conn.request(event, {});
    if (!r.ok) $(errorTarget).textContent = r.error;
  }

  private async hint(): Promise<void> {
    const v = this.room;
    const round = this.round;
    if (!v || !round || v.status !== 'playing') return;
    const board = round.puzzle.kind === 'cross' ? this.cross : this.hunt;
    const index = board.firstOpen();
    if (index < 0) return;
    const typed = round.puzzle.kind === 'cross' ? this.cross.typed(index) : undefined;
    const r = await this.conn.request('hint', { round: round.number, index, typed });
    if (!r.ok) {
      this.say(r.error, 'bad');
      return;
    }
    if (r.prefix !== undefined) {
      this.cross.reveal(r.index, r.prefix);
      this.say(`Revelamos uma letra da pista ${r.index + 1} (−${HINT_COST} pontos).`);
    } else if (r.cell !== undefined) {
      this.hunt.hint(r.index, r.cell);
      this.say(`A palavra da pista ${r.index + 1} começa na letra circulada (−${HINT_COST} pontos).`);
    }
  }

  private bind(): void {
    $<HTMLFormElement>('comp-create-form').addEventListener('submit', (e) => {
      e.preventDefault();
      void this.enter('create');
    });
    $<HTMLFormElement>('comp-join-form').addEventListener('submit', (e) => {
      e.preventDefault();
      void this.enter('join');
    });
    $<HTMLInputElement>('comp-join-code').addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      input.value = cleanCode(input.value);
    });

    $('lobby-copy').addEventListener('click', async () => {
      if (!this.room) return;
      const link = this.roomLink(this.room.code);
      try {
        await navigator.clipboard.writeText(link);
        $('lobby-copy').textContent = 'Link copiado';
      } catch {
        $('lobby-copy').textContent = 'Copie o link ao lado';
      }
      setTimeout(() => ($('lobby-copy').textContent = 'Copiar link'), 2500);
    });
    $('lobby-players').addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-kick]');
      if (!btn) return;
      const r = await this.conn.request('kick', { playerId: btn.dataset.kick! });
      if (!r.ok) $('lobby-wait').textContent = r.error;
    });
    const rules = $('lobby-rules');
    rules.addEventListener('change', () => void this.sendRules());
    rules.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'add-round') void this.sendRules((s) => s.stages.push(RANDOM_STAGE));
      const remove = target.closest<HTMLElement>('[data-remove]');
      if (remove) void this.sendRules((s) => s.stages.splice(Number(remove.dataset.remove), 1));
    });
    $('lobby-start').addEventListener('click', () => void this.act('start', 'lobby-wait'));
    $('results-next').addEventListener('click', () => void this.act('next', 'results-text'));
    $('final-again').addEventListener('click', () => void this.act('restart', 'final-wait'));
    $('match-hint').addEventListener('click', () => void this.hint());
    for (const id of ['lobby-leave', 'match-leave', 'final-leave']) $(id).addEventListener('click', () => void this.leave());
  }
}
