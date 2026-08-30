import { V2HabitPictogram } from "@/components/habit-pictogram/V2HabitPictogram";
import { IdentityVisual } from "@/components/IdentityIconPicker";
import {
  hasV2HabitPictogram,
  isProbablyEmojiGlyph,
} from "@/lib/v2HabitPictograms";
import type { HabitCelebrationVariant } from "@/components/habit-pictogram/habitCelebrationAssets";

export function HabitIconVisual({
  value,
  iconClassName = "h-5 w-5",
  textClassName = "text-lg leading-none",
  fallback = "Target",
  playToken,
  celebrationVariant,
}: {
  value?: string;
  iconClassName?: string;
  textClassName?: string;
  fallback?: string;
  playToken?: number;
  celebrationVariant?: HabitCelebrationVariant;
}) {
  const raw = (value ?? "").trim();
  if (hasV2HabitPictogram(raw) || isProbablyEmojiGlyph(raw)) {
    return (
      <V2HabitPictogram
        value={raw}
        className={iconClassName}
        playToken={playToken}
        celebrationVariant={celebrationVariant}
      />
    );
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
