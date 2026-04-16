# RSH-005: Premium Mobile Animation & Gesture Patterns (2025-2026)

**Date:** 2026-04-15
**Status:** Research Complete
**Scope:** Framer Motion (now `motion`), Telegram techniques, sidebar patterns, editor UX, micro-interactions, performance

---

## 1. Framer Motion / Motion Advanced Patterns

### Package Migration (2024-2025)
- `framer-motion` rebranded to `motion` (package: `motion`, import: `motion/react`)
- API surface identical -- no component or prop changes required
- New premium features: `AnimateView` for shared element transitions

### 1.1 layoutId Morphing (List -> Detail)

```tsx
// Source element (e.g., mood dot in sidebar)
<motion.div layoutId={`entry-${entry.id}`} className="mood-dot" />

// Target element (e.g., expanded entry card)
<AnimatePresence>
  {isExpanded && (
    <motion.div
      layoutId={`entry-${entry.id}`}
      className="entry-card"
      // Transition on the TARGET element is used when animating TO it
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    />
  )}
</AnimatePresence>
```

**Key rules:**
- `layoutId` is GLOBAL across the site -- use `<LayoutGroup id="sidebar">` to namespace
- Transition defined on the element we're animating TO is used
- When both elements exist simultaneously, they crossfade automatically
- Layout animations use CSS `transform` internally -- GPU-composited, no layout thrashing
- For content that stretches: add `layout` prop to children, or use `layout="position"` for images/text

### 1.2 Layout Animation with Specific Transition

```tsx
<motion.div
  layout
  animate={{ opacity: 0.5 }}
  transition={{
    ease: "linear",
    layout: { duration: 0.3 }  // Separate transition for layout vs other props
  }}
/>
```

### 1.3 AnimateView (New in Motion 2025+)

```tsx
// Shared element transition between views (replaces manual layoutId in some cases)
function Item({ setSelectedItem }) {
  return (
    <AnimateView name="item-1">
      <div className="item" onClick={() => startTransition(() => setSelectedItem("item-1"))} />
    </AnimateView>
  )
}

function Modal({ selectedItem }) {
  return (
    <AnimateView name={selectedItem}>
      <div className="modal" />
    </AnimateView>
  )
}
```

### 1.4 Troubleshooting Layout Animations
- **Content stretches**: Add `layout` prop to children for scale correction
- **Aspect ratio changes** (images): Use `layout="position"` instead of `layout={true}`
- **SVG**: Not supported with layout animations -- animate attributes directly (`cx`, `cy`, etc.)
- **Inside transform ancestor** (PullToRefresh): Use `createPortal(jsx, document.body)` -- `position: fixed` breaks under transform/filter/will-change ancestors

---

## 2. Spring Physics -- Values & Presets

### 2.1 Motion Default Values
| Parameter | Default | Description |
|-----------|---------|-------------|
| `stiffness` | `1` (Motion) / `100` (legacy FM) | Spring constant -- higher = snappier |
| `damping` | `10` | Resistance force -- higher = less oscillation |
| `mass` | `1` | Object weight -- higher = more lethargic |
| `bounce` | `0.25` | Simplified API: 0 = no bounce, 1 = very bouncy |
| `restSpeed` | `0.1` | End animation when speed drops below this |
| `restDelta` | `0.01` | End animation when distance drops below this |

**Note:** `bounce` and `duration` are overridden if `stiffness`/`damping`/`mass` are set.

### 2.2 Recommended Spring Presets for Premium Feel

```tsx
// Snappy UI response (buttons, toggles, small elements)
const SPRING_SNAPPY = { type: "spring", stiffness: 500, damping: 30, mass: 0.8 }

// Smooth navigation (page transitions, panels)
const SPRING_SMOOTH = { type: "spring", stiffness: 300, damping: 28, mass: 1 }

// Bouncy delight (success celebrations, FAB)
const SPRING_BOUNCY = { type: "spring", stiffness: 400, damping: 15, mass: 0.8 }

// Heavy/dramatic (modal open, sidebar expand)
const SPRING_HEAVY = { type: "spring", stiffness: 200, damping: 25, mass: 1.2 }

// Gentle settle (tooltips, popovers)
const SPRING_GENTLE = { type: "spring", stiffness: 150, damping: 20, mass: 1 }

// Quick micro-interaction (icon spin, scale)
const SPRING_MICRO = { type: "spring", stiffness: 900, damping: 20 }

// Layout morph (layoutId transitions)
const SPRING_MORPH = { type: "spring", stiffness: 300, damping: 25, mass: 1 }
```

