import { Principal } from "@icp-sdk/core/principal";
import type {
  _SERVICE,
  AcceptOffersReceipt,
  AcceptOffersResult,
  AcceptOffersStatus,
  ActiveOption,
  FeeConfig,
  Offer,
  ProfileInfo,
  TradingLimits,
  UserBalanceInfo,
  VolumetricError,
  WithdrawReceipt,
  WithdrawStatus,
} from "@volumetric/canister-types";

const BASIS_POINTS_DIVISOR = 10_000n;
const DEMO_INITIAL_BALANCE_SATS = 10_000_000n;
const DEMO_MARKET_PRICE_CENTS = 11_200_000n;
const DEMO_MAKER_BALANCE_SATS = 500_000_000n;
const DEMO_SESSION_DURATION_24_HOURS_MS = 24 * 60 * 60 * 1_000;
const DEMO_OFFER_VALIDITY_10_YEARS_SECONDS = 10n * 365n * 24n * 60n * 60n;
const SECONDS_PER_DAY = 86_400n;
const OPERATION_ID_BYTE_LENGTH = 8;
const MAX_STATE_WRITE_ATTEMPTS = 3;

const DEMO_TRADING_LIMITS: TradingLimits = {
  create_offer_quantity_sats: { min: 40_000n, max: 100_000_000n },
  accept_offer_quantity_sats: { min: 40_000n, max: 100_000_000n },
  premium_basis_points: { min: 10, max: 300 },
  strike_basis_points: { min: 100, max: 800 },
  option_duration_seconds: { min: 3n * SECONDS_PER_DAY, max: 7n * SECONDS_PER_DAY },
  deposit_amount_sats: 50_000n,
  withdraw_amount_sats: 50_000n,
  max_offers_per_term: 5n,
};

const DEMO_FEE_CONFIG: FeeConfig = {
  premium_fee_basis_points: 500n,
  profit_fee_basis_points: 2_000n,
  fee_recipient: Principal.selfAuthenticating(new TextEncoder().encode("demo-fee-recipient")),
};

type DemoServerMethod =
  | "accept_offers"
  | "cancel_offer"
  | "create_account"
  | "create_offer"
  | "get_accept_status"
  | "get_account_info"
  | "get_active_options"
  | "get_deposit_address"
  | "get_fee_config"
  | "get_latest_xrc_btc_usd_rate"
  | "get_my_offers"
  | "get_my_options"
  | "get_my_written_options"
  | "get_open_offers"
  | "get_trading_limits"
  | "get_user_balance"
  | "get_user_balances_by_principals"
  | "get_withdraw_status"
  | "resolve_invite_code"
  | "update_ckbtc_balance"
  | "update_username"
  | "withdraw_ckbtc";

type PlainActorMethod<T> = T extends (...args: infer Args) => infer Result
  ? (...args: Args) => Result
  : never;

type DemoServerActor = {
  [Method in DemoServerMethod]: PlainActorMethod<_SERVICE[Method]>;
};

export interface DemoCanisterState {
  revision: number;
  createdAtMs: number;
  profiles: ProfileInfo[];
  referrerAddressByAddress: Record<string, string>;
  balancesByAddress: Record<string, UserBalanceInfo>;
  offers: Offer[];
  activeOptions: ActiveOption[];
  acceptStatusesByOperationId: Record<string, AcceptOffersStatus>;
  withdrawStatusesByOperationId: Record<string, WithdrawStatus>;
  nextProfileId: bigint;
  nextOfferId: bigint;
  nextOptionId: bigint;
  nextFillGroupId: bigint;
  nextAcceptJournalEntryId: bigint;
  nextWithdrawalId: bigint;
  nextOperationId: bigint;
  nextBlockIndex: bigint;
}

export interface DemoStateStore {
  load(): Promise<DemoCanisterState | null>;
  save(state: DemoCanisterState): Promise<void>;
  clear(): Promise<void>;
}

export class DemoStateConflictError extends Error {
  constructor() {
    super("Demo state changed during this action");
    this.name = "DemoStateConflictError";
  }
}

