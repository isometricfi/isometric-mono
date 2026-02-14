import { Lock, PiggyBank, Zap } from "lucide-react";
import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { getHistoryByHash } from "@/lib/use-cases/history/get-history-by-hash/usecase";
import { formatBtcWithSymbolBigint } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://isometric.fi";
  const ogImageUrl = `${baseUrl}/api/og/${id}?locale=${locale}`;

  return {
    title: "Trading Stats | Isometric",
    description: "Check out my Bitcoin options trading performance on Isometric",
    openGraph: {
      title: "My Trading Stats on Isometric",
      description: "Bitcoin Options Trading Performance",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: "Trading Stats",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "My Trading Stats on Isometric",
      description: "Bitcoin Options Trading Performance",
      images: [ogImageUrl],
    },
  };
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const history = await getHistoryByHash(id);
  const entries = history?.entries ?? [];
  const username = history?.username ?? `User ${id}`;
  const principal = history?.principal ?? id;

  if (entries.length === 0) {
    return (
      <div className="container mx-auto py-16 max-w-2xl text-center">
        <h1 className="text-3xl font-bold mb-4">No Trading History</h1>
        <p className="text-muted-foreground mb-8">This user hasn't completed any trades yet.</p>
        <Button asChild>
          <Link href="/">Visit Isometric</Link>
        </Button>
      </div>
    );
  }

  const totalPnlSats = entries.reduce((sum, e) => sum + e.pnlSats, BigInt(0));
  const profitableTrades = entries.filter((e) => e.result === "profit").length;
  const winRate = (profitableTrades / entries.length) * 100;
  const totalVolumeSats = entries.reduce((sum, e) => sum + e.quantitySats, BigInt(0));

  const sortedEntries = [...entries].sort((a, b) => Number(a.acceptedAt - b.acceptedAt));
  const firstTrade = sortedEntries[0];
  const joinedDate = firstTrade
    ? new Date(Number(firstTrade.acceptedAt / BigInt(1_000_000))).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "New Member";

  return (
    <div className="container mx-auto md:py-5 py-4 max-w-2xl">
      <div className=" space-y-3 mb-8 border-b pb-3">
        <div className="flex items-center gap-4 justify-center pb-6 border-b">
          <Avatar seed={principal} width={48} height={48} />
          <div>
            <p className="text-xl font-semibold">{username}</p>
            <p className="text-sm text-muted-foreground">Joined {joinedDate}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 ">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total P&L</p>
            <p className="text-xl font-bold">{formatBtcWithSymbolBigint(totalPnlSats, 6)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Win Rate</p>
            <p className="text-xl font-bold">{winRate.toFixed(1)}%</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Volume</p>
            <p className="text-xl font-bold">{formatBtcWithSymbolBigint(totalVolumeSats, 5)}</p>
          </div>
          <div className="text-center ">
            <p className="text-sm text-muted-foreground">Trades</p>
            <p className="text-xl font-bold  ">{entries.length}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex md:flex-col items-center gap-3 md:text-center p-4 rounded-xl bg-muted/50">
            <div className="size-12! min-w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="size-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Leverage</p>
              <p className="text-sm text-muted-foreground">Up to 100x on price movements</p>
            </div>
          </div>

          <div className="flex md:flex-col items-center gap-3 md:text-center p-4 rounded-xl bg-green-500/10">
            <div className="size-12! min-w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <PiggyBank className="size-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-semibold">Earn Yield</p>
              <p className="text-sm text-muted-foreground">Generate income on your BTC holdings</p>
            </div>
          </div>

          <div className="flex md:flex-col items-center gap-3 md:text-center p-4 rounded-xl bg-muted/50">
            <div className="size-12! min-w-12 rounded-xl bg-muted flex items-center justify-center">
              <Lock className="size-6 text-foreground" />
            </div>
            <div>
              <p className="font-semibold">Fully On-Chain</p>
              <p className="text-sm text-muted-foreground">Trustless, self-custodial trading</p>
            </div>
          </div>
        </div>

        <Button asChild size="lg" className="w-full">
          <Link href="/write">Open App</Link>
        </Button>
      </div>
    </div>
  );
}