### 2.3 Spring Physics Formula
```
acceleration = -stiffness * displacement / mass
velocity += acceleration * dt
velocity *= (1 - damping_factor)
position += velocity * dt
```

Key insight: springs feel natural because they decelerate as they approach rest position. The interplay of stiffness (snap speed), damping (oscillation control), and mass (inertia) creates organic motion that users intuitively understand.

**Tool:** https://emilkowal.ski/ui/great-animations#great-animations-feel-natural -- interactive spring visualizer by Emil Kowalski

---

## 3. Gesture-Driven Animations

### 3.1 Drag with Snap Points

```tsx
import { motion } from "motion/react"

// Basic drag with axis lock and constraints
<motion.div
  drag="x"
  dragConstraints={{ left: -200, right: 0 }}
  dragElastic={{ right: 0.04, left: 0.04 }}  // Rubber-band resistance
/>
```

### 3.2 Swipe Actions (iOS-style, Radix pattern)

```tsx
// useSnap hook pattern for swipe-to-reveal actions
const { dragProps, snapTo } = useSnap({
  direction: "x",
  ref: handleRef,
  snapPoints: {
    type: "constraints-box",
    points: [{ x: 0 }, { x: 1 }],  // 0 = closed, 1 = fully open
    unit: "percent",
  },
  constraints: {
    right: 0,
    left: -actionsWidth - actionsWrapperInset,
  },
  dragElastic: { right: 0.04, left: 0.04 },
  springOptions: { bounce: 0.2 },
});

// Touch-action CSS is REQUIRED for pan gestures on touch devices
// Apply: touch-action: pan-y (for horizontal swipe) or pan-x (for vertical)
```

**Critical CSS rule:** For pan/swipe gestures to work on mobile, the element needs `touch-action: pan-y` (if swiping horizontally) or `touch-action: pan-x` (if swiping vertically).

### 3.3 Inertia (Flick/Fling)

```tsx
// "inertia" animation type for deceleration after gesture release
<motion.div
  drag="x"
  dragTransition={{
    power: 0.3,          // Deceleration factor
    timeConstant: 200,   // Duration of deceleration
    modifyTarget: (v) => Math.round(v / 100) * 100  // Snap to grid
  }}
/>
```

---

## 4. Exit Animations & Stagger

### 4.1 AnimatePresence Exit

```tsx
<AnimatePresence mode="wait">  {/* "wait" = exit completes before enter starts */}
  {isVisible && (
    <motion.div
      key={uniqueKey}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ type: "spring", duration: 0.5 }}
    />
  )}
</AnimatePresence>
```

**Modes:**
- `"sync"` (default): Enter and exit happen simultaneously
- `"wait"`: Exit animation completes, then enter starts
- `"popLayout"`: Exiting elements are popped out of layout flow

### 4.2 Stagger Children

```tsx
import { stagger } from "motion/react"

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      delayChildren: stagger(0.05),      // 50ms between each child
      // OR: delayChildren: stagger(0.05, { from: "center" })
      // OR: delayChildren: stagger(0.05, { from: "last" })
      staggerDirection: 1,                // 1 = first-to-last, -1 = reverse
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map((i) => (
    <motion.li key={i.id} variants={item} />
  ))}
</motion.ul>
```

### 4.3 Variant Propagation

```tsx
// Parent defines animate prop; children only define variant behaviors
// Variants "flow down" through child motion components automatically
const parent = {
  rest: {},
  hover: {},
}
const child = {
  rest: { scale: 1 },
  hover: { scale: 1.05, transition: { type: "spring", stiffness: 400 } },
}

<motion.div variants={parent} initial="rest" whileHover="hover">
  <motion.span variants={child}>Glows on parent hover</motion.span>
</motion.div>
```

---

## 5. Telegram Animation Techniques

### 5.1 Android Source Code Analysis (DrKLO/Telegram)

