"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
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
  created_at: "Created at (UTC)",
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
 * Export options for the payments table (NWP-101). The server validates the
 * columns and scope again; the choices here are only a convenience.
 */
export function ExportDialog({
  query,
  filteredCount,
  totalCount,
}: {
  /** The active filters, as the URL carries them. */
  query: string
  /** Rows the current filter matches, across every page. */
  filteredCount: number
  /** Every payment, ignoring filters. */
  totalCount: number
}) {
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("current")

  const toggle = (column: ExportColumn, checked: boolean) => {
    // Keep the canonical column order whatever order boxes are ticked in.
    setColumns((current) =>
      EXPORT_COLUMNS.filter((c) =>
        c === column ? checked : current.includes(c),
      ),
    )
  }

  const rowCount = scope === "all" ? totalCount : filteredCount
  const params = new URLSearchParams(query)
  params.delete("page")
  params.set("scope", scope)
  params.set("columns", columns.join(","))
  const href = `/api/payments/export?${params.toString()}`
  const canDownload = columns.length > 0

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
        <DialogHeader>
          <DialogTitle>Export payments</DialogTitle>
          <DialogDescription>
            Choose what goes into the CSV. Card last four is off by default.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Scope
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            {(
              [
                ["current", "Current filter", filteredCount],
                ["all", "All payments", totalCount],
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
                  className="size-4 accent-blue-600"
                />
                {label}
                <span className="text-gray-500 tabular-nums">
                  ({count.toLocaleString()} rows)
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
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
                  checked={columns.includes(column)}
                  onChange={(event) => toggle(column, event.target.checked)}
                  className="size-4 accent-blue-600"
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
          </div>
        </fieldset>

        <p
          className="mt-6 text-sm text-gray-500"
          role="status"
          aria-live="polite"
        >
          {canDownload
            ? `${rowCount.toLocaleString()} rows, ${columns.length} columns`
            : "Select at least one column to download."}
        </p>

        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DialogClose>
          {canDownload ? (
            <Button className="gap-2 py-1.5" asChild>
              <a href={href} download>
                <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                Download CSV
              </a>
            </Button>
          ) : (
            <Button className="gap-2 py-1.5" disabled>
              <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
              Download CSV
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
