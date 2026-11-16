import { AddressInfo } from 'net';
import { io as connect, Socket } from 'socket.io-client';
import { buildRound } from '../src/core/match';
import { Ack, ClientEvents, Joined, RoomView, RoundView, ServerEvents } from '../src/core/protocol';
import { CompetitionApp, createApp } from '../server/app';

// Teste de ponta a ponta: servidor de verdade e 30 clientes Socket.IO conectados ao mesmo tempo.

type Client = Socket<ServerEvents, ClientEvents>;

const raiva = buildRound('raiva', 'cross').cross!;
let app: CompetitionApp;
let url: string;
const clients: Client[] = [];

beforeAll(async () => {
  app = createApp({ allowedOrigins: ['https://codycross-vet.vercel.app'], sweepMs: 200, emptyRoomMs: 300 });
  await new Promise<void>((r) => app.http.listen(0, r));
  url = `http://localhost:${(app.http.address() as AddressInfo).port}`;
});

afterEach(() => {
  clients.splice(0).forEach((c) => c.disconnect());
});

afterAll(() => app.close());

function client(origin?: string): Client {
  const c: Client = connect(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    extraHeaders: origin ? { origin } : undefined,
  });
  clients.push(c);
  return c;
}

/** Envia e espera a resposta do servidor. */
function send<E extends keyof ClientEvents>(c: Client, event: E, payload: Parameters<ClientEvents[E]>[0]) {
  type R = Parameters<Parameters<ClientEvents[E]>[1]>[0];
  return new Promise<R>((resolve) =>
    (c.emit as (e: string, p: unknown, ack: (r: R) => void) => void)(event, payload, resolve)
  );
}

/** Espera um estado da sala que satisfaça a condição. */
function stateWhere(c: Client, test: (v: RoomView) => boolean): Promise<RoomView> {
  return new Promise((resolve) => {
    const handler = (v: RoomView) => {
      if (test(v)) {
        c.off('state', handler);
        resolve(v);
      }
    };
    c.on('state', handler);
  });
}

const ok = <T extends object>(r: Ack<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r;
};

it('responde ao /health', async () => {
  const res = await fetch(`${url}/health`);
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true });
});

it('recusa conexões de outros sites', async () => {
  const c = client('https://evil.example');
  const error = await new Promise<Error>((resolve) => c.on('connect_error', resolve));
  expect(error).toBeTruthy();
});

it('30 jogadores: sala, partida, pontos ao vivo e classificação final', async () => {
  const host = client('https://codycross-vet.vercel.app');
  const created = ok(await send(host, 'create', { name: 'Professora' }));
  expect(created.code).toMatch(/^[A-Z2-9]{5}$/);

  const players = Array.from({ length: 29 }, () => client());
  const joins = await Promise.all(players.map((c, i) => send(c, 'join', { code: created.code.toLowerCase(), name: `Aluno ${i + 1}` })));
  joins.forEach(ok);

  const extra = client();
  expect(await send(extra, 'join', { code: created.code, name: 'Atrasado' })).toEqual({ ok: false, error: expect.stringMatching(/cheia/) });

  // Só o organizador começa.
  expect((await send(players[0], 'start', {})).ok).toBe(false);
  ok(await send(host, 'settings', { settings: { mode: 'cross', stages: ['raiva'], seconds: 120, hints: true } }));

  const rounds = players.map((c) => new Promise<RoundView>((resolve) => c.once('round', resolve)));
  ok(await send(host, 'start', {}));
  const received = await Promise.all(rounds);
  expect(received.every((r) => r.stageId === 'raiva' && r.puzzle.kind === 'cross')).toBe(true);
  expect(JSON.stringify(received[0])).not.toContain(`"${raiva.entries[0].word}"`);

  // Um aluno acerta duas palavras; todos veem o placar mudar.
  const seen = stateWhere(players[10], (v) => v.players[0].name === 'Aluno 1' && v.players[0].score === 200);
  expect(ok(await send(players[0], 'answer', { round: 1, index: 0, answer: raiva.entries[0].word }))).toMatchObject({ correct: true });
  expect(ok(await send(players[0], 'answer', { round: 1, index: 1, answer: 'NADA' }))).toMatchObject({ correct: false });
  ok(await send(players[0], 'answer', { round: 1, index: 1, answer: raiva.entries[1].word }));
  const view = await seen;
  expect(view.players).toHaveLength(30);
  expect(view.you.solved).toEqual({});

  // Todos terminam: a partida (1 rodada) acaba sozinha e mostra o pódio.
  const finals = [host, ...players].map((c) => stateWhere(c, (v) => v.status === 'final'));
  await Promise.all(
    [host, ...players].map(async (c) => {
      for (const [i, e] of raiva.entries.entries()) await send(c, 'answer', { round: 1, index: i, answer: e.word });
    })
  );
  const last = await finals[0];
  expect(last.players).toHaveLength(30);
  expect(last.players.every((p) => p.finished && p.score > raiva.entries.length * 100)).toBe(true);
  expect(last.solution).toEqual({ kind: 'cross', words: raiva.entries.map((e) => e.word) });
}, 30_000);

it('volta para a sala depois de cair a internet, com os pontos', async () => {
  const host = client();
  const created = ok(await send(host, 'create', { name: 'Ana' }));
  ok(await send(host, 'settings', { settings: { mode: 'cross', stages: ['raiva'], seconds: 120, hints: true } }));
  const bia = client();
  const joined: Joined = ok(await send(bia, 'join', { code: created.code, name: 'Bia' }));
  ok(await send(host, 'start', {}));
  ok(await send(bia, 'answer', { round: 1, index: 0, answer: raiva.entries[0].word }));

  const offline = stateWhere(host, (v) => v.players.some((p) => p.name === 'Bia' && !p.online));
  bia.disconnect();
  await offline;

  const again = client();
  const round = new Promise<RoundView>((resolve) => again.once('round', resolve));
  const state = stateWhere(again, (v) => v.status === 'playing');
  expect(ok(await send(again, 'resume', { code: created.code, token: joined.token })).playerId).toBe(joined.playerId);
  expect((await round).number).toBe(1);
  const v = await state;
  expect(v.you.solved).toEqual({ 0: raiva.entries[0].word });
  expect(v.players.find((p) => p.name === 'Bia')).toMatchObject({ online: true, score: 100 });

  expect(await send(client(), 'resume', { code: created.code, token: 'errado' })).toMatchObject({ ok: false });
});

it('sala sem ninguém é apagada', async () => {
  const host = client();
  const { code } = ok(await send(host, 'create', { name: 'Sozinho' }));
  expect(app.rooms.has(code)).toBe(true);
  ok(await send(host, 'leave', {}));
  await new Promise((r) => setTimeout(r, 500));
  expect(app.rooms.has(code)).toBe(false);
  expect(await send(client(), 'join', { code, name: 'Outro' })).toMatchObject({ ok: false, error: expect.stringMatching(/não encontrada/) });
});

it('limita tentativas seguidas', async () => {
  const host = client();
  ok(await send(host, 'create', { name: 'Rápido' }));
  ok(await send(host, 'start', {}));
  const results = [];
  for (let i = 0; i < 40; i++) results.push(await send(host, 'answer', { round: 1, index: 0, answer: 'X' }));
  expect(results.some((r) => !r.ok && /Calma/.test(r.error))).toBe(true);
});
