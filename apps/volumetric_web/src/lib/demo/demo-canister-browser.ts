import { Principal } from "@icp-sdk/core/principal";
import type { _SERVICE } from "@volumetric/canister-types";
import SuperJSON from "superjson";
import { INVITE_CODE_PATTERN } from "@/lib/referrals/invite-code";
import {
  createDemoCanisterActor,
  creditDemoBalance,
  type DemoCanisterState,
  type DemoStateStore,
} from "./demo-canister";

const DEMO_STATE_STORAGE_KEY = "vm-demo-state";
export const DEMO_USER_ADDRESS = "demo-maker-bravo";
export const DEMO_USER_SIGNATURE = "demo-signature";

const serializer = new SuperJSON();

serializer.registerCustom<Principal, string>(
  {
    isApplicable: (value): value is Principal => value instanceof Principal,
    serialize: (value) => value.toText(),
    deserialize: (value) => Principal.fromText(value),
  },
  "icp-principal",
);

type DemoBrowserMethod =
  | "get_accept_offers_message"
  | "get_cancel_offer_message"
  | "get_create_offer_message"
  | "get_message_to_sign"
  | "get_username_update_message"
  | "get_withdraw_message"
  | "validate_invite_code";

type PlainActorMethod<T> = T extends (...args: infer Args) => infer Result
  ? (...args: Args) => Result
  : never;

type DemoBrowserActor = {
  [Method in DemoBrowserMethod]: PlainActorMethod<_SERVICE[Method]>;
};

const demoMessageActor: DemoBrowserActor = {
  get_message_to_sign: async (address, inviteCode, expiresAtSeconds) =>
    message("create account", address, inviteCode[0] ?? "none", expiresAtSeconds),
  get_create_offer_message: async (
    address,
    quantity,
    strikeBasisPoints,
    premiumBasisPoints,
    optionDurationSeconds,
    offerValidUntilSeconds,
    expiresAtSeconds,
  ) =>
    message(
      "create offer",
      address,
      quantity,
      strikeBasisPoints,
      premiumBasisPoints,
      optionDurationSeconds,
      offerValidUntilSeconds,
      expiresAtSeconds,
    ),
  get_accept_offers_message: async (address, items, expiresAtSeconds) =>
    message(
      "accept offers",
      address,
      items.map((item) => `${item.offer_id}:${item.quantity}`).join(","),
      expiresAtSeconds,
    ),
  get_cancel_offer_message: async (address, offerId, expiresAtSeconds) =>
    message("cancel offer", address, offerId, expiresAtSeconds),
  get_withdraw_message: async (address, amount, expiresAtSeconds) =>
    message("withdraw", address, amount, expiresAtSeconds),
  get_username_update_message: async (address, username, expiresAtSeconds) =>
    message("update username", address, username, expiresAtSeconds),
  validate_invite_code: async (inviteCode) =>
    INVITE_CODE_PATTERN.test(inviteCode.trim().toUpperCase()),
};

const demoStateStore: DemoStateStore = {
  async load() {
    const stateJson = localStorage.getItem(DEMO_STATE_STORAGE_KEY);
    if (!stateJson) return null;
    return serializer.deserialize<DemoCanisterState>(JSON.parse(stateJson));
  },
  async save(state) {
    const nextState = { ...state, revision: state.revision + 1 };
    localStorage.setItem(DEMO_STATE_STORAGE_KEY, JSON.stringify(serializer.serialize(nextState)));
    state.revision = nextState.revision;
  },
  async clear() {
    localStorage.removeItem(DEMO_STATE_STORAGE_KEY);
  },
};

export const demoBrowserActor = {
  ...createDemoCanisterActor(demoStateStore),
  ...demoMessageActor,
} as unknown as _SERVICE;

export async function depositDemoFunds(address: string, amountSats: bigint): Promise<void> {
  await creditDemoBalance(demoStateStore, address, amountSats);
}

export async function resetDemoSession(): Promise<void> {
  await demoStateStore.clear();
}

function message(action: string, ...values: Array<string | number | bigint>) {
  return { Ok: `Isometric demo | ${action} | ${values.join(" | ")}` } as const;
}
