import { buildRound, HINT_COST, MAX_PLAYERS, WORD_POINTS } from '../src/core/match';
import { HOST_GRACE_MS, LOBBY_GRACE_MS, Room, RoomError } from '../server/room';

const raiva = buildRound('raiva', 'cross').cross!;
const raivaHunt = buildRound('raiva', 'hunt').hunt!;

function setup() {
  const hooks = { changed: jest.fn(), roundStarted: jest.fn(), kicked: jest.fn() };
  const room = new Room('ABCDE', hooks);
  const host = room.addPlayer('Ana');
  const bia = room.addPlayer('Bia');
  return { room, hooks, host, bia };
}

/** Configura e começa uma partida de palavras-cruzadas de Raiva com 5 minutos. */
function startCross(room: Room, hostId: string, stages = ['raiva'], hints = true) {
  room.updateSettings(hostId, { mode: 'cross', stages, seconds: 300, hints });
  room.start(hostId);
}

const solveAll = (room: Room, playerId: string, round = 1) =>
  raiva.entries.forEach((e, i) => room.answer(playerId, round, i, e.word));

beforeEach(() => jest.useFakeTimers({ now: 1_000_000 }));
afterEach(() => jest.useRealTimers());

describe('sala de espera', () => {
  it('o primeiro a entrar é o organizador', () => {
    const { room, host, bia } = setup();
    expect(room.hostId).toBe(host.id);
    const view = room.view(bia.id);
    expect(view.players.map((p) => [p.name, p.host])).toEqual([['Ana', true], ['Bia', false]]);
    expect(view.status).toBe('lobby');
  });

  it(`aceita até ${MAX_PLAYERS} jogadores e recusa apelido repetido`, () => {
    const { room } = setup();
    expect(() => room.addPlayer('ana')).toThrow(/apelido/);
    for (let i = 3; i <= MAX_PLAYERS; i++) room.addPlayer(`Jogador ${i}`);
    expect(room.players.size).toBe(MAX_PLAYERS);
    expect(() => room.addPlayer('Mais um')).toThrow(/cheia/);
  });

  it('só o organizador muda as regras e começa', () => {
    const { room, bia } = setup();
    expect(() => room.updateSettings(bia.id, { mode: 'hunt', stages: ['raiva'], seconds: 120, hints: true })).toThrow(RoomError);
    expect(() => room.start(bia.id)).toThrow(/organizador/);
  });

  it('quem caiu sai da sala de espera depois de um tempo; o organizador passa a vez', () => {
    const { room, host, bia } = setup();
    room.setOnline(host.id, false);
    jest.advanceTimersByTime(HOST_GRACE_MS);
    room.sweep();
    expect(room.hostId).toBe(bia.id);
    jest.advanceTimersByTime(LOBBY_GRACE_MS);
    room.sweep();
    expect(room.players.has(host.id)).toBe(false);
  });

  it('organizador remove um jogador', () => {
    const { room, hooks, host, bia } = setup();
    room.kick(host.id, bia.id);
    expect(room.players.has(bia.id)).toBe(false);
    expect(hooks.kicked).toHaveBeenCalledWith(bia.id);
    expect(() => room.kick(host.id, host.id)).toThrow(RoomError);
  });

  it('organizador que sai passa a vez para o próximo', () => {
    const { room, host, bia } = setup();
    room.remove(host.id);
    expect(room.hostId).toBe(bia.id);
    room.remove(bia.id);
    expect(room.isEmpty).toBe(true);
  });
});

