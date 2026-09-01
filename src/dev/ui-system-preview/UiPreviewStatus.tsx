import type { ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  CloudOff,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  WifiOff,
  XCircle,
} from "lucide-react";

import { uiPreviewFixtureCopy } from "./fixtures";
import type { RegisteredUiPreviewCase } from "./registry";

function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function statusContent(previewCase: RegisteredUiPreviewCase): {
  icon: ReactNode;
  message: string;
} {
  const copy = uiPreviewFixtureCopy[previewCase.locale];
  const staticLoader = previewCase.reducedMotion ? "" : "motion-safe:animate-spin";

  switch (previewCase.state) {
    case "loading":
      return {
        icon: <LoaderCircle aria-hidden className={classes("size-5", staticLoader)} />,
        message: copy.boundaryNotice,
      };
    case "success":
      return {
        icon: <ShieldCheck aria-hidden className="size-5" />,
        message: copy.boundaryNotice,
      };
    case "warning":
      return {
        icon: <AlertTriangle aria-hidden className="size-5" />,
        message: copy.boundaryNotice,
      };
    case "error":
      return {
        icon: <XCircle aria-hidden className="size-5" />,
        message: copy.recoveryNotice,
      };
    case "offline":
      return {
        icon: <WifiOff aria-hidden className="size-5" />,
        message: copy.offlineNotice,
      };
    case "permission-blocked":
      return {
        icon: <LockKeyhole aria-hidden className="size-5" />,
        message: copy.permissionNotice,
      };
    case "pending-sync":
      return {
        icon: <CloudOff aria-hidden className="size-5" />,
        message: copy.pendingSyncNotice,
      };
    case "recovery":
      return {
        icon: <RefreshCw aria-hidden className="size-5" />,
        message: copy.recoveryNotice,
      };
    default:
      return {
        icon: <Check aria-hidden className="size-5" />,
        message:
          previewCase.state === "long-content"
            ? copy.accountPreferencesDetail
            : copy.boundaryNotice,
      };
  }
}
