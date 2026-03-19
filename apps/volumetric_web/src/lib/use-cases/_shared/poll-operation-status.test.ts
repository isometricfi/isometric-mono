import { describe, expect, test, vi } from "vitest";
import { pollOperationStatusUntilTerminal } from "./poll-operation-status";

describe("pollOperationStatusUntilTerminal", () => {
  test("should return terminal result when status eventually succeeds", async () => {
    // given
    const statuses = [{ Pending: null }, { Pending: null }, { Succeeded: { value: 42 } }] as const;
    let statusIndex = 0;
    const wait = vi.fn().mockResolvedValue(undefined);

    // when
    const result = await pollOperationStatusUntilTerminal({
      getStatus: async () => statuses[statusIndex++] ?? statuses[statuses.length - 1],
      mapTerminalStatus: (status) => ("Succeeded" in status ? status.Succeeded.value : null),
      intervalMs: 5,
      maxAttempts: 5,
      wait,
    });

    // then
    const EXPECTED_RESULT = 42;
    const EXPECTED_WAIT_CALL_COUNT = 2;
    expect(result).toBe(EXPECTED_RESULT);
    expect(wait).toHaveBeenCalledTimes(EXPECTED_WAIT_CALL_COUNT);
  });

  test("should throw timeout error when terminal status never arrives", async () => {
    // given
    const wait = vi.fn().mockResolvedValue(undefined);

    // when
    const run = pollOperationStatusUntilTerminal({
      getStatus: async () => ({ Pending: null }),
      mapTerminalStatus: () => null,
      intervalMs: 5,
      maxAttempts: 3,
      wait,
    });

    // then
    await expect(run).rejects.toThrow("terminal state");
    const EXPECTED_WAIT_CALL_COUNT = 2;
    expect(wait).toHaveBeenCalledTimes(EXPECTED_WAIT_CALL_COUNT);
  });
});
