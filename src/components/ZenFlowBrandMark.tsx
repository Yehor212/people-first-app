import { cn } from "@/lib/utils";
import { BASE_URL } from "@/lib/env";

export const zenFlowBrandMarkSrc = `${BASE_URL}icon-source.svg`;

interface ZenFlowBrandMarkProps {
  className?: string;
  imageClassName?: string;
  label?: string;
  testId?: string;
}

export function ZenFlowBrandMark({
  className,
  imageClassName,
  label = "ZenFlow",
  testId = "zenflow-brand-logo",
}: ZenFlowBrandMarkProps) {
  return (
    <div className={cn("entry-brand-logo", className)} data-testid={testId}>
      <img
        src={zenFlowBrandMarkSrc}
        alt={label}
        draggable={false}
        width={512}
        height={512}
        decoding="async"
        loading="eager"
        className={cn("h-full w-full rounded-[inherit] object-cover", imageClassName)}
        data-testid={`${testId}-image`}
      />
    </div>
  );
}