export function createDemoCanisterActor(store: DemoStateStore): DemoServerActor {
  return {
    get_trading_limits: async () => DEMO_TRADING_LIMITS,
    get_fee_config: async () => ({ Ok: DEMO_FEE_CONFIG }),
    get_latest_xrc_btc_usd_rate: async () => {
      const nowSeconds = BigInt(Math.floor(Date.now() / 1_000));
      return [
        {
          decimals: 2,
          price_cents: DEMO_MARKET_PRICE_CENTS,
          xrc_timestamp_seconds: nowSeconds,
          fetched_at_seconds: nowSeconds,
        },
      ];
    },
    get_account_info: async (address, includeReferralCount) => {
      const state = await loadDemoState(store);
      const profile = findProfileByAddress(state, address);
      if (!profile) {
        return { Ok: [] };
      }

      return { Ok: [withReferralCount(state, profile, includeReferralCount)] };
    },
    create_account: async (payload) =>
      updateDemoState(store, (state) => {
        const address = payload.wallet_proof.address;
        const existingProfile = findProfileByAddress(state, address);
        if (existingProfile) {
          return { Ok: withReferralCount(state, existingProfile, true) };
        }

        if (!payload.wallet_proof.signature) {
          return demoError("A wallet signature is required");
        }

        const profile = createProfile(address, [], createInviteCode(state.nextProfileId));
        state.nextProfileId += 1n;
        state.profiles.push(profile);
        state.balancesByAddress[address] = createBalance(DEMO_INITIAL_BALANCE_SATS);

        const referrerInviteCode = payload.data.invite_code[0];
        const referrerProfile = referrerInviteCode
          ? findProfileByInviteCode(state, referrerInviteCode)
          : undefined;
        if (referrerProfile) {
          state.referrerAddressByAddress[address] = referrerProfile.address;
        }

        return { Ok: withReferralCount(state, profile, true) };
      }),
    get_deposit_address: async (address) => {
      const state = await loadDemoState(store);
      const profile = findProfileByAddress(state, address);
      if (!profile) {
        return demoError("Demo account not found");
      }

      return {
        Ok: {
          account: { owner: profile.principal, subaccount: [profile.subaccount] },
          btc_address: `demo-${profile.invite_code[0] ?? "account"}`,
        },
      };
    },
    get_user_balance: async (address) => {
      const state = await loadDemoState(store);
      const balance = state.balancesByAddress[address];
      return balance ? { Ok: balance } : demoError("Demo account not found");
    },
    get_user_balances_by_principals: async (principals) => {
      const state = await loadDemoState(store);
      return {
        Ok: principals.map((principal) => {
          const profile = findProfileByPrincipal(state, principal);
          return profile ? state.balancesByAddress[profile.address] : createBalance(0n);
        }),
      };
    },
    update_ckbtc_balance: async () => ({ Ok: [] }),
    update_username: async (payload) =>
      updateDemoState(store, (state) => {
        const profile = findProfileByAddress(state, payload.wallet_proof.address);
        if (!profile) {
          return demoError("Demo account not found");
        }

        profile.username = [payload.data.username];
        return { Ok: withReferralCount(state, profile, true) };
      }),
    resolve_invite_code: async (inviteCode) => {
      const state = await loadDemoState(store);
      const profile = findProfileByInviteCode(state, inviteCode);
      return profile ? [profile.address] : [];
    },
    get_open_offers: async () => {
      const state = await loadDemoState(store);
      return state.offers.filter((offer) => isOpenOffer(offer));
    },
    get_active_options: async () => {
      const state = await loadDemoState(store);
      return state.activeOptions.filter((option) => "Active" in option.status);
    },
    get_my_offers: async (address) => {
      const state = await loadDemoState(store);
      const profile = findProfileByAddress(state, address);
      return {
        Ok: profile
          ? state.offers.filter((offer) => offer.writer.toText() === profile.principal.toText())
          : [],
      };
    },
    get_my_options: async (address) => {
      const state = await loadDemoState(store);
      const profile = findProfileByAddress(state, address);
      return {
        Ok: profile
          ? state.activeOptions.filter(
              (option) => option.buyer.toText() === profile.principal.toText(),
            )
          : [],
      };
    },
    get_my_written_options: async (address) => {
      const state = await loadDemoState(store);
      const profile = findProfileByAddress(state, address);
      return {
        Ok: profile
          ? state.activeOptions.filter(
              (option) => option.writer.toText() === profile.principal.toText(),
            )
          : [],
      };
    },
    create_offer: async (payload) =>
      updateDemoState(store, (state) => {
        const profile = findProfileByAddress(state, payload.wallet_proof.address);
        if (!profile) {
          return demoError("Demo account not found");
        }

        const balance = state.balancesByAddress[profile.address];
        const quantity = payload.data.quantity;
        if (!isWithinRange(quantity, DEMO_TRADING_LIMITS.create_offer_quantity_sats)) {
          return demoError("Offer quantity is outside the demo trading limits");
        }
        if (
          !isWithinNumberRange(
            payload.data.strike_basis_points,
            DEMO_TRADING_LIMITS.strike_basis_points,
          ) ||
          !isWithinNumberRange(
            payload.data.premium_basis_points,
            DEMO_TRADING_LIMITS.premium_basis_points,
          ) ||
          !isWithinRange(
            payload.data.option_duration_seconds,
            DEMO_TRADING_LIMITS.option_duration_seconds,
          )
        ) {
          return demoError("Offer parameters are outside the demo trading limits");
        }
        if (!balance || balance.available < quantity) {
          return demoError("Insufficient demo balance");
        }

        const openOffersForTerm = state.offers.filter(
          (offer) =>
            offer.writer.toText() === profile.principal.toText() &&
            offer.option_duration_seconds === payload.data.option_duration_seconds &&
            isOpenOffer(offer),
        ).length;
        if (BigInt(openOffersForTerm) >= DEMO_TRADING_LIMITS.max_offers_per_term) {
          return demoError("Maximum open offers reached for this term");
        }

        const offer: Offer = {
          id: state.nextOfferId,
          status: { Open: null },
          option_type: { Call: null },
          asset: { CkBtc: null },
          total_quantity: quantity,
          remaining_quantity: quantity,
          offer_valid_until_seconds: payload.data.offer_valid_until_seconds,
          writer: profile.principal,
          strike_basis_points: payload.data.strike_basis_points,
          premium_basis_points: payload.data.premium_basis_points,
          created_at_seconds: nowSeconds(),
          option_duration_seconds: payload.data.option_duration_seconds,
        };
        state.nextOfferId += 1n;
        state.offers.push(offer);
        return { Ok: { offer } };
      }),
    cancel_offer: async (payload) =>
      updateDemoState(store, (state) => {
        const profile = findProfileByAddress(state, payload.wallet_proof.address);
        const offer = state.offers.find((candidate) => candidate.id === payload.data.offer_id);
        if (!profile || !offer || offer.writer.toText() !== profile.principal.toText()) {
          return demoError("Demo offer not found");
        }
        if (!isOpenOffer(offer)) {
          return demoError("Demo offer is no longer open");
        }

        offer.status = { Cancelled: null };
        return { Ok: offer };
      }),
    accept_offers: async (payload) =>
      updateDemoState(store, (state) => acceptOffersInState(state, payload)),
    get_accept_status: async (operationId) => {
      const state = await loadDemoState(store);
      const status = state.acceptStatusesByOperationId[bytesToHex(operationId)];
      return status ? { Ok: status } : demoError("Demo accept operation not found");
    },
    withdraw_ckbtc: async (payload) =>
      updateDemoState(store, (state) => withdrawFromState(state, payload)),
    get_withdraw_status: async (operationId) => {
      const state = await loadDemoState(store);
      const status = state.withdrawStatusesByOperationId[bytesToHex(operationId)];
      return status ? { Ok: status } : demoError("Demo withdrawal operation not found");
    },
  };
}

