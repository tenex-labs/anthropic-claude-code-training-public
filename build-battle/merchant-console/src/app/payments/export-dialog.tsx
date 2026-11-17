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
  withCurrency,
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

/**
 * Export options for the payments table (NWP-101).
 *
 * This only builds a link. The CSV is written by `/api/payments/export`,
 * which re-validates columns and scope and reads every matching row, not
 * the page on screen.
 */
export function ExportDialog({
  filterQuery,
  counts,
}: {
  /** The page's current filter params, without `page`. */
  filterQuery: string
  counts: Record<ExportScope, number>
}) {
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("current")

  const toggle = (column: ExportColumn, checked: boolean) =>
    setColumns((current) =>
      withCurrency(
        // Keep the canonical column order whatever order boxes are ticked in.
        EXPORT_COLUMNS.filter((c) =>
          c === column ? checked : current.includes(c),
        ),
      ),
    )

  // The server adds currency to any export with amount; the dialog shows it.
  const currencyLocked = columns.includes("amount")

  const params = new URLSearchParams(scope === "current" ? filterQuery : "")
  params.set("scope", scope)
  params.set("columns", columns.join(","))
  const href = `/api/payments/export?${params.toString()}`

  const rowCount = counts[scope]
  const canDownload = columns.length > 0

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
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose what goes into the CSV before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {(
                [
                  ["current", "Current filter"],
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
                  <span className="text-gray-500 tabular-nums">
                    ({counts[value].toLocaleString()} rows)
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
                    checked={columns.includes(column)}
                    disabled={column === "currency" && currencyLocked}
                    aria-describedby={
                      column === "currency" && currencyLocked
                        ? "currency-locked-note"
                        : undefined
                    }
                    onChange={(event) => toggle(column, event.target.checked)}
                    className="size-4 accent-blue-600 disabled:opacity-60"
                  />
                  {COLUMN_LABELS[column]}
                  {column === "currency" && currencyLocked && (
                    <span id="currency-locked-note" className="text-gray-500">
                      (included with Amount)
                    </span>
                  )}
                </label>
              ))}
            </div>
            {!canDownload && (
              <p role="status" className="mt-2 text-sm text-red-600 dark:text-red-500">
                Choose at least one column to download.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter className="items-center gap-2">
          <p className="mr-auto text-sm text-gray-500" aria-live="polite">
            {rowCount.toLocaleString()} rows · {columns.length} columns
          </p>
          <DrawerClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DrawerClose>
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
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
