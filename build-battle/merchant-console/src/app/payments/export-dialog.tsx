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

const formatCount = (count: number) => count.toLocaleString("en-US")

/**
 * Options for the payments CSV export. The server builds the file and
 * enforces every choice; this only collects them and links to the route.
 */
export function ExportDialog({
  filterQuery,
  filteredCount,
  allCount,
}: {
  /** The page's filter parameters, without `page`. */
  filterQuery: string
  filteredCount: number
  allCount: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("filtered")
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])

  // Every export starts from the safe defaults, so the last four is never
  // carried over from the previous file.
  const onOpenChange = (next: boolean) => {
    if (next) {
      setScope("filtered")
      setColumns([...DEFAULT_EXPORT_COLUMNS])
    }
    setOpen(next)
  }

  const toggle = (column: ExportColumn) =>
    setColumns((current) =>
      EXPORT_COLUMNS.filter((c) =>
        c === column ? !current.includes(c) : current.includes(c),
      ),
    )

  const rowCount = scope === "all" ? allCount : filteredCount
  const query = new URLSearchParams(filterQuery)
  query.set("scope", scope)
  query.set("columns", columns.join(","))
  const href = `/api/payments/export?${query.toString()}`

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
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
            Choose which payments and columns go into the CSV file.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Payments
            </legend>
            {(
              [
                ["filtered", "Current filter", filteredCount],
                ["all", "All payments", allCount],
              ] as const
            ).map(([value, label, count]) => (
              <label
                key={value}
                className="flex items-center gap-3 text-sm text-gray-900 dark:text-gray-50"
              >
                <input
                  type="radio"
                  name="export-scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => setScope(value)}
                  className="size-4 accent-blue-600"
                />
                <span className="flex-1">{label}</span>
                <span className="tabular-nums text-gray-500">
                  {formatCount(count)} {count === 1 ? "payment" : "payments"}
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-3 text-sm text-gray-900 dark:text-gray-50"
                >
                  <input
                    type="checkbox"
                    name="export-columns"
                    value={column}
                    checked={columns.includes(column)}
                    onChange={() => toggle(column)}
                    className="size-4 accent-blue-600"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Card last four is off by default. Leave it off for files that go
              to a merchant.
            </p>
          </fieldset>

          <p
            id="export-summary"
            aria-live="polite"
            className="text-sm text-gray-700 dark:text-gray-300"
          >
            {columns.length === 0
              ? "Choose at least one column to download."
              : rowCount === 0
                ? "No payments match the current filter. The file will contain only the header row."
                : `${formatCount(rowCount)} ${rowCount === 1 ? "row" : "rows"}, ${columns.length} ${columns.length === 1 ? "column" : "columns"}.`}
          </p>
        </DrawerBody>

        <DrawerFooter className="gap-2 sm:gap-0">
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          {columns.length === 0 ? (
            <Button disabled aria-describedby="export-summary">
              Download
            </Button>
          ) : (
            <Button asChild>
              <a
                href={href}
                download
                aria-describedby="export-summary"
                onClick={() => setOpen(false)}
              >
                Download
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
