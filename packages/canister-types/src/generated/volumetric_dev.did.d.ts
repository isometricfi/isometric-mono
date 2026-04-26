import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface AcceptOfferItem { 'offer_id' : bigint, 'quantity' : bigint }
export interface AcceptOffersReceipt {
  'accept_journal_entry_id' : bigint,
  'fill_group_id' : bigint,
  'operation_id' : Uint8Array | number[],
}
export interface AcceptOffersRequest {
  'expires_at_seconds' : bigint,
  'items' : Array<AcceptOfferItem>,
}
export interface AcceptOffersResult {
  'fill_group_id' : bigint,
  'active_options' : Array<ActiveOption>,
}
export type AcceptOffersStatus = {
    'Failed' : { 'receipt' : AcceptOffersReceipt, 'message' : string }
  } |
  {
    'RecoveryRequired' : {
      'last_error' : [] | [string],
      'receipt' : AcceptOffersReceipt,
      'phase' : AcceptPhase,
    }
  } |
  {
    'Succeeded' : {
      'result' : AcceptOffersResult,
      'receipt' : AcceptOffersReceipt,
    }
  } |
  {
    'Pending' : {
      'last_error' : [] | [string],
      'receipt' : AcceptOffersReceipt,
      'phase' : AcceptPhase,
    }
  };
export type AcceptPhase = { 'Started' : null } |
  { 'Failed' : { 'reason' : string } } |
  { 'CollateralLocked' : null } |
  { 'BuyerDebited' : null } |
  { 'TransfersComplete' : null } |
  { 'Completed' : null };
export interface AcceptedOffer {
  'writer' : Principal,
  'option_id' : bigint,
  'collateral_locked' : bigint,
  'offer_id' : bigint,
  'quantity' : bigint,
  'premium_to_writer' : bigint,
  'platform_fee' : bigint,
}
export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [Uint8Array | number[]],
}
export interface ActiveOption {
  'id' : bigint,
  'status' : ActiveOptionStatus,
  'expiry_seconds' : bigint,
  'option_type' : OptionType,
  'fill_group_id' : [] | [bigint],
  'entry_price_cents' : bigint,
  'asset' : Asset,
  'writer' : Principal,
  'offer_id' : bigint,
  'profit_fee_basis_points' : bigint,
  'quantity' : bigint,
  'accepted_at_seconds' : bigint,
  'buyer' : Principal,
  'premium_paid' : bigint,
  'strike_price_cents' : bigint,
}
export type ActiveOptionStatus = { 'Active' : null } |
  { 'Settling' : null } |
  { 'Expired' : null } |
  { 'Settled' : null };
export type Asset = { 'CkBtc' : null };
export interface AuthenticatedPayload {
  'data' : AcceptOffersRequest,
  'wallet_proof' : WalletProof,
}
export interface AuthenticatedPayload_1 {
  'data' : CancelOfferRequest,
  'wallet_proof' : WalletProof,
}
export interface AuthenticatedPayload_2 {
  'data' : CreateProfileRequest,
  'wallet_proof' : WalletProof,
}
export interface AuthenticatedPayload_3 {
  'data' : CreateOfferRequest,
  'wallet_proof' : WalletProof,
}
export interface AuthenticatedPayload_4 {
  'data' : null,
  'wallet_proof' : WalletProof,
}
export interface AuthenticatedPayload_5 {
  'data' : UpdateUsernameRequest,
  'wallet_proof' : WalletProof,
}
export interface AuthenticatedPayload_6 {
  'data' : WithdrawCkbtcRequest,
  'wallet_proof' : WalletProof,
}
export type BtcNetwork = { 'Mainnet' : null } |
  { 'Testnet' : null };
