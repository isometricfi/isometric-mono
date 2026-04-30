import { Badge, Button, Empty, Input, LayerCard, Table, Text } from "@cloudflare/kumo";
import { Principal } from "@dfinity/principal";
import { MagnifyingGlass, UserFocus } from "@phosphor-icons/react";
import type {
  ActiveOption,
  Event,
  Offer,
  PendingAccept,
  PendingSettlement,
  PendingWithdrawal,
  ProfileInfo,
  UserBalanceInfo,
  UserInfo,
} from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { type ReactNode, useState } from "react";
import { Eyebrow } from "../components/Eyebrow";
import { MetricCard } from "../components/MetricCard";
import { Mono } from "../components/Mono";
import { PageShell } from "../components/PageShell";
import { deriveSubaccount } from "../lib/account";
import { type CanisterClients, useCreateCanisterClients } from "../lib/clients";
import { useConnection } from "../lib/connection-context";
import { bytesToHex, formatSats, shortPrincipal } from "../lib/format";
import { useAsyncAction } from "../lib/use-async-action";

const USER_EVENT_LIMIT = 1000;

type ResolvedUser = {
  input: string;
  address: string | null;
  principal: Principal;
  profile: ProfileInfo | null;
};

type UserAuditData = {
  resolvedUser: ResolvedUser;
  bookBalance: UserBalanceInfo | null;
  onChainBalanceSats: bigint;
  depositSubaccountHex: string;
  boughtOptions: ActiveOption[];
  writtenOptions: ActiveOption[];
  offers: Offer[];
  events: Event[];
  pendingAccepts: PendingAccept[];
  failedAccepts: PendingAccept[];
  pendingSettlements: PendingSettlement[];
  failedSettlements: PendingSettlement[];
  pendingWithdrawals: PendingWithdrawal[];
  failedWithdrawals: PendingWithdrawal[];
};

export function UserAuditPage() {
  const createClients = useCreateCanisterClients();
  const { volumetricCanisterId } = useConnection();
  const [userInput, setUserInput] = useState("");

  const action = useAsyncAction<UserAuditData>({
    loadingStatus: "Fetching user audit snapshot...",
    successStatus: (result) =>
      `Loaded ${shortPrincipal(result.resolvedUser.principal)} with ${result.events.length} events.`,
  });

  async function runAudit() {
    const trimmedInput = userInput.trim();
    if (!trimmedInput) {
      throw new Error("Enter a BTC address or principal.");
    }

    await action.run(async () => {
      const { volumetric, ckBtcLedger } = createClients();
      const canisterPrincipal = Principal.fromText(volumetricCanisterId);
      const resolvedUser = await resolveUser(volumetric, trimmedInput);
      const subaccount = deriveSubaccount(resolvedUser.principal);

      const [
        bookBalance,
        onChainBalanceSats,
        boughtOptions,
        writtenOptions,
        offers,
        events,
        pendingAccepts,
        failedAccepts,
        pendingSettlements,
        failedSettlements,
        pendingWithdrawals,
        failedWithdrawals,
      ] = await Promise.all([
        loadBookBalance(volumetric, resolvedUser.address),
        ckBtcLedger.icrc1_balance_of({
          owner: canisterPrincipal,
          subaccount: [subaccount],
        }),
        loadBoughtOptions(volumetric, resolvedUser),
        loadWrittenOptions(volumetric, resolvedUser),
        loadOffers(volumetric, resolvedUser),
        volumetric
          .get_events_for_principal(resolvedUser.principal, [], [USER_EVENT_LIMIT])
          .then(unwrapResult),
        volumetric.get_pending_accepts().then(unwrapResult),
        volumetric.get_failed_accepts().then(unwrapResult),
        volumetric.get_pending_settlements_journal().then(unwrapResult),
        volumetric.get_failed_settlements().then(unwrapResult),
        volumetric.get_pending_withdrawals().then(unwrapResult),
        volumetric.get_failed_withdrawals().then(unwrapResult),
      ]);

      return {
        resolvedUser,
        bookBalance,
        onChainBalanceSats,
        depositSubaccountHex: bytesToHex(subaccount),
        boughtOptions,
        writtenOptions,
        offers,
        events,
        pendingAccepts: filterAcceptsForPrincipal(pendingAccepts, resolvedUser.principal),
        failedAccepts: filterAcceptsForPrincipal(failedAccepts, resolvedUser.principal),
        pendingSettlements: filterSettlementsForPrincipal(
          pendingSettlements,
          resolvedUser.principal,
        ),
        failedSettlements: filterSettlementsForPrincipal(failedSettlements, resolvedUser.principal),
        pendingWithdrawals: filterWithdrawalsForPrincipal(
          pendingWithdrawals,
          resolvedUser.principal,
        ),
        failedWithdrawals: filterWithdrawalsForPrincipal(failedWithdrawals, resolvedUser.principal),
      };
    });
  }

  async function handleSubmit() {
    try {
      await runAudit();
    } catch {
      /* handled by async action */
    }
  }

  return (
    <PageShell
      eyebrow="Accounting / Users"
      title="User Audit"
      description="Resolve a BTC wallet address or principal into one user snapshot: book balances, live ckBTC subaccount balance, options, offers, operations, and event history."
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
          Audit user
        </Button>
      }
    >
      <div className="max-w-2xl">
        <Input
          label="BTC address or principal"
          placeholder="bc1... or aaaaa-..."
          value={userInput}
          onChange={(event) => setUserInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void handleSubmit();
            }
          }}
        />
      </div>

      {action.data ? (
        <>
          <UserSummary data={action.data} />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <OptionsTable title="Bought Options" options={action.data.boughtOptions} />
            <OptionsTable title="Written Options" options={action.data.writtenOptions} />
            <OffersTable offers={action.data.offers} />
            <OperationsTable data={action.data} />
          </div>
          <EventsTable events={action.data.events} />
        </>
      ) : (
        <Empty
          size="sm"
          icon={<UserFocus size={36} className="text-kumo-inactive" />}
          title="No user loaded"
          description="Paste a BTC address or principal to fetch the user audit snapshot."
        />
      )}
    </PageShell>
  );
}