From Telegram's open-source Android code:

```java
// ChatAttachAlert.java -- attachment panel spring
SpringAnimation springAnimation = new SpringAnimation(view, property);
springAnimation.getSpring()
    .setStiffness(500.0f)
    .setDampingRatio(0.75f);

// PhotoViewer.java -- caption spring
springAnimation.getSpring()
    .setStiffness(100f);

// AndroidUtilities.java -- utility spring
// applySpring(stiffness, damping, mass, initialVelocity)
// computeDampingRatio(tension, friction, mass)
```

### 5.2 Telegram Spring Constants (Extracted)

| Context | Stiffness | Damping Ratio | Feel |
|---------|-----------|---------------|------|
| Attachment panel | 500 | 0.75 | Snappy, slight bounce |
| Photo viewer caption | 100 | ~0.8 | Gentle, smooth |
| Message reactions | 600 | 0.75 | Very snappy |
| General UI transitions | 400 | 0.8 | Balanced |

### 5.3 Telegram's 60fps Strategies
- **Performance class detection**: Measures device capabilities, adjusts particle counts and blur params
- **Invalidate-on-draw loop**: `invalidate()` on each draw pass, slightly changing animated values
- **Lottie via .tgs**: Animated stickers/emoji use gZipped Lottie files
- **Custom canvas drawing**: Many animations bypass View system entirely, drawing directly to Canvas
- **Layer type HARDWARE**: Key views use `setLayerType(LAYER_TYPE_HARDWARE)` during animation

### 5.4 Mapping to Motion/React Equivalents

```tsx
// Telegram "attachment panel" feel
const TELEGRAM_SNAPPY = { type: "spring", stiffness: 500, damping: 22 }

// Telegram "photo viewer" feel
const TELEGRAM_GENTLE = { type: "spring", stiffness: 100, damping: 15 }

// Telegram "reaction" feel
const TELEGRAM_REACTIVE = { type: "spring", stiffness: 600, damping: 24 }

// Telegram "general UI" feel
const TELEGRAM_BALANCED = { type: "spring", stiffness: 400, damping: 20 }
```

Note: Android's `dampingRatio` maps differently to Motion's `damping`. Android ratio 0.75 ~ Motion damping 20-24 depending on stiffness. Use the spring visualizer to tune.

---

## 6. Collapsible Sidebar Patterns (3-State)

### 6.1 Three-State Architecture

```
HIDDEN (0px) <--> COMPACT (48px) <--> EXPANDED (280px)
```

### 6.2 Gesture-Driven Sidebar

```tsx
const SIDEBAR_STATES = {
  hidden: { width: 0, opacity: 0 },
  compact: { width: 48, opacity: 1 },
  expanded: { width: 280, opacity: 1 },
}

function Sidebar({ state }: { state: "hidden" | "compact" | "expanded" }) {
  return (
    <motion.aside
      animate={state}
      variants={SIDEBAR_STATES}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      drag="x"
      dragConstraints={{ left: 0, right: 280 }}
      dragElastic={0.1}
      onDragEnd={(_, info) => {
        // Snap to nearest state based on velocity + position
        if (info.velocity.x > 200) expandSidebar()
        else if (info.velocity.x < -200) collapseSidebar()
        else snapToNearest(info.offset.x)
      }}
      style={{ touchAction: "pan-y" }}  // Allow vertical scroll while swiping
    >
      {/* Content adapts based on state */}
    </motion.aside>
  )
}
```

### 6.3 Avoiding Content Shift

```tsx
// Option A: Sidebar overlays content (no shift)
<motion.aside className="fixed left-0 top-0 z-40" />

// Option B: Content margin animates in sync
<motion.main
  animate={{ marginLeft: state === "expanded" ? 280 : state === "compact" ? 48 : 0 }}
  transition={{ type: "spring", stiffness: 300, damping: 28 }}
/>

// Option C: CSS Grid with animated template
<motion.div
  style={{ display: "grid" }}
  animate={{ gridTemplateColumns: state === "expanded" ? "280px 1fr" : "48px 1fr" }}
/>
```

### 6.4 Edge Swipe Detection