export interface CancelOfferRequest {
  'expires_at_seconds' : bigint,
  'offer_id' : bigint,
}
export interface Config {
  'ckbtc_minter' : Principal,
  'trading_limits' : TradingLimits,
  'btc_network' : BtcNetwork,
  'fee_config' : FeeConfig,
  'ckbtc_ledger' : Principal,
  'feature_flags' : FeatureFlags,
}
export interface CreateOfferRequest {
  'option_type' : OptionType,
  'asset' : Asset,
  'offer_valid_until_seconds' : bigint,
  'expires_at_seconds' : bigint,
  'strike_basis_points' : number,
  'premium_basis_points' : number,
  'quantity' : bigint,
  'option_duration_seconds' : bigint,
}
export interface CreateOfferResponse { 'offer' : Offer }
export interface CreateProfileRequest {
  'invite_code' : [] | [string],
  'expires_at_seconds' : bigint,
}
export interface DepositInfo { 'account' : Account, 'btc_address' : string }
export interface ErrorDetails { 'caller' : [] | [string] }
export interface Event {
  'id' : bigint,
  'principal' : Principal,
  'data' : EventData,
  'event_type' : EventType,
  'timestamp_seconds' : bigint,
}
export type EventData = { 'AccountCreated' : { 'wallet_address' : string } } |
  {
    'OfferAcceptFailed' : {
      'offer_ids' : BigUint64Array | bigint[],
      'reason' : string,
    }
  } |
  { 'Deposit' : { 'amount_sats' : bigint } } |
  {
    'OfferCancelled' : {
      'offer_id' : bigint,
      'remaining_quantity_sats' : bigint,
    }
  } |
  {
    'OfferAccepted' : {
      'expiry_seconds' : bigint,
      'fill_group_id' : bigint,
      'entry_price_cents' : bigint,
      'role' : TradeRole,
      'counterparty' : Principal,
      'option_id' : bigint,
      'quantity_sats' : bigint,
      'offer_id' : bigint,
      'premium_sats' : bigint,
      'strike_price_cents' : bigint,
    }
  } |
  {
    'OptionSettled' : {
      'entry_price_cents' : bigint,
      'payout_sats' : bigint,
      'role' : TradeRole,
      'option_id' : bigint,
      'quantity_sats' : bigint,
      'accepted_at_seconds' : bigint,
      'settled_at_seconds' : bigint,
      'premium_sats' : bigint,
      'settlement_price_cents' : bigint,
      'strike_price_cents' : bigint,
    }
  } |
  { 'Withdrawal' : { 'destination' : string, 'amount_sats' : bigint } } |
  { 'WithdrawalFailed' : { 'amount_sats' : bigint, 'reason' : string } } |
  { 'Unknown' : null } |
  {
    'UsernameUpdated' : {
      'old_username' : [] | [string],
      'new_username' : string,
    }
  } |
  {
    'OfferCreated' : {
      'duration_seconds' : bigint,
      'offer_valid_until_seconds' : bigint,
      'quantity_sats' : bigint,
      'strike_basis_points' : number,
      'offer_id' : bigint,
      'premium_basis_points' : number,
    }
  } |
  { 'OptionSettlementFailed' : { 'option_id' : bigint, 'reason' : string } };
export type EventType = { 'AccountCreated' : null } |
  { 'OfferAcceptFailed' : null } |
  { 'Deposit' : null } |
  { 'OfferCancelled' : null } |
  { 'OfferAccepted' : null } |
  { 'OptionSettled' : null } |
  { 'Withdrawal' : null } |
  { 'WithdrawalFailed' : null } |
  { 'Unknown' : null } |
  { 'UsernameUpdated' : null } |
  { 'OfferCreated' : null } |
  { 'OptionSettlementFailed' : null };
export interface FeatureFlags {
  'is_stitching_enabled' : boolean,
  'is_partial_filling_enabled' : boolean,
}
export interface FeeConfig {
  'premium_fee_basis_points' : bigint,
  'fee_recipient' : Principal,
  'profit_fee_basis_points' : bigint,
}
export interface ObservabilityMetrics {
  'failed_accepts_total' : bigint,
  'balances_total' : bigint,
  'stable_memory_pages' : bigint,
  'stable_memory_bytes' : bigint,
  'failed_withdrawals_total' : bigint,
  'open_offers_total' : bigint,
  'profiles_total' : bigint,
  'whitelist_entries_total' : bigint,
  'pending_settlements_total' : bigint,
  'signature_nonces_total' : bigint,
  'pending_accepts_total' : bigint,
  'events_total' : bigint,
  'wallet_registrations_total' : bigint,
  'pending_withdrawals_total' : bigint,
  'active_options_total' : bigint,
  'failed_settlements_total' : bigint,
  'offers_total' : bigint,
}
export interface Offer {
  'id' : bigint,
  'status' : OfferStatus,
  'option_type' : OptionType,
  'asset' : Asset,
  'total_quantity' : bigint,
  'offer_valid_until_seconds' : bigint,
  'writer' : Principal,
  'strike_basis_points' : number,
  'remaining_quantity' : bigint,
  'premium_basis_points' : number,
  'created_at_seconds' : bigint,
  'option_duration_seconds' : bigint,
}
export type OfferStatus = { 'Open' : null } |
  { 'PartiallyFilled' : null } |
  { 'Filled' : null } |
  { 'Cancelled' : null } |
  { 'Processing' : null };
