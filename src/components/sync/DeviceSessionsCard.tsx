import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Laptop,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  TabletSmartphone,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import {
  DEVICE_SESSIONS_UPDATED_EVENT,
  getCurrentDeviceSessionId,
  listDeviceSessions,
  revokeDeviceSession,
  upsertCurrentDeviceSession,
  type DeviceSession,
  type DeviceSessionPlatform,
} from "@/storage/deviceSessions";

interface DeviceSessionsCardProps {
  dense?: boolean;
  surface?: "default" | "settings";
}

const DEVICE_SESSIONS_SURFACE_CLASS: Record<
  NonNullable<DeviceSessionsCardProps["surface"]>,
  string
> = {
  default: "border-border bg-card",
  settings: "border-[hsl(var(--zf-role-settings)/0.24)] bg-[hsl(var(--card)/0.76)]",
};

function interpolateValue(template: string, value: string): string {
  return template.replace("{value}", value);
}

export function formatDeviceLastActivity(
  value: string,
  locale: string,
  template: string,
  unknownLabel: string,
  nowMs = Date.now(),
): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return interpolateValue(template, unknownLabel);

  const diffMs = timestamp - nowMs;
  const absDiffMs = Math.abs(diffMs);

  try {
    if (absDiffMs < 7 * 24 * 60 * 60_000) {
      const relative = new Intl.RelativeTimeFormat(locale, {
        numeric: "auto",
        style: "long",
      });

      if (absDiffMs < 60_000) {
        return interpolateValue(template, relative.format(0, "second"));
      }
      if (absDiffMs < 60 * 60_000) {
        return interpolateValue(
          template,
          relative.format(Math.round(diffMs / 60_000), "minute"),
        );
      }
      if (absDiffMs < 24 * 60 * 60_000) {
        return interpolateValue(
          template,
          relative.format(Math.round(diffMs / (60 * 60_000)), "hour"),
        );
      }
      return interpolateValue(
        template,
        relative.format(Math.round(diffMs / (24 * 60 * 60_000)), "day"),
      );
    }

    const formattedDate = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
    return interpolateValue(template, formattedDate);
  } catch {
    return interpolateValue(template, unknownLabel);
  }
}

interface DeviceSessionLabelCopy {
  browser: string;
  installedApp: string;
  unknownSystem: string;
}

export function formatDeviceSessionLabel(
  storedLabel: string,
  copy: DeviceSessionLabelCopy,
): string {
  const match = /^(.+?) on (.+)$/u.exec(storedLabel.trim());
  if (!match) return storedLabel;

  const app = match[1] === "PWA" ? copy.installedApp : match[1] === "Browser" ? copy.browser : match[1];
  const system = match[2] === "Unknown" ? copy.unknownSystem : match[2];
  return `${app} · ${system}`;
}

function iconForPlatform(platform: DeviceSessionPlatform) {
  if (platform === "android" || platform === "ios" || platform === "pwa") {
    return Smartphone;
  }
  if (platform === "web") return TabletSmartphone;
  return Laptop;
}

