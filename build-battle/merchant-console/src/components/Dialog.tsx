// Dialog, on the same Radix primitive as Drawer.
// Radix moves focus in on open, returns it on close, traps Tab, and closes on Escape.

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
>(({ className, children, ...props }, forwardedRef) => (
  <DialogPrimitives.Portal>
    <DialogPrimitives.Overlay className="fixed inset-0 z-50 bg-black/30" />
    <DialogPrimitives.Content
      ref={forwardedRef}
      className={cx(
        "fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border p-6 shadow-lg",
        "border-gray-200 dark:border-gray-900",
        "bg-white dark:bg-[#090E1A]",
        focusRing,
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitives.Close asChild>
        <Button
          variant="ghost"
          className="absolute right-3 top-3 aspect-square p-1 hover:bg-gray-100 hover:dark:bg-gray-400/10"
          aria-label="Close"
        >
          <RiCloseLine className="size-5" aria-hidden="true" />
        </Button>
      </DialogPrimitives.Close>
    </DialogPrimitives.Content>
  </DialogPrimitives.Portal>
))
DialogContent.displayName = "DialogContent"

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Title>
>(({ className, ...props }, forwardedRef) => (
  <DialogPrimitives.Title
    ref={forwardedRef}
    className={cx("text-base font-semibold text-gray-900 dark:text-gray-50", className)}
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
    className={cx("mt-1 text-sm text-gray-500", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
}
