export const idlFactory = ({ IDL }) => {
  const BtcNetwork = IDL.Variant({
    'Mainnet' : IDL.Null,
    'Testnet' : IDL.Null,
  });
  const AcceptOfferItem = IDL.Record({
    'offer_id' : IDL.Nat64,
    'quantity' : IDL.Nat64,
  });
  const AcceptOffersRequest = IDL.Record({
    'wallet_address' : IDL.Text,
    'items' : IDL.Vec(AcceptOfferItem),
  });
  const ActiveOptionStatus = IDL.Variant({
    'Active' : IDL.Null,
    'Settling' : IDL.Null,
    'Expired' : IDL.Null,
    'Settled' : IDL.Null,
  });
  const OptionType = IDL.Variant({ 'Call' : IDL.Null });
  const Asset = IDL.Variant({ 'CkBtc' : IDL.Null });
  const ActiveOption = IDL.Record({
    'id' : IDL.Nat64,
    'status' : ActiveOptionStatus,
    'option_type' : OptionType,
    'fill_group_id' : IDL.Opt(IDL.Nat64),
    'asset' : Asset,
    'accepted_at' : IDL.Nat64,
    'writer' : IDL.Principal,
    'offer_id' : IDL.Nat64,
    'quantity' : IDL.Nat64,
    'buyer' : IDL.Principal,
    'expiry' : IDL.Nat64,
    'premium_paid' : IDL.Nat64,
    'strike_price_cents' : IDL.Nat64,
  });
  const AcceptOffersResponse = IDL.Record({
    'fill_group_id' : IDL.Nat64,
    'active_options' : IDL.Vec(ActiveOption),
  });
  const ErrorDetails = IDL.Record({ 'caller' : IDL.Opt(IDL.Text) });
  const VolumetricError = IDL.Record({
    'code' : IDL.Nat32,
    'name' : IDL.Text,
    'message' : IDL.Text,
    'details' : IDL.Opt(ErrorDetails),
  });
  const Result = IDL.Variant({
    'Ok' : AcceptOffersResponse,
    'Err' : VolumetricError,
  });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : VolumetricError });
  const CancelOfferRequest = IDL.Record({ 'offer_id' : IDL.Nat64 });
  const WalletProof = IDL.Record({
    'signature' : IDL.Text,
    'address' : IDL.Text,
  });
  const AuthenticatedPayload = IDL.Record({
    'data' : CancelOfferRequest,
    'wallet_proof' : WalletProof,
  });
  const OfferStatus = IDL.Variant({
    'Open' : IDL.Null,
    'PartiallyFilled' : IDL.Null,
    'Filled' : IDL.Null,
    'Cancelled' : IDL.Null,
    'Processing' : IDL.Null,
  });
  const Offer = IDL.Record({
    'id' : IDL.Nat64,
    'status' : OfferStatus,
    'option_type' : OptionType,
    'asset' : Asset,
    'total_quantity' : IDL.Nat64,
    'offer_valid_until' : IDL.Nat64,
    'created_at' : IDL.Nat64,
    'writer' : IDL.Principal,
    'remaining_quantity' : IDL.Nat64,
    'premium_basis_points' : IDL.Nat16,
    'option_duration_seconds' : IDL.Nat64,
    'strike_price_cents' : IDL.Nat64,
  });
  const Result_2 = IDL.Variant({ 'Ok' : Offer, 'Err' : VolumetricError });
  const AuthenticatedPayload_1 = IDL.Record({
    'data' : IDL.Record({}),
    'wallet_proof' : WalletProof,
  });
  const ProfileInfo = IDL.Record({
    'principal' : IDL.Principal,
    'username' : IDL.Opt(IDL.Text),
    'subaccount' : IDL.Vec(IDL.Nat8),
    'address' : IDL.Text,
  });
  const Result_3 = IDL.Variant({ 'Ok' : ProfileInfo, 'Err' : VolumetricError });
  const CreateOfferRequest = IDL.Record({
    'option_type' : OptionType,
    'asset' : Asset,
    'offer_valid_until' : IDL.Nat64,
    'premium_basis_points' : IDL.Nat16,
    'quantity' : IDL.Nat64,
    'option_duration_seconds' : IDL.Nat64,
    'strike_price_cents' : IDL.Nat64,
  });
  const AuthenticatedPayload_2 = IDL.Record({
    'data' : CreateOfferRequest,
    'wallet_proof' : WalletProof,
  });
  const CreateOfferResponse = IDL.Record({ 'offer' : Offer });
  const Result_4 = IDL.Variant({
    'Ok' : CreateOfferResponse,
    'Err' : VolumetricError,
  });
  const Result_5 = IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : VolumetricError });
  const FeatureFlags = IDL.Record({
    'is_stitching_enabled' : IDL.Bool,
    'is_partial_filling_enabled' : IDL.Bool,
  });
  const Config = IDL.Record({
    'ckbtc_minter' : IDL.Principal,
    'btc_network' : BtcNetwork,
    'ckbtc_ledger' : IDL.Principal,
    'feature_flags' : FeatureFlags,
  });
  const Account = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const DepositInfo = IDL.Record({
    'account' : Account,
    'btc_address' : IDL.Text,
  });
  const Result_6 = IDL.Variant({ 'Ok' : DepositInfo, 'Err' : VolumetricError });
  const Result_7 = IDL.Variant({
    'Ok' : IDL.Vec(Offer),
    'Err' : VolumetricError,
  });
  const Result_8 = IDL.Variant({
    'Ok' : IDL.Vec(ActiveOption),
    'Err' : VolumetricError,
  });
  const UserInfo = IDL.Record({
    'principal' : IDL.Principal,
    'username' : IDL.Opt(IDL.Text),
    'address' : IDL.Text,
  });
  const SettlementResult = IDL.Record({
    'status' : ActiveOptionStatus,
    'payout_to_buyer' : IDL.Nat64,
    'option_id' : IDL.Nat64,
    'settlement_price_cents' : IDL.Nat64,
    'payout_to_writer' : IDL.Nat64,
  });
  const SettleExpiredOptionsResponse = IDL.Record({
    'settled' : IDL.Vec(SettlementResult),
    'errors' : IDL.Vec(IDL.Text),
  });
  const Result_9 = IDL.Variant({
    'Ok' : SettleExpiredOptionsResponse,
    'Err' : VolumetricError,
  });
  const Result_10 = IDL.Variant({
    'Ok' : SettlementResult,
    'Err' : VolumetricError,
  });
  const Result_11 = IDL.Variant({
    'Ok' : ActiveOption,
    'Err' : VolumetricError,
  });
  const Result_12 = IDL.Variant({ 'Ok' : IDL.Nat64, 'Err' : VolumetricError });
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
  const Result_13 = IDL.Variant({
    'Ok' : IDL.Vec(UtxoStatus),
    'Err' : VolumetricError,
  });
  const UpdateUsernameRequest = IDL.Record({ 'username' : IDL.Text });
  const AuthenticatedPayload_3 = IDL.Record({
    'data' : UpdateUsernameRequest,
    'wallet_proof' : WalletProof,
  });
  const WithdrawCkbtcRequest = IDL.Record({
    'amount' : IDL.Nat64,
    'btc_address' : IDL.Text,
  });
  const AuthenticatedPayload_4 = IDL.Record({
    'data' : WithdrawCkbtcRequest,
    'wallet_proof' : WalletProof,
  });
  const WithdrawResult = IDL.Record({ 'block_index' : IDL.Nat64 });
  const Result_14 = IDL.Variant({
    'Ok' : WithdrawResult,
    'Err' : VolumetricError,
  });
  return IDL.Service({
    'accept_offers' : IDL.Func([AcceptOffersRequest], [Result], []),
    'add_whitelisted' : IDL.Func([IDL.Principal], [Result_1], []),
    'cancel_offer' : IDL.Func([AuthenticatedPayload], [Result_2], []),
    'create_account' : IDL.Func([AuthenticatedPayload_1], [Result_3], []),
    'create_offer' : IDL.Func([AuthenticatedPayload_2], [Result_4], []),
    'get_account_info' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(ProfileInfo)],
        ['query'],
      ),
    'get_account_nonce' : IDL.Func([IDL.Text], [IDL.Nat64], ['query']),
    'get_active_option_by_id' : IDL.Func(
        [IDL.Nat64],
        [IDL.Opt(ActiveOption)],
        ['query'],
      ),
    'get_cancel_offer_message' : IDL.Func(
        [IDL.Text, IDL.Nat64],
        [IDL.Text],
        ['query'],
      ),
    'get_ckbtc_balance' : IDL.Func([IDL.Text], [Result_5], []),
    'get_config' : IDL.Func([], [Config], ['query']),
    'get_create_offer_message' : IDL.Func(
        [IDL.Text, IDL.Nat64, IDL.Nat64, IDL.Nat16],
        [IDL.Text],
        ['query'],
      ),
    'get_deposit_address' : IDL.Func([IDL.Text], [Result_6], []),
    'get_feature_flags' : IDL.Func([], [FeatureFlags], ['query']),
    'get_message_to_sign' : IDL.Func([IDL.Text], [IDL.Text], ['query']),
    'get_my_offers' : IDL.Func([IDL.Text], [Result_7], ['query']),
    'get_my_options' : IDL.Func([IDL.Text], [Result_8], ['query']),
    'get_my_written_options' : IDL.Func([IDL.Text], [Result_8], ['query']),
    'get_offer_by_id' : IDL.Func([IDL.Nat64], [IDL.Opt(Offer)], ['query']),
    'get_open_offers' : IDL.Func([], [IDL.Vec(Offer)], ['query']),
    'get_pending_settlements' : IDL.Func(
        [],
        [IDL.Vec(ActiveOption)],
        ['query'],
      ),
    'get_platform_fee_info' : IDL.Func([], [IDL.Nat64, IDL.Nat64], ['query']),
    'get_username_update_message' : IDL.Func(
        [IDL.Text, IDL.Text],
        [IDL.Text],
        ['query'],
      ),
    'get_withdraw_message' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Nat64],
        [IDL.Text],
        ['query'],
      ),
    'greet' : IDL.Func([IDL.Text], [IDL.Text], ['query']),
    'list_users' : IDL.Func([], [IDL.Vec(UserInfo)], ['query']),
    'list_whitelisted' : IDL.Func([], [IDL.Vec(IDL.Principal)], ['query']),
    'remove_whitelisted' : IDL.Func([IDL.Principal], [Result_1], []),
    'set_feature_flags' : IDL.Func([FeatureFlags], [Result_1], []),
    'set_oracle_price' : IDL.Func([IDL.Nat64], [Result_1], []),
    'settle_expired_options' : IDL.Func([], [Result_9], []),
    'settle_option_by_id' : IDL.Func([IDL.Nat64], [Result_10], []),
    'testing_expire_option' : IDL.Func([IDL.Nat64], [Result_11], []),
    'testing_force_settle' : IDL.Func([IDL.Nat64], [Result_10], []),
    'testing_set_option_expiry' : IDL.Func(
        [IDL.Nat64, IDL.Nat64],
        [Result_11],
        [],
      ),
    'testing_sync_balance_from_ledger' : IDL.Func([IDL.Text], [Result_12], []),
    'update_ckbtc_balance' : IDL.Func([IDL.Text], [Result_13], []),
    'update_username' : IDL.Func([AuthenticatedPayload_3], [Result_3], []),
    'withdraw_ckbtc' : IDL.Func([AuthenticatedPayload_4], [Result_14], []),
  });
};
export const init = ({ IDL }) => {
  const BtcNetwork = IDL.Variant({
    'Mainnet' : IDL.Null,
    'Testnet' : IDL.Null,
  });
  return [IDL.Opt(BtcNetwork)];
};
