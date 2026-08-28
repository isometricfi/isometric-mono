import { expect, test } from "vitest";
import { getHistory } from "./usecase";

test("should return an empty history for a demo session", async () => {
  // given
  const DEMO_PRINCIPAL = "aaaaa-aa";

  // when
  const result = await getHistory(DEMO_PRINCIPAL);

  // then
  expect(result).toEqual({ entries: [] });
});