export async function creditDemoBalance(
  store: DemoStateStore,
  address: string,
  amountSats: bigint,
): Promise<void> {
  await updateDemoState(store, (state) => {
    const balance = state.balancesByAddress[address];
    if (!balance) {
      throw new Error("Demo account not found");
    }
    if (amountSats <= 0n) {
      throw new Error("Demo deposit amount must be positive");
    }

    balance.available += amountSats;
    balance.total += amountSats;
  });
}

export function createDemoState(createdAtMs = Date.now()): DemoCanisterState {
  const createdAtSeconds = BigInt(Math.floor(createdAtMs / 1_000));
  const offerValidUntilSeconds = createdAtSeconds + DEMO_OFFER_VALIDITY_10_YEARS_SECONDS;
  const makerAlpha = createProfile("demo-maker-alpha", ["Atlas"], "DEMO01");
  const makerBravo = createProfile("demo-maker-bravo", ["Satoshi"], "DEMO02");
  const profiles = [makerAlpha, makerBravo];

  const offers: Offer[] = [
    createSeedOffer(1n, makerAlpha.principal, 5_000_000n, 300, 90, 3n, createdAtSeconds),
    createSeedOffer(2n, makerBravo.principal, 8_000_000n, 500, 150, 7n, createdAtSeconds),
    createSeedOffer(3n, makerAlpha.principal, 3_000_000n, 800, 240, 7n, createdAtSeconds),
  ].map((offer) => ({ ...offer, offer_valid_until_seconds: offerValidUntilSeconds }));

  const activeOptions: ActiveOption[] = [
    {
      id: 1n,
      status: { Active: null },
      expiry_seconds: createdAtSeconds + 3n * SECONDS_PER_DAY,
      option_type: { Call: null },
      fill_group_id: [1n],
      entry_price_cents: DEMO_MARKET_PRICE_CENTS,
      asset: { CkBtc: null },
      writer: makerAlpha.principal,
      offer_id: 1n,
      profit_fee_basis_points: DEMO_FEE_CONFIG.profit_fee_basis_points,
      quantity: 1_000_000n,
      accepted_at_seconds: createdAtSeconds,
      buyer: makerBravo.principal,
      premium_paid: 9_000n,
      strike_price_cents: calculateStrikePriceCents(DEMO_MARKET_PRICE_CENTS, 300),
    },
  ];

  return {
    revision: -1,
    createdAtMs,
    profiles,
    referrerAddressByAddress: {},
    balancesByAddress: {
      [makerAlpha.address]: createBalance(DEMO_MAKER_BALANCE_SATS - 1_000_000n, 1_000_000n),
      [makerBravo.address]: createBalance(DEMO_MAKER_BALANCE_SATS),
    },
    offers,
    activeOptions,
    acceptStatusesByOperationId: {},
    withdrawStatusesByOperationId: {},
    nextProfileId: 3n,
    nextOfferId: 4n,
    nextOptionId: 2n,
    nextFillGroupId: 2n,
    nextAcceptJournalEntryId: 1n,
    nextWithdrawalId: 1n,
    nextOperationId: 1n,
    nextBlockIndex: 1n,
  };
}

