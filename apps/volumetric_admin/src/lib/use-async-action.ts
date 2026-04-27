import { useCallback, useState } from "react";
import type { AsyncPhase } from "../components/StatusBadge";

export type AsyncActionState<T> = {
  phase: AsyncPhase;
  statusText: string;
  error: string | null;
  data: T | null;
};

export function useAsyncAction<T>(options: {
  initialStatus?: string;
  loadingStatus: string;
  successStatus: (result: T) => string;
}) {
  const [state, setState] = useState<AsyncActionState<T>>({
    phase: "idle",
    statusText: options.initialStatus ?? "Idle",
    error: null,
    data: null,
  });

  const run = useCallback(
    async (task: () => Promise<T>) => {
      setState((current) => ({
        ...current,
        phase: "loading",
        statusText: options.loadingStatus,
        error: null,
      }));
      try {
        const result = await task();
        setState({
          phase: "ready",
          statusText: options.successStatus(result),
          error: null,
          data: result,
        });
        return result;
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
        setState((current) => ({
          ...current,
          phase: "error",
          statusText: "Query failed.",
          error: message,
        }));
        throw caughtError;
      }
    },
    [options.loadingStatus, options.successStatus],
  );

  return { ...state, run, setState };
}
