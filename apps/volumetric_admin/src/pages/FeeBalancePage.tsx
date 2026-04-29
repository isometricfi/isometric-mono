import { Button, Empty } from "@cloudflare/kumo";
import type { Principal } from "@dfinity/principal";
import { ArrowsClockwise, Wallet } from "@phosphor-icons/react";
import { MetricCard } from "../components/MetricCard";
import { PageShell } from "../components/PageShell";
import { defaultAccount } from "../lib/account";
import { useCreateCanisterClients } from "../lib/clients";
import { formatSats, shortPrincipal } from "../lib/format";
import { useAsyncAction } from "../lib/use-async-action";

type FeeBalanceData = {
  feeRecipient: Principal;
  feeRecipientLedgerBalanceSats: bigint;
};

export function FeeBalancePage() {
  const createClients = useCreateCanisterClients();

  const action = useAsyncAction<FeeBalanceData>({
    loadingStatus: "Fetching fee recipient ckBTC balance...",
    successStatus: (result) =>
      `Fee recipient balance: ${formatSats(result.feeRecipientLedgerBalanceSats)}.`,
  });

  async function runAudit() {
    await action.run(async () => {
      const { volumetric, ckBtcLedger } = createClients();
      const feeConfig = await volumetric.get_fee_config();
      const feeRecipientAccount = defaultAccount(feeConfig.fee_recipient);
      const feeRecipientLedgerBalanceSats = await ckBtcLedger.icrc1_balance_of(feeRecipientAccount);

      return {
        feeRecipient: feeConfig.fee_recipient,
        feeRecipientLedgerBalanceSats,
      };
    });
  }

  return (
    <PageShell
      eyebrow="Accounting / Fees"
      title="Fee Recipient Balance"
      description="Fetch the live ckBTC balance of the configured fee recipient's default ICRC account."
      phase={action.phase}
      statusText={action.statusText}
      error={action.error}
      action={
        <Button
          variant="primary"
          icon={<ArrowsClockwise />}
          loading={action.phase === "loading"}
          onClick={runAudit}
        >
          Fetch balance
        </Button>
      }
    >
      {action.data ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <MetricCard label="Fee recipient" value={shortPrincipal(action.data.feeRecipient)} mono />
          <MetricCard
            label="ckBTC balance"
            value={formatSats(action.data.feeRecipientLedgerBalanceSats)}
          />
        </div>
      ) : (
        <Empty
          size="sm"
          icon={<Wallet size={36} className="text-kumo-inactive" />}
          title="No fee balance loaded"
          description="Fetch the configured fee recipient's live ckBTC ledger balance."
        />
      )}
    </PageShell>
  );
}