async function loadDemoState(store: DemoStateStore): Promise<DemoCanisterState> {
  for (let attempt = 0; attempt < MAX_STATE_WRITE_ATTEMPTS; attempt += 1) {
    const existingState = await store.load();
    if (
      existingState &&
      Date.now() - existingState.createdAtMs < DEMO_SESSION_DURATION_24_HOURS_MS
    ) {
      return existingState;
    }

    const state = createDemoState();
    try {
      await store.save(state);
      return state;
    } catch (error) {
      if (!(error instanceof DemoStateConflictError)) {
        throw error;
      }
    }
  }

  throw new DemoStateConflictError();
}

async function updateDemoState<T>(
  store: DemoStateStore,
  update: (state: DemoCanisterState) => T,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_STATE_WRITE_ATTEMPTS; attempt += 1) {
    const state = await loadDemoState(store);
    const result = update(state);
    try {
      await store.save(state);
      return result;
    } catch (error) {
      if (!(error instanceof DemoStateConflictError)) {
        throw error;
      }
    }
  }

  throw new DemoStateConflictError();
}

function acceptOffersInState(
  state: DemoCanisterState,
  payload: Parameters<DemoServerActor["accept_offers"]>[0],
) {
  const buyerProfile = findProfileByAddress(state, payload.wallet_proof.address);
  if (!buyerProfile) {
    return demoError("Demo account not found");
  }

  const buyerBalance = state.balancesByAddress[buyerProfile.address];
  if (!buyerBalance) {
    return demoError("Demo balance not found");
  }

  const seenOfferIds = new Set<bigint>();
  const preparedFills: Array<{
    offer: Offer;
    writerProfile: ProfileInfo;
    quantity: bigint;
    premiumSats: bigint;
  }> = [];
  const collateralByWriterAddress = new Map<string, bigint>();
  let totalPremiumSats = 0n;

  for (const item of payload.data.items) {
    if (seenOfferIds.has(item.offer_id)) {
      return demoError("A demo offer can only be accepted once per request");
    }
    seenOfferIds.add(item.offer_id);

    const offer = state.offers.find((candidate) => candidate.id === item.offer_id);
    if (!offer || !isOpenOffer(offer)) {
      return demoError("Demo offer is no longer open");
    }
    if (!isWithinRange(item.quantity, DEMO_TRADING_LIMITS.accept_offer_quantity_sats)) {
      return demoError("Accepted quantity is outside the demo trading limits");
    }
    if (item.quantity > offer.remaining_quantity) {
      return demoError("Accepted quantity exceeds the remaining demo offer");
    }

    const writerProfile = findProfileByPrincipal(state, offer.writer);
    if (!writerProfile || writerProfile.address === buyerProfile.address) {
      return demoError("You cannot accept your own demo offer");
    }

    const premiumSats = calculateBasisPoints(item.quantity, offer.premium_basis_points);
    totalPremiumSats += premiumSats;
    collateralByWriterAddress.set(
      writerProfile.address,
      (collateralByWriterAddress.get(writerProfile.address) ?? 0n) + item.quantity,
    );
    preparedFills.push({ offer, writerProfile, quantity: item.quantity, premiumSats });
  }

  if (buyerBalance.available < totalPremiumSats) {
    return demoError("Insufficient demo balance for the premium");
  }
  for (const [writerAddress, collateralSats] of collateralByWriterAddress) {
    if ((state.balancesByAddress[writerAddress]?.available ?? 0n) < collateralSats) {
      return demoError("The demo writer no longer has enough collateral");
    }
  }

  const fillGroupId = state.nextFillGroupId;
  state.nextFillGroupId += 1n;
  const activeOptions: ActiveOption[] = [];
  const acceptedAtSeconds = nowSeconds();

  for (const fill of preparedFills) {
    const writerBalance = state.balancesByAddress[fill.writerProfile.address];
    if (!writerBalance) {
      return demoError("Demo writer balance not found");
    }

    const premiumFeeSats = calculateBasisPoints(
      fill.premiumSats,
      Number(DEMO_FEE_CONFIG.premium_fee_basis_points),
    );
    buyerBalance.available -= fill.premiumSats;
    buyerBalance.total -= fill.premiumSats;
    writerBalance.available =
      writerBalance.available - fill.quantity + fill.premiumSats - premiumFeeSats;
    writerBalance.locked += fill.quantity;
    writerBalance.total += fill.premiumSats - premiumFeeSats;

    fill.offer.remaining_quantity -= fill.quantity;
    fill.offer.status =
      fill.offer.remaining_quantity === 0n ? { Filled: null } : { PartiallyFilled: null };

    const activeOption: ActiveOption = {
      id: state.nextOptionId,
      status: { Active: null },
      expiry_seconds: acceptedAtSeconds + fill.offer.option_duration_seconds,
      option_type: { Call: null },
      fill_group_id: [fillGroupId],
      entry_price_cents: DEMO_MARKET_PRICE_CENTS,
      asset: { CkBtc: null },
      writer: fill.offer.writer,
      offer_id: fill.offer.id,
      profit_fee_basis_points: DEMO_FEE_CONFIG.profit_fee_basis_points,
      quantity: fill.quantity,
      accepted_at_seconds: acceptedAtSeconds,
      buyer: buyerProfile.principal,
      premium_paid: fill.premiumSats,
      strike_price_cents: calculateStrikePriceCents(
        DEMO_MARKET_PRICE_CENTS,
        fill.offer.strike_basis_points,
      ),
    };
    state.nextOptionId += 1n;
    state.activeOptions.push(activeOption);
    activeOptions.push(activeOption);
  }

  const operationId = operationIdBytes(state.nextOperationId);
  state.nextOperationId += 1n;
  const receipt: AcceptOffersReceipt = {
    accept_journal_entry_id: state.nextAcceptJournalEntryId,
    fill_group_id: fillGroupId,
    operation_id: operationId,
  };
  state.nextAcceptJournalEntryId += 1n;
  const result: AcceptOffersResult = { fill_group_id: fillGroupId, active_options: activeOptions };
  state.acceptStatusesByOperationId[bytesToHex(operationId)] = {
    Succeeded: { result, receipt },
  };
  return { Ok: receipt };
}

