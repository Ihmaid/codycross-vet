import { randomInt } from 'crypto';
import { createServer, IncomingMessage, Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { cleanCode, cleanName, CODE_ALPHABET, CODE_LENGTH } from '../src/core/match';
import { Ack, ClientEvents, Joined, ServerEvents } from '../src/core/protocol';
import { Room, RoomError } from './room';

export interface AppOptions {
  /** Endereços do site que podem se conectar (aceita * como curinga). Vazio: qualquer um. */
  allowedOrigins?: string[];
  maxRooms?: number;
  /** Sala sem ninguém conectado é apagada depois desse tempo. */
  emptyRoomMs?: number;
  /** Nenhuma sala dura mais do que isso. */
  maxRoomAgeMs?: number;
  sweepMs?: number;
  log?: (message: string) => void;
}

interface SocketData {
  code?: string;
  playerId?: string;
}

type IoServer = Server<ClientEvents, ServerEvents, Record<string, never>, SocketData>;
type IoSocket = Socket<ClientEvents, ServerEvents, Record<string, never>, SocketData>;

/** Converte "https://site-*.vercel.app" em expressão regular. */
export function originMatcher(patterns: string[]): (origin: string | undefined) => boolean {
  if (!patterns.length) return () => true;
  const regexes = patterns.map(
    (p) => new RegExp(`^${p.trim().replace(/\/$/, '').replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]*')}$`, 'i')
  );
  // Sem "Origin" não é um navegador (ex.: testes); navegadores sempre enviam.
  return (origin) => !origin || regexes.some((r) => r.test(origin));
}

/** Limite simples de ações por janela de tempo (protege contra "chutes" em sequência e abusos). */
class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private readonly max: number,
    private readonly windowMs: number
  ) {}
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
  forget(key: string): void {
    this.hits.delete(key);
  }
  prune(now = Date.now()): void {
    for (const [k, list] of this.hits) if (!list.some((t) => now - t < this.windowMs)) this.hits.delete(k);
  }
}

const isInt = (v: unknown): v is number => Number.isInteger(v);
const asObject = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || '?';
}

export interface CompetitionApp {
  http: HttpServer;
  io: IoServer;
  rooms: Map<string, Room>;
  close(): Promise<void>;
}

