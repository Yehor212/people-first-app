import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IdentityMappingSection } from "../IdentityMappingSection";

const ts: Record<string, string> = {
  identityMapping: "Habit purpose",
  identityMappingHint: "Optional: describe who this action helps you become.",
  identityCluster: "Life area",
  identityClusterPlaceholder: "e.g., Health, Focus, Sleep",
  identityVerb: "Who I am becoming",
  identityVerbPlaceholder: "e.g., someone who cares for their body",
  identityIcon: "Uses the habit emoji as the symbol",
  identityDefaultVerb: "someone who keeps their word",
  identityVotePreview:
    "After saving, the card shows this purpose; each completion becomes a small proof.",
  identityVoteFor: "Proof: {identity}",
};

describe("IdentityMappingSection", () => {
  it("frames identity as optional purpose and inherits the habit emoji", () => {
    render(
      <IdentityMappingSection
        isPrimaryCTA
        ts={ts}
        identityCluster=""
        setIdentityCluster={vi.fn()}
        identityVerb=""
        setIdentityVerb={vi.fn()}
        identityIcon=""
        habitIcon="💧"
        existingClusters={[]}
      />,
    );

    expect(screen.getByTestId("identity-vote-preview")).toHaveTextContent(
      "Proof: someone who keeps their word",
    );
    expect(screen.getByTestId("identity-icon-inherited")).toHaveTextContent("💧");
    expect(screen.getByTestId("identity-icon-inherited")).toHaveTextContent(
      "Uses the habit emoji as the symbol",
    );
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("keeps user inputs explicit: purpose phrase first, life area second", () => {
    const setIdentityVerb = vi.fn();
    const setIdentityCluster = vi.fn();

    render(
      <IdentityMappingSection
        isPrimaryCTA
        ts={ts}
        identityCluster=""
        setIdentityCluster={setIdentityCluster}
        identityVerb=""
        setIdentityVerb={setIdentityVerb}
        identityIcon=""
        habitIcon="🏃"
        existingClusters={["Health"]}
      />,
    );

    fireEvent.change(screen.getByTestId("identity-verb-input"), {
      target: { value: "someone who moves daily" },
    });
    fireEvent.change(screen.getByTestId("identity-cluster-input"), {
      target: { value: "Health" },
    });

    expect(setIdentityVerb).toHaveBeenCalledWith("someone who moves daily");
    expect(setIdentityCluster).toHaveBeenCalledWith("Health");
  });
});
