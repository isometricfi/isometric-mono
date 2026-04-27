import { Badge, Button, Empty, Input, LayerCard } from "@cloudflare/kumo";
import { Principal } from "@dfinity/principal";
import { Database, MagnifyingGlass } from "@phosphor-icons/react";
import type { DepositInfo, UserBalanceInfo } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { useState } from "react";
import { MetricCard } from "../components/MetricCard";
import { Mono } from "../components/Mono";
import { PageShell } from "../components/PageShell";
import { useCreateCanisterClients } from "../lib/clients";
import { useConnection } from "../lib/connection-context";
import { bytesToHex, formatSats, shortPrincipal } from "../lib/format";
import { useAsyncAction } from "../lib/use-async-action";

type DepositData = {
  address: string;
  principalText: string;
  depositInfo: DepositInfo;
  subaccountLedgerBalance: bigint;
  canisterBalance: UserBalanceInfo;
  uncreditedSats: bigint;
};

export function DepositAddressPage() {
  const createClients = useCreateCanisterClients();
  const { volumetricCanisterId } = useConnection();
  const [addressInput, setAddressInput] = useState("");

  const action = useAsyncAction<DepositData>({
    loadingStatus: "Deriving deposit account and checking ledger...",
    successStatus: (result) =>
      `${shortPrincipal(result.principalText)} — uncredited: ${formatSats(result.uncreditedSats)}.`,
  });

  async function runAudit() {
    const trimmed = addressInput.trim();
    if (!trimmed) {
      throw new Error("Enter a wallet address.");
    }

    await action.run(async () => {
      const { volumetric, ckBtcLedger } = createClients();
      const canisterPrincipal = Principal.fromText(volumetricCanisterId);

      const [depositInfo, canisterBalance, profileOptional] = await Promise.all([
        volumetric.get_deposit_address(trimmed).then(unwrapResult),
        volumetric.get_user_balance(trimmed).then(unwrapResult),
        volumetric.get_account_info(trimmed, false).then(unwrapResult),
      ]);

      const profile = profileOptional[0];
      if (!profile) {
        throw new Error("No profile for that wallet address.");
      }

      const subaccountLedgerBalance = await ckBtcLedger.icrc1_balance_of({
        owner: canisterPrincipal,
        subaccount: [profile.subaccount],
      });

      const uncreditedSats = subaccountLedgerBalance - canisterBalance.available;

      return {
        address: trimmed,
        principalText: profile.principal.toText(),
        depositInfo,
        subaccountLedgerBalance,
        canisterBalance,
        uncreditedSats: uncreditedSats > 0n ? uncreditedSats : 0n,
      };
    });
  }

  async function handleSubmit() {
    try {
      await runAudit();
    } catch {
      /* handled */
    }
  }

  return (
    <PageShell
      eyebrow="Operations"
      title="Deposit Address"
      description="For a wallet address, show the derived ckBTC deposit subaccount, the canonical BTC deposit address, and flag any uncredited deposit (ckBTC sitting in the subaccount but not reflected in the user's balance)."
      phase={action.phase}
      statusText={action.statusText}
      error={action.error}
      action={
        <Button
          variant="primary"
          icon={<MagnifyingGlass />}
          loading={action.phase === "loading"}
          onClick={handleSubmit}
        >
          Resolve
        </Button>
      }
    >
      <div className="max-w-xl">
        <Input
          label="Wallet address"
          value={addressInput}
          onChange={(event) => setAddressInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleSubmit();
          }}
        />
      </div>

      {action.data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <MetricCard
              label="Subaccount balance"
              value={formatSats(action.data.subaccountLedgerBalance)}
            />
            <MetricCard
              label="Canister balance"
              value={formatSats(action.data.canisterBalance.available)}
            />
            <MetricCard
              label="Uncredited"
              value={formatSats(action.data.uncreditedSats)}
              tone={action.data.uncreditedSats > 0n ? "danger" : "ok"}
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <LayerCard className="flex items-center justify-between border vol-hairline p-4">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[11px] uppercase tracking-wider text-kumo-subtle">
                  BTC deposit address
                </span>
                <Mono className="text-[13px] text-kumo-strong">
                  {action.data.depositInfo.btc_address}
                </Mono>
              </div>
              {action.data.uncreditedSats > 0n ? (
                <Badge variant="error">uncredited deposit</Badge>
              ) : (
                <Badge variant="success">reconciled</Badge>
              )}
            </LayerCard>

            <LayerCard className="flex items-center justify-between border vol-hairline p-4">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[11px] uppercase tracking-wider text-kumo-subtle">
                  Derived subaccount
                </span>
                <Mono className="text-[13px] text-kumo-strong">
                  {bytesToHex(action.data.depositInfo.account.subaccount[0] ?? new Uint8Array())}
                </Mono>
              </div>
              <Mono className="text-sm text-kumo-subtle">
                owner {shortPrincipal(action.data.depositInfo.account.owner)}
              </Mono>
            </LayerCard>
          </div>
        </>
      ) : (
        <Empty
          size="sm"
          icon={<Database size={36} className="text-kumo-inactive" />}
          title="No address resolved"
          description="Enter a wallet address to derive its deposit subaccount and check for uncredited ckBTC."
        />
      )}
    </PageShell>
  );
}
