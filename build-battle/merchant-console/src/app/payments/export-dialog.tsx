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
import { Download } from "lucide-react"
import { useState } from "react"

const LABELS: Record<string, string> = {
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

type Scope = "filter" | "all"

const inputClass =
  "size-4 shrink-0 accent-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"

/**
 * Options for the payments export. This only builds a link: the route handler
 * validates the columns and scope and produces the file, so the export covers
 * every matching row rather than the page on screen.
 */
export function ExportDialog({
  columns,
  defaultColumns,
  filteredCount,
  allCount,
  query,
}: {
  columns: readonly string[]
  defaultColumns: readonly string[]
  filteredCount: number
  allCount: number
  /** The current filter query string, without `page`. */
  query: string
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([...defaultColumns])
  const [scope, setScope] = useState<Scope>("filter")

  const toggle = (column: string, checked: boolean) => {
    setSelected((current) =>
      checked ? [...current, column] : current.filter((c) => c !== column),
    )
  }

  // Keep the file's column order stable regardless of the order boxes were ticked.
  const ordered = columns.filter((column) => selected.includes(column))
  const rowCount = scope === "all" ? allCount : filteredCount

  const params = new URLSearchParams(query)
  params.set("scope", scope)
  params.set("columns", ordered.join(","))
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
            Choose what goes in the CSV file. Card last four is left out unless
            you add it.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Scope
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                value="filter"
                checked={scope === "filter"}
                onChange={() => setScope("filter")}
                className={inputClass}
              />
              Current filter
              <span className="tabular-nums text-gray-500">
                ({filteredCount.toLocaleString("en-US")} payments)
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                value="all"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className={inputClass}
              />
              All payments
              <span className="tabular-nums text-gray-500">
                ({allCount.toLocaleString("en-US")} payments)
              </span>
            </label>
          </div>
        </fieldset>

        <fieldset className="mt-6">
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
                  name="export-columns"
                  value={column}
                  checked={selected.includes(column)}
                  onChange={(event) => toggle(column, event.target.checked)}
                  className={inputClass}
                />
                {LABELS[column] ?? column}
              </label>
            ))}
          </div>
        </fieldset>

        <p
          className="mt-6 text-sm text-gray-500"
          role="status"
          aria-live="polite"
        >
          {ordered.length === 0
            ? "Select at least one column to download."
            : `${rowCount.toLocaleString("en-US")} rows, ${ordered.length} of ${columns.length} columns.`}
        </p>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          {ordered.length === 0 ? (
            <Button disabled>Download</Button>
          ) : (
            <Button asChild>
              <a href={href} onClick={() => setOpen(false)}>
                Download
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
