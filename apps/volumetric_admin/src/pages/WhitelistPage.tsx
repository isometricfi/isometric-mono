import { Button, Empty, LayerCard, Table } from "@cloudflare/kumo";
import type { Principal } from "@icp-sdk/core/principal";
import { ArrowsClockwise, UsersThree } from "@phosphor-icons/react";
import type { UserInfo } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { Eyebrow } from "../components/Eyebrow";
import { MetricCard } from "../components/MetricCard";
import { Mono } from "../components/Mono";
import { PageShell } from "../components/PageShell";
import { useCreateCanisterClients } from "../lib/clients";
import { shortPrincipal } from "../lib/format";
import { useAsyncAction } from "../lib/use-async-action";

type WhitelistData = {
  whitelist: Principal[];
  users: UserInfo[];
};

export function WhitelistPage() {
  const createClients = useCreateCanisterClients();

  const action = useAsyncAction<WhitelistData>({
    loadingStatus: "Fetching whitelist and user list...",
    successStatus: (result) =>
      `${result.whitelist.length} whitelisted, ${result.users.length} users with profiles.`,
  });

  async function runAudit() {
    await action.run(async () => {
      const { volumetric } = createClients();
      const [whitelist, users] = await Promise.all([
        volumetric.list_whitelisted().then(unwrapResult),
        volumetric.list_users().then(unwrapResult),
      ]);
      return { whitelist, users };
    });
  }

  return (
    <PageShell
      eyebrow="Configuration"
      title="Whitelist & Users"
      description="Side-by-side view of principals currently whitelisted for administrative operations and principals with registered profiles on the canister."
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
          Refresh
        </Button>
      }
    >
      {action.data ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Whitelisted" value={action.data.whitelist.length.toString()} />
            <MetricCard label="Users" value={action.data.users.length.toString()} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <LayerCard className="rounded-none border vol-hairline p-0">
              <div className="flex items-center justify-between border-b vol-hairline px-4 py-2.5">
                <Eyebrow>Whitelist</Eyebrow>
                <Eyebrow>{action.data.whitelist.length}</Eyebrow>
              </div>
              {action.data.whitelist.length === 0 ? (
                <Empty
                  size="sm"
                  title="Empty whitelist"
                  description="No principals are whitelisted."
                />
              ) : (
                <LayerCard className="p-0">
                  <Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.Head>Principal</Table.Head>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {action.data.whitelist.map((principal) => (
                        <Table.Row key={principal.toText()}>
                          <Table.Cell>
                            <Mono className="text-sm">{principal.toText()}</Mono>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
                </LayerCard>
              )}
            </LayerCard>

            <LayerCard className="rounded-none border vol-hairline p-0">
              <div className="flex items-center justify-between border-b vol-hairline px-4 py-2.5">
                <Eyebrow>Users</Eyebrow>
                <Eyebrow>{action.data.users.length}</Eyebrow>
              </div>
              {action.data.users.length === 0 ? (
                <Empty size="sm" title="No users" description="No user profiles exist yet." />
              ) : (
                <LayerCard className="p-0">
                  <Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.Head>Principal</Table.Head>
                        <Table.Head>Username</Table.Head>
                        <Table.Head>Address</Table.Head>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {action.data.users.map((user) => (
                        <Table.Row key={user.principal.toText()}>
                          <Table.Cell>
                            <Mono className="text-sm">{shortPrincipal(user.principal)}</Mono>
                          </Table.Cell>
                          <Table.Cell>
                            <Mono className="text-sm">{user.username[0] ?? "—"}</Mono>
                          </Table.Cell>
                          <Table.Cell>
                            <Mono className="text-sm">{shortenAddress(user.address)}</Mono>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
                </LayerCard>
              )}
            </LayerCard>
          </div>
        </>
      ) : (
        <Empty
          size="sm"
          icon={<UsersThree size={36} className="text-kumo-inactive" />}
          title="No data loaded"
          description="Refresh to pull the current whitelist and user registry."
        />
      )}
    </PageShell>
  );
}

function shortenAddress(address: string): string {
  if (address.length <= 22) return address;
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}