function UserSummary({ data }: { data: UserAuditData }) {
  const bookAvailable = data.bookBalance?.available ?? 0n;
  const bookLocked = data.bookBalance?.locked ?? 0n;
  const bookTotal = data.bookBalance?.total ?? 0n;
  const bookTotalDrift = data.onChainBalanceSats - bookTotal;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <MetricCard label="Principal" value={shortPrincipal(data.resolvedUser.principal)} mono />
        <MetricCard
          label="Address"
          value={shortenAddress(data.resolvedUser.address ?? "unknown")}
          mono
        />
        <MetricCard label="Book available" value={formatSats(bookAvailable)} />
        <MetricCard label="Book locked" value={formatSats(bookLocked)} />
        <MetricCard label="Book total" value={formatSats(bookTotal)} />
        <MetricCard
          label="On-chain subaccount"
          value={formatSats(data.onChainBalanceSats)}
          tone={bookTotalDrift === 0n ? "ok" : bookTotalDrift < 0n ? "danger" : "warn"}
        />
        <MetricCard
          label="Drift vs book total"
          value={formatSats(bookTotalDrift)}
          tone={bookTotalDrift === 0n ? "ok" : bookTotalDrift < 0n ? "danger" : "warn"}
        />
        <MetricCard label="Events" value={data.events.length.toString()} />
        <MetricCard
          label="Options"
          value={(data.boughtOptions.length + data.writtenOptions.length).toString()}
        />
        <MetricCard label="Offers" value={data.offers.length.toString()} />
        <MetricCard
          label="Pending ops"
          value={(
            data.pendingAccepts.length +
            data.pendingSettlements.length +
            data.pendingWithdrawals.length
          ).toString()}
        />
        <MetricCard
          label="Failed ops"
          value={(
            data.failedAccepts.length +
            data.failedSettlements.length +
            data.failedWithdrawals.length
          ).toString()}
          tone={
            data.failedAccepts.length +
              data.failedSettlements.length +
              data.failedWithdrawals.length >
            0
              ? "danger"
              : "ok"
          }
        />
      </div>

      <LayerCard className="rounded-none border vol-hairline p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <DetailRow label="Input" value={data.resolvedUser.input} />
          <DetailRow label="Username" value={data.resolvedUser.profile?.username[0] ?? "—"} />
          <DetailRow label="Invite code" value={data.resolvedUser.profile?.invite_code[0] ?? "—"} />
          <DetailRow
            label="Referral count"
            value={data.resolvedUser.profile?.referral_count[0]?.toString() ?? "—"}
          />
          <DetailRow label="Deposit subaccount" value={data.depositSubaccountHex} />
        </div>
      </LayerCard>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <Mono className="mt-1 block break-all text-sm">{value}</Mono>
    </div>
  );
}

