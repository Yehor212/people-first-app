import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import { storageCanWrite } from "@/lib/safeJson";
import type { StorageIncident } from "./storageErrorIncidentState";

type PresentStorageIncident = (action: {
  type: "present";
  incident: StorageIncident;
}) => void;

export function useStoragePrivateModeIncident(
  message: string,
  presentIncident: PresentStorageIncident,
) {
  const hasCheckedPrivateMode = useRef(false);

  useEffect(() => {
    if (hasCheckedPrivateMode.current) return;
    hasCheckedPrivateMode.current = true;
    if (storageCanWrite()) return;

    logger.warn("[StorageErrorBanner] Private mode detected");
    presentIncident({
      type: "present",
      incident: {
        key: "private-mode",
        priority: 1,
        title: null,
        message,
        retryAction: null,
      },
    });
  }, [message, presentIncident]);
}
