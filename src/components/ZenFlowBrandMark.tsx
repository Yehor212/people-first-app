import { cn } from "@/lib/utils";
import zenFlowBrandMarkAssetSrc from "../../public/icon-source.svg?url";

export const zenFlowBrandMarkSrc = zenFlowBrandMarkAssetSrc;

interface ZenFlowBrandMarkProps {
  className?: string;
  imageClassName?: string;
  testId?: string;
}

export function ZenFlowBrandMark({
  className,
  imageClassName,
  testId = "zenflow-brand-logo",
}: ZenFlowBrandMarkProps) {
  return (
    <div className={cn("entry-brand-logo", className)} data-testid={testId} aria-hidden="true">
      <img
        src={zenFlowBrandMarkSrc}
        alt=""
        aria-hidden="true"
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
