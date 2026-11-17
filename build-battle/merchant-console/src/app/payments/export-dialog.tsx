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
 * This only builds the request. The file is filtered, scoped, and serialized
 * on the server, which validates every column again; the table is paginated,
 * so a browser-built file would hold one page.
 */
export function ExportDialog({
  query,
  filteredCount,
  allCount,
}: {
  /** The page's current filter params, passed through unchanged. */
  query: string
  filteredCount: number
  allCount: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("filter")
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )

  const rowCount = scope === "all" ? allCount : filteredCount
  const columns = EXPORT_COLUMNS.filter((column) => selected.has(column))
  const canDownload = columns.length > 0

  const toggle = (column: ExportColumn) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  const download = () => {
    if (!canDownload) return
    const params = new URLSearchParams(query)
    params.delete("page")
    params.set("scope", scope)
    params.set("columns", columns.join(","))
    window.location.assign(`/api/payments/export?${params.toString()}`)
    setOpen(false)
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setScope("filter")
          setSelected(new Set(DEFAULT_EXPORT_COLUMNS))
        }
      }}
    >
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
            Choose what goes in the CSV before you send it anywhere.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
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
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    name="columns"
                    value={column}
                    checked={selected.has(column)}
                    onChange={() => toggle(column)}
                    className="mt-0.5 size-4 shrink-0 accent-blue-600"
                  />
                  <span>
                    {COLUMN_LABELS[column]}
                    {column === "last4" && (
                      <span className="block text-xs text-gray-500">
                        Off by default. Leave it off for files going to a
                        merchant.
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </DrawerBody>

        <DrawerFooter className="items-center gap-2 sm:justify-between">
          <p className="text-sm text-gray-500" aria-live="polite">
            {canDownload
              ? `${rowCount.toLocaleString()} ${rowCount === 1 ? "row" : "rows"} · ${columns.length} ${columns.length === 1 ? "column" : "columns"}`
              : "Choose at least one column"}
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <DrawerClose asChild>
              <Button variant="secondary" className="w-full sm:w-fit">
                Cancel
              </Button>
            </DrawerClose>
            <Button
              className="w-full sm:w-fit"
              disabled={!canDownload}
              onClick={download}
            >
              Download
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
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
  onSelect: (value: ExportScope) => void
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
        className="size-4 shrink-0 accent-blue-600"
      />
      <span>
        {label}{" "}
        <span className="text-gray-500">
          ({count.toLocaleString()} {count === 1 ? "payment" : "payments"})
        </span>
      </span>
    </label>
  )
}
