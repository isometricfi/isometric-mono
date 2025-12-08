import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Config { 'temp' : string }
export type Result = { 'Ok' : null } |
  { 'Err' : VolumetricError };
export type VolumetricError = { 'Internal' : string } |
  { 'UnauthorizedWhitelisted' : { 'caller' : string } } |
  { 'UnauthorizedController' : { 'caller' : string } } |
  { 'ConfigError' : string };
export interface _SERVICE {
  'add_whitelisted' : ActorMethod<[Principal], Result>,
  'get_config' : ActorMethod<[], Config>,
  'greet' : ActorMethod<[string], string>,
  'list_whitelisted' : ActorMethod<[], Array<Principal>>,
  'remove_whitelisted' : ActorMethod<[Principal], Result>,
  'set_temp' : ActorMethod<[string], Result>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
