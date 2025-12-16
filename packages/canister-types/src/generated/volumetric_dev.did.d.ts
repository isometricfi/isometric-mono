import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface AcceptOfferItem { 'offer_id' : bigint, 'quantity' : bigint }
export interface AcceptOffersRequest {
  'wallet_address' : string,
  'items' : Array<AcceptOfferItem>,
}
export interface AcceptOffersResponse {
  'fill_group_id' : bigint,
  'active_options' : Array<ActiveOption>,
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
  'data' : CancelOfferRequest,
  'wallet_proof' : WalletProof,
}
export interface AuthenticatedPayload_1 {
  'data' : {},
  'wallet_proof' : WalletProof,
}
export interface AuthenticatedPayload_2 {
  'data' : CreateOfferRequest,
  'wallet_proof' : WalletProof,
}
export interface AuthenticatedPayload_3 {
  'data' : UpdateUsernameRequest,
  'wallet_proof' : WalletProof,
}
export interface AuthenticatedPayload_4 {
  'data' : WithdrawCkbtcRequest,
  'wallet_proof' : WalletProof,
}
export type BtcNetwork = { 'Mainnet' : null } |
  { 'Testnet' : null };
export interface CancelOfferRequest { 'offer_id' : bigint }
export interface Config {
  'ckbtc_minter' : Principal,
  'btc_network' : BtcNetwork,
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
export interface FeatureFlags {
  'is_stitching_enabled' : boolean,
  'is_partial_filling_enabled' : boolean,
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
export interface ProfileInfo {
  'principal' : Principal,
  'username' : [] | [string],
  'subaccount' : Uint8Array | number[],
  'address' : string,
}
export type Result = { 'Ok' : AcceptOffersResponse } |
  { 'Err' : VolumetricError };
export type Result_1 = { 'Ok' : null } |
  { 'Err' : VolumetricError };
export type Result_10 = { 'Ok' : SettleExpiredOptionsResponse } |
  { 'Err' : VolumetricError };
export type Result_11 = { 'Ok' : SettlementResult } |
  { 'Err' : VolumetricError };
export type Result_12 = { 'Ok' : ActiveOption } |
  { 'Err' : VolumetricError };
export type Result_13 = { 'Ok' : bigint } |
  { 'Err' : VolumetricError };
export type Result_14 = { 'Ok' : Array<UtxoStatus> } |
  { 'Err' : VolumetricError };
export type Result_15 = { 'Ok' : WithdrawResult } |
  { 'Err' : VolumetricError };
export type Result_2 = { 'Ok' : Offer } |
  { 'Err' : VolumetricError };
export type Result_3 = { 'Ok' : ProfileInfo } |
  { 'Err' : VolumetricError };
export type Result_4 = { 'Ok' : CreateOfferResponse } |
  { 'Err' : VolumetricError };
export type Result_5 = { 'Ok' : bigint } |
  { 'Err' : VolumetricError };
export type Result_6 = { 'Ok' : DepositInfo } |
  { 'Err' : VolumetricError };
export type Result_7 = { 'Ok' : Array<Offer> } |
  { 'Err' : VolumetricError };
export type Result_8 = { 'Ok' : Array<ActiveOption> } |
  { 'Err' : VolumetricError };
export type Result_9 = { 'Ok' : UserBalanceInfo } |
  { 'Err' : VolumetricError };
export interface SettleExpiredOptionsResponse {
  'settled' : Array<SettlementResult>,
  'errors' : Array<string>,
}
export interface SettlementResult {
  'status' : ActiveOptionStatus,
  'payout_to_buyer' : bigint,
  'option_id' : bigint,
  'settlement_price_cents' : bigint,
  'payout_to_writer' : bigint,
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
export interface _SERVICE {
  'accept_offers' : ActorMethod<[AcceptOffersRequest], Result>,
  'add_whitelisted' : ActorMethod<[Principal], Result_1>,
  'cancel_offer' : ActorMethod<[AuthenticatedPayload], Result_2>,
  'create_account' : ActorMethod<[AuthenticatedPayload_1], Result_3>,
  'create_offer' : ActorMethod<[AuthenticatedPayload_2], Result_4>,
  'get_account_info' : ActorMethod<[string], [] | [ProfileInfo]>,
  'get_account_nonce' : ActorMethod<[string], bigint>,
  'get_active_option_by_id' : ActorMethod<[bigint], [] | [ActiveOption]>,
  'get_cancel_offer_message' : ActorMethod<[string, bigint], string>,
  'get_ckbtc_balance' : ActorMethod<[string], Result_5>,
  'get_config' : ActorMethod<[], Config>,
  'get_create_offer_message' : ActorMethod<
    [string, bigint, number, number],
    string
  >,
  'get_deposit_address' : ActorMethod<[string], Result_6>,
  'get_feature_flags' : ActorMethod<[], FeatureFlags>,
  'get_message_to_sign' : ActorMethod<[string], string>,
  'get_my_offers' : ActorMethod<[string], Result_7>,
  'get_my_options' : ActorMethod<[string], Result_8>,
  'get_my_written_options' : ActorMethod<[string], Result_8>,
  'get_offer_by_id' : ActorMethod<[bigint], [] | [Offer]>,
  'get_open_offers' : ActorMethod<[], Array<Offer>>,
  'get_pending_settlements' : ActorMethod<[], Array<ActiveOption>>,
  'get_platform_fee_info' : ActorMethod<[], [bigint, bigint]>,
  'get_user_balance' : ActorMethod<[string], Result_9>,
  'get_username_update_message' : ActorMethod<[string, string], string>,
  'get_withdraw_message' : ActorMethod<[string, string, bigint], string>,
  'greet' : ActorMethod<[string], string>,
  'list_users' : ActorMethod<[], Array<UserInfo>>,
  'list_whitelisted' : ActorMethod<[], Array<Principal>>,
  'remove_whitelisted' : ActorMethod<[Principal], Result_1>,
  'set_feature_flags' : ActorMethod<[FeatureFlags], Result_1>,
  'set_oracle_price' : ActorMethod<[bigint], Result_1>,
  'settle_expired_options' : ActorMethod<[], Result_10>,
  'settle_option_by_id' : ActorMethod<[bigint], Result_11>,
  'testing_expire_option' : ActorMethod<[bigint], Result_12>,
  'testing_force_settle' : ActorMethod<[bigint], Result_11>,
  'testing_set_option_expiry' : ActorMethod<[bigint, bigint], Result_12>,
  'testing_sync_balance_from_ledger' : ActorMethod<[string], Result_13>,
  'update_ckbtc_balance' : ActorMethod<[string], Result_14>,
  'update_username' : ActorMethod<[AuthenticatedPayload_3], Result_3>,
  'withdraw_ckbtc' : ActorMethod<[AuthenticatedPayload_4], Result_15>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