export type OptionType = { 'Call' : null };
export interface PendingAccept {
  'id' : bigint,
  'fill_group_id' : bigint,
  'entry_price_cents' : [] | [bigint],
  'updated_at_seconds' : bigint,
  'offers' : Array<AcceptedOffer>,
  'created_at_seconds' : bigint,
  'buyer' : Principal,
  'phase' : AcceptPhase,
  'total_buyer_debit_required_sats' : bigint,
  'platform_fee_collected' : [] | [boolean],
}
export interface PendingSettlement {
  'updated_at_seconds' : bigint,
  'payout_to_buyer' : bigint,
  'writer' : Principal,
  'option_id' : bigint,
  'created_at_seconds' : bigint,
  'buyer' : Principal,
  'phase' : SettlementPhase,
  'settlement_price_cents' : bigint,
  'payout_to_writer' : bigint,
}
export interface PendingWithdrawal {
  'id' : bigint,
  'principal' : Principal,
  'updated_at_seconds' : bigint,
  'created_at_time_ns' : bigint,
  'created_at_seconds' : bigint,
  'phase' : WithdrawalPhase,
  'amount' : bigint,
  'btc_address' : string,
}
export interface ProfileInfo {
  'principal' : Principal,
  'username' : [] | [string],
  'referral_count' : [] | [bigint],
  'subaccount' : Uint8Array | number[],
  'invite_code' : [] | [string],
  'address' : string,
}
export interface Range { 'max' : bigint, 'min' : bigint }
export interface Range_1 { 'max' : number, 'min' : number }
export type Result = { 'Ok' : AcceptOffersReceipt } |
  { 'Err' : VolumetricError };
export type Result_1 = { 'Ok' : null } |
  { 'Err' : VolumetricError };
export type Result_10 = { 'Ok' : bigint } |
  { 'Err' : VolumetricError };
export type Result_11 = { 'Ok' : DepositInfo } |
  { 'Err' : VolumetricError };
export type Result_12 = { 'Ok' : Array<PendingAccept> } |
  { 'Err' : VolumetricError };
export type Result_13 = { 'Ok' : Array<PendingSettlement> } |
  { 'Err' : VolumetricError };
export type Result_14 = { 'Ok' : Array<PendingWithdrawal> } |
  { 'Err' : VolumetricError };
export type Result_15 = { 'Ok' : Array<Offer> } |
  { 'Err' : VolumetricError };
export type Result_16 = { 'Ok' : Array<ActiveOption> } |
  { 'Err' : VolumetricError };
export type Result_17 = { 'Ok' : Array<Uint8Array | number[]> } |
  { 'Err' : VolumetricError };
export type Result_18 = { 'Ok' : [] | [PendingSettlement] } |
  { 'Err' : VolumetricError };
export type Result_19 = { 'Ok' : SettlementStatus } |
  { 'Err' : VolumetricError };
export type Result_2 = { 'Ok' : Offer } |
  { 'Err' : VolumetricError };
export type Result_20 = { 'Ok' : UserBalanceInfo } |
  { 'Err' : VolumetricError };
export type Result_21 = { 'Ok' : WithdrawStatus } |
  { 'Err' : VolumetricError };
export type Result_22 = { 'Ok' : [] | [PendingWithdrawal] } |
  { 'Err' : VolumetricError };
