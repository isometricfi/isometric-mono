import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface AuthenticatedPayload {
  'data' : {},
  'wallet_proof' : WalletProof,
}
export interface AuthenticatedPayload_1 {
  'data' : UpdateUsernameRequest,
  'wallet_proof' : WalletProof,
}
export interface Config { 'temp' : string }
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
export interface UpdateUsernameRequest { 'username' : string }
export interface UserInfo {
  'principal' : Principal,
  'username' : [] | [string],
  'address' : string,
}
export type VolumetricError = { 'Internal' : string } |
  { 'ProfileAlreadyRegistered' : null } |
  { 'ProfileNotFound' : null } |
  { 'InvalidSignature' : string } |
  { 'UnauthorizedWhitelisted' : { 'caller' : string } } |
  { 'UnauthorizedController' : { 'caller' : string } } |
  { 'ConfigError' : string };
export interface WalletProof { 'signature' : string, 'address' : string }
export interface _SERVICE {
  'add_whitelisted' : ActorMethod<[Principal], Result>,
  'create_account' : ActorMethod<[AuthenticatedPayload], Result_1>,
  'get_account_info' : ActorMethod<[string], [] | [ProfileInfo]>,
  'get_account_nonce' : ActorMethod<[string], bigint>,
  'get_config' : ActorMethod<[], Config>,
  'get_message_to_sign' : ActorMethod<[string], string>,
  'get_username_update_message' : ActorMethod<[string, string], string>,
  'greet' : ActorMethod<[string], string>,
  'list_users' : ActorMethod<[], Array<UserInfo>>,
  'list_whitelisted' : ActorMethod<[], Array<Principal>>,
  'remove_whitelisted' : ActorMethod<[Principal], Result>,
  'set_temp' : ActorMethod<[string], Result>,
  'update_username' : ActorMethod<[AuthenticatedPayload_1], Result_1>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
