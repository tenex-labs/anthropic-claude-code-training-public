"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import type { ExportColumn } from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

type Scope = "filtered" | "all"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

/**
 * Export options for the payments table (NWP-101).
 *
 * This only builds the download URL. The server validates every column and
 * the scope, and builds the file from the full, unpaginated result set.
 */
export function ExportDialog({
  query,
  columns,
  defaultColumns,
  filteredCount,
  allCount,
}: {
  /** The active filters as a query string, without `page`. */
  query: string
  columns: readonly ExportColumn[]
  defaultColumns: readonly ExportColumn[]
  filteredCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(defaultColumns),
  )
  const [scope, setScope] = useState<Scope>("filtered")

  const toggle = (column: ExportColumn) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })

  // Keep the canonical column order regardless of click order.
  const chosen = columns.filter((column) => selected.has(column))
  const rowCount = scope === "all" ? allCount : filteredCount

  const params = new URLSearchParams(query)
  params.set("scope", scope)
  params.set("columns", chosen.join(","))
  const href = `/api/payments/export?${params.toString()}`

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose what goes into the CSV before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            {(
              [
                ["filtered", "Current filter", filteredCount],
                ["all", "All payments", allCount],
              ] as const
            ).map(([value, label, count]) => (
              <label
                key={value}
                htmlFor={`export-scope-${value}`}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  id={`export-scope-${value}`}
                  type="radio"
                  name="export-scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => setScope(value)}
                  className="size-4 accent-blue-600"
                />
                {label}
                <span className="tabular-nums text-gray-500">
                  ({count.toLocaleString()})
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            {columns.map((column) => (
              <label
                key={column}
                htmlFor={`export-column-${column}`}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  id={`export-column-${column}`}
                  type="checkbox"
                  checked={selected.has(column)}
                  onChange={() => toggle(column)}
                  className="size-4 rounded accent-blue-600"
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
          </fieldset>

          <p className="text-sm text-gray-500" aria-live="polite">
            {chosen.length === 0
              ? "Select at least one column to download."
              : `${rowCount.toLocaleString()} ${rowCount === 1 ? "row" : "rows"} · ${chosen.length} ${chosen.length === 1 ? "column" : "columns"}`}
          </p>
        </DrawerBody>

        <DrawerFooter className="gap-2">
          <DrawerClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DrawerClose>
          {chosen.length === 0 ? (
            <Button className="gap-2 py-1.5" disabled>
              <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
              Download CSV
            </Button>
          ) : (
            <Button className="gap-2 py-1.5" asChild>
              <a href={href}>
                <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                Download CSV
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