export type Result_23 = { 'Ok' : WalExecutionOutcome } |
  { 'Err' : VolumetricError };
export type Result_24 = { 'Ok' : SettleExpiredOptionsResponse } |
  { 'Err' : VolumetricError };
export type Result_25 = { 'Ok' : SettlementReceipt } |
  { 'Err' : VolumetricError };
export type Result_26 = { 'Ok' : Array<UtxoStatus> } |
  { 'Err' : VolumetricError };
export type Result_27 = { 'Ok' : WithdrawReceipt } |
  { 'Err' : VolumetricError };
export type Result_3 = { 'Ok' : bigint } |
  { 'Err' : VolumetricError };
export type Result_4 = { 'Ok' : ProfileInfo } |
  { 'Err' : VolumetricError };
export type Result_5 = { 'Ok' : CreateOfferResponse } |
  { 'Err' : VolumetricError };
export type Result_6 = { 'Ok' : [] | [PendingAccept] } |
  { 'Err' : VolumetricError };
export type Result_7 = { 'Ok' : string } |
  { 'Err' : VolumetricError };
export type Result_8 = { 'Ok' : AcceptOffersStatus } |
  { 'Err' : VolumetricError };
export type Result_9 = { 'Ok' : [] | [ProfileInfo] } |
  { 'Err' : VolumetricError };
export interface SettleExpiredOptionsResponse {
  'settled' : Array<SettlementResult>,
  'errors' : Array<string>,
}
export type SettlementPhase = { 'Started' : null } |
  { 'Failed' : { 'reason' : string } } |
  { 'TransferComplete' : null } |
  { 'BalanceReleased' : null } |
  { 'Completed' : null };
export interface SettlementReceipt {
  'operation_id' : Uint8Array | number[],
  'option_id' : bigint,
}
export interface SettlementResult {
  'status' : ActiveOptionStatus,
  'payout_to_buyer' : bigint,
  'option_id' : bigint,
  'settlement_price_cents' : bigint,
  'payout_to_writer' : bigint,
}
export type SettlementStatus = {
    'Failed' : { 'receipt' : SettlementReceipt, 'message' : string }
  } |
  {
    'RecoveryRequired' : {
      'last_error' : [] | [string],
      'receipt' : SettlementReceipt,
      'phase' : SettlementPhase,
    }
  } |
  {
    'Succeeded' : {
      'result' : SettlementWalResult,
      'receipt' : SettlementReceipt,
    }
  } |
  {
    'Pending' : {
      'last_error' : [] | [string],
      'receipt' : SettlementReceipt,
      'phase' : SettlementPhase,
    }
  };
export interface SettlementWalResult { 'option_id' : bigint }
export type TradeRole = { 'Buyer' : null } |
  { 'Writer' : null };
export interface TradingLimits {
  'create_offer_quantity_sats' : Range,
  'deposit_amount_sats' : bigint,
  'accept_offer_quantity_sats' : Range,
  'max_offers_per_term' : bigint,
  'withdraw_amount_sats' : bigint,
  'strike_basis_points' : Range_1,
  'premium_basis_points' : Range_1,
  'option_duration_seconds' : Range,
}
export interface UpdateUsernameRequest {
  'username' : string,
  'expires_at_seconds' : bigint,
}
export interface UserBalanceInfo {
  'total' : bigint,
  'locked' : bigint,
  'available' : bigint,
}
export interface UserInfo {
  'principal' : Principal,
  'username' : [] | [string],
  'address' : string,
}
export interface Utxo {
  'height' : number,
  'value' : bigint,
  'outpoint' : UtxoOutpoint,
}
export interface UtxoOutpoint {
  'txid' : Uint8Array | number[],
  'vout' : number,
}
export type UtxoStatus = { 'ValueTooSmall' : Utxo } |
  { 'Tainted' : Utxo } |
  {
    'Minted' : {
      'minted_amount' : bigint,
      'block_index' : bigint,
      'utxo' : Utxo,
    }
  } |
  { 'Checked' : Utxo };
