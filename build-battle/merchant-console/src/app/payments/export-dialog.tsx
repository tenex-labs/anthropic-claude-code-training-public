"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
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

const count = (n: number, noun: string) =>
  `${n.toLocaleString()} ${noun}${n === 1 ? "" : "s"}`

/**
 * Export options for the payments table (NWP-101).
 *
 * This only builds the request. The route validates the columns and scope
 * again and does the export on the server, so the file holds every matching
 * row rather than the page on screen.
 */
export function ExportDialog({
  filterQuery,
  counts,
}: {
  /** The payments filters currently applied, as a query string. */
  filterQuery: string
  /** Rows each scope will export, from the same query builder as the route. */
  counts: Record<ExportScope, number>
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("filter")
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])

  // Keep the table's column order however the boxes were ticked.
  const columns = EXPORT_COLUMNS.filter((column) => selected.includes(column))
  const rowCount = counts[scope]

  const toggle = (column: ExportColumn, checked: boolean) =>
    setSelected((current) =>
      checked
        ? [...current, column]
        : current.filter((existing) => existing !== column),
    )

  const params = new URLSearchParams(scope === "filter" ? filterQuery : "")
  params.set("scope", scope)
  params.set("columns", columns.join(","))
  const href = `/api/payments/export?${params.toString()}`

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
        <DialogHeader>
          <DialogTitle>Export payments</DialogTitle>
          <DialogDescription>
            Choose what goes in the CSV. Card last four is off by default.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              {(
                [
                  ["filter", "Current filter"],
                  ["all", "All payments"],
                ] as const
              ).map(([value, label]) => (
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
                    className="size-4 accent-blue-600"
                  />
                  {label}
                  <span className="tabular-nums text-gray-500">
                    ({count(counts[value], "row")})
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <div className="flex items-center justify-between">
              <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
                Columns
              </legend>
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  className="text-blue-600 hover:underline dark:text-blue-500"
                  onClick={() => setSelected([...EXPORT_COLUMNS])}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="text-blue-600 hover:underline dark:text-blue-500"
                  onClick={() => setSelected([])}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(column)}
                    onChange={(event) => toggle(column, event.target.checked)}
                    className="size-4 rounded accent-blue-600"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
          </fieldset>
        </DialogBody>

        <DialogFooter>
          <p
            className="order-last text-sm text-gray-500 sm:order-none sm:mr-auto"
            aria-live="polite"
          >
            {columns.length === 0
              ? "Choose at least one column."
              : `${count(rowCount, "row")} · ${count(columns.length, "column")}`}
          </p>
          <DialogClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DialogClose>
          {columns.length === 0 ? (
            <Button variant="primary" className="py-1.5" disabled>
              Download
            </Button>
          ) : (
            <Button variant="primary" className="py-1.5" asChild>
              <a href={href} download onClick={() => setOpen(false)}>
                Download
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
