/**
 * IdentityMappingSection — "Who are you becoming?" identity cluster/verb/icon fields.
 */

import { Fingerprint } from "lucide-react";
import { cn } from "@/lib/utils";
import { IdentityIconPicker } from "@/components/IdentityIconPicker";

interface IdentityMappingSectionProps {
  isPrimaryCTA: boolean;
  ts: Record<string, string>;
  identityCluster: string;
  setIdentityCluster: (v: string) => void;
  identityVerb: string;
  setIdentityVerb: (v: string) => void;
  identityIcon: string;
  setIdentityIcon: (v: string) => void;
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
  setIdentityIcon,
  existingClusters,
}: IdentityMappingSectionProps) {
  return (
    <div
      className={cn(
        "relative mb-4 rounded-xl p-3 space-y-3",
        isPrimaryCTA ? "bg-foreground/5 border border-foreground/10" : "bg-card"
      )}
    >
      <div className="flex items-center gap-2">
        <Fingerprint className={cn("w-4 h-4", isPrimaryCTA ? "text-violet-400" : "text-primary")} />
        <p
          className={cn(
            "text-sm font-medium",
            isPrimaryCTA ? "text-slate-700 dark:text-foreground/80" : "text-foreground"
          )}
        >
          {ts.identityMapping || "Identity Mapping"}
        </p>
      </div>
      <p
        className={cn(
          "text-xs",
          isPrimaryCTA ? "text-slate-500 dark:text-foreground/60" : "text-muted-foreground"
        )}
      >
        {ts.identityMappingHint || "Optional — connect this habit to who you're becoming"}
      </p>

      {/* Cluster name */}
      <div>
        <label
          className={cn(
            "text-xs mb-1 block",
            isPrimaryCTA ? "text-slate-500 dark:text-foreground/50" : "text-muted-foreground"
          )}
        >
          {ts.identityCluster || "Cluster"}
        </label>
        <input
          type="text"
          list="identity-clusters-list"
          value={identityCluster}
          onChange={(e) => setIdentityCluster(e.target.value)}
          placeholder={ts.identityClusterPlaceholder || "e.g., The Mindful Me"}
          maxLength={40}
          className={cn(
            "w-full p-2 rounded-lg text-sm motion-safe:transition-all",
            "focus:outline-none focus:ring-2",
            isPrimaryCTA
              ? "bg-foreground/10 border border-foreground/20 text-white placeholder:text-foreground/60 focus:ring-violet-500/50"
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

      {/* Identity verb */}
      <div>
        <label
          className={cn(
            "text-xs mb-1 block",
            isPrimaryCTA ? "text-slate-500 dark:text-foreground/50" : "text-muted-foreground"
          )}
        >
          {ts.identityVerb || "Affirmation"}
        </label>
        <input
          type="text"
          value={identityVerb}
          onChange={(e) => setIdentityVerb(e.target.value)}
          placeholder={ts.identityVerbPlaceholder || "e.g., I am a meditator"}
          maxLength={60}
          className={cn(
            "w-full p-2 rounded-lg text-sm motion-safe:transition-all",
            "focus:outline-none focus:ring-2",
            isPrimaryCTA
              ? "bg-foreground/10 border border-foreground/20 text-white placeholder:text-foreground/60 focus:ring-violet-500/50"
              : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
          )}
        />
      </div>

      {/* Identity icon */}
      <div>
        <label
          className={cn(
            "text-xs mb-1.5 block",
            isPrimaryCTA ? "text-slate-500 dark:text-foreground/50" : "text-muted-foreground"
          )}
        >
          {ts.identityIcon || "Icon"}
        </label>
        <IdentityIconPicker
          value={identityIcon}
          onChange={setIdentityIcon}
          isPrimaryCTA={isPrimaryCTA}
        />
      </div>
    </div>
  );
}
