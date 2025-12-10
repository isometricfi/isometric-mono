export const idlFactory = ({ IDL }) => {
  const VolumetricError = IDL.Variant({
    'Internal' : IDL.Text,
    'ProfileAlreadyRegistered' : IDL.Null,
    'ProfileNotFound' : IDL.Null,
    'InvalidSignature' : IDL.Text,
    'UnauthorizedWhitelisted' : IDL.Record({ 'caller' : IDL.Text }),
    'UnauthorizedController' : IDL.Record({ 'caller' : IDL.Text }),
    'ConfigError' : IDL.Text,
  });
  const Result = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : VolumetricError });
  const WalletProof = IDL.Record({
    'signature' : IDL.Text,
    'address' : IDL.Text,
  });
  const AuthenticatedPayload = IDL.Record({
    'data' : IDL.Record({}),
    'wallet_proof' : WalletProof,
  });
  const ProfileInfo = IDL.Record({
    'principal' : IDL.Principal,
    'username' : IDL.Opt(IDL.Text),
    'subaccount' : IDL.Vec(IDL.Nat8),
    'address' : IDL.Text,
  });
  const Result_1 = IDL.Variant({ 'Ok' : ProfileInfo, 'Err' : VolumetricError });
  const Config = IDL.Record({ 'temp' : IDL.Text });
  const UserInfo = IDL.Record({
    'principal' : IDL.Principal,
    'username' : IDL.Opt(IDL.Text),
    'address' : IDL.Text,
  });
  const UpdateUsernameRequest = IDL.Record({ 'username' : IDL.Text });
  const AuthenticatedPayload_1 = IDL.Record({
    'data' : UpdateUsernameRequest,
    'wallet_proof' : WalletProof,
  });
  return IDL.Service({
    'add_whitelisted' : IDL.Func([IDL.Principal], [Result], []),
    'create_account' : IDL.Func([AuthenticatedPayload], [Result_1], []),
    'get_account_info' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(ProfileInfo)],
        ['query'],
      ),
    'get_account_nonce' : IDL.Func([IDL.Text], [IDL.Nat64], ['query']),
    'get_config' : IDL.Func([], [Config], ['query']),
    'get_message_to_sign' : IDL.Func([IDL.Text], [IDL.Text], ['query']),
    'get_username_update_message' : IDL.Func(
        [IDL.Text, IDL.Text],
        [IDL.Text],
        ['query'],
      ),
    'greet' : IDL.Func([IDL.Text], [IDL.Text], ['query']),
    'list_users' : IDL.Func([], [IDL.Vec(UserInfo)], ['query']),
    'list_whitelisted' : IDL.Func([], [IDL.Vec(IDL.Principal)], ['query']),
    'remove_whitelisted' : IDL.Func([IDL.Principal], [Result], []),
    'set_temp' : IDL.Func([IDL.Text], [Result], []),
    'update_username' : IDL.Func([AuthenticatedPayload_1], [Result_1], []),
  });
};
export const init = ({ IDL }) => { return []; };