export function DeviceSessionsCard({
  dense = false,
  surface = "default",
}: DeviceSessionsCardProps) {
  const { t, language } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const refreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    if (!supabase) {
      setLoading(false);
      setSessions([]);
      setCurrentDeviceId(null);
      refreshingRef.current = false;
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await upsertCurrentDeviceSession("manual");
      const [deviceId, rows] = await Promise.all([
        getCurrentDeviceSessionId(),
        listDeviceSessions(8),
      ]);
      setCurrentDeviceId(deviceId);
      setSessions(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Device sessions unavailable");
    } finally {
      setLoading(false);
      refreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handleUpdate = () => void refresh();
    window.addEventListener(DEVICE_SESSIONS_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DEVICE_SESSIONS_UPDATED_EVENT, handleUpdate);
  }, [refresh]);

  const activeCount = useMemo(
    () => sessions.filter((session) => !session.revoked_at).length,
    [sessions],
  );

  const handleRevoke = async (session: DeviceSession) => {
    setRevokingId(session.id);
    setError(null);
    try {
      await revokeDeviceSession(session.id);
      const rows = await listDeviceSessions(8);
      setSessions(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Device session revoke failed");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <section
      className={cn(
        "rounded-2xl border p-5 shadow-[var(--zen-shadow-card)]",
        DEVICE_SESSIONS_SURFACE_CLASS[surface],
        dense && "p-4",
      )}
      data-testid="device-sessions-card"
      aria-labelledby="device-sessions-card-title"
    >
      <div className="flex flex-col items-stretch gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <TabletSmartphone className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="device-sessions-card-title" className="text-base font-semibold text-foreground">
              {tx.syncDeviceSessionsTitle || "Your devices"}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {tx.syncDeviceSessionsDescription ||
                "See which devices have used your account without exposing private data."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex min-h-[44px] max-w-full shrink-0 items-center gap-1.5 self-end whitespace-normal rounded-full border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-accent/50 motion-safe:transition-colors"
          disabled={loading}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", loading && "motion-safe:animate-spin")}
            aria-hidden="true"
          />
          {tx.refresh || "Refresh"}
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {tx.syncDeviceSessionsActive || "Active devices"}
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {supabase ? String(activeCount) : tx.cloudSyncDisabled || "Online backup is not available"}
        </p>
      </div>

      {error && (
        <div
          className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive"
          role="status"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{tx.syncDeviceSessionsError || "Device status is temporarily unavailable."}</span>
        </div>
      )}

      <div className="mt-4 space-y-2" data-testid="device-sessions-list">
        {!loading && sessions.length === 0 && (
          <p className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            {supabase
              ? tx.syncDeviceSessionsEmpty || "Sign in to see connected devices."
              : tx.cloudSyncDisabled || "Online backup is not available"}
          </p>
        )}

        {sessions.map((session) => {
          const Icon = iconForPlatform(session.platform);
          const isCurrent = session.device_id === currentDeviceId;
          const isRevoked = Boolean(session.revoked_at);
          return (
            <article
              key={session.id}
              className="flex flex-col items-stretch gap-3 rounded-xl border border-border bg-muted/20 p-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"
              data-testid="device-session-row"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block whitespace-normal break-words text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
                    <bdi dir="auto">
                      {formatDeviceSessionLabel(session.label, {
                        browser: tx.syncDeviceBrowser || "Browser",
                        installedApp: tx.syncDeviceInstalledApp || "ZenFlow app",
                        unknownSystem: tx.syncDeviceUnknownSystem || "Unknown system",
                      })}
                    </bdi>
                  </span>
                  <span className="block whitespace-normal break-words text-xs text-muted-foreground [hyphens:manual] [overflow-wrap:normal]">
                    {isCurrent
                      ? tx.syncDeviceCurrent || "Current device"
                      : isRevoked
                        ? tx.syncDeviceRevoked || "Inactive"
                        : <bdi dir="auto">
                            {formatDeviceLastActivity(
                              session.last_seen_at,
                              language,
                              tx.syncDeviceLastSeen || "Last activity: {value}",
                              tx.syncDeviceLastSeenUnknown || "Unknown",
                            )}
                          </bdi>}
                  </span>
                </span>
              </div>

              {!isCurrent && !isRevoked && (
                <button
                  type="button"
                  onClick={() => void handleRevoke(session)}
                  disabled={revokingId === session.id}
                  className="min-h-[44px] max-w-full shrink-0 self-end whitespace-normal break-words rounded-full border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-accent/50 motion-safe:transition-colors [hyphens:manual] [overflow-wrap:normal]"
                >
                  {revokingId === session.id
                    ? tx.syncRevoking || "Revoking"
                    : tx.syncRevokeDevice || "Mark inactive"}
                </button>
              )}
            </article>
          );
        })}
      </div>

      <p className="mt-3 whitespace-normal break-words text-xs leading-relaxed text-muted-foreground [hyphens:manual] [overflow-wrap:normal]">
        {tx.syncDeviceSessionsFootnote ||
          "Marking a device inactive hides it from this list; it does not sign that device out."}
      </p>
    </section>
  );
}
