const DEFAULT_MAX_ATTEMPTS = 30;
const DEFAULT_INTERVAL_MS = 1_000;

export interface PollOperationStatusConfig<TStatus, TResult> {
  getStatus: () => Promise<TStatus>;
  mapTerminalStatus: (status: TStatus) => TResult | null;
  getPendingErrorMessage?: (status: TStatus) => string | null;
  intervalMs?: number;
  maxAttempts?: number;
  wait?: (ms: number) => Promise<void>;
}

export class OperationStatusPollingTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationStatusPollingTimeoutError";
  }
}

async function defaultWait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollOperationStatusUntilTerminal<TStatus, TResult>(
  config: PollOperationStatusConfig<TStatus, TResult>,
): Promise<TResult> {
  const wait = config.wait ?? defaultWait;
  const intervalMs = config.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxAttempts = config.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const status = await config.getStatus();
    const terminalResult = config.mapTerminalStatus(status);

    if (terminalResult !== null) {
      return terminalResult;
    }

    if (attempt < maxAttempts) {
      await wait(intervalMs);
    }
  }

  throw new OperationStatusPollingTimeoutError(
    `Operation status did not reach a terminal state after ${maxAttempts} attempts`,
  );
}