```tsx
// Detect swipe from left edge of screen
useEffect(() => {
  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    if (touch.clientX < 20) {  // Within 20px of left edge
      setEdgeSwipeActive(true)
    }
  }
  document.addEventListener("touchstart", handleTouchStart, { passive: true })
  return () => document.removeEventListener("touchstart", handleTouchStart)
}, [])
```

---

## 7. Writing/Editor UX Animations

### 7.1 Floating Toolbar (Notion/Medium Pattern)

```tsx
function FloatingToolbar({ selectionRect }: { selectionRect: DOMRect | null }) {
  return (
    <AnimatePresence>
      {selectionRect && (
        <motion.div
          className="fixed z-[70] bg-background/95 rounded-lg shadow-lg px-2 py-1"
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          style={{
            left: selectionRect.left + selectionRect.width / 2,
            top: selectionRect.top - 48,
            transform: "translateX(-50%)",
          }}
        >
          <ToolbarButtons />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

### 7.2 Keyboard-Aware Layout (Mobile Web)

**Modern approach (2025+):** Use dynamic viewport units (`dvh`), not VisualViewport observers.

```tsx
// In your root layout / Capacitor app
// Tailwind: h-dvh instead of h-screen
<div className="h-dvh flex flex-col">
  <main className="flex-1 overflow-y-auto">{children}</main>
  <footer className="shrink-0">
    <EditorToolbar />
  </footer>
</div>
```

```tsx
// Viewport meta for Android/Chromium keyboard resize
// In index.html or Capacitor config:
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, interactive-widget=resizes-content" />
```

**Key:** `interactive-widget=resizes-content` tells Android Chrome to resize the layout viewport when the keyboard opens, making `dvh` work correctly.

### 7.3 Focus Mode Transition

```tsx
const focusModeVariants = {
  normal: { opacity: 1 },
  focused: { opacity: 0.3, filter: "blur(2px)", transition: { duration: 0.4 } },
}

// Dim everything except the editor
<motion.div
  variants={focusModeVariants}
  animate={isFocused ? "focused" : "normal"}
  className="sidebar"
/>

// Editor itself gets enhanced
<motion.div
  animate={isFocused ? {
    scale: 1.02,
    boxShadow: "0 0 60px rgba(0,0,0,0.1)",
  } : {
    scale: 1,
    boxShadow: "0 0 0px rgba(0,0,0,0)",
  }}
  transition={{ type: "spring", stiffness: 200, damping: 25 }}
/>
```

### 7.4 Auto-Scroll to Cursor

```tsx
function useAutoScrollToCursor(editorRef: RefObject<HTMLDivElement>) {
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const observer = new MutationObserver(() => {
      const selection = window.getSelection()
      if (!selection?.rangeCount) return
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const editorRect = editor.getBoundingClientRect()

      // If cursor is below visible area, scroll down
      if (rect.bottom > editorRect.bottom - 60) {
        editor.scrollBy({
          top: rect.bottom - editorRect.bottom + 80,
          behavior: "smooth",
        })
      }
    })

    observer.observe(editor, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [editorRef])
}
```

---

## 8. Micro-Interactions for Premium Feel

### 8.1 Button Press Feedback

```tsx
// Scale + spring for tactile feel
<motion.button
  whileTap={{ scale: 0.95 }}
  whileHover={{ scale: 1.02 }}
  transition={{ type: "spring", stiffness: 500, damping: 20 }}
  onClick={() => {
    // Haptic feedback (Capacitor)
    Haptics.impact({ style: ImpactStyle.Light })
  }}
>
  Save
</motion.button>
```

### 8.2 Success Celebration

```tsx
const checkmarkVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { type: "spring", duration: 0.8, bounce: 0 },
      opacity: { duration: 0.1 },
    },
  },
}

<motion.svg viewBox="0 0 24 24">
  <motion.path
    d="M5 13l4 4L19 7"
    variants={checkmarkVariants}
    initial="hidden"
    animate="visible"
    stroke="currentColor"
    strokeWidth={2}
    fill="none"
  />
</motion.svg>
```

### 8.3 Skeleton Shimmer

```tsx
// Official Motion pattern (2025)
<motion.div
  className="h-4 w-full rounded bg-muted"
  animate={{
    backgroundPosition: ["200% 0", "-200% 0"],
  }}
  transition={{
    duration: 1.5,
    repeat: Infinity,
    ease: "linear",
  }}
  style={{
    backgroundImage: "linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.3) 50%, transparent 75%)",
    backgroundSize: "200% 100%",
  }}
