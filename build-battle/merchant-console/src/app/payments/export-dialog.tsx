"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import { Download } from "lucide-react"
import { useId, useState } from "react"

const LABELS: Record<string, string> = {
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

type Scope = "current" | "all"

/**
 * Options for the payments export. This component only builds the link: the
 * file is produced by GET /api/payments/export, which validates the columns
 * and covers every matching row rather than the page on screen.
 */
export function ExportDialog({
  columns,
  defaultColumns,
  filterQuery,
  currentCount,
  allCount,
}: {
  /** Every exportable column, in file order (the server's allowlist). */
  columns: readonly string[]
  /** Columns ticked when the dialog opens. Excludes card last four. */
  defaultColumns: readonly string[]
  /** The active filters as a query string, without page. */
  filterQuery: string
  currentCount: number
  allCount: number
}) {
  const idPrefix = useId()
  const [selected, setSelected] = useState<string[]>([...defaultColumns])
  const [scope, setScope] = useState<Scope>("current")

  const toggle = (column: string) =>
    setSelected((prev) =>
      prev.includes(column) ? prev.filter((c) => c !== column) : [...prev, column],
    )

  // Keep file order stable regardless of the order boxes were ticked in.
  const ordered = columns.filter((column) => selected.includes(column))
  const rowCount = scope === "all" ? allCount : currentCount

  const params = new URLSearchParams(scope === "all" ? "" : filterQuery)
  params.set("scope", scope)
  params.set("columns", ordered.join(","))
  const href = `/api/payments/export?${params.toString()}`

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Export payments</DialogTitle>
        <DialogDescription>
          Choose what goes in the CSV. Amounts are formatted, with the currency in
          its own column.
        </DialogDescription>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Scope
          </legend>
          <div className="mt-2 space-y-2">
            {(
              [
                ["current", "Current filter", currentCount],
                ["all", "All payments", allCount],
              ] as const
            ).map(([value, label, count]) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="radio"
                  name={`${idPrefix}-scope`}
                  value={value}
                  checked={scope === value}
                  onChange={() => setScope(value)}
                  className="size-4 accent-blue-500"
                />
                {label}
                <span className="text-gray-500">
                  ({count.toLocaleString()} {count === 1 ? "row" : "rows"})
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Columns
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {columns.map((column) => (
              <label
                key={column}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(column)}
                  onChange={() => toggle(column)}
                  className="size-4 accent-blue-500"
                />
                {LABELS[column] ?? column}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500" aria-live="polite">
            {ordered.length === 0
              ? "Choose at least one column to download."
              : `${rowCount.toLocaleString()} ${rowCount === 1 ? "row" : "rows"}, ${ordered.length} ${ordered.length === 1 ? "column" : "columns"}`}
          </p>
          {ordered.length === 0 ? (
            <Button variant="primary" disabled>
              Download CSV
            </Button>
          ) : (
            <Button variant="primary" asChild>
              <a href={href} download>
                Download CSV
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
