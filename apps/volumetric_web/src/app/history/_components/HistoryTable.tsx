"use client";

import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useHistory } from "@/hooks";
import { columns } from "./columns";

const PAGE_SIZE = 25;

export function HistoryTable() {
  const { data: history, isLoading } = useHistory();
  const [sorting, setSorting] = useState<SortingState>([{ id: "settledAt", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [moneyStatusFilter, setMoneyStatusFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all");

  const table = useReactTable({
    data: history?.entries ?? [],
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: {
        pageSize: PAGE_SIZE,
      },
    },
    state: {
      sorting,
      columnFilters,
    },
  });

  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value);
    if (value === "all") {
      table.getColumn("role")?.setFilterValue(undefined);
    } else {
      table.getColumn("role")?.setFilterValue([value]);
    }
  };

  const handleMoneyStatusFilterChange = (value: string) => {
    setMoneyStatusFilter(value);
    if (value === "all") {
      table.getColumn("moneyStatus")?.setFilterValue(undefined);
    } else {
      table.getColumn("moneyStatus")?.setFilterValue([value]);
    }
  };

  const handleResultFilterChange = (value: string) => {
    setResultFilter(value);
    if (value === "all") {
      table.getColumn("result")?.setFilterValue(undefined);
    } else {
      table.getColumn("result")?.setFilterValue([value]);
    }
  };

  const clearFilters = () => {
    setRoleFilter("all");
    setMoneyStatusFilter("all");
    setResultFilter("all");
    setColumnFilters([]);
  };

  const hasActiveFilters =
    roleFilter !== "all" || moneyStatusFilter !== "all" || resultFilter !== "all";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-[400px] w-full rounded-lg" />
      </div>
    );
  }

  if (!history?.entries.length) {
    return (
      <div className="flex justify-center">
        <div className="text-center space-y-3 border rounded-xl p-8 max-w-lg w-full">
          <p className="text-lg">No trading history yet</p>
          <p className="text-sm text-muted-foreground">Your completed trades will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={roleFilter} onValueChange={handleRoleFilterChange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="buyer">Buyer</SelectItem>
            <SelectItem value="writer">Writer</SelectItem>
          </SelectContent>
        </Select>

        <Select value={moneyStatusFilter} onValueChange={handleMoneyStatusFilterChange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="itm">ITM</SelectItem>
            <SelectItem value="otm">OTM</SelectItem>
            <SelectItem value="atm">ATM</SelectItem>
          </SelectContent>
        </Select>

        <Select value={resultFilter} onValueChange={handleResultFilterChange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Result" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Results</SelectItem>
            <SelectItem value="profit">Profit</SelectItem>
            <SelectItem value="loss">Loss</SelectItem>
            <SelectItem value="breakeven">Breakeven</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
            <X className="size-4 mr-1" />
            Clear filters
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="text-muted-foreground">
            {table.getFilteredRowModel().rows.length} trades
          </Badge>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
