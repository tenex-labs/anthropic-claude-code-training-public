"use client"

// Dialog, modelled on Drawer.tsx: Radix Dialog with the console's styling.
// Radix moves focus in on open, returns it to the trigger on close, closes on
// Escape, and names the dialog from DialogTitle.

import * as DialogPrimitives from "@radix-ui/react-dialog"
import { RiCloseLine } from "@remixicon/react"
import * as React from "react"

import { cx, focusRing } from "@/lib/utils"

import { Button } from "./Button"

const Dialog = DialogPrimitives.Root
const DialogTrigger = DialogPrimitives.Trigger
const DialogClose = DialogPrimitives.Close

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Content>
>(({ className, ...props }, forwardedRef) => (
  <DialogPrimitives.Portal>
    <DialogPrimitives.Overlay
      className={cx(
        "fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/30 p-4",
        "data-[state=closed]:animate-hide",
      )}
    >
      <DialogPrimitives.Content
        ref={forwardedRef}
        className={cx(
          "relative flex w-full max-w-lg flex-col rounded-md border p-4 shadow-lg focus:outline-none sm:p-6",
          "border-gray-200 dark:border-gray-900",
          "bg-white dark:bg-[#090E1A]",
          "data-[state=open]:animate-slideUpAndFade",
          focusRing,
          className,
        )}
        {...props}
      />
    </DialogPrimitives.Overlay>
  </DialogPrimitives.Portal>
))
DialogContent.displayName = "DialogContent"

const DialogHeader = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className="flex items-start justify-between gap-x-4 border-b border-gray-200 pb-4 dark:border-gray-900"
    {...props}
  >
    <div className={cx("mt-1 flex flex-col gap-y-1", className)}>
      {children}
    </div>
    <DialogPrimitives.Close asChild>
      <Button
        variant="ghost"
        className="aspect-square p-1 hover:bg-gray-100 hover:dark:bg-gray-400/10"
        aria-label="Close"
      >
        <RiCloseLine className="size-6" aria-hidden="true" />
      </Button>
    </DialogPrimitives.Close>
  </div>
)
DialogHeader.displayName = "DialogHeader"

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Title>
>(({ className, ...props }, forwardedRef) => (
  <DialogPrimitives.Title
    ref={forwardedRef}
    className={cx(
      "text-base font-semibold text-gray-900 dark:text-gray-50",
      className,
    )}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Description>
>(({ className, ...props }, forwardedRef) => (
  <DialogPrimitives.Description
    ref={forwardedRef}
    className={cx("text-sm text-gray-500 dark:text-gray-500", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cx("flex-1 py-4", className)} {...props} />
)
DialogBody.displayName = "DialogBody"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cx(
      "flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-end dark:border-gray-900",
      className,
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}
