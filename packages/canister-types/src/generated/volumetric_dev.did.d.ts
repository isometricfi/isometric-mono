import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface AcceptOfferItem { 'offer_id' : bigint, 'quantity' : bigint }
export interface AcceptOffersRequest { 'items' : Array<AcceptOfferItem> }
export interface AcceptOffersResponse {
  'fill_group_id' : bigint,
  'active_options' : Array<ActiveOption>,
}
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
  'option_type' : OptionType,
  'fill_group_id' : [] | [bigint],
  'entry_price_cents' : bigint,
  'asset' : Asset,
  'accepted_at' : bigint,
  'writer' : Principal,
  'offer_id' : bigint,
  'profit_fee_basis_points' : bigint,
  'quantity' : bigint,
  'buyer' : Principal,
  'expiry' : bigint,
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
  'data' : {},
  'wallet_proof' : WalletProof,
}
export interface AuthenticatedPayload_3 {
  'data' : CreateOfferRequest,
  'wallet_proof' : WalletProof,
}
export interface AuthenticatedPayload_4 {
  'data' : UpdateUsernameRequest,
  'wallet_proof' : WalletProof,
}
export interface AuthenticatedPayload_5 {
  'data' : WithdrawCkbtcRequest,
  'wallet_proof' : WalletProof,
}
export type BtcNetwork = { 'Mainnet' : null } |
  { 'Testnet' : null };
