/**
 * IdentityMappingSection — optional habit-purpose fields.
 */

import { BadgeCheck, Fingerprint } from "lucide-react";
import { V2HabitPictogram } from "@/components/habit-pictogram/V2HabitPictogram";
import { cn } from "@/lib/utils";
import { IdentityVisual } from "@/components/IdentityIconPicker";

interface IdentityMappingSectionProps {
  isPrimaryCTA: boolean;
  ts: Record<string, string>;
  identityCluster: string;
  setIdentityCluster: (v: string) => void;
  identityVerb: string;
  setIdentityVerb: (v: string) => void;
  identityIcon: string;
  habitIcon: string;
  existingClusters: string[];
}

export function IdentityMappingSection({
  isPrimaryCTA,
  ts,
  identityCluster,
  setIdentityCluster,
  identityVerb,
  setIdentityVerb,
  identityIcon,
  habitIcon,
  existingClusters,
}: IdentityMappingSectionProps) {
  const clusterText = identityCluster.trim();
  const identityText = identityVerb.trim() || clusterText || ts.identityDefaultVerb;
  const displayIcon = identityIcon.trim() || habitIcon.trim() || "Sparkles";
  const votePreview = (ts.identityVoteFor || "Step toward {identity}").replace(
    "{identity}",
    identityText,
  );

  return (
    <div
      className={cn(
        "relative mb-4 overflow-hidden rounded-[20px] border p-3 space-y-4",
        isPrimaryCTA
          ? "border-[hsl(var(--zf-role-rest)/0.32)] bg-[radial-gradient(circle_at_12%_0%,hsl(var(--zf-role-rest)/0.14),transparent_34%),hsl(var(--zf-night-0)/0.36)]"
          : "border-border bg-card"
      )}
    >
      {isPrimaryCTA ? (
        <span
          className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-[hsl(var(--zf-role-rest)/0.14)] blur-2xl"
          aria-hidden="true"
        />
      ) : null}
      <div className="flex items-center gap-2">
        <Fingerprint
          className={cn(
            "w-4 h-4",
            isPrimaryCTA ? "text-[hsl(var(--zf-role-rest))]" : "text-primary",
          )}
        />
        <p
          className={cn(
            "text-sm font-medium",
            isPrimaryCTA ? "text-[hsl(var(--zf-text-strong))]" : "text-foreground",
          )}
        >
          {ts.identityMapping}
        </p>
      </div>
      <p
        className={cn(
          "text-xs",
          isPrimaryCTA ? "text-[hsl(var(--zf-text-soft))]" : "text-muted-foreground",
        )}
      >
        {ts.identityMappingHint}
      </p>

      <div
        className={cn(
          "relative rounded-[18px] border p-3",
          isPrimaryCTA
            ? "border-[hsl(var(--zf-role-rest)/0.28)] bg-[hsl(var(--zf-role-rest)/0.10)]"
            : "border-border bg-background/70",
        )}
        data-testid="identity-vote-preview"
      >
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border",
              isPrimaryCTA
                ? "border-[hsl(var(--zf-role-rest)/0.32)] bg-[hsl(var(--zf-role-rest)/0.14)] text-[hsl(var(--zf-role-rest))]"
                : "border-border bg-card text-primary",
            )}
            aria-hidden="true"
          >
            {isPrimaryCTA ? (
              <V2HabitPictogram value={displayIcon} className="h-5 w-5" />
            ) : (
              <IdentityVisual
                name={displayIcon}
                fallback="Sparkles"
                iconClassName="h-4 w-4"
                textClassName="text-base leading-none"
              />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-xs font-semibold",
                isPrimaryCTA ? "text-[hsl(var(--zf-text-strong))]" : "text-foreground",
              )}
            >
              {votePreview}
            </p>
            <p
              className={cn(
                "mt-1 whitespace-normal break-words text-xs leading-snug",
                isPrimaryCTA ? "text-[hsl(var(--zf-text-soft))]" : "text-muted-foreground",
              )}
            >
              {ts.identityVotePreview}
            </p>
          </div>
          <BadgeCheck
            className={cn(
              "mt-1 h-4 w-4 shrink-0",
              isPrimaryCTA ? "text-[hsl(var(--zf-role-energy))]" : "text-primary",
            )}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label
            className={cn(
              "text-xs mb-1 block",
              isPrimaryCTA ? "text-[hsl(var(--zf-text-soft))]" : "text-muted-foreground",
            )}
          >
            {ts.identityVerb}
          </label>
          <input
            type="text"
            value={identityVerb}
            onChange={(e) => setIdentityVerb(e.target.value)}
            placeholder={ts.identityVerbPlaceholder}
            maxLength={60}
            data-testid="identity-verb-input"
            className={cn(
              "w-full p-3 rounded-[16px] text-sm motion-safe:transition-all",
              "focus:outline-none focus:ring-2",
              isPrimaryCTA
                ? "bg-[hsl(var(--zf-role-rest)/0.12)] border border-[hsl(var(--zf-role-rest)/0.30)] text-[hsl(var(--zf-text-strong))] placeholder:text-[hsl(var(--zf-text-soft))] focus:ring-[hsl(var(--zf-role-rest)/0.62)]"
                : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
            )}
          />
        </div>

        <div>
          <label
            className={cn(
              "text-xs mb-1 block",
              isPrimaryCTA ? "text-[hsl(var(--zf-text-soft))]" : "text-muted-foreground",
            )}
          >
            {ts.identityCluster}
          </label>
          <input
            type="text"
            list="identity-clusters-list"
            value={identityCluster}
            onChange={(e) => setIdentityCluster(e.target.value)}
            placeholder={ts.identityClusterPlaceholder}
            maxLength={40}
            data-testid="identity-cluster-input"
            className={cn(
              "w-full p-3 rounded-[16px] text-sm motion-safe:transition-all",
              "focus:outline-none focus:ring-2",
              isPrimaryCTA
                ? "bg-[hsl(var(--zf-role-rest)/0.12)] border border-[hsl(var(--zf-role-rest)/0.30)] text-[hsl(var(--zf-text-strong))] placeholder:text-[hsl(var(--zf-text-soft))] focus:ring-[hsl(var(--zf-role-rest)/0.62)]"
                : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
            )}
          />
          {existingClusters.length > 0 && (
            <datalist id="identity-clusters-list">
              {existingClusters.map((c) => (
                <option key={c} value={c} aria-label={c} />
              ))}
            </datalist>
          )}
        </div>

        <p
          data-testid="identity-icon-inherited"
          className={cn(
            "rounded-[14px] border px-3 py-2 text-xs leading-snug",
            isPrimaryCTA ? "text-[hsl(var(--zf-text-soft))]" : "text-muted-foreground",
            isPrimaryCTA
              ? "border-[hsl(var(--zf-role-rest)/0.22)] bg-[hsl(var(--zf-role-rest)/0.08)]"
              : "border-border bg-background/55",
          )}
        >
          <span className="flex max-w-full items-start gap-1.5">
            {isPrimaryCTA ? (
              <V2HabitPictogram value={displayIcon} className="h-4 w-4" />
            ) : (
              <IdentityVisual
                name={displayIcon}
                fallback="Sparkles"
                iconClassName="h-3.5 w-3.5"
                textClassName="text-sm leading-none"
              />
            )}
            <span className="min-w-0 whitespace-normal break-words">{ts.identityIcon}</span>
          </span>
        </p>
      </div>
    </div>
  );
}
