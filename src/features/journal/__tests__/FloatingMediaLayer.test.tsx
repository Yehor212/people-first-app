import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { forwardRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FloatingMediaLayer, ReadOnlyFloatingMediaLayer } from "../FloatingMediaLayer";
import type { PhotoLayout } from "../FloatingMediaLayer";
import type { JournalPhoto } from "../types";

const languageState = vi.hoisted<{ language: "en" | "ar" }>(() => ({ language: "en" }));
const androidBackMocks = vi.hoisted(() => ({
  registrations: [] as Array<{ isOpen: boolean; onClose: () => void }>,
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: (isOpen: boolean, onClose: () => void) => {
    androidBackMocks.registrations.push({ isOpen, onClose });
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: languageState.language,
    t: {
      diaryPhotoMove: "Move photo",
      diaryPhotoResize: "Resize photo",
      diaryPhotoReturn: "Return photo to gallery",
      diaryPhotoTapDestination: "Photo selected. Tap where you want to place it.",
      journalPhotoPosition: "Photo {current} of {total}",
      diaryPhotoInteractionLabel:
        "Photo {current} of {total}. Move photo and resize it. Activate for options.",
      diaryPhotoInteractionLabelWithDescription:
        "Photo {current} of {total}: {description}. Move photo and resize it. Activate for options.",
      diaryPhotoLayoutStatus:
        "Photo {current} of {total}. Position {x}, {y}. Width {width}.",
      diaryPhotoGestureInstructions:
        "Drag to move. Tap to change size. Pinch also resizes. Press Home to center. Use arrow keys to move, plus or minus to resize, and Delete to return to the gallery. On touch, press and hold to return the photo to the gallery.",
      diaryPhotoGestureHint: "Drag, tap size, hold to return",
      diaryPhotoDescribe: "Describe photo",
      diaryPhotoDescriptionLabel: "Photo description",
      diaryPhotoDescriptionHelp:
        "Describe what matters in this photo for screen readers. Leave blank if it adds no meaning.",
      save: "Save",
      cancel: "Cancel",
    },
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { whileTap?: unknown }>(
      function MotionDiv({ children, whileTap, ...rest }, ref) {
        void whileTap;
        return (
          <div ref={ref} {...rest}>
            {children}
          </div>
        );
      }
    ),
  },
  useReducedMotion: () => false,
}));

const getPhotoById = vi.fn();

vi.mock("../journalStorage", () => ({
  getPhotoById: (photoId: string, entryId: string) => getPhotoById(photoId, entryId),
}));

const photo: JournalPhoto = {
  id: "photo-1",
  entryId: "entry-1",
  data: "data:image/jpeg;base64,full",
  thumbnail: "data:image/jpeg;base64,thumb",
  width: 1200,
  height: 900,
  createdAt: 1,
};

const photoTwo: JournalPhoto = {
  ...photo,
  id: "photo-2",
  data: "data:image/jpeg;base64,full-two",
  thumbnail: "data:image/jpeg;base64,thumb-two",
};

const createContainerRef = (width = 420, height = 520) => {
  const containerRef = { current: document.createElement("div") };
  const containerRect: DOMRect = {
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
  containerRef.current.getBoundingClientRect = () => containerRect;
  return containerRef;
};

const dispatchPointerEvent = (
  target: Element | Window | Document,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel" | "lostpointercapture",
  coordinates: { clientX: number; clientY: number; pointerId?: number; pointerType?: string }
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: coordinates.clientX,
    clientY: coordinates.clientY,
  });
  Object.defineProperties(event, {
    pointerId: { value: coordinates.pointerId ?? 1 },
    pointerType: { value: coordinates.pointerType ?? "mouse" },
  });
  fireEvent(target, event);
};

