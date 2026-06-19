import { V2HabitPictogram } from "@/components/habit-pictogram/V2HabitPictogram";
import { IdentityVisual } from "@/components/IdentityIconPicker";
import {
  hasV2HabitPictogram,
  isProbablyEmojiGlyph,
} from "@/lib/v2HabitPictograms";

export function HabitIconVisual({
  value,
  iconClassName = "h-5 w-5",
  textClassName = "text-lg leading-none",
  fallback = "Target",
}: {
  value?: string;
  iconClassName?: string;
  textClassName?: string;
  fallback?: string;
}) {
  const raw = (value ?? "").trim();
  if (hasV2HabitPictogram(raw) || isProbablyEmojiGlyph(raw)) {
    return <V2HabitPictogram value={raw} className={iconClassName} />;
  }

  return (
    <IdentityVisual
      name={raw}
      fallback={fallback}
      iconClassName={iconClassName}
      textClassName={textClassName}
    />
  );
}