export interface VolumetricError {
  'code' : number,
  'name' : string,
  'message' : string,
  'details' : [] | [ErrorDetails],
}
export type WalExecutionOutcome = { 'SucceededAlready' : null } |
  { 'RecoveryRequired' : string } |
  { 'FailedPermanent' : string } |
  { 'Succeeded' : null } |
  { 'SkippedAlreadyInFlight' : null };
export interface WalletProof { 'signature' : string, 'address' : string }
export interface WithdrawCkbtcRequest {
  'expires_at_seconds' : bigint,
  'amount' : bigint,
  'btc_address' : string,
}
export interface WithdrawReceipt {
  'withdrawal_id' : bigint,
  'operation_id' : Uint8Array | number[],
}
export interface WithdrawResult { 'block_index' : bigint }
export type WithdrawStatus = {
    'Failed' : { 'receipt' : WithdrawReceipt, 'message' : string }
  } |
  {
    'RecoveryRequired' : {
      'last_error' : [] | [string],
      'receipt' : WithdrawReceipt,
      'phase' : WithdrawalPhase,
    }
  } |
  { 'Succeeded' : { 'result' : WithdrawResult, 'receipt' : WithdrawReceipt } } |
  {
    'Pending' : {
      'last_error' : [] | [string],
      'receipt' : WithdrawReceipt,
      'phase' : WithdrawalPhase,
    }
  };
export type WithdrawalPhase = { 'Started' : null } |
  { 'Failed' : { 'reason' : string } } |
  { 'RetrieveRequested' : WithdrawResult } |
  { 'Approved' : null } |
  { 'Completed' : WithdrawResult };
