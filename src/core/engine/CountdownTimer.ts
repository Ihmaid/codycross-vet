/**
 * Contagem regressiva baseada no relógio (Date.now) e não na contagem de ticks:
 * navegadores atrasam setInterval em abas em segundo plano, o que fazia o tempo "parar".
 */
export class CountdownTimer {
  private deadline = 0;
  private remaining = 0;
  private lastReported = -1;
  private handle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly onTick: (secondsLeft: number) => void,
    private readonly onExpire: () => void
  ) {}

  public start(seconds: number): void {
    this.stop();
    this.remaining = seconds;
    this.deadline = Date.now() + seconds * 1000;
    this.lastReported = -1;
    this.handle = setInterval(() => this.tick(), 250);
    this.tick();
  }

  /** Para o cronômetro, congelando o tempo restante. */
  public stop(): void {
    if (!this.handle) return;
    this.remaining = this.secondsLeft();
    clearInterval(this.handle);
    this.handle = null;
  }

  public secondsLeft(): number {
    if (!this.handle) return this.remaining;
    return Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
  }

  private tick(): void {
    const seconds = this.secondsLeft();
    if (seconds !== this.lastReported) {
      this.lastReported = seconds;
      this.onTick(seconds);
    }
    if (seconds <= 0) {
      this.stop();
      this.onExpire();
    }
  }
}
