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
 * Builds a download link to the server export. Nothing is filtered or
 * serialized here: the route validates the columns and scope and runs the
 * query, so the file always has every matching row, not just this page.
 */
export function ExportDialog({
  columns,
  defaultColumns,
  filterQuery,
  filteredCount,
  allCount,
}: {
  columns: readonly ExportColumn[]
  defaultColumns: readonly ExportColumn[]
  /** The current filters as a query string, without page. */
  filterQuery: string
  filteredCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<ExportColumn[]>([...defaultColumns])
  const [scope, setScope] = useState<ExportScope>("filter")

  const toggle = (column: ExportColumn, checked: boolean) =>
    setSelected((current) =>
      checked ? [...current, column] : current.filter((c) => c !== column),
    )

  // Write columns in the table's order, whatever order they were ticked in.
  const ordered = columns.filter((column) => selected.includes(column))
  const rowCount = scope === "all" ? allCount : filteredCount

  const query = new URLSearchParams(scope === "filter" ? filterQuery : "")
  query.set("scope", scope)
  query.set("columns", ordered.join(","))
  const href = `/api/payments/export?${query.toString()}`

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

        <DialogBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              <ScopeOption
                value="filter"
                checked={scope === "filter"}
                onSelect={setScope}
                label="Current filter"
                count={filteredCount}
              />
              <ScopeOption
                value="all"
                checked={scope === "all"}
                onSelect={setScope}
                label="All payments"
                count={allCount}
              />
            </div>
          </fieldset>

          <fieldset>
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
                    name="columns"
                    value={column}
                    checked={selected.includes(column)}
                    onChange={(event) => toggle(column, event.target.checked)}
                    className="size-4 rounded border-gray-300 text-blue-500 dark:border-gray-700"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
          </fieldset>
        </DialogBody>

        <DialogFooter>
          <p
            className="text-sm text-gray-500 sm:mr-auto"
            role="status"
            aria-live="polite"
          >
            {ordered.length === 0
              ? "Select at least one column."
              : `${rowCount.toLocaleString()} ${rowCount === 1 ? "row" : "rows"} · ${ordered.length} ${ordered.length === 1 ? "column" : "columns"}`}
          </p>
          <DialogClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DialogClose>
          {ordered.length === 0 ? (
            <Button variant="primary" className="gap-2 py-1.5" disabled>
              Download CSV
            </Button>
          ) : (
            <Button variant="primary" className="gap-2 py-1.5" asChild>
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

function ScopeOption({
  value,
  checked,
  onSelect,
  label,
  count,
}: {
  value: ExportScope
  checked: boolean
  onSelect: (scope: ExportScope) => void
  label: string
  count: number
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <input
        type="radio"
        name="scope"
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="size-4 border-gray-300 text-blue-500 dark:border-gray-700"
      />
      {label}
      <span className="text-gray-500">
        ({count.toLocaleString()} {count === 1 ? "payment" : "payments"})
      </span>
    </label>
  )
}