/>
```

### 8.4 Pull-to-Refresh Custom Animation

```tsx
function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const y = useMotionValue(0)
  const opacity = useTransform(y, [0, 60], [0, 1])
  const rotate = useTransform(y, [0, 80], [0, 360])

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0, bottom: 80 }}
      dragElastic={0.4}
      style={{ y }}
      onDragEnd={async (_, info) => {
        if (info.offset.y > 60) {
          await onRefresh()
        }
      }}
    >
      <motion.div
        className="flex justify-center py-2"
        style={{ opacity, rotate }}
      >
        <RefreshIcon />
      </motion.div>
      <div>{/* Content */}</div>
    </motion.div>
  )
}
```

### 8.5 Tab Switching with Underline

```tsx
function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <div className="flex relative">
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onTabChange(tab.id)}>
          {tab.label}
          {activeTab === tab.id && (
            <motion.div
              layoutId="tab-underline"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  )
}
```

### 8.6 Empty State with Subtle Motion

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
>
  <motion.div
    animate={{ y: [0, -8, 0] }}
    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
  >
    <EmptyIllustration />
  </motion.div>
  <p className="text-muted-foreground mt-4">No entries yet</p>
</motion.div>
```

---

## 9. Performance Best Practices

### 9.1 Animation Performance Tier List (from Motion.dev)

| Tier | What | Why | Examples |
|------|------|-----|----------|
| **S-Tier** | CSS/WAAPI composited | Runs on compositor thread, never blocked by main thread | CSS `@keyframes` on transform/opacity, WAAPI |
| **A-Tier** | JS-driven composited | Uses transform/opacity but driven from main thread | Motion spring on transform, opacity |
| **B-Tier** | Paint-only | Triggers repaint but no layout recalculation | `color`, `background-color`, `box-shadow` |
| **C-Tier** | Layout-triggering | Forces layout recalculation | `width`, `height`, `padding`, `font-size` |
| **F-Tier** | Layout thrashing | Multiple forced layout recalcs per frame | Reading layout -> writing -> reading again |

### 9.2 GPU Acceleration Rules

```css
/* SAFE to animate (GPU compositor) */
transform: translateX() / translateY() / scale() / rotate();
opacity: 0..1;

/* TRIGGER REPAINT ONLY (acceptable) */
background-color, color, box-shadow, border-color;

/* TRIGGER LAYOUT (avoid in animations) */
width, height, padding, margin, top, left, flex, grid-template-*;
```

### 9.3 will-change Usage

```css
/* DO: Apply before animation starts, remove after */
.sidebar-animating {
  will-change: transform, opacity;
}

/* DON'T: Apply permanently to many elements */
/* This creates excessive GPU layers and wastes memory */
.every-element {
  will-change: transform;  /* BAD */
}
```

**Motion's approach:** Does NOT spray `will-change` across every element. Layer promotion is a tool to use knowingly, not a blanket optimization.

### 9.4 Layer Promotion Triggers (Automatic)
- Active CSS/WAAPI `transform` animation
- 3D `transform` (even `translateZ(0)`)
- `position: fixed` or `sticky`
- `backdrop-filter`
- Overlapping another layer

### 9.5 Avoiding Layout Thrashing

```tsx
// BAD: Read-write-read-write cycle
elements.forEach(el => {
  const height = el.offsetHeight    // READ (forces layout)
  el.style.height = height + 10     // WRITE (invalidates layout)
})

// GOOD: Batch reads, then batch writes
const heights = elements.map(el => el.offsetHeight)  // All reads
elements.forEach((el, i) => {
  el.style.height = heights[i] + 10  // All writes
})
```

### 9.6 Motion-Specific Performance Tips