describe('partida', () => {
  it('palavra certa vale 100; errada não vale nada; a resposta fica só no servidor', () => {
    const { room, hooks, host, bia } = setup();
    startCross(room, host.id);
    expect(hooks.roundStarted).toHaveBeenCalledTimes(1);
    const round = room.roundView()!;
    expect(JSON.stringify(round)).not.toContain(`"${raiva.entries[0].word}"`);

    expect(room.answer(bia.id, 1, 0, 'ERRADA')).toEqual({ correct: false });
    expect(room.answer(bia.id, 1, 0, raiva.entries[0].word.toLowerCase())).toEqual({ correct: true, word: raiva.entries[0].word });
    const view = room.view(bia.id);
    expect(view.players[0]).toMatchObject({ name: 'Bia', score: WORD_POINTS, solved: 1 });
    expect(view.you.solved).toEqual({ 0: raiva.entries[0].word });
    expect(view.solution).toBeNull();
  });

  it('quem completa antes ganha 1 ponto por segundo restante', () => {
    const { room, host, bia } = setup();
    startCross(room, host.id);
    jest.advanceTimersByTime(100_000);
    solveAll(room, bia.id);
    const me = room.view(bia.id).players.find((p) => p.id === bia.id)!;
    expect(me.finished).toBe(true);
    expect(me.score).toBe(raiva.entries.length * WORD_POINTS + 200);
  });

  it('dica desconta pontos, revela letras e pode ser desligada', () => {
    const { room, host, bia } = setup();
    startCross(room, host.id);
    expect(room.hint(bia.id, 1, 0, '')).toEqual({ index: 0, prefix: raiva.entries[0].word[0] });
    expect(room.hint(bia.id, 1, 0, '')).toEqual({ index: 0, prefix: raiva.entries[0].word.slice(0, 2) });
    room.answer(bia.id, 1, 0, raiva.entries[0].word);
    const view = room.view(bia.id);
    expect(view.players.find((p) => p.id === bia.id)!.score).toBe(WORD_POINTS - 2 * HINT_COST);
    expect(view.you.hints).toBe(2);
    expect(() => room.hint(bia.id, 1, 0)).toThrow(/acertou/);

    jest.advanceTimersByTime(300_000);
    room.restart(host.id);
    startCross(room, host.id, ['raiva'], false);
    expect(() => room.hint(bia.id, 1, 1)).toThrow(/desligadas/);
  });

  it('pontos nunca ficam negativos', () => {
    const { room, host, bia } = setup();
    startCross(room, host.id);
    room.hint(bia.id, 1, 0, '');
    expect(room.view(bia.id).players.find((p) => p.id === bia.id)!.score).toBe(0);
  });

  it('o tempo acaba, mostra as respostas e a próxima rodada começa sozinha', () => {
    const { room, hooks, host, bia } = setup();
    startCross(room, host.id, ['raiva', 'cinomose']);
    room.answer(bia.id, 1, 0, raiva.entries[0].word);
    jest.advanceTimersByTime(300_000);
    let view = room.view(host.id);
    expect(view.status).toBe('results');
    expect(view.solution).toEqual({ kind: 'cross', words: raiva.entries.map((e) => e.word) });
    expect(view.round!.nextAt).toBe(Date.now() + 15_000);
    expect(() => room.answer(bia.id, 1, 1, raiva.entries[1].word)).toThrow(/terminou/);

    jest.advanceTimersByTime(15_000);
    view = room.view(host.id);
    expect(view.status).toBe('playing');
    expect(view.round).toMatchObject({ number: 2, total: 2, stageId: 'cinomose' });
    expect(hooks.roundStarted).toHaveBeenCalledTimes(2);
    // O total continua somando; os pontos da rodada recomeçam.
    expect(view.players[0]).toMatchObject({ name: 'Bia', score: WORD_POINTS, roundScore: 0 });

    jest.advanceTimersByTime(300_000);
    expect(room.view(host.id).status).toBe('final');
  });

  it('a rodada acaba quando todos os conectados terminam', () => {
    const { room, host, bia } = setup();
    startCross(room, host.id, ['raiva', 'cinomose']);
    solveAll(room, host.id);
    expect(room.view(host.id).status).toBe('playing');
    room.setOnline(bia.id, false);
    expect(room.view(host.id).status).toBe('results');
    room.next(host.id);
    expect(room.view(host.id).round!.number).toBe(2);
  });

  it('empate: vence quem chegou primeiro à pontuação', () => {
    const { room, host, bia } = setup();
    startCross(room, host.id);
    room.answer(bia.id, 1, 0, raiva.entries[0].word);
    jest.advanceTimersByTime(1000);
    room.answer(host.id, 1, 0, raiva.entries[0].word);
    expect(room.view(host.id).players.map((p) => p.name)).toEqual(['Bia', 'Ana']);
  });

  it('caça-palavras: a seleção vale nos dois sentidos', () => {
    const { room, host, bia } = setup();
    room.updateSettings(host.id, { mode: 'hunt', stages: ['raiva'], seconds: 120, hints: true });
    room.start(host.id);
    const coords = raivaHunt.placed[1].coords;
    expect(room.select(bia.id, 1, coords[0], coords[1])).toEqual({ index: -1 });
    expect(room.select(bia.id, 1, coords[coords.length - 1], coords[0])).toMatchObject({ index: 1, word: raivaHunt.placed[1].word });
    expect(room.hint(bia.id, 1, 2)).toEqual({ index: 2, cell: raivaHunt.placed[2].coords[0] });
    expect(room.view(bia.id).you).toMatchObject({ found: { 1: coords }, hintCells: { 2: raivaHunt.placed[2].coords[0] } });
    expect(() => room.select(bia.id, 1, -1, 3)).toThrow(RoomError);
  });

  it('quem entra no meio da rodada joga com o tempo que sobra', () => {
    const { room, host } = setup();
    startCross(room, host.id);
    const caio = room.addPlayer('Caio');
    expect(room.view(caio.id).status).toBe('playing');
    expect(room.answer(caio.id, 1, 0, raiva.entries[0].word).correct).toBe(true);
  });

  it('depois do pódio, "jogar de novo" volta para a sala de espera zerada', () => {
    const { room, host, bia } = setup();
    startCross(room, host.id);
    room.answer(bia.id, 1, 0, raiva.entries[0].word);
    jest.advanceTimersByTime(300_000);
    expect(room.view(bia.id).status).toBe('final');
    expect(() => room.restart(bia.id)).toThrow(/organizador/);
    room.restart(host.id);
    const view = room.view(bia.id);
    expect(view.status).toBe('lobby');
    expect(view.players.every((p) => p.score === 0)).toBe(true);
  });
});
