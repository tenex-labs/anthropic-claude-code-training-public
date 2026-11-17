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
import type { ExportColumn, ExportScope } from "@/lib/csv"
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

/**
 * Options for the payments CSV export. The dialog only builds the query
 * string; the route re-validates every column and the scope, so nothing here
 * is the enforcement.
 */
export function ExportDialog({
  query,
  columns,
  defaultColumns,
  counts,
}: {
  /** The current filter query string, as on the payments page URL. */
  query: string
  /** Every exportable column, in file order. */
  columns: readonly ExportColumn[]
  defaultColumns: readonly ExportColumn[]
  counts: Record<ExportScope, number>
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("filter")
  const [selected, setSelected] = useState<ReadonlySet<ExportColumn>>(
    () => new Set(defaultColumns),
  )

  const chosen = columns.filter((column) => selected.has(column))
  const rowCount = counts[scope]

  const toggle = (column: ExportColumn, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(column)
      else next.delete(column)
      return next
    })
  }

  const params = new URLSearchParams(query)
  params.delete("page")
  params.set("scope", scope)
  params.set("columns", chosen.join(","))
  const href = `/api/payments/export?${params.toString()}`

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setScope("filter")
          setSelected(new Set(defaultColumns))
        }
      }}
    >
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
        <div className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Export payments</DialogTitle>
            <DialogDescription>
              Choose what goes into the CSV. Card last four is off unless you
              tick it.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            {(
              [
                ["filter", "Current filter"],
                ["all", "All payments"],
              ] as const
            ).map(([value, label]) => (
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
                  ({counts[value].toLocaleString()})
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                    onChange={(event) => toggle(column, event.target.checked)}
                    className="size-4 accent-blue-600"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
          </fieldset>

          <p
            className="text-sm text-gray-700 dark:text-gray-300"
            aria-live="polite"
          >
            {chosen.length === 0 ? (
              "Select at least one column to download."
            ) : (
              <>
                <span className="font-medium tabular-nums text-gray-900 dark:text-gray-50">
                  {rowCount.toLocaleString()}
                </span>{" "}
                {rowCount === 1 ? "payment" : "payments"} ·{" "}
                {chosen.length} {chosen.length === 1 ? "column" : "columns"}
              </>
            )}
          </p>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" className="py-1.5">
                Cancel
              </Button>
            </DialogClose>
            {chosen.length === 0 ? (
              <Button variant="primary" className="py-1.5" disabled>
                Download CSV
              </Button>
            ) : (
              <Button variant="primary" className="py-1.5" asChild>
                <a href={href} onClick={() => setOpen(false)}>
                  Download CSV
                </a>
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
