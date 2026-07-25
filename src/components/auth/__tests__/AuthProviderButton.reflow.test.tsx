import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthProviderButton } from "@/components/auth/AuthProviderButton";
import { AUTH_PROVIDER_CONFIGS } from "@/lib/authProviders";

describe("AuthProviderButton text reflow", () => {
  it("lets a long localized provider label wrap and gives it the narrow-screen rail", () => {
    render(
      <AuthProviderButton
        provider={AUTH_PROVIDER_CONFIGS.telegram}
        label="Продовжити за допомогою Telegram"
        loadingLabel="Виконується вхід…"
        isLoading={false}
        onClick={() => undefined}
      />
    );

    const button = screen.getByRole("button", {
      name: "Продовжити за допомогою Telegram",
    });
    const content = screen.getByTestId("auth-provider-content-telegram");
    const label = screen.getByText("Продовжити за допомогою Telegram");

    expect(button).toHaveClass("min-w-0", "whitespace-normal");
    expect(content.className).toContain("grid-cols-1");
    expect(content.className).toContain("min-[420px]:grid-cols-[2rem_minmax(0,1fr)_2rem]");
    expect(label).toHaveClass("min-w-0", "whitespace-normal", "break-words");
    expect(label.className).toContain("[overflow-wrap:break-word]");
    expect(label.className).toContain("[hyphens:manual]");
    expect(label.className).not.toContain("[overflow-wrap:anywhere]");
    expect(label.className).toContain("min-[420px]:col-start-2");
  });
});