```tsx
// Use layout animations instead of animating width/height directly
// Motion internally uses transform for layout animations = GPU composited
<motion.div layout />  // GOOD: uses transform internally

// useMotionValue for values that change every frame
const x = useMotionValue(0)  // Doesn't trigger React re-render
const opacity = useTransform(x, [0, 200], [1, 0])

// MotionConfig for global defaults (reduces per-component overhead)
<MotionConfig transition={{ type: "spring", stiffness: 300, damping: 25 }}>
  <App />
</MotionConfig>

// Reduced motion support
<MotionConfig reducedMotion="user">  {/* Respects prefers-reduced-motion */}
  <App />
</MotionConfig>
```

### 9.7 requestAnimationFrame Pattern

```tsx
// For custom animations outside Motion
function useAnimationFrame(callback: (dt: number) => void) {
  const rafRef = useRef<number>()
  const prevTimeRef = useRef<number>()

  useEffect(() => {
    const animate = (time: number) => {
      if (prevTimeRef.current !== undefined) {
        const dt = time - prevTimeRef.current
        callback(dt)
      }
      prevTimeRef.current = time
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [callback])
}
```

### 9.8 CSS Containment

```css
/* Isolate animation impact to specific subtrees */
.sidebar {
  contain: layout style;  /* Changes inside don't affect outside layout */
}

.animation-container {
  contain: strict;  /* Maximum isolation: layout + style + paint + size */
}
```

---

## 10. Easing Curves Reference

### Named Easings (Motion)
```tsx
// Built-in easings
"linear"
"easeIn"        // [0.42, 0, 1, 1]
"easeOut"       // [0, 0, 0.58, 1]
"easeInOut"     // [0.42, 0, 0.58, 1]
"circIn"
"circOut"
"circInOut"
"backIn"
"backOut"
"backInOut"
"anticipate"    // Wind-up then overshoot
```

### Custom Cubic Bezier
```tsx
// Premium feel curves
ease: [0.25, 0.1, 0.25, 1.0]    // Material Design standard
ease: [0.4, 0.0, 0.2, 1.0]      // Material Design decelerate
ease: [0.0, 0.0, 0.2, 1.0]      // Material Design accelerate
ease: [0, 0.71, 0.2, 1.01]      // Slight overshoot (Motion default example)
ease: [0.16, 1, 0.3, 1]         // Apple-like ease out
ease: [0.33, 1, 0.68, 1]        // CSS ease-out equivalent
ease: [0.76, 0, 0.24, 1]        // Symmetric ease-in-out
```

---

## Sources

- [Motion.dev - Layout Animations](https://motion.dev/docs/react-layout-animations)
- [Motion.dev - Transitions](https://motion.dev/docs/react-transitions)
- [Motion.dev - Animation Performance Tier List](https://motion.dev/magazine/web-animation-performance-tier-list)
- [Maxime Heckel - Everything about Layout Animations](https://blog.maximeheckel.com/posts/framer-motion-layout-animations/)
- [Maxime Heckel - Advanced Animation Patterns](https://blog.maximeheckel.com/posts/advanced-animation-patterns-with-framer-motion/)
- [Maxime Heckel - Physics Behind Spring Animations](https://blog.maximeheckel.com/posts/the-physics-behind-spring-animations/)
- [OlegWock - Swipe Actions with React and Framer Motion](https://sinja.io/blog/swipe-actions-react-framer-motion)
- [Emil Kowalski - Spring Visualizer](https://emilkowal.ski/ui/great-animations)
- [Telegram Android Source (DrKLO/Telegram)](https://github.com/DrKLO/Telegram)
- [Motion.dev - Skeleton Shimmer Example](https://motion.dev/examples/react-skeleton-shimmer)
- [Jacob Cofman - Micro Animations in React](https://jcofman.de/blog/micro-animations)
- [CSS GPU Acceleration Guide](https://www.lexo.ch/blog/2025/01/boost-css-performance-with-will-change-and-transform-translate3d-why-gpu-acceleration-matters/)
- [VisualViewport Keyboard Fix](https://dev.to/franciscomoretti/fix-mobile-keyboard-overlap-with-visualviewport-3a4a)
- [Android SpringAnimation Docs](https://developer.android.com/develop/ui/views/animations/spring-animation)
- [60fps.design - Telegram Animations](https://60fps.design/apps/telegram)
- [Motion.dev - Stagger](https://www.framer.com/motion/stagger/)
- [Motion.dev - Gestures](https://www.framer.com/motion/gestures/)
