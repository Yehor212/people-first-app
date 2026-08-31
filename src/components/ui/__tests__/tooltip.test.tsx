import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

describe("Tooltip", () => {
  it("keeps trigger and portal content accessible after dependency updates", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip defaultOpen>
          <TooltipTrigger asChild>
            <button type="button">More information</button>
          </TooltipTrigger>
          <TooltipContent>Helpful details</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    expect(screen.getByRole("button", { name: "More information" })).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Helpful details");
  });
});
