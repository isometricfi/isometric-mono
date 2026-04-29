import {
  Coins,
  Cube,
  Database,
  FileCode,
  GearSix,
  HandCoins,
  ListChecks,
  Scales,
  ShieldCheck,
  Stack,
  UserCircle,
  UsersThree,
  Wallet,
  WarningOctagon,
  Wrench,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { SidebarGroup } from "./components/Sidebar";
import { ConfigSnapshotPage } from "./pages/ConfigSnapshotPage";
import { ConnectionSettingsPage } from "./pages/ConnectionSettingsPage";
import { DepositAddressPage } from "./pages/DepositAddressPage";
import { EventStreamPage } from "./pages/EventStreamPage";
import { FailedOperationsPage } from "./pages/FailedOperationsPage";
import { FeeBalancePage } from "./pages/FeeBalancePage";
import { FeeReconciliationPage } from "./pages/FeeReconciliationPage";
import { OptionAuditPage } from "./pages/OptionAuditPage";
import { PendingSettlementsPage } from "./pages/PendingSettlementsPage";
import { PendingWithdrawalsPage } from "./pages/PendingWithdrawalsPage";
import { SolvencyPage } from "./pages/SolvencyPage";
import { UserBalancePage } from "./pages/UserBalancePage";
import { WalRecoveryPage } from "./pages/WalRecoveryPage";
import { WhitelistPage } from "./pages/WhitelistPage";

export type RouteDef = {
  path: string;
  label: string;
  render: () => ReactNode;
};

export const ROUTES: Record<string, RouteDef> = {
  "/solvency": {
    path: "/solvency",
    label: "Solvency",
    render: () => <SolvencyPage />,
  },
  "/fees": {
    path: "/fees",
    label: "Fee Reconciliation",
    render: () => <FeeReconciliationPage />,
  },
  "/fee-balance": {
    path: "/fee-balance",
    label: "Fee Balance",
    render: () => <FeeBalancePage />,
  },
  "/options": {
    path: "/options",
    label: "Option Audit",
    render: () => <OptionAuditPage />,
  },
  "/pending-settlements": {
    path: "/pending-settlements",
    label: "Pending Settlements",
    render: () => <PendingSettlementsPage />,
  },
  "/pending-withdrawals": {
    path: "/pending-withdrawals",
    label: "Pending Withdrawals",
    render: () => <PendingWithdrawalsPage />,
  },
  "/user-balance": {
    path: "/user-balance",
    label: "User Balance",
    render: () => <UserBalancePage />,
  },
  "/failed": {
    path: "/failed",
    label: "Failed Operations",
    render: () => <FailedOperationsPage />,
  },
  "/wal": {
    path: "/wal",
    label: "WAL Recovery",
    render: () => <WalRecoveryPage />,
  },
  "/events": {
    path: "/events",
    label: "Event Stream",
    render: () => <EventStreamPage />,
  },
  "/deposit-address": {
    path: "/deposit-address",
    label: "Deposit Address",
    render: () => <DepositAddressPage />,
  },
  "/config": {
    path: "/config",
    label: "Config Snapshot",
    render: () => <ConfigSnapshotPage />,
  },
  "/whitelist": {
    path: "/whitelist",
    label: "Whitelist & Users",
    render: () => <WhitelistPage />,
  },
  "/connection": {
    path: "/connection",
    label: "Connection Settings",
    render: () => <ConnectionSettingsPage />,
  },
};

export const ROUTE_PATHS: readonly string[] = Object.keys(ROUTES);

export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Overview",
    entries: [{ path: "/solvency", label: "Solvency", icon: Scales }],
  },
  {
    label: "Accounting",
    entries: [
      { path: "/fees", label: "Fee Reconciliation", icon: Coins },
      { path: "/fee-balance", label: "Fee Balance", icon: Wallet },
      { path: "/options", label: "Option Audit", icon: Cube },
      { path: "/pending-settlements", label: "Pending Settlements", icon: Stack },
      { path: "/pending-withdrawals", label: "Pending Withdrawals", icon: HandCoins },
      { path: "/user-balance", label: "User Balance", icon: UserCircle },
    ],
  },
  {
    label: "Operations",
    entries: [
      { path: "/failed", label: "Failed Operations", icon: WarningOctagon },
      { path: "/wal", label: "WAL Recovery", icon: Wrench },
      { path: "/events", label: "Event Stream", icon: ListChecks },
      { path: "/deposit-address", label: "Deposit Address", icon: Database },
    ],
  },
  {
    label: "Configuration",
    entries: [
      { path: "/config", label: "Config Snapshot", icon: FileCode },
      { path: "/whitelist", label: "Whitelist & Users", icon: UsersThree },
      { path: "/connection", label: "Connection Settings", icon: GearSix },
    ],
  },
];

export const CONSOLE_ICON = ShieldCheck;