export function createApp(options: AppOptions = {}): CompetitionApp {
  const {
    allowedOrigins = [],
    maxRooms = 500,
    emptyRoomMs = 10 * 60_000,
    maxRoomAgeMs = 6 * 60 * 60_000,
    sweepMs = 5_000,
    log = () => undefined,
  } = options;
  const allowed = originMatcher(allowedOrigins);
  const rooms = new Map<string, Room>();
  const createdAt = new Map<string, number>();
  const pending = new Set<string>();
  // Uma turma inteira pode entrar pela mesma rede (mesmo IP): limites generosos.
  const entryLimit = new RateLimiter(120, 60_000);
  // Respostas e dicas (contra "chutes" em sequência) e comandos do organizador têm limites separados.
  const playLimit = new RateLimiter(30, 10_000);
  const hostLimit = new RateLimiter(40, 10_000);

  const http = createServer((req, res) => {
    const origin = req.headers.origin;
    if (origin && allowed(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Servidor da competição do Virologia em Jogo.');
  });

  const io: IoServer = new Server(http, {
    cors: { origin: (origin, cb) => cb(null, allowed(origin)) },
    allowRequest: (req, cb) => cb(null, allowed(req.headers.origin)),
    maxHttpBufferSize: 20_000,
    pingInterval: 20_000,
    pingTimeout: 20_000,
  });

  /** Envia o estado da sala para cada jogador (cada um vê o próprio progresso). Agrupa mudanças próximas. */
  const flush = (room: Room) => {
    pending.delete(room.code);
    if (!rooms.has(room.code)) return;
    for (const s of io.sockets.adapter.rooms.get(room.code) ?? []) {
      const socket = io.sockets.sockets.get(s) as IoSocket | undefined;
      const playerId = socket?.data.playerId;
      if (socket && playerId && room.players.has(playerId)) socket.emit('state', room.view(playerId));
    }
  };

  const newRoom = (): Room => {
    if (rooms.size >= maxRooms) throw new RoomError('O servidor está cheio agora. Tente de novo em alguns minutos.');
    let code = '';
    do {
      code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    } while (rooms.has(code));
    const room: Room = new Room(code, {
      changed: () => {
        if (pending.has(code)) return;
        pending.add(code);
        setTimeout(() => flush(room), 60);
      },
      roundStarted: () => {
        const round = room.roundView();
        if (round) io.to(code).emit('round', round);
      },
      kicked: (playerId) => {
        for (const s of io.sockets.adapter.rooms.get(code) ?? []) {
          const socket = io.sockets.sockets.get(s) as IoSocket | undefined;
          if (socket?.data.playerId === playerId) {
            socket.emit('kicked');
            socket.leave(code);
            socket.data = {};
          }
        }
      },
    });
    rooms.set(code, room);
    createdAt.set(code, Date.now());
    log(`sala ${code} criada (${rooms.size} no total)`);
    return room;
  };

  const deleteRoom = (code: string) => {
    rooms.get(code)?.dispose();
    rooms.delete(code);
    createdAt.delete(code);
    log(`sala ${code} apagada (${rooms.size} no total)`);
  };

  /** Liga o socket ao jogador (sai da sala anterior, se houver). */
  const attach = (socket: IoSocket, room: Room, playerId: string) => {
    detach(socket);
    socket.data = { code: room.code, playerId };
    socket.join(room.code);
    room.setOnline(playerId, true);
    const round = room.roundView();
    if (round) socket.emit('round', round);
    socket.emit('state', room.view(playerId));
  };

  const detach = (socket: IoSocket) => {
    const { code, playerId } = socket.data;
    if (!code || !playerId) return;
    socket.leave(code);
    socket.data = {};
    const room = rooms.get(code);
    // Outro aparelho/aba do mesmo jogador ainda conectado? Continua online.
    const stillHere = [...(io.sockets.adapter.rooms.get(code) ?? [])].some(
      (s) => (io.sockets.sockets.get(s) as IoSocket | undefined)?.data.playerId === playerId
    );
    if (room && !stillHere) room.setOnline(playerId, false);
  };

  const joined = (room: Room, playerId: string): Ack<Joined> => ({
    ok: true,
    code: room.code,
    playerId,
    token: room.players.get(playerId)!.token,
  });

  io.on('connection', (socket: IoSocket) => {
    const ip = clientIp(socket.request);

    /** Executa a ação e responde: erros de regra viram mensagem; o resto vira erro genérico. */
    const handle = <T extends object>(
      ack: unknown,
      fn: () => Ack<T> | T,
      limiter: RateLimiter | null = hostLimit,
      key = socket.id
    ) => {
      const reply = typeof ack === 'function' ? (ack as (r: Ack<T>) => void) : () => undefined;
      if (limiter && !limiter.allow(key)) {
        reply({ ok: false, error: 'Calma! Muitas tentativas seguidas. Espere alguns segundos.' });
        return;
      }
      try {
        const result = fn();
        reply('ok' in result ? (result as Ack<T>) : ({ ok: true, ...result } as Ack<T>));
      } catch (e) {
        if (e instanceof RoomError) reply({ ok: false, error: e.message });
        else {
          log(`erro: ${(e as Error).stack ?? e}`);
          reply({ ok: false, error: 'Algo deu errado no servidor. Tente de novo.' });
        }
      }
    };

    /** Sala e jogador deste socket. */
    const current = (): { room: Room; playerId: string } => {
      const { code, playerId } = socket.data;
      const room = code ? rooms.get(code) : undefined;
      if (!room || !playerId || !room.players.has(playerId)) throw new RoomError('Você não está em nenhuma sala.');
      return { room, playerId };
    };

    socket.on('create', (p, ack) =>
      handle<Joined>(
        ack,
        () => {
          const name = cleanName(asObject(p).name);
          if (!name) throw new RoomError('Escolha um apelido (até 16 letras).');
          const room = newRoom();
          const player = room.addPlayer(name);
          attach(socket, room, player.id);
          return joined(room, player.id);
        },
        entryLimit,
        ip
      )
    );

    socket.on('join', (p, ack) =>
      handle<Joined>(
        ack,
        () => {
          const o = asObject(p);
          const name = cleanName(o.name);
          if (!name) throw new RoomError('Escolha um apelido (até 16 letras).');
          const room = rooms.get(cleanCode(o.code));
          if (!room) throw new RoomError('Sala não encontrada. Confira o código.');
          const player = room.addPlayer(name);
          attach(socket, room, player.id);
          return joined(room, player.id);
        },
        entryLimit,
        ip
      )
    );

    socket.on('resume', (p, ack) =>
      handle<Joined>(
        ack,
        () => {
          const o = asObject(p);
          const room = rooms.get(cleanCode(o.code));
          const player = room && typeof o.token === 'string' ? room.byToken(o.token) : undefined;
          if (!room || !player) throw new RoomError('Essa sala não existe mais.');
          attach(socket, room, player.id);
          return joined(room, player.id);
        },
        entryLimit,
        ip
      )
    );

    socket.on('settings', (p, ack) =>
      handle(ack, () => {
        const { room, playerId } = current();
        room.updateSettings(playerId, asObject(p).settings);
        return {};
      })
    );

    socket.on('start', (_p, ack) =>
      handle(ack, () => {
        const { room, playerId } = current();
        room.start(playerId);
        return {};
      })
    );

    socket.on('next', (_p, ack) =>
      handle(ack, () => {
        const { room, playerId } = current();
        room.next(playerId);
        return {};
      })
    );

    socket.on('restart', (_p, ack) =>
      handle(ack, () => {
        const { room, playerId } = current();
        room.restart(playerId);
        return {};
      })
    );

    socket.on('kick', (p, ack) =>
      handle(ack, () => {
        const { room, playerId } = current();
        room.kick(playerId, String(asObject(p).playerId ?? ''));
        return {};
      })
    );

    socket.on('leave', (_p, ack) =>
      handle(
        ack,
        () => {
          const { room, playerId } = current();
          socket.leave(room.code);
          socket.data = {};
          room.remove(playerId);
          return {};
        },
        null
      )
    );

    socket.on('answer', (p, ack) =>
      handle(ack, () => {
        const o = asObject(p);
        if (!isInt(o.round) || !isInt(o.index) || typeof o.answer !== 'string' || o.answer.length > 60) {
          throw new RoomError('Resposta inválida.');
        }
        const { room, playerId } = current();
        return room.answer(playerId, o.round, o.index, o.answer);
      }, playLimit)
    );

    socket.on('select', (p, ack) =>
      handle(ack, () => {
        const o = asObject(p);
        if (!isInt(o.round) || !isInt(o.from) || !isInt(o.to)) throw new RoomError('Seleção inválida.');
        const { room, playerId } = current();
        return room.select(playerId, o.round, o.from, o.to);
      }, playLimit)
    );

    socket.on('hint', (p, ack) =>
      handle(ack, () => {
        const o = asObject(p);
        if (!isInt(o.round) || !isInt(o.index)) throw new RoomError('Dica inválida.');
        const typed = typeof o.typed === 'string' ? o.typed.slice(0, 60) : undefined;
        const { room, playerId } = current();
        return room.hint(playerId, o.round, o.index, typed);
      }, playLimit)
    );

    socket.on('disconnect', () => {
      detach(socket);
      playLimit.forget(socket.id);
      hostLimit.forget(socket.id);
    });
  });

  // Limpeza periódica: jogadores que caíram, organizador ausente, salas vazias ou antigas.
  const sweeper = setInterval(() => {
    const t = Date.now();
    for (const [code, room] of rooms) {
      room.sweep();
      const old = t - (createdAt.get(code) ?? t) > maxRoomAgeMs;
      const abandoned = room.isEmpty || (room.emptySince !== null && t - room.emptySince > emptyRoomMs);
      if (old || abandoned) {
        io.to(code).emit('closed');
        io.in(code).socketsLeave(code);
        deleteRoom(code);
      }
    }
    entryLimit.prune(t);
    playLimit.prune(t);
    hostLimit.prune(t);
  }, sweepMs);
  sweeper.unref();

  return {
    http,
    io,
    rooms,
    close: () =>
      new Promise((resolve) => {
        clearInterval(sweeper);
        for (const code of [...rooms.keys()]) deleteRoom(code);
        io.close(() => resolve());
      }),
  };
}