function OptionsTable({ title, options }: { title: string; options: ActiveOption[] }) {
  const isBoughtOptionsTable = title === "Bought Options";

  return (
    <AuditTableShell title={title} count={options.length} emptyTitle={`No ${title.toLowerCase()}`}>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>ID</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head>{isBoughtOptionsTable ? "Writer" : "Buyer"}</Table.Head>
            <Table.Head>Quantity</Table.Head>
            <Table.Head>Premium</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {options.map((option) => (
            <Table.Row key={option.id.toString()}>
              <Table.Cell>
                <Mono>{option.id.toString()}</Mono>
              </Table.Cell>
              <Table.Cell>{variantLabel(option.status)}</Table.Cell>
              <Table.Cell>
                <Mono className="text-sm">
                  {shortPrincipal(isBoughtOptionsTable ? option.writer : option.buyer)}
                </Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono>{formatSats(option.quantity)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono>{formatSats(option.premium_paid)}</Mono>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </AuditTableShell>
  );
}

function OffersTable({ offers }: { offers: Offer[] }) {
  return (
    <AuditTableShell title="Offers" count={offers.length} emptyTitle="No offers">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>ID</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head>Remaining</Table.Head>
            <Table.Head>Total</Table.Head>
            <Table.Head>Premium</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {offers.map((offer) => (
            <Table.Row key={offer.id.toString()}>
              <Table.Cell>
                <Mono>{offer.id.toString()}</Mono>
              </Table.Cell>
              <Table.Cell>{variantLabel(offer.status)}</Table.Cell>
              <Table.Cell>
                <Mono>{formatSats(offer.remaining_quantity)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono>{formatSats(offer.total_quantity)}</Mono>
              </Table.Cell>
              <Table.Cell>{formatBasisPoints(offer.premium_basis_points)}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </AuditTableShell>
  );
}

function OperationsTable({ data }: { data: UserAuditData }) {
  const rows = [
    { label: "Pending accepts", count: data.pendingAccepts.length, tone: "warn" as const },
    { label: "Failed accepts", count: data.failedAccepts.length, tone: "danger" as const },
    { label: "Pending settlements", count: data.pendingSettlements.length, tone: "warn" as const },
    { label: "Failed settlements", count: data.failedSettlements.length, tone: "danger" as const },
    { label: "Pending withdrawals", count: data.pendingWithdrawals.length, tone: "warn" as const },
    { label: "Failed withdrawals", count: data.failedWithdrawals.length, tone: "danger" as const },
  ];

  return (
    <LayerCard className="p-0">
      <div className="flex items-center justify-between border-b vol-hairline px-4 py-2.5">
        <Eyebrow>Operations</Eyebrow>
        <Eyebrow>{rows.reduce((sum, row) => sum + row.count, 0)}</Eyebrow>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>Type</Table.Head>
            <Table.Head>Count</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((row) => (
            <Table.Row key={row.label}>
              <Table.Cell>{row.label}</Table.Cell>
              <Table.Cell>
                {row.count > 0 ? (
                  <Badge variant={row.tone === "danger" ? "error" : "warning"}>{row.count}</Badge>
                ) : (
                  <Badge variant="success">0</Badge>
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </LayerCard>
  );
}

function EventsTable({ events }: { events: Event[] }) {
  return (
    <AuditTableShell title="History" count={events.length} emptyTitle="No events">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>ID</Table.Head>
            <Table.Head>Type</Table.Head>
            <Table.Head>Time</Table.Head>
            <Table.Head>Summary</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {events.map((event) => (
            <Table.Row key={event.id.toString()}>
              <Table.Cell>
                <Mono>{event.id.toString()}</Mono>
              </Table.Cell>
              <Table.Cell>{variantLabel(event.event_type)}</Table.Cell>
              <Table.Cell>
                <Text size="sm">{formatSeconds(event.timestamp_seconds)}</Text>
              </Table.Cell>
              <Table.Cell>
                <Mono className="text-sm">{eventSummary(event)}</Mono>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </AuditTableShell>
  );
}

function AuditTableShell({
  title,
  count,
  emptyTitle,
  children,
}: {
  title: string;
  count: number;
  emptyTitle: string;
  children: ReactNode;
}) {
  return (
    <LayerCard className="p-0">
      <div className="flex items-center justify-between border-b vol-hairline px-4 py-2.5">
        <Eyebrow>{title}</Eyebrow>
        <Eyebrow>{count}</Eyebrow>
      </div>
      {count === 0 ? (
        <Empty size="sm" title={emptyTitle} description="Nothing matched this user." />
      ) : (
        children
      )}
    </LayerCard>
  );
}

async function resolveUser(
  volumetric: CanisterClients["volumetric"],
  input: string,
): Promise<ResolvedUser> {
  const parsedPrincipal = parsePrincipalOrNull(input);
  if (parsedPrincipal) {
    const users = unwrapResult(await volumetric.list_users());
    const user = users.find((candidate: UserInfo) =>
      isSamePrincipal(candidate.principal, parsedPrincipal),
    );
    if (!user) {
      return {
        input,
        address: null,
        principal: parsedPrincipal,
        profile: null,
      };
    }

    const profile = unwrapResult(await volumetric.get_account_info(user.address, true))[0] ?? null;
    return {
      input,
      address: user.address,
      principal: parsedPrincipal,
      profile,
    };
  }

  const profile = unwrapResult(await volumetric.get_account_info(input, true))[0];
  if (!profile) {
    throw new Error("No profile found for that BTC address.");
  }

  return {
    input,
    address: profile.address,
    principal: profile.principal,
    profile,
  };
}

async function loadBookBalance(
  volumetric: CanisterClients["volumetric"],
  address: string | null,
): Promise<UserBalanceInfo | null> {
  if (!address) {
    return null;
  }

  return unwrapResult(await volumetric.get_user_balance(address));
}

async function loadBoughtOptions(
  volumetric: CanisterClients["volumetric"],
  resolvedUser: ResolvedUser,
): Promise<ActiveOption[]> {
  if (!resolvedUser.address) {
    const activeOptions = await volumetric.get_active_options();
    return activeOptions.filter((option) => isSamePrincipal(option.buyer, resolvedUser.principal));
  }

  return unwrapResult(await volumetric.get_my_options(resolvedUser.address));
}

async function loadWrittenOptions(
  volumetric: CanisterClients["volumetric"],
  resolvedUser: ResolvedUser,
): Promise<ActiveOption[]> {
  if (!resolvedUser.address) {
    const activeOptions = await volumetric.get_active_options();
    return activeOptions.filter((option) => isSamePrincipal(option.writer, resolvedUser.principal));
  }

  return unwrapResult(await volumetric.get_my_written_options(resolvedUser.address));
}

async function loadOffers(
  volumetric: CanisterClients["volumetric"],
  resolvedUser: ResolvedUser,
): Promise<Offer[]> {
  if (!resolvedUser.address) {
    const openOffers = await volumetric.get_open_offers();
    return openOffers.filter((offer) => isSamePrincipal(offer.writer, resolvedUser.principal));
  }

  return unwrapResult(await volumetric.get_my_offers(resolvedUser.address));
}

function filterAcceptsForPrincipal(
  entries: PendingAccept[],
  principal: Principal,
): PendingAccept[] {
  return entries.filter(
    (entry) =>
      isSamePrincipal(entry.buyer, principal) ||
      entry.offers.some((offer) => isSamePrincipal(offer.writer, principal)),
  );
}

function filterSettlementsForPrincipal(
  entries: PendingSettlement[],
  principal: Principal,
): PendingSettlement[] {
  return entries.filter(
    (entry) => isSamePrincipal(entry.buyer, principal) || isSamePrincipal(entry.writer, principal),
  );
}

function filterWithdrawalsForPrincipal(
  entries: PendingWithdrawal[],
  principal: Principal,
): PendingWithdrawal[] {
  return entries.filter((entry) => isSamePrincipal(entry.principal, principal));
}

function parsePrincipalOrNull(value: string): Principal | null {
  try {
    return Principal.fromText(value);
  } catch {
    return null;
  }
}

function isSamePrincipal(left: Principal, right: Principal): boolean {
  return left.toText() === right.toText();
}

function variantLabel(variant: Record<string, unknown>): string {
  return Object.keys(variant)[0] ?? "Unknown";
}

function eventSummary(event: Event): string {
  const dataKey = Object.keys(event.data)[0] ?? "";
  const dataValue = (event.data as Record<string, unknown>)[dataKey];
  if (!dataValue || typeof dataValue !== "object") {
    return dataKey;
  }

  return Object.entries(dataValue as Record<string, unknown>)
    .slice(0, 4)
    .map(([key, value]) => `${key}=${formatInlineValue(value)}`)
    .join(" ");
}

function formatInlineValue(value: unknown): string {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "string") {
    return value.length > 20 ? `${value.slice(0, 18)}...` : value;
  }
  if (typeof value === "number") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return `[${value.length}]`;
  }
  if (value && typeof value === "object" && "toText" in value) {
    return shortPrincipal(value as Principal);
  }

  return "...";
}

function formatSeconds(seconds: bigint): string {
  if (seconds === 0n) {
    return "unknown";
  }

  return new Date(Number(seconds) * 1000).toLocaleString();
}

function formatBasisPoints(basisPoints: number): string {
  return `${(basisPoints / 100).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}%`;
}

function shortenAddress(address: string): string {
  if (address.length <= 22) {
    return address;
  }

  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}
