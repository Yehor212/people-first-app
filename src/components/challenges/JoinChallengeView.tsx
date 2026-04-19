import { useState, useEffect, useRef } from "react";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { hapticSuccess, hapticTap, hapticWarning } from "@/lib/haptics";
import type { Translations } from "@/i18n/types";
import {
  Challenge,
  ChallengeInvite,
  joinChallenge,
  joinChallengeByCode,
} from "@/lib/friendChallenge";

export function JoinChallengeView({
  initialInvite,
  onJoined,
  onCancel,
  t,
}: {
  initialInvite?: ChallengeInvite;
  onJoined: (challenge: Challenge) => void;
  onCancel: () => void;
  t: Translations;
}) {
  const [code, setCode] = useState(initialInvite?.code || "");
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // Auto-format code as user types (add dash after ZEN)
  const handleCodeChange = (value: string) => {
    // Remove any non-alphanumeric characters except dash
    let cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, "");

    // Auto-add ZEN- prefix if user starts typing without it
    if (cleaned.length > 0 && !cleaned.startsWith("ZEN")) {
      cleaned = "ZEN-" + cleaned.replace(/-/g, "");
    }

    // Ensure dash after ZEN
    if (cleaned.startsWith("ZEN") && cleaned.length > 3 && cleaned[3] !== "-") {
      cleaned = "ZEN-" + cleaned.slice(3).replace(/-/g, "");
    }

    // Limit to ZEN-XXXXXX format
    if (cleaned.length > 10) {
      cleaned = cleaned.slice(0, 10);
    }

    setCode(cleaned);
    setError("");
  };

  const handleJoin = async () => {
    void hapticTap();
    setError("");

    // If we have full invite data, use it
    if (initialInvite && initialInvite.habitName) {
      setIsJoining(true);
      const challenge = joinChallenge(initialInvite);
      await new Promise((resolve) => setTimeout(resolve, 300));
      void hapticSuccess();
      onJoined(challenge);
      return;
    }

    // Otherwise, join by code only
    const challenge = joinChallengeByCode(code);

    if (!challenge) {
      setError(t.invalidChallengeCode || "Invalid code. Format: ZEN-XXXXXX");
      void hapticWarning();
      return;
    }

    setIsJoining(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    void hapticSuccess();
    onJoined(challenge);
  };

  const isValidCode = /^ZEN-[A-Z0-9]{6}$/.test(code);

  return (
    <div className="space-y-6 pb-8">
      {/* Header illustration */}
      <div className="text-center py-6 bg-gradient-to-b from-primary/10 to-transparent rounded-2xl">
        <div className="text-6xl mb-3">🤝</div>
        <h3 className="text-xl font-bold text-foreground">
          {t.joinChallenge || "Join Challenge"}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t.enterChallengeCode || "Enter the code from your friend"}
        </p>
      </div>

      {/* Show invite preview if we have full data */}
      {initialInvite && initialInvite.habitName && (
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-2xl">
          <div className="text-4xl">{initialInvite.habitIcon}</div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">
              {initialInvite.habitName}
            </p>
            <p className="text-sm text-muted-foreground">
              {initialInvite.duration} {t.days || "days"} •{" "}
              {initialInvite.creatorName || t.friend || "Friend"}
            </p>
          </div>
        </div>
      )}

      {/* Code input */}
      <div>
        <label
          htmlFor="challenge-code-input"
          className="text-sm font-medium text-foreground mb-2 block"
        >
          {t.challengeCode || "Challenge Code"}
        </label>
        <input
          id="challenge-code-input"
          type="text"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          placeholder="ZEN-XXXXXX"
          className={cn(
            "w-full px-4 py-4 rounded-xl border-2 text-center text-xl font-mono tracking-widest",
            "bg-card focus-visible:outline-none motion-safe:transition-colors",
            error
              ? "border-destructive focus:border-destructive"
              : isValidCode
                ? "border-[hsl(var(--mood-good))] focus:border-[hsl(var(--mood-good))]"
                : "border-border focus:border-primary",
          )}
          maxLength={10}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          disabled={!!initialInvite?.habitName}
          onFocus={(e) => {
            const el = e.target;
            scrollTimeoutRef.current = setTimeout(
              () => el.scrollIntoView({ behavior: "smooth", block: "center" }),
              300,
            );
          }}
        />
        {error && (
          <p
            className="text-sm text-destructive mt-2 text-center"
            role="status"
            aria-live="polite"
          >
            {error}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          className="h-14"
          disabled={isJoining}
        >
          {t.cancel || "Cancel"}
        </Button>

        <Button
          onClick={handleJoin}
          disabled={!isValidCode || isJoining}
          className="h-14 text-lg font-semibold"
        >
          {isJoining ? (
            <span className="motion-safe:animate-pulse">{t.joining || "Joining..."}</span>
          ) : (
            <>
              <UserPlus className="w-5 h-5 me-2" />
              {t.join || "Join"}
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        {t.joinChallengeHint ||
          "Ask your friend to share their challenge code with you"}
      </p>
    </div>
  );
}
