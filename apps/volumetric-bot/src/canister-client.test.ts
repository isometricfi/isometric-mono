import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { actorCreateActorMock, fetchRootKeyMock, httpAgentCreateMock } = vi.hoisted(() => ({
  actorCreateActorMock: vi.fn(),
  fetchRootKeyMock: vi.fn(),
  httpAgentCreateMock: vi.fn(),
}));

vi.mock("@dfinity/agent", () => ({
  Actor: {
    createActor: actorCreateActorMock,
  },
  HttpAgent: {
    create: httpAgentCreateMock,
  },
}));

vi.mock("@volumetric/canister-types", () => ({
  idlFactory: {},
}));

describe("getCanisterActor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    httpAgentCreateMock.mockResolvedValue({
      fetchRootKey: fetchRootKeyMock,
    });
    actorCreateActorMock.mockReturnValue({ get_message_to_sign: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("should pass a receiver-independent fetch wrapper to the DFINITY agent", async () => {
    // given
    const fetchMock = vi.fn(function (
      this: unknown,
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) {
      if (this !== undefined) {
        throw new TypeError("Illegal invocation");
      }

      return Promise.resolve(new Response(null, { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getCanisterActor } = await import("./canister-client");

    // when
    await getCanisterActor("mock-canister-id", "https://ic0.app");

    // then
    expect(httpAgentCreateMock).toHaveBeenCalledTimes(1);

    const httpAgentOptions = httpAgentCreateMock.mock.calls[0][0] as {
      fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
      host: string;
    };

    expect(httpAgentOptions.host).toBe("https://ic0.app");
    expect(httpAgentOptions.fetch).toBeTypeOf("function");

    await expect(
      httpAgentOptions.fetch?.call({ broken: true }, "https://ic0.app/api/v2/status"),
    ).resolves.toBeInstanceOf(Response);
    expect(fetchMock).toHaveBeenCalledWith("https://ic0.app/api/v2/status", undefined);
  });
});
