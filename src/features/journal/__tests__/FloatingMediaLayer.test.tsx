import { act, render, screen, fireEvent } from "@testing-library/react";
import { forwardRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FloatingMediaLayer } from "../FloatingMediaLayer";
import type { PhotoLayout } from "../FloatingMediaLayer";
import type { JournalPhoto } from "../types";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      diaryPhotoMove: "Move photo",
      diaryPhotoResize: "Resize photo",
      diaryPhotoGestureInstructions:
        "Drag to move. Tap to change size. Pinch also resizes. Press Home to center. Use arrow keys to move, plus or minus to resize, and Delete to return to the gallery. On touch, press and hold to return the photo to the gallery.",
      diaryPhotoGestureHint: "Drag, tap size, hold to return",
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
  getPhotoById: (photoId: string) => getPhotoById(photoId),
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
  target: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
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

    const floatingPhoto = await screen.findByRole("group", { name: /move photo/i });
    expect(floatingPhoto).toHaveStyle({ width: "304px" });
    expect(onLayoutChange).not.toHaveBeenCalled();
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

    const floatingPhoto = await screen.findByRole("group", { name: /move photo/i });
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

    const floatingPhoto = await screen.findByRole("group", { name: /move photo/i });
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

    expect(floatingPhoto).toHaveStyle({ width: "273.6px" });

    dispatchPointerEvent(floatingPhoto, "pointerup", {
      clientX: 190,
      clientY: 100,
      pointerId: 2,
      pointerType: "touch",
    });
    expect(onLayoutChange).toHaveBeenCalledWith(expect.any(Function));
    const updateLayout = onLayoutChange.mock.calls.at(-1)?.[0];
    expect(updateLayout({ "photo-1": { x: 50, y: 50, width: 500 } })).toEqual({
      "photo-1": { x: 50, y: 50, width: 273.6 },
    });
  });

  it("lets a direct tap resize floating photos without exposing a visible control rail", async () => {
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

    const floatingPhoto = await screen.findByRole("group", { name: /move photo/i });
    expect(screen.queryByRole("button", { name: /resize/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /return/i })).not.toBeInTheDocument();

    fireEvent.click(floatingPhoto);

    expect(onLayoutChange).toHaveBeenCalledWith(expect.any(Function));
    const updateLayout = onLayoutChange.mock.calls[0][0];
    expect(updateLayout({ "photo-1": { x: 50, y: 50, width: 120 } })).toEqual({
      "photo-1": { x: 50, y: 50, width: 160 },
    });
    expect(onReturnToGallery).not.toHaveBeenCalled();
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

    const floatingPhotos = await screen.findAllByRole("group", { name: /move photo/i });
    fireEvent.click(floatingPhotos[0]);
    fireEvent.click(floatingPhotos[1]);

    expect(JSON.parse(screen.getByTestId("layout-state").textContent || "{}")).toEqual({
      "photo-1": { x: 35, y: 45, width: 160 },
      "photo-2": { x: 65, y: 55, width: 160 },
    });
  });

  it("coalesces drag updates to the latest position in each animation frame", async () => {
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

    const floatingPhoto = await screen.findByRole("group", { name: /move photo/i });
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
});
