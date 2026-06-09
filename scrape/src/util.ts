export function displayError(error: Error): string {
  let str = "";
  while (true) {
    if (str) {
      str += ": ";
    }
    str += error.message;
    if (error.cause instanceof Error) {
      error = error.cause;
    } else if (error.cause === undefined) {
      return str;
    } else {
      console.error(error);
      throw new TypeError("Unexpected non-Error error");
    }
  }
}

export class ConcurrencyLimiter {
  #spots: number;
  #queue: PromiseWithResolvers<void>[] = [];

  constructor(max: number) {
    this.#spots = max;
  }

  async acquire(): Promise<Disposable> {
    if (this.#spots > 0) {
      this.#spots--;
    } else {
      const entry = Promise.withResolvers<void>();
      this.#queue.push(entry);
      await entry.promise;
    }
    let disposed = false;
    return {
      [Symbol.dispose]: () => {
        if (disposed) {
          return;
        }
        disposed = true;
        const next = this.#queue.shift();
        if (next) {
          next.resolve();
        } else {
          this.#spots++;
        }
      },
    };
  }
}
