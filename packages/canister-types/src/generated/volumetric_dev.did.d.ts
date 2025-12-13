import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [Uint8Array | number[]],
}
export interface AuthenticatedPayload {
  'data' : {},
  'wallet_proof' : WalletProof,
}
export interface AuthenticatedPayload_1 {
  'data' : UpdateUsernameRequest,
  'wallet_proof' : WalletProof,
}
export interface AuthenticatedPayload_2 {
  'data' : WithdrawCkbtcRequest,
  'wallet_proof' : WalletProof,
}
export type BtcNetwork = { 'Mainnet' : null } |
  { 'Testnet' : null };
export interface Config {
  'temp' : string,
  'ckbtc_minter' : Principal,
  'btc_network' : BtcNetwork,
  'ckbtc_ledger' : Principal,
}
export interface DepositInfo { 'account' : Account, 'btc_address' : string }
export interface ProfileInfo {
  'principal' : Principal,
  'username' : [] | [string],
  'subaccount' : Uint8Array | number[],
  'address' : string,
}
export type Result = { 'Ok' : null } |
  { 'Err' : VolumetricError };
export type Result_1 = { 'Ok' : ProfileInfo } |
  { 'Err' : VolumetricError };
export type Result_2 = { 'Ok' : bigint } |
  { 'Err' : VolumetricError };
export type Result_3 = { 'Ok' : DepositInfo } |
  { 'Err' : VolumetricError };
export type Result_4 = { 'Ok' : Array<UtxoStatus> } |
  { 'Err' : VolumetricError };
export type Result_5 = { 'Ok' : WithdrawResult } |
  { 'Err' : VolumetricError };
export interface UpdateUsernameRequest { 'username' : string }
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
export type VolumetricError = { 'Internal' : string } |
  { 'ProfileAlreadyRegistered' : null } |
  { 'ProfileNotFound' : null } |
  { 'InvalidSignature' : string } |
  { 'UnauthorizedWhitelisted' : { 'caller' : string } } |
  { 'InterCanisterCallFailed' : string } |
  { 'UnauthorizedController' : { 'caller' : string } } |
  { 'ConfigError' : string };
export interface WalletProof { 'signature' : string, 'address' : string }
export interface WithdrawCkbtcRequest {
  'amount' : bigint,
  'btc_address' : string,
}
export interface WithdrawResult { 'block_index' : bigint }
export interface _SERVICE {
  'add_whitelisted' : ActorMethod<[Principal], Result>,
  'create_account' : ActorMethod<[AuthenticatedPayload], Result_1>,
  'get_account_info' : ActorMethod<[string], [] | [ProfileInfo]>,
  'get_account_nonce' : ActorMethod<[string], bigint>,
  'get_ckbtc_balance' : ActorMethod<[string], Result_2>,
  'get_config' : ActorMethod<[], Config>,
  'get_deposit_address' : ActorMethod<[string], Result_3>,
  'get_message_to_sign' : ActorMethod<[string], string>,
  'get_username_update_message' : ActorMethod<[string, string], string>,
  'get_withdraw_message' : ActorMethod<[string, string, bigint], string>,
  'greet' : ActorMethod<[string], string>,
  'list_users' : ActorMethod<[], Array<UserInfo>>,
  'list_whitelisted' : ActorMethod<[], Array<Principal>>,
  'remove_whitelisted' : ActorMethod<[Principal], Result>,
  'set_temp' : ActorMethod<[string], Result>,
  'update_ckbtc_balance' : ActorMethod<[string], Result_4>,
  'update_username' : ActorMethod<[AuthenticatedPayload_1], Result_1>,
  'withdraw_ckbtc' : ActorMethod<[AuthenticatedPayload_2], Result_5>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
