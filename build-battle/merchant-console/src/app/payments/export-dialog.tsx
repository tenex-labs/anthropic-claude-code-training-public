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

/**
 * Export options for the payments table (NWP-101).
 *
 * Only builds the URL. Validation, scope, and the rows themselves are the
 * route handler's job, so the file always holds every matching payment rather
 * than the page on screen.
 */
export function ExportDialog({
  query,
  filteredCount,
  totalCount,
}: {
  /** The current filter params, as the table uses them. */
  query: string
  filteredCount: number
  totalCount: number
}) {
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("filtered")

  const toggle = (column: ExportColumn) =>
    setColumns((current) =>
      current.includes(column)
        ? current.filter((c) => c !== column)
        : // Keep the table's column order regardless of click order.
          EXPORT_COLUMNS.filter((c) => c === column || current.includes(c)),
    )

  const rowCount = scope === "all" ? totalCount : filteredCount
  const params = new URLSearchParams(scope === "all" ? "" : query)
  params.delete("page")
  params.set("scope", scope)
  params.set("columns", columns.join(","))
  const href = `/api/payments/export?${params.toString()}`
  const canDownload = columns.length > 0

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button
          variant="secondary"
          className="w-full gap-2 py-1.5 sm:w-fit"
          data-auto="payments-export-open"
        >
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose what goes into the CSV file.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6 py-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {(
                [
                  ["filtered", "Current filter", filteredCount],
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
                    data-auto={`payments-export-scope-${value}`}
                  />
                  {label}
                  <span className="text-gray-500 tabular-nums">
                    ({count.toLocaleString()})
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={columns.includes(column)}
                    onChange={() => toggle(column)}
                    data-auto={`payments-export-column-${column}`}
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
          </fieldset>

          <p
            className="text-sm text-gray-500"
            aria-live="polite"
            data-auto="payments-export-summary"
          >
            {canDownload
              ? `${rowCount.toLocaleString()} ${rowCount === 1 ? "payment" : "payments"} will be exported.`
              : "Choose at least one column to export."}
          </p>
        </DrawerBody>

        <DrawerFooter className="gap-2">
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          {canDownload ? (
            <Button asChild data-auto="payments-export-download">
              <a href={href} download>
                Download
              </a>
            </Button>
          ) : (
            <Button disabled data-auto="payments-export-download">
              Download
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
