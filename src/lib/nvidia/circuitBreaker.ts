export class CircuitBreaker<T, Args extends any[]> {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastStateChange = Date.now();

  private readonly failureThreshold: number;
  private readonly recoveryTimeoutMs: number;
  private readonly requestTimeoutMs: number;
  private readonly fn: (...args: Args) => Promise<T>;

  constructor(fn: (...args: Args) => Promise<T>, cfg?: {
    failureThreshold?: number;
    recoveryTimeoutMs?: number;
    requestTimeoutMs?: number;
  }) {
    this.fn = fn;
    this.failureThreshold = cfg?.failureThreshold ?? 5;
    this.recoveryTimeoutMs = cfg?.recoveryTimeoutMs ?? 60_000;
    this.requestTimeoutMs = cfg?.requestTimeoutMs ?? 15_000;
  }

  async execute(...args: Args): Promise<T> {
    this.tick();
    if (this.state === 'OPEN') throw new Error('CircuitBreaker OPEN — downstream API unavailable.');
    try {
      const result = await this.race(...args);
      this.onSuccess();
      return result;
    } catch (e) {
      this.onFailure();
      throw e;
    }
  }

  private race(...args: Args): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, rej) => {
      timer = setTimeout(() => rej(new Error(`Timed out after ${this.requestTimeoutMs}ms`)), this.requestTimeoutMs);
    });
    return Promise.race([this.fn(...args), timeout]).finally(() => clearTimeout(timer!));
  }

  private tick() {
    if (this.state === 'OPEN' && Date.now() - this.lastStateChange > this.recoveryTimeoutMs) {
      this.state = 'HALF_OPEN';
      this.lastStateChange = Date.now();
    }
  }
  private onSuccess() { this.failureCount = 0; this.state = 'CLOSED'; }
  private onFailure() {
    this.failureCount++;
    this.lastStateChange = Date.now();
    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) this.state = 'OPEN';
  }
  getStatus() {
    return { state: this.state, failureCount: this.failureCount, uptime: Date.now() - this.lastStateChange };
  }
}