function withdrawFromState(
  state: DemoCanisterState,
  payload: Parameters<DemoServerActor["withdraw_ckbtc"]>[0],
) {
  const profile = findProfileByAddress(state, payload.wallet_proof.address);
  const balance = profile ? state.balancesByAddress[profile.address] : undefined;
  if (!profile || !balance) {
    return demoError("Demo account not found");
  }
  if (payload.data.amount < DEMO_TRADING_LIMITS.withdraw_amount_sats) {
    return demoError("Withdrawal is below the demo minimum");
  }
  if (balance.available < payload.data.amount) {
    return demoError("Insufficient demo balance");
  }

  balance.available -= payload.data.amount;
  balance.total -= payload.data.amount;
  const operationId = operationIdBytes(state.nextOperationId);
  state.nextOperationId += 1n;
  const receipt: WithdrawReceipt = {
    withdrawal_id: state.nextWithdrawalId,
    operation_id: operationId,
  };
  state.nextWithdrawalId += 1n;
  const result = { block_index: state.nextBlockIndex };
  state.nextBlockIndex += 1n;
  state.withdrawStatusesByOperationId[bytesToHex(operationId)] = {
    Succeeded: { result, receipt },
  };
  return { Ok: receipt };
}

function createProfile(address: string, username: [] | [string], inviteCode: string): ProfileInfo {
  const principal = Principal.selfAuthenticating(new TextEncoder().encode(`demo:${address}`));
  const subaccount = new Uint8Array(32);
  const principalBytes = principal.toUint8Array();
  subaccount.set(principalBytes.slice(0, subaccount.length));

  return {
    principal,
    username,
    referral_count: [0n],
    subaccount,
    invite_code: [inviteCode],
    address,
  };
}

