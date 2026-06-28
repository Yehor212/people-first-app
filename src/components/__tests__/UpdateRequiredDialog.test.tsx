import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CHUNK_LOAD_ERROR_EVENT,
  UpdateRequiredDialog,
} from "@/components/UpdateRequiredDialog";

const mockForceHardReload = vi.fn().mockResolvedValue(undefined);

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      updateRequiredTitle: "Доступне оновлення",
      updateRequiredDesc:
        "Доступна нова версія додатку. Оновіть для отримання нових функцій та виправлень.",
      updateRequiredRefresh: "Оновити додаток",
    },
  }),
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  addBreadcrumb: vi.fn(),
}));

vi.mock("@/lib/versionCheck", () => ({
  forceHardReload: (...args: unknown[]) => mockForceHardReload(...args),
}));

describe("UpdateRequiredDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses hard reload when the user accepts a stale chunk update", async () => {
    render(<UpdateRequiredDialog />);

    window.dispatchEvent(
      new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
        detail: {
          chunk: "TabContent-old.js",
          message: "Failed to fetch dynamically imported module",
        },
      }),
    );

    const refresh = await screen.findByRole("button", { name: "Оновити додаток" });
    fireEvent.click(refresh);

    await waitFor(() => expect(mockForceHardReload).toHaveBeenCalledTimes(1));
  });
});
