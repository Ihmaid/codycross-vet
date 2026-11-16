import { io, Socket } from 'socket.io-client';
import { Ack, ClientEvents, Joined, RoomView, RoundView, ServerEvents } from '../core/protocol';

/** Endereço do servidor da competição: definido no build; no computador, a porta 3001 do mesmo endereço. */
export const SERVER_URL = __COMPETITION_SERVER__ || `${location.protocol}//${location.hostname}:3001`;

const SESSION_KEY = 'virologia-em-jogo-competicao';
const NAME_KEY = 'virologia-em-jogo-apelido';

export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'offline';

export interface Session {
  code: string;
  token: string;
  playerId: string;
}

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* armazenamento indisponível (modo privado): a sala só se perde se recarregar a página */
  }
}

export const savedName = (): string => read<string>(NAME_KEY) ?? '';
export const saveName = (name: string): void => write(NAME_KEY, name);

type Payload<E extends keyof ClientEvents> = Parameters<ClientEvents[E]>[0];
type Reply<E extends keyof ClientEvents> = Parameters<Parameters<ClientEvents[E]>[1]>[0];

export interface ConnectionEvents {
  status(status: ConnectionStatus): void;
  state(view: RoomView): void;
  round(round: RoundView): void;
  /** Saiu da sala sem querer: removido pelo organizador, sala encerrada ou sala que não existe mais. */
  left(reason: 'kicked' | 'closed' | 'gone'): void;
}

/**
 * Conexão com o servidor da competição. Só abre quando a pessoa entra na competição.
 * Se a internet cair, o Socket.IO reconecta sozinho e o jogador volta para a sala com o token salvo.
 */
export class Connection {
  private socket: Socket<ServerEvents, ClientEvents> | null = null;
  status: ConnectionStatus = 'idle';
  session: Session | null = read<Session>(SESSION_KEY);

  constructor(private readonly on: ConnectionEvents) {}

  connect(): void {
    if (this.socket) return;
    this.setStatus('connecting');
    // O servidor gratuito "dorme" sem uso e leva até um minuto para acordar: as tentativas continuam até lá.
    const socket: Socket<ServerEvents, ClientEvents> = io(SERVER_URL, { timeout: 20_000, reconnectionDelayMax: 4_000 });
    this.socket = socket;
    socket.on('connect', () => {
      this.setStatus('online');
      if (this.session) void this.resume();
    });
    socket.on('disconnect', () => this.setStatus('offline'));
    socket.on('connect_error', () => this.setStatus(this.status === 'online' ? 'offline' : this.status));
    socket.on('state', (v) => this.on.state(v));
    socket.on('round', (r) => this.on.round(r));
    socket.on('kicked', () => this.drop('kicked'));
    socket.on('closed', () => this.drop('closed'));
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.on.status(status);
  }

  private async resume(): Promise<void> {
    const s = this.session!;
    const r = await this.request('resume', { code: s.code, token: s.token });
    if (!r.ok && this.session?.token === s.token) this.drop('gone');
  }

  private drop(reason: 'kicked' | 'closed' | 'gone'): void {
    this.setSession(null);
    this.on.left(reason);
  }

  private setSession(session: Session | null): void {
    this.session = session;
    write(SESSION_KEY, session);
  }

  /** Envia uma ação e espera a resposta (com prazo, para não travar a tela sem internet). */
  request<E extends keyof ClientEvents>(event: E, payload: Payload<E>, timeoutMs = 12_000): Promise<Reply<E>> {
    this.connect();
    const socket = this.socket! as unknown as {
      timeout(ms: number): { emit(e: string, p: unknown, cb: (err: Error | null, r: Reply<E>) => void): void };
    };
    return new Promise((resolve) => {
      socket.timeout(timeoutMs).emit(event, payload, (err, r) => {
        resolve(err ? ({ ok: false, error: 'Sem resposta do servidor. Confira a internet e tente de novo.' } as Reply<E>) : r);
      });
    });
  }

  /** Cria ou entra numa sala e guarda o token para voltar depois. */
  async enter(event: 'create' | 'join', payload: { name: string; code?: string }): Promise<Ack<Joined>> {
    const r =
      event === 'create'
        ? await this.request('create', { name: payload.name })
        : await this.request('join', { code: payload.code ?? '', name: payload.name });
    if (r.ok) this.setSession({ code: r.code, token: r.token, playerId: r.playerId });
    return r;
  }

  async leave(): Promise<void> {
    if (this.session) await this.request('leave', {}, 4_000);
    this.setSession(null);
  }
}
