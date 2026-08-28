import { unwrapResult } from "@volumetric/canister-types";
import { describe, expect, test } from "vitest";
import {
  createDemoCanisterActor,
  creditDemoBalance,
  type DemoCanisterState,
  DemoStateConflictError,
  type DemoStateStore,
} from "./demo-canister";

const USER_ADDRESS = "bc1q-demo-user";
const USER_SIGNATURE = "demo-signature";
const INITIAL_BALANCE_SATS = 10_000_000n;

describe("demo canister", () => {
  test("should create a pre-funded account that remains available on later reads", async () => {
    // given
    const store = createMemoryStore();
    const actor = createDemoCanisterActor(store);

    // when
    const createResult = await actor.create_account({
      data: { invite_code: [], expires_at_seconds: futureSeconds() },
      wallet_proof: { address: USER_ADDRESS, signature: USER_SIGNATURE },
    });
    const profile = unwrapResult(createResult);
    const balance = unwrapResult(await actor.get_user_balance(USER_ADDRESS));

    // then
    expect(profile.address).toBe(USER_ADDRESS);
    expect(balance).toEqual({
      available: INITIAL_BALANCE_SATS,
      locked: 0n,
      total: INITIAL_BALANCE_SATS,
    });
  });

  test("should accept a seeded offer and add the option to the buyer portfolio", async () => {
    // given
    const ACCEPT_QUANTITY_SATS = 100_000n;
    const SEEDED_OFFER_ID = 1n;
    const store = createMemoryStore();
    const actor = createDemoCanisterActor(store);
    await createAccount(actor);

    // when
    const receipt = unwrapResult(
      await actor.accept_offers({
        data: {
          expires_at_seconds: futureSeconds(),
          items: [{ offer_id: SEEDED_OFFER_ID, quantity: ACCEPT_QUANTITY_SATS }],
        },
        wallet_proof: { address: USER_ADDRESS, signature: USER_SIGNATURE },
      }),
    );
    const status = unwrapResult(await actor.get_accept_status(receipt.operation_id));
    const boughtOptions = unwrapResult(await actor.get_my_options(USER_ADDRESS));

    // then
    expect(status).toHaveProperty("Succeeded");
    expect(boughtOptions).toHaveLength(1);
    expect(boughtOptions[0]?.quantity).toBe(ACCEPT_QUANTITY_SATS);
  });

  test("should persist a simulated deposit without sending a transaction", async () => {
    // given
    const DEPOSIT_AMOUNT_SATS = 500_000n;
    const store = createMemoryStore();
    const actor = createDemoCanisterActor(store);
    await createAccount(actor);

    // when
    await creditDemoBalance(store, USER_ADDRESS, DEPOSIT_AMOUNT_SATS);
    const balance = unwrapResult(await actor.get_user_balance(USER_ADDRESS));

    // then
    const EXPECTED_BALANCE_SATS = INITIAL_BALANCE_SATS + DEPOSIT_AMOUNT_SATS;
    expect(balance.available).toBe(EXPECTED_BALANCE_SATS);
    expect(balance.total).toBe(EXPECTED_BALANCE_SATS);
  });

  test("should complete a simulated withdrawal immediately", async () => {
    // given
    const WITHDRAW_AMOUNT_SATS = 50_000n;
    const store = createMemoryStore();
    const actor = createDemoCanisterActor(store);
    await createAccount(actor);

    // when
    const receipt = unwrapResult(
      await actor.withdraw_ckbtc({
        data: { amount: WITHDRAW_AMOUNT_SATS, expires_at_seconds: futureSeconds() },
        wallet_proof: { address: USER_ADDRESS, signature: USER_SIGNATURE },
      }),
    );
    const status = unwrapResult(await actor.get_withdraw_status(receipt.operation_id));
    const balance = unwrapResult(await actor.get_user_balance(USER_ADDRESS));

    // then
    const EXPECTED_BALANCE_SATS = INITIAL_BALANCE_SATS - WITHDRAW_AMOUNT_SATS;
    expect(status).toHaveProperty("Succeeded");
    expect(balance.available).toBe(EXPECTED_BALANCE_SATS);
  });

  test("should reject offer parameters outside the demo trading limits", async () => {
    // given
    const QUANTITY_SATS = 100_000n;
    const STRIKE_BASIS_POINTS = 300;
    const INVALID_PREMIUM_BASIS_POINTS = 0;
    const OPTION_DURATION_SECONDS = 259_200n;
    const store = createMemoryStore();
    const actor = createDemoCanisterActor(store);
    await createAccount(actor);

    // when
    const result = await actor.create_offer({
      data: {
        asset: { CkBtc: null },
        option_type: { Call: null },
        quantity: QUANTITY_SATS,
        strike_basis_points: STRIKE_BASIS_POINTS,
        premium_basis_points: INVALID_PREMIUM_BASIS_POINTS,
        option_duration_seconds: OPTION_DURATION_SECONDS,
        offer_valid_until_seconds: futureSeconds(),
        expires_at_seconds: futureSeconds(),
      },
      wallet_proof: { address: USER_ADDRESS, signature: USER_SIGNATURE },
    });

    // then
    expect(result).toHaveProperty("Err");
  });

  test("should retry a state update after a storage conflict", async () => {
    // given
    const store = createConflictOnceStore();
    const actor = createDemoCanisterActor(store);

    // when
    const result = await createAccount(actor);
    const profile = unwrapResult(result);

    // then
    expect(profile.address).toBe(USER_ADDRESS);
    expect(unwrapResult(await actor.get_user_balance(USER_ADDRESS)).total).toBe(
      INITIAL_BALANCE_SATS,
    );
  });
});

function createMemoryStore(): DemoStateStore {
  let state: DemoCanisterState | null = null;
  return {
    load: async () => state,
    save: async (nextState) => {
      state = nextState;
    },
    clear: async () => {
      state = null;
    },
  };
}

function createConflictOnceStore(): DemoStateStore {
  let state: DemoCanisterState | null = null;
  let shouldConflict = true;
  return {
    load: async () => state,
    save: async (nextState) => {
      if (shouldConflict) {
        shouldConflict = false;
        throw new DemoStateConflictError();
      }
      state = nextState;
    },
    clear: async () => {
      state = null;
    },
  };
}

async function createAccount(actor: ReturnType<typeof createDemoCanisterActor>) {
  return actor.create_account({
    data: { invite_code: [], expires_at_seconds: futureSeconds() },
    wallet_proof: { address: USER_ADDRESS, signature: USER_SIGNATURE },
  });
}

function futureSeconds(): bigint {
  const CHALLENGE_LIFETIME_SECONDS = 300n;
  return BigInt(Math.floor(Date.now() / 1_000)) + CHALLENGE_LIFETIME_SECONDS;
}
