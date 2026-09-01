import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-[var(--z-sheet-overlay)] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva("fixed z-[var(--z-sheet)] flex flex-col gap-4 bg-background p-6 shadow-lg isolate", {
  variants: {
    side: {
      top: "inset-x-0 top-0 border-b",
      bottom:
        "inset-x-0 bottom-0 border-t min-h-[50dvh] will-change-transform lg:max-w-4xl lg:mx-auto lg:rounded-t-2xl",
      left: "inset-y-0 start-0 h-full w-3/4 border-e sm:max-w-sm lg:max-w-md xl:max-w-lg",
      right: "inset-y-0 end-0 h-full w-3/4 border-s sm:max-w-sm lg:max-w-md xl:max-w-lg",
    },
  },
  defaultVariants: {
    side: "right",
  },
});

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => {
  const { t } = useLanguage();
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={ref}
        style={
          side === "bottom"
            ? {
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
              }
            : undefined
        }
        className={cn(
          sheetVariants({ side }),
          "relative",
          // CSS animations - работают надёжно с Radix Portal
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:duration-300 data-[state=closed]:duration-200",
          side === "bottom" &&
            "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          side === "top" &&
            "data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
          side === "left" &&
            "data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
          side === "right" &&
            "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
          className
        )}
        {...props}
      >
        {/* Close button - absolute positioned, doesn't affect flex layout */}
        <SheetPrimitive.Close
          aria-label={t.close}
          className={cn(
            "absolute end-4 top-4 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border bg-secondary/80 p-2 text-secondary-foreground backdrop-blur-sm motion-safe:transition-all",
            "opacity-70 hover:bg-secondary hover:opacity-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:pointer-events-none"
          )}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{t.close}</span>
        </SheetPrimitive.Close>

        {/* Children rendered directly - no wrapper to interfere with flex layout */}
        {children}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
});
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-start", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
