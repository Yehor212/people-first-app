import type { ReactNode } from "react";
import * as RadixContextMenu from "@radix-ui/react-context-menu";
import { cn } from "@/lib/utils";

interface MenuItem {
  label: string;
  action: () => void;
  icon?: ReactNode;
  destructive?: boolean;
}

interface ContextMenuProps {
  trigger: ReactNode;
  items: MenuItem[];
  enabled?: boolean;
}

export function ContextMenu({ trigger, items, enabled = true }: ContextMenuProps) {
  if (!enabled) return <>{trigger}</>;

  return (
    <RadixContextMenu.Root>
      <RadixContextMenu.Trigger asChild>{trigger}</RadixContextMenu.Trigger>
      <RadixContextMenu.Portal>
        <RadixContextMenu.Content className="z-[75] min-w-[180px] rounded-xl border border-border/20 bg-card/95 backdrop-blur-xl p-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-150">
          {items.map((item, i) => (
            <RadixContextMenu.Item
              key={i}
              onSelect={item.action}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none min-h-[36px]",
                "data-[highlighted]:bg-muted transition-colors",
                item.destructive && "text-destructive"
              )}
            >
              {item.icon}
              {item.label}
            </RadixContextMenu.Item>
          ))}
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  );
}
