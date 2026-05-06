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
    'expires_at_seconds' : IDL.Nat64,
    'items' : IDL.Vec(AcceptOfferItem),
  });
  const WalletProof = IDL.Record({
    'signature' : IDL.Text,
    'address' : IDL.Text,
  });
  const AuthenticatedPayload = IDL.Record({
    'data' : AcceptOffersRequest,
    'wallet_proof' : WalletProof,
  });
  const AcceptOffersReceipt = IDL.Record({
    'accept_journal_entry_id' : IDL.Nat64,
    'fill_group_id' : IDL.Nat64,
    'operation_id' : IDL.Vec(IDL.Nat8),
  });
  const ErrorDetails = IDL.Record({ 'caller' : IDL.Opt(IDL.Text) });
  const VolumetricError = IDL.Record({
    'code' : IDL.Nat32,
    'name' : IDL.Text,
    'message' : IDL.Text,
    'details' : IDL.Opt(ErrorDetails),
  });
  const Result = IDL.Variant({
    'Ok' : AcceptOffersReceipt,
    'Err' : VolumetricError,
  });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : VolumetricError });
  const CancelOfferRequest = IDL.Record({
    'expires_at_seconds' : IDL.Nat64,
    'offer_id' : IDL.Nat64,
  });
  const AuthenticatedPayload_1 = IDL.Record({
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
  const OptionType = IDL.Variant({ 'Call' : IDL.Null });
  const Asset = IDL.Variant({ 'CkBtc' : IDL.Null });
  const Offer = IDL.Record({
    'id' : IDL.Nat64,
    'status' : OfferStatus,
    'option_type' : OptionType,
    'asset' : Asset,
    'total_quantity' : IDL.Nat64,
    'offer_valid_until_seconds' : IDL.Nat64,
    'writer' : IDL.Principal,
    'strike_basis_points' : IDL.Nat16,
    'remaining_quantity' : IDL.Nat64,
    'premium_basis_points' : IDL.Nat16,
    'created_at_seconds' : IDL.Nat64,
    'option_duration_seconds' : IDL.Nat64,
  });
  const Result_2 = IDL.Variant({ 'Ok' : Offer, 'Err' : VolumetricError });
  const Result_3 = IDL.Variant({ 'Ok' : IDL.Nat64, 'Err' : VolumetricError });
  const CreateProfileRequest = IDL.Record({
    'invite_code' : IDL.Opt(IDL.Text),
    'expires_at_seconds' : IDL.Nat64,
  });
  const AuthenticatedPayload_2 = IDL.Record({
    'data' : CreateProfileRequest,
    'wallet_proof' : WalletProof,
  });
  const ProfileInfo = IDL.Record({
    'principal' : IDL.Principal,
    'username' : IDL.Opt(IDL.Text),
    'referral_count' : IDL.Opt(IDL.Nat64),
    'subaccount' : IDL.Vec(IDL.Nat8),
    'invite_code' : IDL.Opt(IDL.Text),
    'address' : IDL.Text,
  });
  const Result_4 = IDL.Variant({ 'Ok' : ProfileInfo, 'Err' : VolumetricError });
  const CreateOfferRequest = IDL.Record({
    'option_type' : OptionType,
    'asset' : Asset,
    'offer_valid_until_seconds' : IDL.Nat64,
    'expires_at_seconds' : IDL.Nat64,
    'strike_basis_points' : IDL.Nat16,
    'premium_basis_points' : IDL.Nat16,
    'quantity' : IDL.Nat64,
    'option_duration_seconds' : IDL.Nat64,
  });
  const AuthenticatedPayload_3 = IDL.Record({
    'data' : CreateOfferRequest,
    'wallet_proof' : WalletProof,
  });
  const CreateOfferResponse = IDL.Record({ 'offer' : Offer });
  const Result_5 = IDL.Variant({
    'Ok' : CreateOfferResponse,
    'Err' : VolumetricError,
  });
  const ExchangeRateMetadata = IDL.Record({
    'decimals' : IDL.Nat32,
    'forex_timestamp' : IDL.Opt(IDL.Nat64),
    'quote_asset_num_received_rates' : IDL.Nat64,
    'base_asset_num_received_rates' : IDL.Nat64,
    'base_asset_num_queried_sources' : IDL.Nat64,
    'standard_deviation' : IDL.Nat64,
    'quote_asset_num_queried_sources' : IDL.Nat64,
  });
  const AssetClass = IDL.Variant({
    'Cryptocurrency' : IDL.Null,
    'FiatCurrency' : IDL.Null,
  });
  const Asset_1 = IDL.Record({ 'class' : AssetClass, 'symbol' : IDL.Text });
  const ExchangeRate = IDL.Record({
    'metadata' : ExchangeRateMetadata,
    'rate' : IDL.Nat64,
    'timestamp' : IDL.Nat64,
    'quote_asset' : Asset_1,
    'base_asset' : Asset_1,
  });
  const ExchangeRateError = IDL.Variant({
    'AnonymousPrincipalNotAllowed' : IDL.Null,
    'CryptoQuoteAssetNotFound' : IDL.Null,
    'FailedToAcceptCycles' : IDL.Null,
    'ForexBaseAssetNotFound' : IDL.Null,
    'CryptoBaseAssetNotFound' : IDL.Null,
    'StablecoinRateTooFewRates' : IDL.Null,
    'ForexAssetsNotFound' : IDL.Null,
    'InconsistentRatesReceived' : IDL.Null,
    'RateLimited' : IDL.Null,
    'StablecoinRateZeroRate' : IDL.Null,
    'Other' : IDL.Record({ 'code' : IDL.Nat32, 'description' : IDL.Text }),
    'ForexInvalidTimestamp' : IDL.Null,
    'NotEnoughCycles' : IDL.Null,
    'ForexQuoteAssetNotFound' : IDL.Null,
    'StablecoinRateNotFound' : IDL.Null,
    'Pending' : IDL.Null,
  });
  const Result_6 = IDL.Variant({
    'Ok' : ExchangeRate,
    'Err' : ExchangeRateError,
  });
  const Result_7 = IDL.Variant({ 'Ok' : Result_6, 'Err' : VolumetricError });
  const AcceptedOffer = IDL.Record({
    'writer' : IDL.Principal,
    'option_id' : IDL.Nat64,
    'collateral_locked' : IDL.Nat64,
    'offer_id' : IDL.Nat64,
    'quantity' : IDL.Nat64,
    'premium_to_writer' : IDL.Nat64,
    'platform_fee' : IDL.Nat64,
  });
  const AcceptPhase = IDL.Variant({
    'Started' : IDL.Null,
    'Failed' : IDL.Record({ 'reason' : IDL.Text }),
    'CollateralLocked' : IDL.Null,
    'BuyerDebited' : IDL.Null,
    'TransfersComplete' : IDL.Null,
    'Completed' : IDL.Null,
  });
  const PendingAccept = IDL.Record({
    'id' : IDL.Nat64,
    'fill_group_id' : IDL.Nat64,
    'entry_price_cents' : IDL.Opt(IDL.Nat64),
    'updated_at_seconds' : IDL.Nat64,
    'offers' : IDL.Vec(AcceptedOffer),
    'created_at_seconds' : IDL.Nat64,
    'buyer' : IDL.Principal,
    'phase' : AcceptPhase,
    'total_buyer_debit_required_sats' : IDL.Nat64,
    'platform_fee_collected' : IDL.Opt(IDL.Bool),
  });
  const Result_8 = IDL.Variant({
    'Ok' : IDL.Opt(PendingAccept),
    'Err' : VolumetricError,
  });
  const Result_9 = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : VolumetricError });
  const ActiveOptionStatus = IDL.Variant({
    'Active' : IDL.Null,
    'Settling' : IDL.Null,
    'Expired' : IDL.Null,
    'Settled' : IDL.Null,
  });
  const ActiveOption = IDL.Record({
    'id' : IDL.Nat64,
    'status' : ActiveOptionStatus,
    'expiry_seconds' : IDL.Nat64,
    'option_type' : OptionType,
    'fill_group_id' : IDL.Opt(IDL.Nat64),
    'entry_price_cents' : IDL.Nat64,
    'asset' : Asset,
    'writer' : IDL.Principal,
    'offer_id' : IDL.Nat64,
    'profit_fee_basis_points' : IDL.Nat64,
    'quantity' : IDL.Nat64,
    'accepted_at_seconds' : IDL.Nat64,
    'buyer' : IDL.Principal,
    'premium_paid' : IDL.Nat64,
    'strike_price_cents' : IDL.Nat64,
  });
  const AcceptOffersResult = IDL.Record({
    'fill_group_id' : IDL.Nat64,
    'active_options' : IDL.Vec(ActiveOption),
  });
  const AcceptOffersStatus = IDL.Variant({
    'Failed' : IDL.Record({
      'receipt' : AcceptOffersReceipt,
      'message' : IDL.Text,
    }),
    'RecoveryRequired' : IDL.Record({
      'last_error' : IDL.Opt(IDL.Text),
      'receipt' : AcceptOffersReceipt,
      'phase' : AcceptPhase,
    }),
    'Succeeded' : IDL.Record({
      'result' : AcceptOffersResult,
      'receipt' : AcceptOffersReceipt,
    }),
    'Pending' : IDL.Record({
      'last_error' : IDL.Opt(IDL.Text),
      'receipt' : AcceptOffersReceipt,
      'phase' : AcceptPhase,
    }),
  });
  const Result_10 = IDL.Variant({
    'Ok' : AcceptOffersStatus,
    'Err' : VolumetricError,
  });
  const Result_11 = IDL.Variant({
    'Ok' : IDL.Opt(ProfileInfo),
    'Err' : VolumetricError,
  });
  const TradeRole = IDL.Variant({ 'Buyer' : IDL.Null, 'Writer' : IDL.Null });
  const EventData = IDL.Variant({
    'AccountCreated' : IDL.Record({ 'wallet_address' : IDL.Text }),
    'OfferAcceptFailed' : IDL.Record({
      'offer_ids' : IDL.Vec(IDL.Nat64),
      'reason' : IDL.Text,
    }),
    'Deposit' : IDL.Record({ 'amount_sats' : IDL.Nat64 }),
    'OfferCancelled' : IDL.Record({
      'offer_id' : IDL.Nat64,
      'remaining_quantity_sats' : IDL.Nat64,
    }),
    'OfferAccepted' : IDL.Record({
      'expiry_seconds' : IDL.Nat64,
      'fill_group_id' : IDL.Nat64,
      'entry_price_cents' : IDL.Nat64,
      'role' : TradeRole,
      'counterparty' : IDL.Principal,
      'option_id' : IDL.Nat64,
      'quantity_sats' : IDL.Nat64,
      'offer_id' : IDL.Nat64,
      'premium_sats' : IDL.Nat64,
      'strike_price_cents' : IDL.Nat64,
    }),
    'OptionSettled' : IDL.Record({
      'entry_price_cents' : IDL.Nat64,
      'payout_sats' : IDL.Nat64,
      'role' : TradeRole,
      'option_id' : IDL.Nat64,
      'quantity_sats' : IDL.Nat64,
      'accepted_at_seconds' : IDL.Nat64,
      'settled_at_seconds' : IDL.Nat64,
      'premium_sats' : IDL.Nat64,
      'settlement_price_cents' : IDL.Nat64,
      'strike_price_cents' : IDL.Nat64,
    }),
    'Withdrawal' : IDL.Record({
      'destination' : IDL.Text,
      'amount_sats' : IDL.Nat64,
    }),
    'WithdrawalFailed' : IDL.Record({
      'amount_sats' : IDL.Nat64,
      'reason' : IDL.Text,
    }),
    'Unknown' : IDL.Null,
    'UsernameUpdated' : IDL.Record({
      'old_username' : IDL.Opt(IDL.Text),
      'new_username' : IDL.Text,
    }),
    'OfferCreated' : IDL.Record({
      'duration_seconds' : IDL.Nat64,
      'offer_valid_until_seconds' : IDL.Nat64,
      'quantity_sats' : IDL.Nat64,
      'strike_basis_points' : IDL.Nat16,
      'offer_id' : IDL.Nat64,
      'premium_basis_points' : IDL.Nat16,
    }),
    'OptionSettlementFailed' : IDL.Record({
      'option_id' : IDL.Nat64,
      'reason' : IDL.Text,
    }),
  });
  const EventType = IDL.Variant({
    'AccountCreated' : IDL.Null,
    'OfferAcceptFailed' : IDL.Null,
    'Deposit' : IDL.Null,
    'OfferCancelled' : IDL.Null,
    'OfferAccepted' : IDL.Null,
    'OptionSettled' : IDL.Null,
    'Withdrawal' : IDL.Null,
    'WithdrawalFailed' : IDL.Null,
    'Unknown' : IDL.Null,
    'UsernameUpdated' : IDL.Null,
    'OfferCreated' : IDL.Null,
    'OptionSettlementFailed' : IDL.Null,
  });
  const Event = IDL.Record({
    'id' : IDL.Nat64,
    'principal' : IDL.Principal,
    'data' : EventData,
    'event_type' : EventType,
    'timestamp_seconds' : IDL.Nat64,
  });
  const Result_12 = IDL.Variant({
    'Ok' : IDL.Vec(Event),
    'Err' : VolumetricError,
  });
  const Result_13 = IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : VolumetricError });
  const Range = IDL.Record({ 'max' : IDL.Nat64, 'min' : IDL.Nat64 });
  const Range_1 = IDL.Record({ 'max' : IDL.Nat16, 'min' : IDL.Nat16 });
  const TradingLimits = IDL.Record({
    'create_offer_quantity_sats' : Range,
    'deposit_amount_sats' : IDL.Nat64,
    'accept_offer_quantity_sats' : Range,
    'max_offers_per_term' : IDL.Nat64,
    'withdraw_amount_sats' : IDL.Nat64,
    'strike_basis_points' : Range_1,
    'premium_basis_points' : Range_1,
    'option_duration_seconds' : Range,
  });
  const FeeConfig = IDL.Record({
    'premium_fee_basis_points' : IDL.Nat64,
    'fee_recipient' : IDL.Principal,
    'profit_fee_basis_points' : IDL.Nat64,
  });
  const FeatureFlags = IDL.Record({
    'is_stitching_enabled' : IDL.Bool,
    'is_partial_filling_enabled' : IDL.Bool,
  });
  const Config = IDL.Record({
    'ckbtc_minter' : IDL.Principal,
    'trading_limits' : TradingLimits,
    'btc_network' : BtcNetwork,
    'fee_config' : FeeConfig,
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
  const Result_14 = IDL.Variant({
    'Ok' : DepositInfo,
    'Err' : VolumetricError,
  });
  const Result_15 = IDL.Variant({
    'Ok' : IDL.Vec(PendingAccept),
    'Err' : VolumetricError,
  });
  const SettlementPhase = IDL.Variant({
    'Started' : IDL.Null,
    'ProfitFeeCollected' : IDL.Null,
    'Failed' : IDL.Record({ 'reason' : IDL.Text }),
    'TransferComplete' : IDL.Null,
    'BalanceReleased' : IDL.Null,
    'WriterPayoutReleased' : IDL.Null,
    'Completed' : IDL.Null,
  });
  const PendingSettlement = IDL.Record({
    'updated_at_seconds' : IDL.Nat64,
    'payout_to_buyer' : IDL.Nat64,
    'writer' : IDL.Principal,
    'option_id' : IDL.Nat64,
    'created_at_seconds' : IDL.Nat64,
    'buyer' : IDL.Principal,
    'phase' : SettlementPhase,
    'settlement_price_cents' : IDL.Nat64,
    'payout_to_writer' : IDL.Nat64,
  });
  const Result_16 = IDL.Variant({
    'Ok' : IDL.Vec(PendingSettlement),
    'Err' : VolumetricError,
  });
  const WithdrawResult = IDL.Record({ 'block_index' : IDL.Nat64 });
  const WithdrawalPhase = IDL.Variant({
    'Started' : IDL.Null,
    'Failed' : IDL.Record({ 'reason' : IDL.Text }),
    'RetrieveRequested' : WithdrawResult,
    'Approved' : IDL.Null,
    'Completed' : WithdrawResult,
  });
  const PendingWithdrawal = IDL.Record({
    'id' : IDL.Nat64,
    'principal' : IDL.Principal,
    'updated_at_seconds' : IDL.Nat64,
    'created_at_time_ns' : IDL.Nat64,
    'created_at_seconds' : IDL.Nat64,
    'phase' : WithdrawalPhase,
    'amount' : IDL.Nat64,
    'btc_address' : IDL.Text,
  });
  const Result_17 = IDL.Variant({
    'Ok' : IDL.Vec(PendingWithdrawal),
    'Err' : VolumetricError,
  });
  const Result_18 = IDL.Variant({
    'Ok' : IDL.Vec(Offer),
    'Err' : VolumetricError,
  });
  const Result_19 = IDL.Variant({
    'Ok' : IDL.Vec(ActiveOption),
    'Err' : VolumetricError,
  });
  const ListMyPendingWithdrawalsRequest = IDL.Record({
    'expires_at_seconds' : IDL.Nat64,
  });
  const AuthenticatedPayload_4 = IDL.Record({
    'data' : ListMyPendingWithdrawalsRequest,
    'wallet_proof' : WalletProof,
  });
  const Result_20 = IDL.Variant({
    'Ok' : IDL.Vec(IDL.Vec(IDL.Nat8)),
    'Err' : VolumetricError,
  });
  const Result_21 = IDL.Variant({
    'Ok' : IDL.Opt(PendingSettlement),
    'Err' : VolumetricError,
  });
  const SettlementReceipt = IDL.Record({
    'operation_id' : IDL.Vec(IDL.Nat8),
    'option_id' : IDL.Nat64,
  });
  const SettlementWalResult = IDL.Record({ 'option_id' : IDL.Nat64 });
  const SettlementStatus = IDL.Variant({
    'Failed' : IDL.Record({
      'receipt' : SettlementReceipt,
      'message' : IDL.Text,
    }),
    'RecoveryRequired' : IDL.Record({
      'last_error' : IDL.Opt(IDL.Text),
      'receipt' : SettlementReceipt,
      'phase' : SettlementPhase,
    }),
    'Succeeded' : IDL.Record({
      'result' : SettlementWalResult,
      'receipt' : SettlementReceipt,
    }),
    'Pending' : IDL.Record({
      'last_error' : IDL.Opt(IDL.Text),
      'receipt' : SettlementReceipt,
      'phase' : SettlementPhase,
    }),
  });
  const Result_22 = IDL.Variant({
    'Ok' : SettlementStatus,
    'Err' : VolumetricError,
  });
  const UserBalanceInfo = IDL.Record({
    'total' : IDL.Nat64,
    'locked' : IDL.Nat64,
    'available' : IDL.Nat64,
  });
  const Result_23 = IDL.Variant({
    'Ok' : UserBalanceInfo,
    'Err' : VolumetricError,
  });
  const WithdrawReceipt = IDL.Record({
    'withdrawal_id' : IDL.Nat64,
    'operation_id' : IDL.Vec(IDL.Nat8),
  });
  const WithdrawStatus = IDL.Variant({
    'Failed' : IDL.Record({
      'receipt' : WithdrawReceipt,
      'message' : IDL.Text,
    }),
    'RecoveryRequired' : IDL.Record({
      'last_error' : IDL.Opt(IDL.Text),
      'receipt' : WithdrawReceipt,
      'phase' : WithdrawalPhase,
    }),
    'Succeeded' : IDL.Record({
      'result' : WithdrawResult,
      'receipt' : WithdrawReceipt,
    }),
    'Pending' : IDL.Record({
      'last_error' : IDL.Opt(IDL.Text),
      'receipt' : WithdrawReceipt,
      'phase' : WithdrawalPhase,
    }),
  });
  const Result_24 = IDL.Variant({
    'Ok' : WithdrawStatus,
    'Err' : VolumetricError,
  });
  const Result_25 = IDL.Variant({
    'Ok' : IDL.Opt(PendingWithdrawal),
    'Err' : VolumetricError,
  });
  const UserInfo = IDL.Record({
    'principal' : IDL.Principal,
    'username' : IDL.Opt(IDL.Text),
    'address' : IDL.Text,
  });
  const Result_26 = IDL.Variant({
    'Ok' : IDL.Vec(UserInfo),
    'Err' : VolumetricError,
  });
  const Result_27 = IDL.Variant({
    'Ok' : IDL.Vec(IDL.Principal),
    'Err' : VolumetricError,
  });
  const ObservabilityMetrics = IDL.Record({
    'failed_accepts_total' : IDL.Nat64,
    'balances_total' : IDL.Nat64,
    'stable_memory_pages' : IDL.Nat64,
    'stable_memory_bytes' : IDL.Nat64,
    'failed_withdrawals_total' : IDL.Nat64,
    'open_offers_total' : IDL.Nat64,
    'profiles_total' : IDL.Nat64,
    'whitelist_entries_total' : IDL.Nat64,
    'pending_settlements_total' : IDL.Nat64,
    'signature_nonces_total' : IDL.Nat64,
    'pending_accepts_total' : IDL.Nat64,
    'events_total' : IDL.Nat64,
    'wallet_registrations_total' : IDL.Nat64,
    'pending_withdrawals_total' : IDL.Nat64,
    'active_options_total' : IDL.Nat64,
    'failed_settlements_total' : IDL.Nat64,
    'offers_total' : IDL.Nat64,
  });
  const Result_28 = IDL.Variant({
    'Ok' : ObservabilityMetrics,
    'Err' : VolumetricError,
  });
  const WalExecutionOutcome = IDL.Variant({
    'SucceededAlready' : IDL.Null,
    'RecoveryRequired' : IDL.Text,
    'FailedPermanent' : IDL.Text,
    'Succeeded' : IDL.Null,
    'SkippedAlreadyInFlight' : IDL.Null,
  });
  const Result_29 = IDL.Variant({
    'Ok' : WalExecutionOutcome,
    'Err' : VolumetricError,
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
  const Result_30 = IDL.Variant({
    'Ok' : SettleExpiredOptionsResponse,
    'Err' : VolumetricError,
  });
  const Result_31 = IDL.Variant({
    'Ok' : SettlementReceipt,
    'Err' : VolumetricError,
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
  const Result_32 = IDL.Variant({
    'Ok' : IDL.Vec(UtxoStatus),
    'Err' : VolumetricError,
  });
  const UpdateUsernameRequest = IDL.Record({
    'username' : IDL.Text,
    'expires_at_seconds' : IDL.Nat64,
  });
  const AuthenticatedPayload_5 = IDL.Record({
    'data' : UpdateUsernameRequest,
    'wallet_proof' : WalletProof,
  });
  const WithdrawCkbtcRequest = IDL.Record({
    'expires_at_seconds' : IDL.Nat64,
    'amount' : IDL.Nat64,
  });
  const AuthenticatedPayload_6 = IDL.Record({
    'data' : WithdrawCkbtcRequest,
    'wallet_proof' : WalletProof,
  });
  const Result_33 = IDL.Variant({
    'Ok' : WithdrawReceipt,
    'Err' : VolumetricError,
  });
  return IDL.Service({
    'accept_offers' : IDL.Func([AuthenticatedPayload], [Result], []),
    'add_whitelisted' : IDL.Func([IDL.Principal], [Result_1], []),
    'cancel_offer' : IDL.Func([AuthenticatedPayload_1], [Result_2], []),
    'cleanup_old_events' : IDL.Func([], [Result_3], []),
    'clear_all_events' : IDL.Func([], [Result_3], []),
    'clear_log_access_token' : IDL.Func([], [Result_1], []),
    'create_account' : IDL.Func([AuthenticatedPayload_2], [Result_4], []),
    'create_offer' : IDL.Func([AuthenticatedPayload_3], [Result_5], []),
    'fetch_xrc_btc_usd_exchange_rate_snapshot' : IDL.Func([], [Result_7], []),
    'get_accept_by_id' : IDL.Func([IDL.Nat64], [Result_8], ['query']),
    'get_accept_offers_message' : IDL.Func(
        [IDL.Text, IDL.Vec(AcceptOfferItem), IDL.Nat64],
        [Result_9],
        ['query'],
      ),
    'get_accept_status' : IDL.Func([IDL.Vec(IDL.Nat8)], [Result_10], ['query']),
    'get_account_info' : IDL.Func([IDL.Text, IDL.Bool], [Result_11], ['query']),
    'get_account_nonce' : IDL.Func([IDL.Text], [Result_3], ['query']),
    'get_active_option_by_id' : IDL.Func(
        [IDL.Nat64],
        [IDL.Opt(ActiveOption)],
        ['query'],
      ),
    'get_active_options' : IDL.Func([], [IDL.Vec(ActiveOption)], ['query']),
    'get_all_events' : IDL.Func(
        [IDL.Opt(IDL.Nat64), IDL.Opt(IDL.Nat32)],
        [Result_12],
        ['query'],
      ),
    'get_cancel_offer_message' : IDL.Func(
        [IDL.Text, IDL.Nat64, IDL.Nat64],
        [Result_9],
        ['query'],
      ),
    'get_ckbtc_balance' : IDL.Func([IDL.Text], [Result_13], []),
    'get_config' : IDL.Func([], [Config], ['query']),
    'get_create_offer_message' : IDL.Func(
        [
          IDL.Text,
          IDL.Nat64,
          IDL.Nat16,
          IDL.Nat16,
          IDL.Nat64,
          IDL.Nat64,
          IDL.Nat64,
        ],
        [Result_9],
        ['query'],
      ),
    'get_deposit_address' : IDL.Func([IDL.Text], [Result_14], []),
    'get_events_for_principal' : IDL.Func(
        [IDL.Principal, IDL.Opt(IDL.Nat64), IDL.Opt(IDL.Nat32)],
        [Result_12],
        ['query'],
      ),
    'get_events_since' : IDL.Func(
        [IDL.Nat64, IDL.Opt(IDL.Nat32)],
        [Result_12],
        ['query'],
      ),
    'get_failed_accepts' : IDL.Func([], [Result_15], ['query']),
    'get_failed_settlements' : IDL.Func([], [Result_16], ['query']),
    'get_failed_withdrawals' : IDL.Func([], [Result_17], ['query']),
    'get_feature_flags' : IDL.Func([], [FeatureFlags], ['query']),
    'get_fee_config' : IDL.Func([], [FeeConfig], ['query']),
    'get_message_to_sign' : IDL.Func(
        [IDL.Text, IDL.Opt(IDL.Text), IDL.Nat64],
        [Result_9],
        ['query'],
      ),
    'get_my_events' : IDL.Func(
        [IDL.Opt(IDL.Nat64), IDL.Opt(IDL.Nat32)],
        [IDL.Vec(Event)],
        ['query'],
      ),
    'get_my_offers' : IDL.Func([IDL.Text], [Result_18], ['query']),
    'get_my_options' : IDL.Func([IDL.Text], [Result_19], ['query']),
    'get_my_pending_withdrawals' : IDL.Func(
        [AuthenticatedPayload_4],
        [Result_17],
        ['query'],
      ),
    'get_my_pending_withdrawals_message' : IDL.Func(
        [IDL.Text, IDL.Nat64],
        [Result_9],
        ['query'],
      ),
    'get_my_written_options' : IDL.Func([IDL.Text], [Result_19], ['query']),
    'get_offer_by_id' : IDL.Func([IDL.Nat64], [IDL.Opt(Offer)], ['query']),
    'get_open_offers' : IDL.Func([], [IDL.Vec(Offer)], ['query']),
    'get_pending_accepts' : IDL.Func([], [Result_15], ['query']),
    'get_pending_settlements' : IDL.Func([], [Result_19], ['query']),
    'get_pending_settlements_journal' : IDL.Func([], [Result_16], ['query']),
    'get_pending_withdrawals' : IDL.Func([], [Result_17], ['query']),
    'get_platform_fees_collected_total' : IDL.Func([], [IDL.Nat64], ['query']),
    'get_recovery_required_wal_entries' : IDL.Func(
        [IDL.Nat32],
        [Result_20],
        ['query'],
      ),
    'get_settlement_by_id' : IDL.Func([IDL.Nat64], [Result_21], ['query']),
    'get_settlement_status' : IDL.Func(
        [IDL.Vec(IDL.Nat8)],
        [Result_22],
        ['query'],
      ),
    'get_trading_limits' : IDL.Func([], [TradingLimits], ['query']),
    'get_user_balance' : IDL.Func([IDL.Text], [Result_23], ['query']),
    'get_user_balance_by_principal' : IDL.Func(
        [IDL.Principal],
        [Result_23],
        ['query'],
      ),
    'get_username_update_message' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Nat64],
        [Result_9],
        ['query'],
      ),
    'get_withdraw_message' : IDL.Func(
        [IDL.Text, IDL.Nat64, IDL.Nat64],
        [Result_9],
        ['query'],
      ),
    'get_withdraw_status' : IDL.Func(
        [IDL.Vec(IDL.Nat8)],
        [Result_24],
        ['query'],
      ),
    'get_withdrawal_by_id' : IDL.Func([IDL.Nat64], [Result_25], ['query']),
    'list_users' : IDL.Func([], [Result_26], ['query']),
    'list_whitelisted' : IDL.Func([], [Result_27], ['query']),
    'observability_get_metrics' : IDL.Func([], [Result_28], ['query']),
    'recover_wal_operation' : IDL.Func([IDL.Vec(IDL.Nat8)], [Result_29], []),
    'remove_whitelisted' : IDL.Func([IDL.Principal], [Result_1], []),
    'resolve_invite_code' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(IDL.Text)],
        ['query'],
      ),
    'set_accept_offer_quantity_sats_range_config' : IDL.Func(
        [IDL.Nat64, IDL.Nat64],
        [Result_1],
        [],
      ),
    'set_create_offer_quantity_sats_range_config' : IDL.Func(
        [IDL.Nat64, IDL.Nat64],
        [Result_1],
        [],
      ),
    'set_deposit_amount_sats_config' : IDL.Func([IDL.Nat64], [Result_1], []),
    'set_feature_flags_config' : IDL.Func([FeatureFlags], [Result_1], []),
    'set_fee_config_config' : IDL.Func([FeeConfig], [Result_1], []),
    'set_fee_recipient_config' : IDL.Func([IDL.Principal], [Result_1], []),
    'set_log_access_token' : IDL.Func([IDL.Text], [Result_1], []),
    'set_max_offers_per_term_config' : IDL.Func([IDL.Nat64], [Result_1], []),
    'set_option_duration_seconds_range_config' : IDL.Func(
        [IDL.Nat64, IDL.Nat64],
        [Result_1],
        [],
      ),
    'set_premium_basis_points_range_config' : IDL.Func(
        [IDL.Nat16, IDL.Nat16],
        [Result_1],
        [],
      ),
    'set_premium_fee_basis_points_config' : IDL.Func(
        [IDL.Nat64],
        [Result_1],
        [],
      ),
    'set_profit_fee_basis_points_config' : IDL.Func(
        [IDL.Nat64],
        [Result_1],
        [],
      ),
    'set_quantity_sats_range_config' : IDL.Func(
        [IDL.Nat64, IDL.Nat64],
        [Result_1],
        [],
      ),
    'set_strike_basis_points_range_config' : IDL.Func(
        [IDL.Nat16, IDL.Nat16],
        [Result_1],
        [],
      ),
    'set_trading_limits_config' : IDL.Func([TradingLimits], [Result_1], []),
    'set_withdraw_amount_sats_config' : IDL.Func([IDL.Nat64], [Result_1], []),
    'settle_expired_options' : IDL.Func([], [Result_30], []),
    'settle_option_by_id' : IDL.Func([IDL.Nat64], [Result_31], []),
    'update_ckbtc_balance' : IDL.Func([IDL.Text], [Result_32], []),
    'update_username' : IDL.Func([AuthenticatedPayload_5], [Result_4], []),
    'validate_invite_code' : IDL.Func(
        [IDL.Text, IDL.Text],
        [IDL.Bool],
        ['query'],
      ),
    'withdraw_ckbtc' : IDL.Func([AuthenticatedPayload_6], [Result_33], []),
  });
};
export const init = ({ IDL }) => {
  const BtcNetwork = IDL.Variant({
    'Mainnet' : IDL.Null,
    'Testnet' : IDL.Null,
  });
  return [IDL.Opt(BtcNetwork)];
};