export interface _SERVICE {
  'accept_offers' : ActorMethod<[AuthenticatedPayload], Result>,
  'add_whitelisted' : ActorMethod<[Principal], Result_1>,
  'cancel_offer' : ActorMethod<[AuthenticatedPayload_1], Result_2>,
  'cleanup_old_events' : ActorMethod<[], Result_3>,
  'clear_all_events' : ActorMethod<[], Result_3>,
  'clear_log_access_token' : ActorMethod<[], Result_1>,
  'create_account' : ActorMethod<[AuthenticatedPayload_2], Result_4>,
  'create_offer' : ActorMethod<[AuthenticatedPayload_3], Result_5>,
  'get_accept_by_id' : ActorMethod<[bigint], Result_6>,
  'get_accept_offers_message' : ActorMethod<
    [string, Array<AcceptOfferItem>, bigint],
    Result_7
  >,
  'get_accept_status' : ActorMethod<[Uint8Array | number[]], Result_8>,
  'get_account_info' : ActorMethod<[string, boolean], Result_9>,
  'get_account_nonce' : ActorMethod<[string], Result_3>,
  'get_active_option_by_id' : ActorMethod<[bigint], [] | [ActiveOption]>,
  'get_all_events' : ActorMethod<[[] | [bigint], [] | [number]], Array<Event>>,
  'get_cancel_offer_message' : ActorMethod<[string, bigint, bigint], Result_7>,
  'get_ckbtc_balance' : ActorMethod<[string], Result_10>,
  'get_config' : ActorMethod<[], Config>,
  'get_create_offer_message' : ActorMethod<
    [string, bigint, number, number, bigint, bigint, bigint],
    Result_7
  >,
  'get_deposit_address' : ActorMethod<[string], Result_11>,
  'get_events_for_principal' : ActorMethod<
    [Principal, [] | [bigint], [] | [number]],
    Array<Event>
  >,
  'get_events_since' : ActorMethod<[bigint, [] | [number]], Array<Event>>,
  'get_failed_accepts' : ActorMethod<[], Result_12>,
  'get_failed_settlements' : ActorMethod<[], Result_13>,
  'get_failed_withdrawals' : ActorMethod<[], Result_14>,
  'get_feature_flags' : ActorMethod<[], FeatureFlags>,
  'get_fee_config' : ActorMethod<[], FeeConfig>,
  'get_message_to_sign' : ActorMethod<
    [string, [] | [string], bigint],
    Result_7
  >,
  'get_my_events' : ActorMethod<[[] | [bigint], [] | [number]], Array<Event>>,
  'get_my_offers' : ActorMethod<[string], Result_15>,
  'get_my_options' : ActorMethod<[string], Result_16>,
  'get_my_pending_withdrawals' : ActorMethod<
    [AuthenticatedPayload_4],
    Result_14
  >,
  'get_my_written_options' : ActorMethod<[string], Result_16>,
  'get_offer_by_id' : ActorMethod<[bigint], [] | [Offer]>,
  'get_open_offers' : ActorMethod<[], Array<Offer>>,
  'get_pending_accepts' : ActorMethod<[], Result_12>,
  'get_pending_settlements' : ActorMethod<[], Array<ActiveOption>>,
  'get_pending_settlements_journal' : ActorMethod<[], Result_13>,
  'get_pending_withdrawals' : ActorMethod<[], Result_14>,
  'get_platform_fees_collected_total' : ActorMethod<[], bigint>,
  'get_recovery_required_wal_entries' : ActorMethod<[number], Result_17>,
  'get_settlement_by_id' : ActorMethod<[bigint], Result_18>,
  'get_settlement_status' : ActorMethod<[Uint8Array | number[]], Result_19>,
  'get_trading_limits' : ActorMethod<[], TradingLimits>,
  'get_user_balance' : ActorMethod<[string], Result_20>,
  'get_username_update_message' : ActorMethod<
    [string, string, bigint],
    Result_7
  >,
  'get_withdraw_message' : ActorMethod<
    [string, string, bigint, bigint],
    Result_7
  >,
  'get_withdraw_status' : ActorMethod<[Uint8Array | number[]], Result_21>,
  'get_withdrawal_by_id' : ActorMethod<[bigint], Result_22>,
  'greet' : ActorMethod<[string], string>,
  'list_users' : ActorMethod<[], Array<UserInfo>>,
  'list_whitelisted' : ActorMethod<[], Array<Principal>>,
  'observability_get_metrics' : ActorMethod<[], ObservabilityMetrics>,
  'recover_wal_operation' : ActorMethod<[Uint8Array | number[]], Result_23>,
  'remove_whitelisted' : ActorMethod<[Principal], Result_1>,
  'resolve_invite_code' : ActorMethod<[string], [] | [string]>,
  'set_accept_offer_quantity_sats_range_config' : ActorMethod<
    [bigint, bigint],
    Result_1
  >,
  'set_create_offer_quantity_sats_range_config' : ActorMethod<
    [bigint, bigint],
    Result_1
  >,
  'set_deposit_amount_sats_config' : ActorMethod<[bigint], Result_1>,
  'set_feature_flags_config' : ActorMethod<[FeatureFlags], Result_1>,
  'set_fee_config_config' : ActorMethod<[FeeConfig], Result_1>,
  'set_fee_recipient_config' : ActorMethod<[Principal], Result_1>,
  'set_log_access_token' : ActorMethod<[string], Result_1>,
  'set_max_offers_per_term_config' : ActorMethod<[bigint], Result_1>,
  'set_option_duration_seconds_range_config' : ActorMethod<
    [bigint, bigint],
    Result_1
  >,
  'set_premium_basis_points_range_config' : ActorMethod<
    [number, number],
    Result_1
  >,
  'set_premium_fee_basis_points_config' : ActorMethod<[bigint], Result_1>,
  'set_profit_fee_basis_points_config' : ActorMethod<[bigint], Result_1>,
  'set_quantity_sats_range_config' : ActorMethod<[bigint, bigint], Result_1>,
  'set_strike_basis_points_range_config' : ActorMethod<
    [number, number],
    Result_1
  >,
  'set_trading_limits_config' : ActorMethod<[TradingLimits], Result_1>,
  'set_withdraw_amount_sats_config' : ActorMethod<[bigint], Result_1>,
  'settle_expired_options' : ActorMethod<[], Result_24>,
  'settle_option_by_id' : ActorMethod<[bigint], Result_25>,
  'update_ckbtc_balance' : ActorMethod<[string], Result_26>,
  'update_username' : ActorMethod<[AuthenticatedPayload_5], Result_4>,
  'validate_invite_code' : ActorMethod<[string, string], boolean>,
  'withdraw_ckbtc' : ActorMethod<[AuthenticatedPayload_6], Result_27>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
