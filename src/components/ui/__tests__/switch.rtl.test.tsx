import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Switch } from "../switch";

describe("Switch RTL geometry", () => {
  afterEach(() => {
    document.documentElement.dir = "ltr";
  });

  it("moves the checked thumb toward logical end in LTR and RTL", () => {
    document.documentElement.dir = "ltr";
    const ltr = render(<Switch checked aria-label="LTR" />);
    const ltrThumb = ltr.getByRole("switch").firstElementChild as HTMLElement;
    expect(ltrThumb.style.insetInlineStart).toBe("3px");
    expect(ltrThumb).toHaveClass("ltr:translate-x-[24px]", "rtl:-translate-x-[24px]");
    expect(ltrThumb.style.transform).toBe("");
    ltr.unmount();

    document.documentElement.dir = "rtl";
    const rtl = render(<Switch checked aria-label="RTL" />);
    const rtlThumb = rtl.getByRole("switch").firstElementChild as HTMLElement;
    expect(rtlThumb.style.insetInlineStart).toBe("3px");
    expect(rtlThumb).toHaveClass("ltr:translate-x-[24px]", "rtl:-translate-x-[24px]");
    expect(rtlThumb.style.transform).toBe("");
  });

  it("keeps press and thumb transitions behind the effective reduced-motion class", () => {
    const view = render(<Switch checked aria-label="Motion-safe switch" />);
    const control = view.getByRole("switch");
    const thumb = control.firstElementChild as HTMLElement;

    expect(control).toHaveClass("motion-safe:active:scale-[0.97]");
    expect(control).not.toHaveClass("active:scale-[0.97]");
    expect(thumb).toHaveClass("motion-safe:transition-transform", "motion-safe:duration-300");
    expect(thumb.style.transition).toBe("");
  });
});
