export interface LatestWriteQueueOptions<T> {
  write: (value: T) => Promise<void>;
  copy: (value: T) => T;
  onError: (error: unknown, value: T) => void;
  onIdle: (hasErrors: boolean) => void;
}

/**
 * Debounces writes by key, serializes writes for the same key, and always
 * persists the newest value scheduled while an older write is in flight.
 */
export class LatestWriteQueue<T> {
  readonly #options: LatestWriteQueueOptions<T>;
  readonly #timeouts = new Map<string, number>();
  readonly #pending = new Map<string, T>();
  readonly #inFlight = new Set<string>();
  readonly #failed = new Set<string>();
  readonly #cancelled = new Set<string>();
  #disposed = false;

  constructor(options: LatestWriteQueueOptions<T>) {
    this.#options = options;
  }

  schedule(key: string, value: T, delayMs: number): void {
    if (this.#disposed) {
      return;
    }

    this.#clearTimeout(key);
    this.#cancelled.delete(key);
    this.#failed.delete(key);
    this.#pending.set(key, this.#options.copy(value));
    this.#timeouts.set(
      key,
      globalThis.setTimeout(() => {
        void this.flush(key);
      }, delayMs),
    );
  }

  async flush(key: string): Promise<void> {
    this.#clearTimeout(key);

    if (this.#disposed || this.#inFlight.has(key) || !this.#pending.has(key)) {
      return;
    }

    const value = this.#pending.get(key) as T;
    this.#pending.delete(key);
    this.#inFlight.add(key);

    try {
      await this.#options.write(value);
      if (!this.#cancelled.has(key)) {
        this.#failed.delete(key);
      }
    } catch (error) {
      if (!this.#disposed && !this.#cancelled.has(key)) {
        this.#failed.add(key);
        this.#options.onError(error, value);
      }
    } finally {
      this.#inFlight.delete(key);

      if (this.#disposed) {
        return;
      }

      if (this.#cancelled.delete(key)) {
        this.#pending.delete(key);
        this.#failed.delete(key);
      } else if (this.#pending.has(key)) {
        void this.flush(key);
      }

      this.#notifyIfIdle();
    }
  }

  cancel(keys: Iterable<string>): void {
    for (const key of keys) {
      this.#clearTimeout(key);
      this.#pending.delete(key);
      this.#failed.delete(key);

      if (this.#inFlight.has(key)) {
        this.#cancelled.add(key);
      }
    }

    this.#notifyIfIdle();
  }

  dispose(): void {
    this.#disposed = true;
    for (const timeoutId of this.#timeouts.values()) {
      globalThis.clearTimeout(timeoutId);
    }
    this.#timeouts.clear();
    this.#pending.clear();
    this.#failed.clear();
    this.#cancelled.clear();
  }

  #clearTimeout(key: string): void {
    const timeoutId = this.#timeouts.get(key);
    if (timeoutId !== undefined) {
      globalThis.clearTimeout(timeoutId);
      this.#timeouts.delete(key);
    }
  }

  #notifyIfIdle(): void {
    if (
      !this.#disposed &&
      this.#timeouts.size === 0 &&
      this.#pending.size === 0 &&
      this.#inFlight.size === 0
    ) {
      this.#options.onIdle(this.#failed.size > 0);
    }
  }
}
