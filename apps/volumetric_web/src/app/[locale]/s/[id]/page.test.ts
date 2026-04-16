import { describe, expect, test, vi } from "vitest";

const { getHistoryByHashMock, getTranslationsMock } = vi.hoisted(() => ({
  getHistoryByHashMock: vi.fn(),
  getTranslationsMock: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: getTranslationsMock,
}));

vi.mock("@/lib/use-cases/history/get-history-by-hash/usecase", () => ({
  getHistoryByHash: getHistoryByHashMock,
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("@/components/ui/button", () => ({
  Button: () => null,
}));

vi.mock("@/i18n/routing", () => ({
  Link: () => null,
}));

vi.mock("./_components/CaptureInviteCode", () => ({
  CaptureInviteCode: () => null,
}));

import SharePage, { generateMetadata } from "./page";

function createTranslationMock(translate: (key: string) => string = (key) => key) {
  const translationMock = ((key: string) => translate(key)) as ((key: string) => string) & {
    rich: (key: string, values?: Record<string, unknown>) => string;
  };

  translationMock.rich = (key, values) => {
    const username = typeof values?.username === "string" ? values.username : "";

    return translate(key).replace("{username}", username);
  };

  return translationMock;
}

describe("Share page route", () => {
  test("should render without crashing when Next.js provides params as a promise", async () => {
    // given
    const routeParams = Promise.resolve({
      id: "3ANK9U",
      locale: "en",
    });

    getTranslationsMock.mockResolvedValue(createTranslationMock());
    getHistoryByHashMock.mockResolvedValue(null);

    // when
    const pagePromise = SharePage({
      params: routeParams as never,
    });

    // then
    await expect(pagePromise).resolves.toBeDefined();
    expect(getHistoryByHashMock).toHaveBeenCalledWith("3ANK9U");
  });

  test("should build metadata from awaited dynamic route params", async () => {
    // given
    const routeParams = Promise.resolve({
      id: "3ANK9U",
      locale: "en",
    });

    getTranslationsMock.mockResolvedValue(
      createTranslationMock((key: string) => {
        if (key === "keywords") {
          return "Bitcoin options trading, trading stats, Isometric, on-chain trading";
        }

        return key;
      }),
    );

    // when
    const metadata = await generateMetadata({
      params: routeParams as never,
    });

    // then
    expect(metadata.twitter?.images).toEqual(["https://isometric.fi/api/og/3ANK9U?locale=en"]);
    expect(metadata.keywords).toEqual([
      "Bitcoin options trading",
      "trading stats",
      "Isometric",
      "on-chain trading",
    ]);
  });
});
