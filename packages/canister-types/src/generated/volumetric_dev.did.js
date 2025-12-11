export const idlFactory = ({ IDL }) => {
  const VolumetricError = IDL.Variant({
    'Internal' : IDL.Text,
    'ProfileAlreadyRegistered' : IDL.Null,
    'ProfileNotFound' : IDL.Null,
    'InvalidSignature' : IDL.Text,
    'UnauthorizedWhitelisted' : IDL.Record({ 'caller' : IDL.Text }),
    'InterCanisterCallFailed' : IDL.Text,
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
  const Result_2 = IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : VolumetricError });
  const Config = IDL.Record({
    'temp' : IDL.Text,
    'ckbtc_minter' : IDL.Principal,
    'ckbtc_ledger' : IDL.Principal,
  });
  const Account = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const DepositInfo = IDL.Record({
    'account' : Account,
    'btc_address' : IDL.Text,
  });
  const Result_3 = IDL.Variant({ 'Ok' : DepositInfo, 'Err' : VolumetricError });
  const UserInfo = IDL.Record({
    'principal' : IDL.Principal,
    'username' : IDL.Opt(IDL.Text),
    'address' : IDL.Text,
  });
  const UtxoOutpoint = IDL.Record({
    'txid' : IDL.Vec(IDL.Nat8),
    'vout' : IDL.Nat32,
  });
  const Utxo = IDL.Record({
    'height' : IDL.Nat32,
    'value' : IDL.Nat64,
    'outpoint' : UtxoOutpoint,
  });
  const UtxoStatus = IDL.Variant({
    'ValueTooSmall' : Utxo,
    'Tainted' : Utxo,
    'Minted' : IDL.Record({
      'minted_amount' : IDL.Nat64,
      'block_index' : IDL.Nat64,
      'utxo' : Utxo,
    }),
    'Checked' : Utxo,
  });
  const Result_4 = IDL.Variant({
    'Ok' : IDL.Vec(UtxoStatus),
    'Err' : VolumetricError,
  });
  const UpdateUsernameRequest = IDL.Record({ 'username' : IDL.Text });
  const AuthenticatedPayload_1 = IDL.Record({
    'data' : UpdateUsernameRequest,
    'wallet_proof' : WalletProof,
  });
  const WithdrawRequest = IDL.Record({
    'address' : IDL.Text,
    'amount' : IDL.Nat64,
    'btc_address' : IDL.Text,
  });
  const WithdrawResult = IDL.Record({ 'block_index' : IDL.Nat64 });
  const Result_5 = IDL.Variant({
    'Ok' : WithdrawResult,
    'Err' : VolumetricError,
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
    'get_ckbtc_balance' : IDL.Func([IDL.Text], [Result_2], []),
    'get_config' : IDL.Func([], [Config], ['query']),
    'get_deposit_address' : IDL.Func([IDL.Text], [Result_3], []),
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
    'update_ckbtc_balance' : IDL.Func([IDL.Text], [Result_4], []),
    'update_username' : IDL.Func([AuthenticatedPayload_1], [Result_1], []),
    'withdraw_ckbtc' : IDL.Func([WithdrawRequest], [Result_5], []),
  });
};
export const init = ({ IDL }) => { return []; };
