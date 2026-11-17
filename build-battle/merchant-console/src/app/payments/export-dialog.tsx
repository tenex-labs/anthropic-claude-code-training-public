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
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  ExportScope,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

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

const inputClass =
  "size-4 shrink-0 border-gray-300 text-blue-500 accent-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-700"

/**
 * Export options for the payments table (NWP-101). The file itself is built
 * by GET /api/payments/export, which validates everything chosen here.
 */
export function ExportDialog({
  filterQuery,
  filteredCount,
  allCount,
}: {
  /** The table's current filters as a query string, without the page. */
  filterQuery: string
  filteredCount: number
  allCount: number
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("filtered")

  // Keep the canonical column order whatever order boxes were ticked in.
  const columns = EXPORT_COLUMNS.filter((column) => selected.includes(column))
  const rowCount = scope === "all" ? allCount : filteredCount

  const toggle = (column: ExportColumn, checked: boolean) =>
    setSelected((current) =>
      checked
        ? [...current, column]
        : current.filter((existing) => existing !== column),
    )

  const params = new URLSearchParams(filterQuery)
  params.set("columns", columns.join(","))
  params.set("scope", scope)
  const href = `/api/payments/export?${params.toString()}`

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose what goes in the CSV before you download it.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              {(
                [
                  ["filtered", "Current filter", filteredCount],
                  ["all", "All payments", allCount],
                ] as const
              ).map(([value, label, count]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="radio"
                    name="export-scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className={inputClass}
                  />
                  <span>{label}</span>
                  <span className="text-gray-500 tabular-nums">
                    {count.toLocaleString()} payments
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    name="export-columns"
                    value={column}
                    checked={selected.includes(column)}
                    onChange={(event) => toggle(column, event.target.checked)}
                    className={inputClass}
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
          </fieldset>

          <p
            className="text-sm text-gray-500"
            role="status"
            aria-live="polite"
          >
            {columns.length === 0
              ? "Select at least one column to download."
              : `${rowCount.toLocaleString()} rows, ${columns.length} ${
                  columns.length === 1 ? "column" : "columns"
                }.`}
          </p>
        </DrawerBody>
        <DrawerFooter className="gap-2 sm:gap-0">
          <DrawerClose asChild>
            <Button variant="secondary" className="w-full sm:w-fit">
              Cancel
            </Button>
          </DrawerClose>
          {columns.length === 0 ? (
            <Button variant="primary" className="w-full sm:w-fit" disabled>
              Download CSV
            </Button>
          ) : (
            <Button variant="primary" className="w-full sm:w-fit" asChild>
              <a href={href} onClick={() => setOpen(false)}>
                Download CSV
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