describe("FloatingMediaLayer", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    getPhotoById.mockReset();
    languageState.language = "en";
    androidBackMocks.registrations = [];
  });

  it("keeps readable floating photos visible when one photo cannot be loaded", async () => {
    getPhotoById.mockImplementation(async (photoId: string) => {
      if (photoId === "photo-2") throw new Error("corrupt photo");
      return photo;
    });

    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1", "photo-2"]}
        layout={{
          "photo-1": { x: 40, y: 50, width: 160 },
          "photo-2": { x: 60, y: 50, width: 160 },
        }}
        onLayoutChange={vi.fn()}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />,
    );

    expect(await screen.findByRole("button", { name: /Photo 1 of 1/ })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/could not be shown/i);
    expect(getPhotoById).toHaveBeenCalledWith("photo-1", "entry-1");
    expect(getPhotoById).toHaveBeenCalledWith("photo-2", "entry-1");
  });

  it("retries a floating photo read failure in place", async () => {
    getPhotoById
      .mockRejectedValueOnce(new Error("temporary read failure"))
      .mockResolvedValue(photo);

    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 160 } }}
        onLayoutChange={vi.fn()}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /try loading photos again/i }));

    expect(await screen.findByRole("button", { name: /Photo 1 of 1/ })).toBeInTheDocument();
    expect(getPhotoById).toHaveBeenCalledTimes(2);
  });

  it("retries when a floating photo record is temporarily missing", async () => {
    getPhotoById.mockResolvedValueOnce(undefined).mockResolvedValue(photo);

    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 160 } }}
        onLayoutChange={vi.fn()}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /try loading photos again/i }));

    expect(await screen.findByRole("button", { name: /Photo 1 of 1/ })).toBeInTheDocument();
    expect(getPhotoById).toHaveBeenCalledTimes(2);
  });

  it("keeps the canvas chrome-free while retaining screen-reader instructions", async () => {
    getPhotoById.mockResolvedValue(photo);

    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 160 } }}
        onLayoutChange={vi.fn()}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
        focusPhotoId="photo-1"
        onPhotoFocusHandled={vi.fn()}
      />,
    );

    const floatingPhoto = await screen.findByRole("button", { name: /Photo 1 of 1/ });
    expect(screen.queryByTestId("journal-photo-gesture-hint")).not.toBeInTheDocument();
    expect(floatingPhoto).toHaveAttribute(
      "aria-describedby",
      "floating-photo-instructions-photo-1",
    );
    expect(document.getElementById("floating-photo-instructions-photo-1")).toHaveClass("sr-only");
  });

  it("localizes photo position digits in the gesture target name", async () => {
    languageState.language = "ar";
    getPhotoById.mockImplementation((photoId: string) =>
      Promise.resolve(photoId === "photo-2" ? photoTwo : photo),
    );

    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1", "photo-2"]}
        layout={{
          "photo-1": { x: 40, y: 50, width: 160 },
          "photo-2": { x: 60, y: 50, width: 160 },
        }}
        onLayoutChange={vi.fn()}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />
    );

    const labels = (await screen.findAllByRole("button")).map((element) =>
      (element.getAttribute("aria-label") || "").replace(/[\u2066\u2069]/g, ""),
    );
    expect(labels).toContain(
      "Photo ١ of ٢. Move photo and resize it. Activate for options.",
    );
  });

  it("uses a whole-message interaction label with the saved description", async () => {
    getPhotoById.mockResolvedValue(photo);

    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{
          "photo-1": {
            x: 50,
            y: 50,
            width: 160,
            description: "Sunset over the lake",
          },
        }}
        onLayoutChange={vi.fn()}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />,
    );

    expect(
      await screen.findByRole("button", {
        name: "Photo 1 of 1: Sunset over the lake. Move photo and resize it. Activate for options.",
      }),
    ).toBeInTheDocument();
  });

  it("isolates a mixed-direction saved description in Arabic accessible text", async () => {
    languageState.language = "ar";
    getPhotoById.mockResolvedValue(photo);

    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{
          "photo-1": {
            x: 50,
            y: 50,
            width: 160,
            description: "https://example.com/photo-1",
          },
        }}
        onLayoutChange={vi.fn()}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />,
    );

    expect(
      await screen.findByRole("button", {
        name: /\u2068https:\/\/example\.com\/photo-1\u2069/,
      }),
    ).toBeInTheDocument();
  });

  it("announces the resulting position and size after a keyboard adjustment", async () => {
    getPhotoById.mockResolvedValue(photo);

    function Harness() {
      const [layout, setLayout] = useState<Record<string, PhotoLayout>>({
        "photo-1": { x: 50, y: 50, width: 120 },
      });
      return (
        <FloatingMediaLayer
          entryId="entry-1"
          photoIds={["photo-1"]}
          layout={layout}
          onLayoutChange={setLayout}
          onReturnToGallery={vi.fn()}
          containerRef={createContainerRef()}
        />
      );
    }

    render(<Harness />);
    fireEvent.keyDown(await screen.findByRole("button", { name: /move photo/i }), {
      key: "ArrowRight",
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Photo 1 of 1. Position 54%, 50%. Width 120 px.",
    );
  });

  it("isolates measurements in RTL live announcements", async () => {
    languageState.language = "ar";
    getPhotoById.mockResolvedValue(photo);

    function Harness() {
      const [layout, setLayout] = useState<Record<string, PhotoLayout>>({
        "photo-1": { x: 50, y: 50, width: 120 },
      });
      return (
        <FloatingMediaLayer
          entryId="entry-1"
          photoIds={["photo-1"]}
          layout={layout}
          onLayoutChange={setLayout}
          onReturnToGallery={vi.fn()}
          containerRef={createContainerRef()}
        />
      );
    }

    render(<Harness />);
    fireEvent.keyDown(await screen.findByRole("button", { name: /move photo/i }), {
      key: "ArrowRight",
    });

    const announcement = (await screen.findByRole("status")).textContent ?? "";
    expect(announcement).toContain("\u2066٥٤%\u2069");
    expect(announcement).toContain("\u2066١٢٠ px\u2069");
  });

  it("saves an optional screen-reader description with the photo layout", async () => {
    getPhotoById.mockResolvedValue(photo);

    function Harness() {
      const [layout, setLayout] = useState<Record<string, PhotoLayout>>({
        "photo-1": { x: 50, y: 50, width: 160 },
      });
      return (
        <>
          <div data-testid="description-layout-state">{JSON.stringify(layout)}</div>
          <FloatingMediaLayer
            entryId="entry-1"
            photoIds={["photo-1"]}
            layout={layout}
            onLayoutChange={setLayout}
            onReturnToGallery={vi.fn()}
            containerRef={createContainerRef()}
          />
        </>
      );
    }

    render(<Harness />);
    fireEvent.contextMenu(await screen.findByRole("button", { name: /move photo/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Describe photo" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Photo description" }), {
      target: { value: "Sunset over the lake after my walk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(JSON.parse(screen.getByTestId("description-layout-state").textContent || "{}")).toEqual({
      "photo-1": {
        x: 50,
        y: 50,
        width: 160,
        description: "Sunset over the lake after my walk",
      },
    });
  });

  it.each([
    { label: "Space", key: " ", shiftKey: false },
    { label: "Enter", key: "Enter", shiftKey: false },
    { label: "Shift+F10", key: "F10", shiftKey: true },
    { label: "Context Menu", key: "ContextMenu", shiftKey: false },
  ])("opens the photo actions menu with $label", async ({ key, shiftKey }) => {
    getPhotoById.mockResolvedValue(photo);

    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 160 } }}
        onLayoutChange={vi.fn()}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />,
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    expect(floatingPhoto).toHaveAttribute("aria-haspopup", "menu");
    expect(floatingPhoto).toHaveAttribute("aria-keyshortcuts", "Enter Space Shift+F10");

    fireEvent.keyDown(floatingPhoto, {
      key,
      shiftKey,
    });

    expect(await screen.findByRole("menuitem", { name: "Describe photo" })).toBeInTheDocument();
  });

  it("uses the saved description when a floating photo is reopened read-only", async () => {
    getPhotoById.mockResolvedValue(photo);

    render(
      <ReadOnlyFloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{
          "photo-1": {
            x: 50,
            y: 50,
            width: 160,
            description: "Sunset over the lake after my walk",
          },
        }}
      />,
    );

    const restoredPhoto = await screen.findByRole("img", {
      name: "Sunset over the lake after my walk",
    });
    expect(restoredPhoto).toBeInTheDocument();
    expect(restoredPhoto).toHaveAttribute("loading", "eager");
  });

  it("keeps an undescribed floating photo discoverable when reopened read-only", async () => {
    getPhotoById.mockResolvedValue(photo);

    render(
      <ReadOnlyFloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 160 } }}
      />,
    );

    expect(await screen.findByRole("img", { name: "Photo 1 of 1" })).toBeInTheDocument();
  });

  it("keeps the touch menu available through sub-threshold finger drift", async () => {
    getPhotoById.mockResolvedValue(photo);
    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 120 } }}
        onLayoutChange={vi.fn()}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />,
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    vi.useFakeTimers();
    dispatchPointerEvent(floatingPhoto, "pointerdown", {
      clientX: 100,
      clientY: 100,
      pointerType: "touch",
    });
    dispatchPointerEvent(floatingPhoto, "pointermove", {
      clientX: 101,
      clientY: 101,
      pointerType: "touch",
    });
    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.getByRole("menuitem", { name: "Return photo to gallery" })).toHaveClass(
      "min-h-12",
    );
  });

  it("closes an open photo context menu before Android Back reaches the editor", async () => {
    getPhotoById.mockResolvedValue(photo);
    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 120 } }}
        onLayoutChange={vi.fn()}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />,
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    vi.useFakeTimers();
    dispatchPointerEvent(floatingPhoto, "pointerdown", {
      clientX: 100,
      clientY: 100,
      pointerType: "touch",
    });
    void act(() => vi.advanceTimersByTime(700));
    expect(screen.getByRole("menuitem", { name: "Return photo to gallery" })).toBeInTheDocument();

    const contextMenuBack = [...androidBackMocks.registrations]
      .reverse()
      .find(({ isOpen }) => isOpen);
    expect(contextMenuBack).toBeDefined();
    act(() => contextMenuBack?.onClose());

    expect(screen.queryByRole("menuitem", { name: "Return photo to gallery" })).not.toBeInTheDocument();
  });

  it("fits a desktop-sized photo in a phone editor without overwriting its saved width", async () => {
    getPhotoById.mockResolvedValue(photo);
    const onLayoutChange = vi.fn();
    const containerRef = createContainerRef(320, 520);

    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 80, y: 50, width: 500 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={vi.fn()}
        containerRef={containerRef}
      />
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    expect(floatingPhoto).toHaveStyle({ width: "304px" });
    expect(onLayoutChange).not.toHaveBeenCalled();
  });

  it.each([
    { devicePixelRatio: 2, expectedWidth: 480 },
    { devicePixelRatio: 3, expectedWidth: 320 },
  ])(
    "does not upscale a 960px fallback photo beyond its pixel density at DPR $devicePixelRatio",
    async ({ devicePixelRatio, expectedWidth }) => {
      vi.stubGlobal("devicePixelRatio", devicePixelRatio);
      getPhotoById.mockResolvedValue({ ...photo, width: 960, height: 720 });
      const onLayoutChange = vi.fn();

      render(
        <FloatingMediaLayer
          entryId="entry-1"
          photoIds={["photo-1"]}
          layout={{ "photo-1": { x: 50, y: 50, width: 500 } }}
          onLayoutChange={onLayoutChange}
          onReturnToGallery={vi.fn()}
          containerRef={createContainerRef(900, 700)}
        />
      );

      const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
      expect(floatingPhoto).toHaveStyle({ width: `${expectedWidth}px` });

      fireEvent.keyDown(floatingPhoto, { key: "PageUp" });
      expect(onLayoutChange).toHaveBeenCalledWith(expect.any(Function));
      const updateLayout = onLayoutChange.mock.calls[0][0];
      expect(updateLayout({ "photo-1": { x: 50, y: 50, width: 500 } })).toEqual({
        "photo-1": { x: 50, y: 50, width: expectedWidth },
      });
    },
  );

  it("signals a completed resize so the editor can checkpoint the layout immediately", async () => {
    getPhotoById.mockResolvedValue(photo);
    const onLayoutCommit = vi.fn();

    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 160 } }}
        onLayoutChange={vi.fn()}
        onLayoutCommit={onLayoutCommit}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />
    );

    fireEvent.keyDown(await screen.findByRole("button", { name: /move photo/i }), {
      key: "PageUp",
    });

    expect(onLayoutCommit).toHaveBeenCalledTimes(1);
  });

  it("shows bounded recovery when stored image bytes cannot be decoded", async () => {
    getPhotoById.mockResolvedValue(photo);
    const onLayoutChange = vi.fn();

    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 160 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    fireEvent.error(floatingPhoto.querySelector("img") as HTMLImageElement);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Some photos could not be shown. Your entry was not changed.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try loading photos again" }));
    await waitFor(() => expect(getPhotoById).toHaveBeenCalledTimes(2));
    expect(onLayoutChange).not.toHaveBeenCalled();
  });

  it("starts dragging a responsive-clamped photo from its rendered position", async () => {
    getPhotoById.mockResolvedValue(photo);
    const onLayoutChange = vi.fn();
    const containerRef = createContainerRef(320, 520);

    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 20, y: 50, width: 500 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={vi.fn()}
        containerRef={containerRef}
      />
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    Object.defineProperty(floatingPhoto, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    dispatchPointerEvent(floatingPhoto, "pointerdown", { clientX: 100, clientY: 100 });
    dispatchPointerEvent(floatingPhoto, "pointermove", { clientX: 110, clientY: 100 });

    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    expect(floatingPhoto.style.transform).toContain("translate3d(10px, 0px, 0)");
    dispatchPointerEvent(floatingPhoto, "pointerup", { clientX: 110, clientY: 100 });

    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    const updateLayout = onLayoutChange.mock.calls[0][0];
    expect(updateLayout({ "photo-1": { x: 20, y: 50, width: 500 } })).toEqual({
      "photo-1": { x: 50.625, y: 50, width: 500 },
    });
  });

  it("shrinks a responsive-clamped photo visibly on the first resize action", async () => {
    getPhotoById.mockResolvedValue(photo);
    const onLayoutChange = vi.fn();
    const containerRef = createContainerRef(320, 520);

    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 500 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={vi.fn()}
        containerRef={containerRef}
      />
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    expect(floatingPhoto).toHaveStyle({ width: "304px" });

    fireEvent.keyDown(floatingPhoto, { key: "PageDown" });

    expect(floatingPhoto).toHaveStyle({ width: "280px" });
    expect(onLayoutChange).toHaveBeenCalledWith(expect.any(Function));
    const updateLayout = onLayoutChange.mock.calls[0][0];
    expect(updateLayout({ "photo-1": { x: 50, y: 50, width: 500 } })).toEqual({
      "photo-1": { x: 50, y: 50, width: 280 },
    });
  });

  it("uses the visible phone width as the baseline for the first pinch gesture", async () => {
    getPhotoById.mockResolvedValue(photo);
    const onLayoutChange = vi.fn();
    const containerRef = createContainerRef(320, 520);

    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 500 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={vi.fn()}
        containerRef={containerRef}
      />
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    dispatchPointerEvent(floatingPhoto, "pointerdown", {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      pointerType: "touch",
    });
    dispatchPointerEvent(floatingPhoto, "pointerdown", {
      clientX: 200,
      clientY: 100,
      pointerId: 2,
      pointerType: "touch",
    });
    dispatchPointerEvent(floatingPhoto, "pointermove", {
      clientX: 190,
      clientY: 100,
      pointerId: 2,
      pointerType: "touch",
    });

    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    expect(floatingPhoto).toHaveStyle({ width: "304px" });
    expect(floatingPhoto.style.transform).toContain("scale(0.9)");
    expect(onLayoutChange).not.toHaveBeenCalled();

    dispatchPointerEvent(floatingPhoto, "pointerup", {
      clientX: 190,
      clientY: 100,
      pointerId: 2,
      pointerType: "touch",
    });
    dispatchPointerEvent(floatingPhoto, "pointerup", {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      pointerType: "touch",
    });
    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    expect(onLayoutChange).toHaveBeenCalledWith(expect.any(Function));
    const updateLayout = onLayoutChange.mock.calls.at(-1)?.[0];
    expect(updateLayout({ "photo-1": { x: 50, y: 50, width: 500 } })).toEqual({
      "photo-1": { x: 50, y: 50, width: 273.6 },
    });
  });

  it("opens hidden photo actions on direct activation without exposing a control rail", async () => {
    getPhotoById.mockResolvedValue(photo);
    const onLayoutChange = vi.fn();
    const onReturnToGallery = vi.fn();
    const containerRef = createContainerRef();

    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 120 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={onReturnToGallery}
        containerRef={containerRef}
      />
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    expect(screen.queryByRole("button", { name: /^Resize photo$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Return photo to gallery$/i })).not.toBeInTheDocument();

    fireEvent.click(floatingPhoto);

    expect(await screen.findByRole("menuitem", { name: "Describe photo" })).toBeInTheDocument();
    expect(onLayoutChange).not.toHaveBeenCalled();
    expect(onReturnToGallery).not.toHaveBeenCalled();
  });

  it("offers a no-drag placement action that commits the next paper tap", async () => {
    getPhotoById.mockResolvedValue(photo);
    const containerRef = createContainerRef();

    function Harness() {
      const [layout, setLayout] = useState<Record<string, PhotoLayout>>({
        "photo-1": { x: 50, y: 50, width: 120 },
      });
      return (
        <>
          <div data-testid="tap-placement-layout">{JSON.stringify(layout)}</div>
          <FloatingMediaLayer
            entryId="entry-1"
            photoIds={["photo-1"]}
            layout={layout}
            onLayoutChange={setLayout}
            onReturnToGallery={vi.fn()}
            containerRef={containerRef}
          />
        </>
      );
    }

    render(<Harness />);
    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    fireEvent.contextMenu(floatingPhoto, { clientX: 210, clientY: 260 });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move photo" }));

    const layer = screen.getByTestId("floating-media-layer");
    expect(layer).toHaveAttribute("data-placement-photo-id", "photo-1");
    dispatchPointerEvent(layer, "pointerdown", {
      clientX: 336,
      clientY: 390,
      pointerId: 9,
      pointerType: "touch",
    });

    expect(JSON.parse(screen.getByTestId("tap-placement-layout").textContent || "{}")).toEqual({
      "photo-1": { x: 50, y: 50, width: 120 },
    });
    dispatchPointerEvent(layer, "pointerup", {
      clientX: 336,
      clientY: 390,
      pointerId: 9,
      pointerType: "touch",
    });

    expect(JSON.parse(screen.getByTestId("tap-placement-layout").textContent || "{}")).toEqual({
      "photo-1": { x: 80, y: 75, width: 120 },
    });
    expect(layer).not.toHaveAttribute("data-placement-photo-id");
  });

  it("cancels tap placement when the pointer moves before release", async () => {
    getPhotoById.mockResolvedValue(photo);
    const containerRef = createContainerRef();
    const onLayoutChange = vi.fn();
    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 120 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={vi.fn()}
        containerRef={containerRef}
      />,
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    fireEvent.contextMenu(floatingPhoto);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move photo" }));
    const layer = screen.getByTestId("floating-media-layer");
    dispatchPointerEvent(layer, "pointerdown", {
      clientX: 200,
      clientY: 200,
      pointerType: "touch",
    });
    dispatchPointerEvent(layer, "pointermove", {
      clientX: 230,
      clientY: 230,
      pointerType: "touch",
    });
    dispatchPointerEvent(layer, "pointerup", {
      clientX: 230,
      clientY: 230,
      pointerType: "touch",
    });

    expect(onLayoutChange).not.toHaveBeenCalled();
    expect(layer).not.toHaveAttribute("data-placement-photo-id");
  });

  it("cancels unfinished tap placement when capture is lost or the window blurs", async () => {
    getPhotoById.mockResolvedValue(photo);
    const containerRef = createContainerRef();
    const onLayoutChange = vi.fn();
    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 120 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={vi.fn()}
        containerRef={containerRef}
      />,
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    fireEvent.contextMenu(floatingPhoto);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move photo" }));
    const layer = screen.getByTestId("floating-media-layer");
    dispatchPointerEvent(layer, "pointerdown", {
      clientX: 200,
      clientY: 200,
      pointerType: "touch",
    });
    dispatchPointerEvent(layer, "lostpointercapture", {
      clientX: 200,
      clientY: 200,
      pointerType: "touch",
    });
    expect(layer).not.toHaveAttribute("data-placement-photo-id");

    fireEvent.contextMenu(floatingPhoto);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move photo" }));
    expect(layer).toHaveAttribute("data-placement-photo-id", "photo-1");
    fireEvent.blur(window);

    expect(layer).not.toHaveAttribute("data-placement-photo-id");
    expect(onLayoutChange).not.toHaveBeenCalled();
  });

  it("offers a visible 48px cancel action and restores focus during tap placement", async () => {
    getPhotoById.mockResolvedValue(photo);
    const containerRef = createContainerRef();
    const onLayoutChange = vi.fn();
    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 120 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={vi.fn()}
        containerRef={containerRef}
      />,
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    floatingPhoto.focus();
    fireEvent.contextMenu(floatingPhoto);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move photo" }));

    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveClass("min-h-12", "min-w-12");
    fireEvent.click(cancel);

    expect(screen.getByTestId("floating-media-layer")).not.toHaveAttribute(
      "data-placement-photo-id",
    );
    expect(onLayoutChange).not.toHaveBeenCalled();
    expect(floatingPhoto).toHaveFocus();
  });

  it("does not persist sub-threshold drift when long-press opens the context menu", async () => {
    getPhotoById.mockResolvedValue(photo);
    const containerRef = createContainerRef();
    const onLayoutChange = vi.fn();
    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 120 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={vi.fn()}
        containerRef={containerRef}
      />,
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    dispatchPointerEvent(floatingPhoto, "pointerdown", {
      clientX: 100,
      clientY: 100,
      pointerType: "touch",
    });
    dispatchPointerEvent(floatingPhoto, "pointermove", {
      clientX: 106,
      clientY: 106,
      pointerType: "touch",
    });
    fireEvent.contextMenu(floatingPhoto);

    expect(await screen.findByRole("menuitem", { name: "Move photo" })).toBeInTheDocument();
    expect(onLayoutChange).not.toHaveBeenCalled();
  });

  it("cancels tap placement on Escape without changing the saved layout", async () => {
    getPhotoById.mockResolvedValue(photo);
    const containerRef = createContainerRef();

    function Harness() {
      const [layout, setLayout] = useState<Record<string, PhotoLayout>>({
        "photo-1": { x: 45, y: 55, width: 160 },
      });
      return (
        <>
          <div data-testid="cancel-placement-layout">{JSON.stringify(layout)}</div>
          <FloatingMediaLayer
            entryId="entry-1"
            photoIds={["photo-1"]}
            layout={layout}
            onLayoutChange={setLayout}
            onReturnToGallery={vi.fn()}
            containerRef={containerRef}
          />
        </>
      );
    }

    const editorEscapeHandler = vi.fn();
    document.addEventListener("keydown", editorEscapeHandler);
    render(<Harness />);
    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    fireEvent.contextMenu(floatingPhoto, { clientX: 210, clientY: 260 });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move photo" }));
    const layer = screen.getByTestId("floating-media-layer");
    expect(layer).toHaveAttribute("data-placement-photo-id", "photo-1");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(layer).not.toHaveAttribute("data-placement-photo-id");
    expect(JSON.parse(screen.getByTestId("cancel-placement-layout").textContent || "{}")).toEqual({
      "photo-1": { x: 45, y: 55, width: 160 },
    });
    expect(editorEscapeHandler).not.toHaveBeenCalled();
    document.removeEventListener("keydown", editorEscapeHandler);
  });

  it("preserves sibling floating photo layout when multiple photos are adjusted", async () => {
    getPhotoById.mockImplementation((photoId: string) =>
      Promise.resolve(photoId === "photo-2" ? photoTwo : photo)
    );
    const containerRef = createContainerRef();

    function Harness() {
      const [layout, setLayout] = useState<Record<string, PhotoLayout>>({
        "photo-1": { x: 35, y: 45, width: 120 },
        "photo-2": { x: 65, y: 55, width: 130 },
      });
      return (
        <>
          <div data-testid="layout-state">{JSON.stringify(layout)}</div>
          <FloatingMediaLayer
            entryId="entry-1"
            photoIds={["photo-1", "photo-2"]}
            layout={layout}
            onLayoutChange={setLayout}
            onReturnToGallery={vi.fn()}
            containerRef={containerRef}
          />
        </>
      );
    }

    render(<Harness />);

    const floatingPhotos = await screen.findAllByRole("button", { name: /move photo/i });
    fireEvent.keyDown(floatingPhotos[0], { key: "+" });
    fireEvent.keyDown(floatingPhotos[1], { key: "+" });

    expect(JSON.parse(screen.getByTestId("layout-state").textContent || "{}")).toEqual({
      "photo-1": { x: 35, y: 45, width: 144 },
      "photo-2": { x: 65, y: 55, width: 154 },
    });
  });

  it("previews mouse drag locally and commits the latest position only on pointer release", async () => {
    getPhotoById.mockResolvedValue(photo);
    const onLayoutChange = vi.fn();
    const containerRef = createContainerRef();

    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 120 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={vi.fn()}
        containerRef={containerRef}
      />
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    const callbacks: FrameRequestCallback[] = [];
    const requestFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callbacks.push(callback);
        return callbacks.length;
      });
    const cancelFrame = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);

    dispatchPointerEvent(floatingPhoto, "pointerdown", { clientX: 100, clientY: 100 });
    dispatchPointerEvent(floatingPhoto, "pointermove", { clientX: 130, clientY: 130 });
    dispatchPointerEvent(floatingPhoto, "pointermove", { clientX: 142, clientY: 152 });

    expect(callbacks).toHaveLength(1);
    expect(onLayoutChange).not.toHaveBeenCalled();

    act(() => callbacks[0](performance.now()));

    expect(onLayoutChange).not.toHaveBeenCalled();
    expect(floatingPhoto.style.transform).toContain("translate3d(42px, 52px, 0)");

    dispatchPointerEvent(floatingPhoto, "pointerup", { clientX: 142, clientY: 152 });

    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    const updateLayout = onLayoutChange.mock.calls[0][0];
    expect(updateLayout({ "photo-1": { x: 50, y: 50, width: 120 } })).toEqual({
      "photo-1": {
        x: 60,
        y: 60,
        width: 120,
      },
    });

    requestFrame.mockRestore();
    cancelFrame.mockRestore();
  });

  it("resizes with a fine pointer without exposing a permanent control rail", async () => {
    getPhotoById.mockResolvedValue(photo);
    const onLayoutChange = vi.fn();
    const containerRef = createContainerRef();

    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 120 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={vi.fn()}
        containerRef={containerRef}
      />,
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    const resizeHandle = screen.getByTestId("journal-photo-resize-handle");
    expect(resizeHandle).toHaveAttribute("aria-hidden", "true");

    dispatchPointerEvent(resizeHandle, "pointerdown", {
      clientX: 200,
      clientY: 200,
      pointerId: 7,
      pointerType: "mouse",
    });
    dispatchPointerEvent(resizeHandle, "pointermove", {
      clientX: 230,
      clientY: 220,
      pointerId: 7,
      pointerType: "mouse",
    });

    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    expect(onLayoutChange).not.toHaveBeenCalled();
    expect(floatingPhoto.style.transform).toContain("scale(");

    dispatchPointerEvent(resizeHandle, "pointerup", {
      clientX: 230,
      clientY: 220,
      pointerId: 7,
      pointerType: "mouse",
    });

    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    const updateLayout = onLayoutChange.mock.calls[0][0];
    expect(updateLayout({ "photo-1": { x: 50, y: 50, width: 120 } })["photo-1"].width).toBeGreaterThan(120);
  });

  it("keeps a 48px resize target away from the center of a very wide photo", async () => {
    getPhotoById.mockResolvedValue({ ...photo, width: 1600, height: 200 });
    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 80 } }}
        onLayoutChange={vi.fn()}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />,
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    expect(floatingPhoto).toHaveStyle({ width: "120px", height: "48px" });
    expect(floatingPhoto.querySelector("img")).toHaveStyle({ width: "120px", height: "15px" });
    expect(screen.getByTestId("journal-photo-resize-handle")).toHaveClass("size-12");
  });

  it("offers preset sizes as a single-pointer alternative to resize dragging", async () => {
    getPhotoById.mockResolvedValue(photo);
    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 120 } }}
        onLayoutChange={vi.fn()}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />,
    );

    fireEvent.contextMenu(await screen.findByRole("button", { name: /move photo/i }));

    expect(await screen.findByRole("menuitem", { name: "Resize photo" })).toBeInTheDocument();
  });

  it("restores the saved layout when the browser cancels an in-progress gesture", async () => {
    getPhotoById.mockResolvedValue(photo);
    const containerRef = createContainerRef();

    function Harness() {
      const [layout, setLayout] = useState<Record<string, PhotoLayout>>({
        "photo-1": { x: 50, y: 50, width: 120 },
      });
      return (
        <>
          <div data-testid="cancel-layout-state">{JSON.stringify(layout)}</div>
          <FloatingMediaLayer
            entryId="entry-1"
            photoIds={["photo-1"]}
            layout={layout}
            onLayoutChange={setLayout}
            onReturnToGallery={vi.fn()}
            containerRef={containerRef}
          />
        </>
      );
    }

    render(<Harness />);
    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    dispatchPointerEvent(floatingPhoto, "pointerdown", { clientX: 100, clientY: 100 });
    dispatchPointerEvent(floatingPhoto, "pointermove", { clientX: 142, clientY: 152 });
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    expect(JSON.parse(screen.getByTestId("cancel-layout-state").textContent || "{}")).toEqual({
      "photo-1": { x: 50, y: 50, width: 120 },
    });

    dispatchPointerEvent(floatingPhoto, "pointercancel", { clientX: 142, clientY: 152 });
    expect(JSON.parse(screen.getByTestId("cancel-layout-state").textContent || "{}")).toEqual({
      "photo-1": { x: 50, y: 50, width: 120 },
    });
  });

  it("restores the committed width before the next resize after cancellation", async () => {
    getPhotoById.mockResolvedValue(photo);
    const onLayoutChange = vi.fn();
    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 120 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    const resizeHandle = screen.getByTestId("journal-photo-resize-handle");
    Object.defineProperty(resizeHandle, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    dispatchPointerEvent(resizeHandle, "pointerdown", {
      clientX: 200,
      clientY: 200,
      pointerId: 7,
    });
    dispatchPointerEvent(resizeHandle, "pointermove", {
      clientX: 240,
      clientY: 200,
      pointerId: 7,
    });
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    dispatchPointerEvent(resizeHandle, "pointercancel", {
      clientX: 240,
      clientY: 200,
      pointerId: 7,
    });

    expect(onLayoutChange).not.toHaveBeenCalled();
    fireEvent.keyDown(floatingPhoto, { key: "+" });
    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    const updateLayout = onLayoutChange.mock.calls[0][0];
    expect(updateLayout({ "photo-1": { x: 50, y: 50, width: 120 } })).toEqual({
      "photo-1": { x: 50, y: 50, width: 144 },
    });
  });

  it("keeps desktop dragging available when pointer capture fails and the pointer leaves the photo", async () => {
    getPhotoById.mockResolvedValue(photo);
    const onLayoutChange = vi.fn();
    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 120 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    Object.defineProperty(floatingPhoto, "setPointerCapture", {
      configurable: true,
      value: vi.fn(() => {
        throw new Error("capture unavailable");
      }),
    });
    dispatchPointerEvent(floatingPhoto, "pointerdown", { clientX: 100, clientY: 100 });
    dispatchPointerEvent(window, "pointermove", { clientX: 140, clientY: 100 });

    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    expect(Number.parseFloat(floatingPhoto.style.transform.match(/translate3d\(([^p]+)/)?.[1] ?? "NaN"))
      .toBeCloseTo(40, 5);
    dispatchPointerEvent(window, "pointerup", { clientX: 140, clientY: 100 });

    expect(onLayoutChange).toHaveBeenCalledTimes(1);

    Object.defineProperty(floatingPhoto, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    dispatchPointerEvent(floatingPhoto, "pointerdown", { clientX: 100, clientY: 100 });
    dispatchPointerEvent(floatingPhoto, "pointermove", { clientX: 120, clientY: 100 });
    dispatchPointerEvent(floatingPhoto, "pointerup", { clientX: 120, clientY: 100 });

    expect(onLayoutChange).toHaveBeenCalledTimes(2);
  });

  it("keeps desktop resizing available when pointer capture fails outside the handle", async () => {
    getPhotoById.mockResolvedValue(photo);
    const onLayoutChange = vi.fn();
    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 120 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />
    );

    await screen.findByRole("button", { name: /move photo/i });
    const resizeHandle = screen.getByTestId("journal-photo-resize-handle");
    Object.defineProperty(resizeHandle, "setPointerCapture", {
      configurable: true,
      value: vi.fn(() => {
        throw new Error("capture unavailable");
      }),
    });

    dispatchPointerEvent(resizeHandle, "pointerdown", {
      clientX: 200,
      clientY: 200,
      pointerId: 7,
    });
    dispatchPointerEvent(window, "pointermove", {
      clientX: 248,
      clientY: 200,
      pointerId: 7,
    });
    dispatchPointerEvent(window, "pointerup", {
      clientX: 248,
      clientY: 200,
      pointerId: 7,
    });

    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    const updateLayout = onLayoutChange.mock.calls[0][0];
    expect(updateLayout({ "photo-1": { x: 50, y: 50, width: 120 } })).toEqual({
      "photo-1": { x: 50, y: 50, width: 168 },
    });
  });

  it("commits a desktop drag when another target listener intercepts pointerup", async () => {
    getPhotoById.mockResolvedValue(photo);
    const onLayoutChange = vi.fn();
    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 120 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    floatingPhoto.addEventListener(
      "pointerup",
      (event) => event.stopImmediatePropagation(),
      { capture: true, once: true }
    );

    dispatchPointerEvent(floatingPhoto, "pointerdown", { clientX: 100, clientY: 100 });
    dispatchPointerEvent(floatingPhoto, "pointermove", { clientX: 140, clientY: 120 });
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    dispatchPointerEvent(floatingPhoto, "pointerup", { clientX: 140, clientY: 120 });
    await act(async () => Promise.resolve());

    expect(onLayoutChange).toHaveBeenCalledTimes(1);
  });

  it("does not roll back a committed preview when blur arrives after pointerup", async () => {
    getPhotoById.mockResolvedValue(photo);
    const onLayoutChange = vi.fn();
    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 120 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    dispatchPointerEvent(floatingPhoto, "pointerdown", { clientX: 100, clientY: 100 });
    dispatchPointerEvent(floatingPhoto, "pointermove", { clientX: 140, clientY: 120 });
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    dispatchPointerEvent(floatingPhoto, "pointerup", { clientX: 140, clientY: 120 });
    const committedTransform = floatingPhoto.style.transform;
    fireEvent(window, new Event("blur"));

    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    expect(committedTransform).toContain("translate3d(");
    expect(floatingPhoto.style.transform).toBe(committedTransform);
  });

  it("commits the visible position when pointer capture is lost", async () => {
    getPhotoById.mockResolvedValue(photo);
    const onLayoutChange = vi.fn();
    render(
      <FloatingMediaLayer
        entryId="entry-1"
        photoIds={["photo-1"]}
        layout={{ "photo-1": { x: 50, y: 50, width: 120 } }}
        onLayoutChange={onLayoutChange}
        onReturnToGallery={vi.fn()}
        containerRef={createContainerRef()}
      />,
    );

    const floatingPhoto = await screen.findByRole("button", { name: /move photo/i });
    dispatchPointerEvent(floatingPhoto, "pointerdown", { clientX: 100, clientY: 100 });
    dispatchPointerEvent(floatingPhoto, "pointermove", { clientX: 132, clientY: 142 });
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    expect(floatingPhoto.style.transform).toContain("translate3d(");

    dispatchPointerEvent(floatingPhoto, "lostpointercapture", { clientX: 132, clientY: 142 });

    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    expect(floatingPhoto.style.transform).toContain("translate3d(");
  });
});
