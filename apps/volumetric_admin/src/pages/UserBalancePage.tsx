import { Button, Empty, Input, LayerCard } from "@cloudflare/kumo";
import { Principal } from "@icp-sdk/core/principal";
import { MagnifyingGlass, UserCircle } from "@phosphor-icons/react";
import type { UserBalanceInfo } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { useState } from "react";
import { Eyebrow } from "../components/Eyebrow";
import { MetricCard } from "../components/MetricCard";
import { Mono } from "../components/Mono";
import { PageShell } from "../components/PageShell";
import { deriveSubaccount } from "../lib/account";
import { useCreateCanisterClients } from "../lib/clients";
import { useConnection } from "../lib/connection-context";
import { bytesToHex, formatSats, shortPrincipal } from "../lib/format";
import { useAsyncAction } from "../lib/use-async-action";

type UserBalanceData = {
  address: string;
  principalText: string;
  canisterBalance: UserBalanceInfo;
  onChainBalance: bigint;
  derivedSubaccountHex: string;
  drift: bigint;
};

export function UserBalancePage() {
  const createClients = useCreateCanisterClients();
  const { volumetricCanisterId } = useConnection();
  const [addressInput, setAddressInput] = useState("");

  const action = useAsyncAction<UserBalanceData>({
    loadingStatus: "Fetching user balance vs ledger...",
    successStatus: (result) =>
      `${shortPrincipal(result.principalText)} drift: ${formatSats(result.drift)}.`,
  });

  async function runAudit() {
    const trimmed = addressInput.trim();
    if (!trimmed) {
      throw new Error("Enter a wallet address to audit.");
    }

    await action.run(async () => {
      const { volumetric, ckBtcLedger } = createClients();
      const canisterPrincipal = Principal.fromText(volumetricCanisterId);

      const [canisterBalance, profileOptional] = await Promise.all([
        volumetric.get_user_balance(trimmed).then(unwrapResult),
        volumetric.get_account_info(trimmed, false).then(unwrapResult),
      ]);

      const profile = profileOptional[0];
      if (!profile) {
        throw new Error("No profile found for that wallet address.");
      }
      const userPrincipal = profile.principal;
      const subaccount = deriveSubaccount(userPrincipal);

      const onChainBalance = await ckBtcLedger.icrc1_balance_of({
        owner: canisterPrincipal,
        subaccount: [subaccount],
      });

      const drift = onChainBalance - canisterBalance.available;

      return {
        address: trimmed,
        principalText: userPrincipal.toText(),
        canisterBalance,
        onChainBalance,
        derivedSubaccountHex: bytesToHex(subaccount),
        drift,
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

  const driftTone: "ok" | "warn" | "danger" =
    action.data?.drift === 0n
      ? "ok"
      : action.data && action.data.drift > 0n
        ? "warn"
        : action.data && action.data.drift < 0n
          ? "danger"
          : "ok";

  return (
    <PageShell
      eyebrow="Accounting"
      title="User Balance"
      description="For a specific wallet address, compare the canister's recorded balance against the on-chain ckBTC balance of the user's derived deposit subaccount. Drift indicates accounting misalignment."
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
          Audit balance
        </Button>
      }
    >
      <div className="max-w-xl">
        <Input
          label="Wallet address"
          placeholder="0x... or btc address"
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
              label="Available (canister)"
              value={formatSats(action.data.canisterBalance.available)}
            />
            <MetricCard
              label="Locked (canister)"
              value={formatSats(action.data.canisterBalance.locked)}
            />
            <MetricCard
              label="Total (canister)"
              value={formatSats(action.data.canisterBalance.total)}
            />
            <MetricCard label="On-chain (ledger)" value={formatSats(action.data.onChainBalance)} />
            <MetricCard
              label="Drift (ledger - available)"
              value={formatSats(action.data.drift)}
              tone={driftTone}
            />
            <MetricCard label="Principal" value={shortPrincipal(action.data.principalText)} mono />
          </div>
          <LayerCard className="rounded-none border vol-hairline p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Eyebrow>Principal</Eyebrow>
                <Mono className="mt-1 block break-all text-sm">
                  {action.data.principalText}
                </Mono>
              </div>
              <div>
                <Eyebrow>Deposit subaccount</Eyebrow>
                <Mono className="mt-1 block break-all text-sm">
                  {action.data.derivedSubaccountHex}
                </Mono>
              </div>
            </div>
          </LayerCard>
        </>
      ) : (
        <Empty
          size="sm"
          icon={<UserCircle size={36} className="text-kumo-inactive" />}
          title="No user audited"
          description="Enter a wallet address to compare canister and ledger balances."
        />
      )}
    </PageShell>
  );
}
