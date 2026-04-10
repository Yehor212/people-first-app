import { useState, useCallback, type ReactNode, type DragEvent } from "react";
import { cn } from "@/lib/utils";

interface DragHandleProps {
  draggable: true;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: (e: DragEvent) => void;
}

interface DragDropZoneProps {
  items: string[];
  onReorder: (newOrder: string[]) => void;
  renderItem: (id: string, dragHandleProps: DragHandleProps) => ReactNode;
  enabled?: boolean;
  className?: string;
}

export function DragDropZone({
  items,
  onReorder,
  renderItem,
  enabled = true,
  className,
}: DragDropZoneProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const handleDragStart = useCallback((e: DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setOverId(null);
  }, []);

  const handleDragOver = useCallback((e: DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverId(id);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent, targetId: string) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData("text/plain");
      if (!sourceId || sourceId === targetId) return;

      const newOrder = [...items];
      const fromIndex = newOrder.indexOf(sourceId);
      const toIndex = newOrder.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) return;

      newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, sourceId);
      onReorder(newOrder);
      setDraggedId(null);
      setOverId(null);
    },
    [items, onReorder]
  );

  if (!enabled) {
    return (
      <div className={className}>
        {items.map((id) =>
          renderItem(id, {
            draggable: true,
            onDragStart: () => undefined,
            onDragEnd: () => undefined,
          })
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {items.map((id) => (
        <div
          key={id}
          onDragOver={(e) => handleDragOver(e, id)}
          onDrop={(e) => handleDrop(e, id)}
          onDragLeave={() => setOverId(null)}
          className={cn(
            "transition-all duration-150",
            draggedId === id && "opacity-50",
            overId === id && draggedId !== id && "ring-2 ring-primary rounded-xl"
          )}
        >
          {renderItem(id, {
            draggable: true,
            onDragStart: (e) => handleDragStart(e, id),
            onDragEnd: handleDragEnd,
          })}
        </div>
      ))}
    </div>
  );
}

interface FileDropZoneProps {
  children: ReactNode;
  onFilesDropped: (files: File[]) => void;
  accept?: string;
  enabled?: boolean;
  className?: string;
}

export function FileDropZone({
  children,
  onFilesDropped,
  accept = "image/*",
  enabled = true,
  className,
}: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!enabled) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    },
    [enabled]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!enabled) return;
      e.preventDefault();
      setIsDragOver(false);
      const acceptType = accept.replace("/*", "/");
      const files = Array.from(e.dataTransfer?.files || []).filter((f) =>
        f.type.startsWith(acceptType)
      );
      if (files.length > 0) onFilesDropped(files);
    },
    [enabled, accept, onFilesDropped]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "transition-all duration-150",
        isDragOver && "ring-2 ring-primary ring-dashed bg-primary/5 rounded-xl",
        className
      )}
    >
      {children}
    </div>
  );
}
