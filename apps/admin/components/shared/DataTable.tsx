"use client";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  searchKey?: string;
  searchPlaceholder?: string;
  pageSize?: number;
}

export function DataTable<T>({ data, columns, searchKey, searchPlaceholder, pageSize = 20 }: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  return (
    <div className="space-y-3">
      {searchKey !== undefined && (
        <input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder={searchPlaceholder ?? "Search…"}
          className="w-full max-w-xs border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition"
        />
      )}

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={cn(
                      "text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 whitespace-nowrap select-none",
                      header.column.getCanSort() && "cursor-pointer hover:text-slate-700"
                    )}
                  >
                    <span className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && <ChevronUp size={12}/>}
                      {header.column.getIsSorted() === "desc" && <ChevronDown size={12}/>}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="flex flex-col items-center justify-center py-20">
                    <p className="text-sm font-medium text-slate-900 mb-1">No results</p>
                    <p className="text-sm text-slate-500">No entries match the current filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition last:border-0">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm text-slate-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Total: {table.getFilteredRowModel().rows.length} {table.getFilteredRowModel().rows.length !== 1 ? "rows" : "row"}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={16}/>
          </button>
          <span className="px-2 py-1 text-xs">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronRight size={16}/>
          </button>
        </div>
      </div>
    </div>
  );
}
