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

const controlClass =
  "size-4 shrink-0 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950"

/**
 * Options for the payments export. The file itself is built by
 * `GET /api/payments/export`, which validates everything chosen here; this
 * component only assembles the link.
 */
export function ExportDialog({
  columns,
  defaultColumns,
  filterQuery,
  filteredTotal,
  allTotal,
}: {
  /** The server's column allowlist, in file order. */
  columns: readonly string[]
  defaultColumns: readonly string[]
  /** The active filters as a query string, without paging. */
  filterQuery: string
  filteredTotal: number
  allTotal: number
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([...defaultColumns])
  const [scope, setScope] = useState<Scope>("filter")

  const toggle = (column: string) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((c) => c !== column)
        : [...current, column],
    )

  // Keep file order stable no matter the order boxes were ticked in.
  const ordered = columns.filter((column) => selected.includes(column))
  const rowCount = scope === "all" ? allTotal : filteredTotal
  const nothingSelected = ordered.length === 0

  const query = new URLSearchParams(filterQuery)
  query.set("scope", scope)
  query.set("columns", ordered.join(","))
  const href = `/api/payments/export?${query.toString()}`

  const scopes: { value: Scope; label: string; total: number }[] = [
    { value: "filter", label: "Current filter", total: filteredTotal },
    { value: "all", label: "All payments", total: allTotal },
  ]

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
          <DrawerDescription className="text-sm">
            Choose what goes into the CSV file.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="space-y-8">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-3 space-y-2">
              {scopes.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="radio"
                    name="export-scope"
                    value={option.value}
                    checked={scope === option.value}
                    onChange={() => setScope(option.value)}
                    className={`${controlClass} rounded-full`}
                  />
                  <span>{option.label}</span>
                  <span className="tabular-nums text-gray-500">
                    {option.total.toLocaleString()}{" "}
                    {option.total === 1 ? "payment" : "payments"}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {columns.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(column)}
                    onChange={() => toggle(column)}
                    className={`${controlClass} rounded`}
                  />
                  {LABELS[column] ?? column}
                </label>
              ))}
            </div>
          </fieldset>

          <p
            role="status"
            className="text-sm text-gray-500"
          >
            {nothingSelected
              ? "Select at least one column to download."
              : rowCount === 0
                ? "No payments match, so the file will contain only the header row."
                : `${rowCount.toLocaleString()} ${rowCount === 1 ? "row" : "rows"}, ${ordered.length} ${ordered.length === 1 ? "column" : "columns"}.`}
          </p>
        </DrawerBody>
        <DrawerFooter className="gap-2 sm:gap-0">
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          {nothingSelected ? (
            <Button disabled>Download</Button>
          ) : (
            <Button asChild>
              <a href={href} download onClick={() => setOpen(false)}>
                Download
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