function createSeedOffer(
  id: bigint,
  writer: Principal,
  quantity: bigint,
  strikeBasisPoints: number,
  premiumBasisPoints: number,
  durationDays: bigint,
  createdAtSeconds: bigint,
): Offer {
  return {
    id,
    status: { Open: null },
    option_type: { Call: null },
    asset: { CkBtc: null },
    total_quantity: quantity,
    remaining_quantity: quantity,
    offer_valid_until_seconds: createdAtSeconds,
    writer,
    strike_basis_points: strikeBasisPoints,
    premium_basis_points: premiumBasisPoints,
    created_at_seconds: createdAtSeconds,
    option_duration_seconds: durationDays * SECONDS_PER_DAY,
  };
}

function createBalance(available: bigint, locked = 0n): UserBalanceInfo {
  return { available, locked, total: available + locked };
}

function findProfileByAddress(state: DemoCanisterState, address: string) {
  return state.profiles.find((profile) => profile.address === address);
}

function findProfileByPrincipal(state: DemoCanisterState, principal: Principal) {
  const principalText = principal.toText();
  return state.profiles.find((profile) => profile.principal.toText() === principalText);
}

function findProfileByInviteCode(state: DemoCanisterState, inviteCode: string) {
  const normalizedInviteCode = inviteCode.trim().toUpperCase();
  return state.profiles.find((profile) => profile.invite_code[0] === normalizedInviteCode);
}

function withReferralCount(
  state: DemoCanisterState,
  profile: ProfileInfo,
  includeReferralCount: boolean,
): ProfileInfo {
  if (!includeReferralCount) {
    return { ...profile, referral_count: [] };
  }

  const referralCount = Object.values(state.referrerAddressByAddress).filter(
    (referrerAddress) => referrerAddress === profile.address,
  ).length;
  return { ...profile, referral_count: [BigInt(referralCount)] };
}

function createInviteCode(profileId: bigint): string {
  return `D${profileId.toString(36).toUpperCase().padStart(5, "0")}`;
}

function isOpenOffer(offer: Offer): boolean {
  return "Open" in offer.status || "PartiallyFilled" in offer.status;
}

function isWithinRange(value: bigint, range: { min: bigint; max: bigint }): boolean {
  return value >= range.min && value <= range.max;
}

function isWithinNumberRange(value: number, range: { min: number; max: number }): boolean {
  return Number.isInteger(value) && value >= range.min && value <= range.max;
}

function calculateBasisPoints(amount: bigint, basisPoints: number): bigint {
  return (amount * BigInt(basisPoints)) / BASIS_POINTS_DIVISOR;
}

function calculateStrikePriceCents(entryPriceCents: bigint, strikeBasisPoints: number): bigint {
  return entryPriceCents + calculateBasisPoints(entryPriceCents, strikeBasisPoints);
}

function operationIdBytes(id: bigint): Uint8Array {
  const bytes = new Uint8Array(OPERATION_ID_BYTE_LENGTH);
  new DataView(bytes.buffer).setBigUint64(0, id);
  return bytes;
}

function bytesToHex(bytes: Uint8Array | number[]): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function nowSeconds(): bigint {
  return BigInt(Math.floor(Date.now() / 1_000));
}

function demoError(message: string): { Err: VolumetricError } {
  return {
    Err: {
      code: 400,
      name: "DemoError",
      message,
      details: [],
    },
  };
}
