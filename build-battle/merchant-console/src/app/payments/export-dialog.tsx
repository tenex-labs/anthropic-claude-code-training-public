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

export function ExportDialog({
  query,
  counts,
}: {
  /** The current filters as a query string, without the page. */
  query: string
  counts: Record<ExportScope, number>
}) {
  const [columns, setColumns] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [scope, setScope] = useState<ExportScope>("filter")

  const toggle = (column: ExportColumn) =>
    setColumns((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })

  // Send in the canonical order, whatever order the boxes were ticked in.
  const selected = EXPORT_COLUMNS.filter((column) => columns.has(column))
  const params = new URLSearchParams(query)
  params.set("scope", scope)
  params.set("columns", selected.join(","))
  const href = `/api/payments/export?${params.toString()}`
  const rowCount = counts[scope]

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
            Choose what goes in the CSV. Card last four is off by default.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Scope
          </legend>
          <div className="mt-2 flex flex-col gap-2">
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
                  className="size-4 accent-blue-500"
                />
                {label}
                <span className="text-gray-500 tabular-nums">
                  ({counts[value].toLocaleString()})
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
                  checked={columns.has(column)}
                  onChange={() => toggle(column)}
                  className="size-4 accent-blue-500"
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
          </div>
        </fieldset>

        <p className="mt-6 text-sm text-gray-500" aria-live="polite">
          {selected.length === 0
            ? "Select at least one column to download."
            : `${rowCount.toLocaleString()} ${rowCount === 1 ? "payment" : "payments"} will be exported.`}
        </p>

        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          {selected.length === 0 ? (
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
