import { useState } from "react";
import { Shield, Clock, ChevronDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LOCK_TIMEOUT_OPTIONS, setAutoLockMs } from "@/features/journal";
import { SK } from "@/lib/storageKeys";
import { safeLocalStorageGet } from "@/lib/safeJson";

function getStoredTimeoutMs(): number {
  const stored = safeLocalStorageGet<number | null>(SK.JOURNAL_LOCK_TIMEOUT, null);
  return stored !== null ? stored : 300_000; // 5 min default
}

export function SecuritySection() {
  const { t } = useLanguage();
  const [timeoutMs, setTimeoutMs] = useState(getStoredTimeoutMs);

  const handleTimeoutChange = (ms: number) => {
    setTimeoutMs(ms);
    setAutoLockMs(ms);
  };

  const tAny = t as Record<string, string>;

  return (
    <AccordionItem
      value="security"
      className="bg-card rounded-2xl shadow-zen-sm border overflow-hidden"
    >
      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 data-[state=open]:bg-primary/5">
        <div className="flex items-center gap-3">
          <div className="p-2 zen-gradient rounded-xl shadow-[0_4px_20px_-4px_hsl(160_40%_50%/0.25)]">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground">
            {tAny.settingsSecurity || "Security"}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-6">
        <p className="text-xs text-muted-foreground mb-4">
          {tAny.settingsSecurityDesc || "Configure journal lock and security preferences"}
        </p>

        {/* Journal Lock Timeout */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Clock className="w-4 h-4 text-muted-foreground" />
            {tAny.journalLockTimeout || "Journal auto-lock"}
          </div>
          <p className="text-xs text-muted-foreground">
            {tAny.journalLockTimeoutDesc || "Automatically lock journal after period of inactivity"}
          </p>
          <div className="relative">
            <select
              value={timeoutMs}
              onChange={(e) => handleTimeoutChange(Number(e.target.value))}
              className="w-full appearance-none px-4 py-3 pe-10 rounded-xl bg-background border border-border text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
            >
              {LOCK_TIMEOUT_OPTIONS.map((opt) => (
                <option key={opt.ms} value={opt.ms}>
                  {tAny[`lockTimeout_${opt.ms}`] || opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          {timeoutMs === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {tAny.journalLockImmediateWarning ||
                "Journal will lock every time you leave the diary screen"}
            </p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