export interface CancelOfferRequest { 'offer_id' : bigint }
export interface ClearStorageResponse {
  'options_cleared' : bigint,
  'offers_cleared' : bigint,
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
  'offer_valid_until' : bigint,
  'strike_basis_points' : number,
  'premium_basis_points' : number,
  'quantity' : bigint,
  'option_duration_seconds' : bigint,
}
export interface CreateOfferResponse { 'offer' : Offer }
export interface DepositInfo { 'account' : Account, 'btc_address' : string }
export interface ErrorDetails { 'caller' : [] | [string] }
export interface Event {
  'id' : bigint,
  'principal' : Principal,
  'data' : EventData,
  'timestamp' : bigint,
  'event_type' : EventType,
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
      'fill_group_id' : bigint,
      'entry_price_cents' : bigint,
      'expiry_ns' : bigint,
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
      'accepted_at_ns' : bigint,
      'settled_at_ns' : bigint,
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
      'quantity_sats' : bigint,
      'strike_basis_points' : number,
      'offer_id' : bigint,
      'premium_basis_points' : number,
      'offer_valid_until_ns' : bigint,
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
export interface Offer {
  'id' : bigint,
  'status' : OfferStatus,
  'option_type' : OptionType,
  'asset' : Asset,
  'total_quantity' : bigint,
  'offer_valid_until' : bigint,
  'created_at' : bigint,
  'writer' : Principal,
  'strike_basis_points' : number,
  'remaining_quantity' : bigint,
  'premium_basis_points' : number,
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
  'updated_at' : bigint,
  'fill_group_id' : bigint,
  'offers' : Array<AcceptedOffer>,
  'created_at' : bigint,
  'buyer' : Principal,
  'phase' : AcceptPhase,
  'total_premium' : bigint,
}
export interface PendingSettlement {
  'updated_at' : bigint,
  'payout_to_buyer' : bigint,
  'created_at' : bigint,
  'writer' : Principal,
  'option_id' : bigint,
  'buyer' : Principal,
  'phase' : SettlementPhase,
  'settlement_price_cents' : bigint,
  'payout_to_writer' : bigint,
}
export interface PendingWithdrawal {
  'id' : bigint,
  'updated_at' : bigint,
  'principal' : Principal,
  'created_at' : bigint,
  'phase' : WithdrawalPhase,
  'created_at_time' : bigint,
  'amount' : bigint,
  'btc_address' : string,
}
export interface ProfileInfo {
  'principal' : Principal,
  'username' : [] | [string],
  'subaccount' : Uint8Array | number[],
  'address' : string,
}
export interface Range { 'max' : bigint, 'min' : bigint }
export interface Range_1 { 'max' : number, 'min' : number }
export type Result = { 'Ok' : AcceptOffersResponse } |
  { 'Err' : VolumetricError };
export type Result_1 = { 'Ok' : null } |
  { 'Err' : VolumetricError };
export type Result_10 = { 'Ok' : Array<PendingAccept> } |
  { 'Err' : VolumetricError };
export type Result_11 = { 'Ok' : Array<PendingSettlement> } |
  { 'Err' : VolumetricError };
export type Result_12 = { 'Ok' : Array<PendingWithdrawal> } |
  { 'Err' : VolumetricError };
export type Result_13 = { 'Ok' : Array<Offer> } |
  { 'Err' : VolumetricError };
export type Result_14 = { 'Ok' : Array<ActiveOption> } |
  { 'Err' : VolumetricError };
export type Result_15 = { 'Ok' : [] | [PendingSettlement] } |
  { 'Err' : VolumetricError };
export type Result_16 = { 'Ok' : UserBalanceInfo } |
  { 'Err' : VolumetricError };
export type Result_17 = { 'Ok' : [] | [PendingWithdrawal] } |
  { 'Err' : VolumetricError };
export type Result_18 = { 'Ok' : Array<UserInfo> } |
  { 'Err' : VolumetricError };
export type Result_19 = { 'Ok' : SettleExpiredOptionsResponse } |
  { 'Err' : VolumetricError };
export type Result_2 = { 'Ok' : Offer } |
  { 'Err' : VolumetricError };
export type Result_20 = { 'Ok' : SettlementResult } |
  { 'Err' : VolumetricError };
export type Result_21 = { 'Ok' : ClearStorageResponse } |
  { 'Err' : VolumetricError };
export type Result_22 = { 'Ok' : ActiveOption } |
  { 'Err' : VolumetricError };
export type Result_23 = { 'Ok' : Array<UtxoStatus> } |
  { 'Err' : VolumetricError };
export type Result_24 = { 'Ok' : WithdrawResult } |
  { 'Err' : VolumetricError };
export type Result_3 = { 'Ok' : bigint } |
  { 'Err' : VolumetricError };
export type Result_4 = { 'Ok' : ProfileInfo } |
  { 'Err' : VolumetricError };
export type Result_5 = { 'Ok' : CreateOfferResponse } |
  { 'Err' : VolumetricError };
export type Result_6 = { 'Ok' : [] | [PendingAccept] } |
  { 'Err' : VolumetricError };
export type Result_7 = { 'Ok' : Array<Event> } |
  { 'Err' : VolumetricError };
export type Result_8 = { 'Ok' : bigint } |
  { 'Err' : VolumetricError };
export type Result_9 = { 'Ok' : DepositInfo } |
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
export interface SettlementResult {
  'status' : ActiveOptionStatus,
  'payout_to_buyer' : bigint,
  'option_id' : bigint,
  'settlement_price_cents' : bigint,
  'payout_to_writer' : bigint,
}
export type TradeRole = { 'Buyer' : null } |
  { 'Writer' : null };
export interface TradingLimits {
  'term_days' : Range,
  'deposit_amount_sats' : bigint,
  'max_offers_per_term' : bigint,
  'withdraw_amount_sats' : bigint,
  'quantity_sats' : Range,
  'strike_basis_points' : Range_1,
  'premium_basis_points' : Range_1,
  'option_duration_seconds' : Range,
}
export interface UpdateUsernameRequest { 'username' : string }
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
export interface WalletProof { 'signature' : string, 'address' : string }
export interface WithdrawCkbtcRequest {
  'amount' : bigint,
  'btc_address' : string,
}
export interface WithdrawResult { 'block_index' : bigint }
export type WithdrawalPhase = { 'Started' : null } |
  { 'Failed' : { 'reason' : string } } |
  { 'RetrieveRequested' : { 'block_index' : bigint } } |
  { 'Approved' : null } |
  { 'Completed' : { 'block_index' : bigint } };
export interface _SERVICE {
  'accept_offers' : ActorMethod<[AuthenticatedPayload], Result>,
  'add_whitelisted' : ActorMethod<[Principal], Result_1>,
  'cancel_offer' : ActorMethod<[AuthenticatedPayload_1], Result_2>,
  'cleanup_old_events' : ActorMethod<[], Result_3>,
  'clear_all_events' : ActorMethod<[], Result_3>,
  'create_account' : ActorMethod<[AuthenticatedPayload_2], Result_4>,
  'create_offer' : ActorMethod<[AuthenticatedPayload_3], Result_5>,
  'get_accept_by_id' : ActorMethod<[bigint], Result_6>,
  'get_accept_offers_message' : ActorMethod<
    [string, Array<AcceptOfferItem>],
    string
  >,
  'get_account_info' : ActorMethod<[string], [] | [ProfileInfo]>,
  'get_account_nonce' : ActorMethod<[string], bigint>,
  'get_active_option_by_id' : ActorMethod<[bigint], [] | [ActiveOption]>,
  'get_all_events' : ActorMethod<[[] | [bigint], [] | [number]], Result_7>,
  'get_cancel_offer_message' : ActorMethod<[string, bigint], string>,
  'get_ckbtc_balance' : ActorMethod<[string], Result_8>,
  'get_config' : ActorMethod<[], Config>,
  'get_create_offer_message' : ActorMethod<
    [string, Asset, OptionType, bigint, number, number, bigint, bigint],
    string
  >,
  'get_deposit_address' : ActorMethod<[string], Result_9>,
  'get_events_for_principal' : ActorMethod<
    [Principal, [] | [bigint], [] | [number]],
    Result_7
  >,
  'get_events_since' : ActorMethod<[bigint, [] | [number]], Result_7>,
  'get_failed_accepts' : ActorMethod<[], Result_10>,
  'get_failed_settlements' : ActorMethod<[], Result_11>,
  'get_failed_withdrawals' : ActorMethod<[], Result_12>,
  'get_feature_flags' : ActorMethod<[], FeatureFlags>,
  'get_fee_config' : ActorMethod<[], FeeConfig>,
  'get_message_to_sign' : ActorMethod<[string], string>,
  'get_my_events' : ActorMethod<[[] | [bigint], [] | [number]], Array<Event>>,
  'get_my_offers' : ActorMethod<[string], Result_13>,
  'get_my_options' : ActorMethod<[string], Result_14>,
  'get_my_pending_withdrawals' : ActorMethod<
    [AuthenticatedPayload_2],
    Result_12
  >,
  'get_my_pending_withdrawals_message' : ActorMethod<[string], string>,
  'get_my_written_options' : ActorMethod<[string], Result_14>,
  'get_offer_by_id' : ActorMethod<[bigint], [] | [Offer]>,
  'get_open_offers' : ActorMethod<[], Array<Offer>>,
  'get_pending_accepts' : ActorMethod<[], Result_10>,
  'get_pending_settlements' : ActorMethod<[], Array<ActiveOption>>,
  'get_pending_settlements_journal' : ActorMethod<[], Result_11>,
  'get_pending_withdrawals' : ActorMethod<[], Result_12>,
  'get_platform_fees_collected_total' : ActorMethod<[], bigint>,
  'get_settlement_by_id' : ActorMethod<[bigint], Result_15>,
  'get_trading_limits' : ActorMethod<[], TradingLimits>,
  'get_user_balance' : ActorMethod<[string], Result_16>,
  'get_username_update_message' : ActorMethod<[string, string], string>,
  'get_withdraw_message' : ActorMethod<[string, string, bigint], string>,
  'get_withdrawal_by_id' : ActorMethod<[bigint], Result_17>,
  'greet' : ActorMethod<[string], string>,
  'list_users' : ActorMethod<[], Result_18>,
  'list_whitelisted' : ActorMethod<[], Array<Principal>>,
  'remove_whitelisted' : ActorMethod<[Principal], Result_1>,
  'set_deposit_amount_sats_config' : ActorMethod<[bigint], Result_1>,
  'set_feature_flags_config' : ActorMethod<[FeatureFlags], Result_1>,
  'set_fee_config_config' : ActorMethod<[FeeConfig], Result_1>,
  'set_fee_recipient_config' : ActorMethod<[Principal], Result_1>,
  'set_max_offers_per_term_config' : ActorMethod<[bigint], Result_1>,
  'set_option_duration_seconds_range_config' : ActorMethod<
    [bigint, bigint],
    Result_1
  >,
  'set_oracle_price_config' : ActorMethod<[bigint], Result_1>,
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
  'set_term_days_range_config' : ActorMethod<[bigint, bigint], Result_1>,
  'set_trading_limits_config' : ActorMethod<[TradingLimits], Result_1>,
  'set_withdraw_amount_sats_config' : ActorMethod<[bigint], Result_1>,
  'settle_expired_options' : ActorMethod<[], Result_19>,
  'settle_option_by_id' : ActorMethod<[bigint], Result_20>,
  /**
   * Testing endpoint to clear all offers and active options from storage.
   * Use this for storage migration when schema changes break deserialization.
   */
  'testing_clear_offers_and_options' : ActorMethod<[], Result_21>,
  'testing_expire_option' : ActorMethod<[bigint], Result_22>,
  'testing_force_settle' : ActorMethod<[bigint], Result_20>,
  'testing_set_ckbtc_ledger' : ActorMethod<[Principal], Result_1>,
  'testing_set_option_expiry' : ActorMethod<[bigint, bigint], Result_22>,
  'testing_sync_balance_from_ledger' : ActorMethod<[string], Result_3>,
  'update_ckbtc_balance' : ActorMethod<[string], Result_23>,
  'update_username' : ActorMethod<[AuthenticatedPayload_4], Result_4>,
  'withdraw_ckbtc' : ActorMethod<[AuthenticatedPayload_5], Result_24>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
