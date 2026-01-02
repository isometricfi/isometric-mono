"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown, PenLine, ShoppingCart, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { HistoryEntry } from "@/hooks";
import { cn, formatBtcBigint, SATS_PER_BTC } from "@/lib/utils";

const NS_PER_MS = BigInt(1_000_000);

function formatUsd(cents: bigint): string {
  const dollars = Number(cents) / 100;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(ns: bigint): string {
  const ms = Number(ns / NS_PER_MS);
  return format(new Date(ms), "dd/MM/yyyy");
}

function formatTime(ns: bigint): string {
  const ms = Number(ns / NS_PER_MS);
  return format(new Date(ms), "HH:mm ");
}

export const columns: ColumnDef<HistoryEntry>[] = [
  {
    accessorKey: "settledAt",
    header: ({ column }) => (
      <button
        type="button"
        className="flex items-center gap-1 cursor-pointer select-none"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Date
        {column.getIsSorted() === "asc" ? (
          <ArrowUp className="size-3" />
        ) : column.getIsSorted() === "desc" ? (
          <ArrowDown className="size-3" />
        ) : (
          <ArrowUpDown className="size-3 text-muted-foreground" />
        )}
      </button>
    ),
    cell: ({ row }) => (
      <div className="">
        <div className="font-mono text-xs">{formatDate(row.getValue("settledAt"))}</div>
        <div className="font-mono text-xs text-muted-foreground">
          {formatTime(row.getValue("settledAt"))}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.getValue("role") as string;
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {role === "buyer" ? (
            <>
              <ShoppingCart className="size-3" />
              <span>Buyer</span>
            </>
          ) : (
            <>
              <PenLine className="size-3" />
              <span>Writer</span>
            </>
          )}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "optionType",
    header: "Type",
    cell: () => (
      <Badge variant="secondary">
        <TrendingUp className="size-3" />
        <span>Call</span>
      </Badge>
    ),
  },
  {
    accessorKey: "quantitySats",
    header: ({ column }) => (
      <button
        type="button"
        className="flex items-center gap-1 cursor-pointer select-none"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Size
        {column.getIsSorted() === "asc" ? (
          <ArrowUp className="size-3" />
        ) : column.getIsSorted() === "desc" ? (
          <ArrowDown className="size-3" />
        ) : (
          <ArrowUpDown className="size-3 text-muted-foreground" />
        )}
      </button>
    ),
    cell: ({ row }) => (
      <span className="font-mono">₿{formatBtcBigint(row.getValue("quantitySats"), 4)}</span>
    ),
    sortingFn: (rowA, rowB) => {
      const a = rowA.getValue("quantitySats") as bigint;
      const b = rowB.getValue("quantitySats") as bigint;
      return a < b ? -1 : a > b ? 1 : 0;
    },
  },
  {
    accessorKey: "strikePriceCents",
    header: ({ column }) => (
      <button
        type="button"
        className="flex items-center gap-1 cursor-pointer select-none"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Strike
        {column.getIsSorted() === "asc" ? (
          <ArrowUp className="size-3" />
        ) : column.getIsSorted() === "desc" ? (
          <ArrowDown className="size-3" />
        ) : (
          <ArrowUpDown className="size-3 text-muted-foreground" />
        )}
      </button>
    ),
    cell: ({ row }) => (
      <span className="font-mono">{formatUsd(row.getValue("strikePriceCents"))}</span>
    ),
    sortingFn: (rowA, rowB) => {
      const a = rowA.getValue("strikePriceCents") as bigint;
      const b = rowB.getValue("strikePriceCents") as bigint;
      return a < b ? -1 : a > b ? 1 : 0;
    },
  },
  {
    accessorKey: "premiumSats",
    header: ({ column }) => (
      <button
        type="button"
        className="flex items-center gap-1 cursor-pointer select-none"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Premium
        {column.getIsSorted() === "asc" ? (
          <ArrowUp className="size-3" />
        ) : column.getIsSorted() === "desc" ? (
          <ArrowDown className="size-3" />
        ) : (
          <ArrowUpDown className="size-3 text-muted-foreground" />
        )}
      </button>
    ),
    cell: ({ row }) => (
      <span className="font-mono">₿{formatBtcBigint(row.getValue("premiumSats"), 5)}</span>
    ),
    sortingFn: (rowA, rowB) => {
      const a = rowA.getValue("premiumSats") as bigint;
      const b = rowB.getValue("premiumSats") as bigint;
      return a < b ? -1 : a > b ? 1 : 0;
    },
  },
  {
    accessorKey: "settlementPriceCents",
    header: "Settlement",
    cell: ({ row }) => (
      <span className="font-mono">{formatUsd(row.getValue("settlementPriceCents"))}</span>
    ),
  },
  {
    accessorKey: "payoutSats",
    header: ({ column }) => (
      <button
        type="button"
        className="flex items-center gap-1 cursor-pointer select-none"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Payout
        {column.getIsSorted() === "asc" ? (
          <ArrowUp className="size-3" />
        ) : column.getIsSorted() === "desc" ? (
          <ArrowDown className="size-3" />
        ) : (
          <ArrowUpDown className="size-3 text-muted-foreground" />
        )}
      </button>
    ),
    cell: ({ row }) => (
      <span className="font-mono">₿{formatBtcBigint(row.getValue("payoutSats"), 5)}</span>
    ),
    sortingFn: (rowA, rowB) => {
      const a = rowA.getValue("payoutSats") as bigint;
      const b = rowB.getValue("payoutSats") as bigint;
      return a < b ? -1 : a > b ? 1 : 0;
    },
  },
  {
    accessorKey: "pnlSats",
    header: ({ column }) => (
      <button
        type="button"
        className="flex items-center gap-1 cursor-pointer select-none"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        PnL
        {column.getIsSorted() === "asc" ? (
          <ArrowUp className="size-3" />
        ) : column.getIsSorted() === "desc" ? (
          <ArrowDown className="size-3" />
        ) : (
          <ArrowUpDown className="size-3 text-muted-foreground" />
        )}
      </button>
    ),
    cell: ({ row }) => {
      const pnlSats = row.getValue("pnlSats") as bigint;
      const pnlPercent = row.original.pnlPercent;
      const isProfit = pnlSats > BigInt(0);
      const isLoss = pnlSats < BigInt(0);

      const pnlBtc = Number(pnlSats) / SATS_PER_BTC;
      const displayBtc = Math.abs(pnlBtc).toFixed(5);

      return (
        <div className="flex flex-col">
          <span
            className={cn(
              "font-mono font-medium",
              isProfit && "text-green-500",
              isLoss && "text-red-500",
            )}
          >
            {isProfit ? "+" : isLoss ? "-" : ""}₿{displayBtc}
          </span>
          <span
            className={cn(
              "text-xs font-mono",
              isProfit && "text-green-500/70",
              isLoss && "text-red-500/70",
              !isProfit && !isLoss && "text-muted-foreground",
            )}
          >
            {isProfit ? "+" : ""}
            {pnlPercent.toFixed(1)}%
          </span>
        </div>
      );
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.getValue("pnlSats") as bigint;
      const b = rowB.getValue("pnlSats") as bigint;
      return a < b ? -1 : a > b ? 1 : 0;
    },
  },
  {
    accessorKey: "result",
    header: () => null,
    cell: () => null,
    enableHiding: false,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
];
