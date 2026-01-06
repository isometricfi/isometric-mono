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
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import { getColumns } from "./columns";

const PAGE_SIZE = 15;

export function HistoryTable() {
  const { data: history, isLoading } = useHistory();
  const t = useTranslations("History");
  const tCommon = useTranslations("Common");
  const columns = getColumns(t);
  const [sorting, setSorting] = useState<SortingState>([{ id: "settledAt", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const filteredData = useMemo(() => {
    const entries = history?.entries ?? [];
    if (!dateRange?.from) return entries;

    const fromTime = dateRange.from.getTime();
    const toTime = dateRange.to ? dateRange.to.getTime() + 86400000 : fromTime + 86400000;

    return entries.filter((entry) => {
      const entryMs = Number(entry.settledAt / BigInt(1_000_000));
      return entryMs >= fromTime && entryMs <= toTime;
    });
  }, [history?.entries, dateRange]);

  const table = useReactTable({
    data: filteredData,
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
    setResultFilter("all");
    setDateRange(undefined);
    setColumnFilters([]);
  };

  const hasActiveFilters =
    roleFilter !== "all" || resultFilter !== "all" || dateRange !== undefined;

  if (isLoading) {
    return (
      <div className="space-y-4 w-full max-w-5xl">
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
          <p className="text-lg">{t("noHistory")}</p>
          <p className="text-sm text-muted-foreground">{t("completedTradesWillAppear")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4  w-full  ">
      <div className="flex flex-wrap gap-2 items-center">
        <Popover>
          <PopoverTrigger asChild className="md:flex hidden">
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal h-9 px-3",
                !dateRange && "text-muted-foreground",
              )}
            >
              <CalendarIcon className=" size-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                  </>
                ) : (
                  format(dateRange.from, "dd/MM/yy")
                )
              ) : (
                <span>{t("dateRange")}</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <Select value={roleFilter} onValueChange={handleRoleFilterChange}>
          <SelectTrigger className=" h-9 md:flex hidden">
            <SelectValue placeholder={t("role")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allRoles")}</SelectItem>
            <SelectItem value="buyer">{t("buyer")}</SelectItem>
            <SelectItem value="writer">{t("writer")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={resultFilter} onValueChange={handleResultFilterChange}>
          <SelectTrigger className=" h-9 md:flex hidden">
            <SelectValue placeholder={t("result")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allResults")}</SelectItem>
            <SelectItem value="profit">{t("profit")}</SelectItem>
            <SelectItem value="loss">{t("loss")}</SelectItem>
            <SelectItem value="breakeven">{t("breakeven")}</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2">
            <X className="size-4 mr-1" />
            {tCommon("clear")}
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="text-muted-foreground font-normal">
            {table.getFilteredRowModel().rows.length} {t("trades")}
          </Badge>
        </div>
      </div>

      <div className="rounded-[8px] border overflow-hidden">
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
                  {t("noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {t("page", {
              current: table.getState().pagination.pageIndex + 1,
              total: table.getPageCount(),
            })}
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
