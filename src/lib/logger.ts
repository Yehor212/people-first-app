/** Privacy-safe fixed-code logger. */

import { IS_DEV } from "@/lib/env";
import { DIAGNOSTIC_CODES } from "@/lib/diagnosticPrivacy";

const isDev = IS_DEV;

export const logger = {
  log: (..._args: unknown[]) => {
    if (isDev) {
      console.log(DIAGNOSTIC_CODES.log);
    }
  },

  info: (..._args: unknown[]) => {
    if (isDev) {
      console.log(DIAGNOSTIC_CODES.info);
    }
  },

  warn: (..._args: unknown[]) => {
    if (isDev) {
      console.warn(DIAGNOSTIC_CODES.warning);
    }
  },

  error: (..._args: unknown[]) => {
    // Fixed code in every build: development data is still real user data.
    console.error(DIAGNOSTIC_CODES.error);
  },

  sync: (_message: string, _data?: Record<string, unknown>) => {
    if (isDev) {
      console.log(DIAGNOSTIC_CODES.sync);
    }
  },

  auth: (_message: string) => {
    if (isDev) {
      console.log(DIAGNOSTIC_CODES.auth);
    }
  },
};

export default logger;
