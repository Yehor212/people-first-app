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

function formatRelativeTime(value: string, locale: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "unknown";
  const diffMs = Date.now() - timestamp;
  const minutes = Math.max(0, Math.round(diffMs / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return `${Math.round(hours / 24)}d`;
  }
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
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <TabletSmartphone className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
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
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-accent/50 motion-safe:transition-colors"
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
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3"
              data-testid="device-session-row"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {session.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {isCurrent
                      ? tx.syncDeviceCurrent || "Current device"
                      : isRevoked
                        ? tx.syncDeviceRevoked || "Inactive"
                        : `${tx.syncDeviceLastSeen || "Last seen"} ${formatRelativeTime(
                            session.last_seen_at,
                            language,
                          )}`}
                  </span>
                </span>
              </div>

              {!isCurrent && !isRevoked && (
                <button
                  type="button"
                  onClick={() => void handleRevoke(session)}
                  disabled={revokingId === session.id}
                  className="min-h-[44px] shrink-0 rounded-full border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-accent/50 motion-safe:transition-colors"
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

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {tx.syncDeviceSessionsFootnote ||
          "Marking a device inactive hides it from this list; it does not sign that device out."}
      </p>
    </section>
  );
}
