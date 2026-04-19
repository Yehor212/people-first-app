import type { ReactNode } from "react";
import * as HoverCard from "@radix-ui/react-hover-card";
import { cn } from "@/lib/utils";

interface HoverPreviewProps {
  trigger: ReactNode;
  content: ReactNode;
  enabled?: boolean;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
}

export function HoverPreview({
  trigger,
  content,
  enabled = true,
  side = "top",
  align = "center",
  className,
}: HoverPreviewProps) {
  if (!enabled) return <>{trigger}</>;

  return (
    <HoverCard.Root openDelay={200} closeDelay={100}>
      <HoverCard.Trigger asChild>{trigger}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side={side}
          align={align}
          sideOffset={8}
          className={cn(
            "z-[75] rounded-xl border border-border/20 bg-card/95 backdrop-blur-xl p-3 shadow-lg",
            "motion-safe:animate-in fade-in zoom-in-95 motion-safe:duration-150",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95",
            className
          )}
        >
          {content}
          <HoverCard.Arrow className="fill-card" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
