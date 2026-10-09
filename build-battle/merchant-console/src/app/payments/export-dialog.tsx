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

const COLUMN_LABELS: Record<string, string> = {
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

type Scope = "filtered" | "all"

/**
 * Options for the payments export: which columns and which rows. The server
 * validates both again; disabling Download here is only a convenience.
 */
export function ExportDialog({
  columns,
  defaultColumns,
  query,
  counts,
}: {
  columns: readonly string[]
  defaultColumns: readonly string[]
  /** The current filter, as a query string without the page. */
  query: string
  counts: { filtered: number; all: number }
}) {
  const [scope, setScope] = useState<Scope>("filtered")
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultColumns),
  )

  const toggle = (column: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })

  // Keep the canonical column order, whatever order they were ticked in.
  const chosen = columns.filter((column) => selected.has(column))
  const params = new URLSearchParams(scope === "filtered" ? query : "")
  params.set("scope", scope)
  params.set("columns", chosen.join(","))
  const href = `/api/payments/export?${params.toString()}`

  const scopes: { value: Scope; label: string; count: number }[] = [
    { value: "filtered", label: "Current filter", count: counts.filtered },
    { value: "all", label: "All payments", count: counts.all },
  ]
  const rowCount = scope === "filtered" ? counts.filtered : counts.all

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
      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose which payments and columns go into the CSV.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              {scopes.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="radio"
                    name="scope"
                    value={option.value}
                    checked={scope === option.value}
                    onChange={() => setScope(option.value)}
                    className="size-4 accent-blue-500"
                  />
                  <span>
                    {option.label}
                    <span className="text-gray-500">
                      {" "}
                      · {option.count.toLocaleString()} payments
                    </span>
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
              {columns.map((column) => (
                <label
                  key={column}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(column)}
                    onChange={() => toggle(column)}
                    className="size-4 accent-blue-500"
                  />
                  {COLUMN_LABELS[column] ?? column}
                </label>
              ))}
            </div>
            {chosen.length === 0 && (
              <p role="status" className="mt-3 text-sm text-gray-500">
                Choose at least one column to download.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter className="items-center gap-2">
          <p className="mr-auto text-sm text-gray-500">
            {rowCount.toLocaleString()} rows
          </p>
          <DrawerClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DrawerClose>
          {chosen.length === 0 ? (
            <Button className="gap-2 py-1.5" disabled>
              Download CSV
            </Button>
          ) : (
            <Button className="gap-2 py-1.5" asChild>
              <a href={href} download>
                Download CSV
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
