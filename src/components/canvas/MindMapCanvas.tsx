/**
 * MindMapCanvas — Infinite 2D interactive canvas with dark background.
 *
 * Uses framer-motion `drag` for pan, wheel + pinch for zoom.
 * Renders:
 *   - RootNode (center)
 *   - AuxPills (split mode: Emotions + Goals)
 *   - GrowingEdge + EmotionPanel (emotion-flow)
 *   - GoalTreeEdges + GoalNode[] + GoalActionMenu + GoalInput (goal tree)
 *
 * Exposes imperative API (recenter, zoomIn, zoomOut) via ref.
 */

import {
  forwardRef, useCallback, useEffect, useImperativeHandle,
  useMemo, useRef, useState,
} from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { RootNode } from './RootNode';
import { AuxPills } from './AuxPills';
import { GrowingEdge, getEdgeEndY } from './GrowingEdge';
import { EmotionPanel } from './EmotionPanel';
import { GoalTreeEdges } from './GoalTreeEdges';
import { GoalNode } from './GoalNode';
import { GoalActionSheet } from './GoalActionSheet';
import { GoalInput } from './GoalInput';
import { computeGoalTreeLayout } from './goalTreeLayout';
import { isBranchGoal } from '@/lib/canvasGoals';
import { zenMotion } from '@/lib/animationUtils';
import { useKeyboardShift } from '@/hooks/useKeyboardShift';
import type { MoodType, CanvasGoal } from '@/types';
import type { CanvasMode } from '@/stores/uiStore';

export interface MindMapCanvasRef {
  recenter: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface MindMapCanvasProps {
  latestMood: MoodType | null;
  canvasGoals: CanvasGoal[];
  canvasMode: CanvasMode;
  onRootTap: () => void;
  onCanvasBackgroundTap: () => void;
  onEmotionSelect: () => void;
  onGoalSelect: () => void;
  onEmotionSave: (mood: MoodType, text?: string) => void;
  onEmotionCancel: () => void;
  onGoalCreate: (title: string, parentId: string | null, icon?: string) => void;
  onGoalToggle: (goalId: string) => void;
  onGoalDelete: (goalId: string) => void;
  onGoalUpdateIcon: (goalId: string, icon: string | undefined) => void;
  onGoalCancel: () => void;
}

// Fixed canvas size
const CANVAS_SIZE = 800;
const MIN_ZOOM = 0.65;
const MAX_ZOOM = 2.5;

// Goal flow: target point for root goal input (right of Root)
const GOAL_INPUT_DISTANCE = 200;
const GOAL_INPUT_ANGLE = -Math.PI / 6; // upper-right (~-30°)

export const MindMapCanvas = forwardRef<MindMapCanvasRef, MindMapCanvasProps>(
  function MindMapCanvas({
    latestMood, canvasGoals, canvasMode,
    onRootTap, onCanvasBackgroundTap,
    onEmotionSelect, onGoalSelect,
    onEmotionSave, onEmotionCancel,
    onGoalCreate, onGoalToggle, onGoalDelete, onGoalUpdateIcon, onGoalCancel,
  }, ref) {
    const zoom = useMotionValue(1);
    const autoPanX = useMotionValue(0);
    const autoPanY = useMotionValue(0);

    // Pending auto-pan flag — set true before goal creation, consumed by effect
    const pendingAutoPanRef = useRef(false);

    // Canvas container ref — used for performance degradation during drag
    const canvasContainerRef = useRef<HTMLDivElement>(null);

    // Drag reset key — incrementing forces framer-motion to reset drag position
    const [dragKey, setDragKey] = useState(0);

    // Track selected mood in emotion flow for edge gradient color
    const [emotionFlowMood, setEmotionFlowMood] = useState<MoodType | null>(null);

    // Goal interaction state (local to canvas)
    const [activeGoalMenuId, setActiveGoalMenuId] = useState<string | null>(null);
    const [subtaskInput, setSubtaskInput] = useState<{ parentId: string; x: number; y: number } | null>(null);

    const half = CANVAS_SIZE / 2;
    const canvasCenter = useMemo(() => ({ x: half, y: half }), [half]);

    const isEmotionFlow = canvasMode === 'emotion-flow';
    const isGoalFlow = canvasMode === 'goal-flow';
    const isInputActive = isEmotionFlow || isGoalFlow || subtaskInput !== null;

    // Keyboard shift guard: detect virtual keyboard and shift canvas
    const keyboardOffset = useKeyboardShift(isInputActive);

    // Goal tree layout (pure computation)
    const goalLayout = useMemo(
      () => computeGoalTreeLayout(canvasGoals, canvasCenter),
      [canvasGoals, canvasCenter],
    );

    // Goal completion ratio for Root's progress ring
    const completionPercent = useMemo(() => {
      const rootGoals = canvasGoals.filter(g => g.parentId === null);
      if (rootGoals.length === 0) return 0;
      const done = rootGoals.filter(g => g.completed).length;
      return done / rootGoals.length;
    }, [canvasGoals]);

    // Goal-flow: compute where the root goal input should appear
    const goalInputTarget = useMemo(() => ({
      x: canvasCenter.x + Math.cos(GOAL_INPUT_ANGLE) * GOAL_INPUT_DISTANCE,
      y: canvasCenter.y + Math.sin(GOAL_INPUT_ANGLE) * GOAL_INPUT_DISTANCE,
    }), [canvasCenter]);

    // ── Auto-pan to newly created goals ──
    // When keyboard is visible (batch subtask entry), shift target upward
    // so the new node isn't hidden behind the virtual keyboard.
    useEffect(() => {
      if (!pendingAutoPanRef.current || goalLayout.nodes.length === 0) return;
      pendingAutoPanRef.current = false;
      const newest = goalLayout.nodes.reduce((a, b) =>
        a.goal.createdAt > b.goal.createdAt ? a : b,
      );
      const z = zoom.get();
      const targetX = (CANVAS_SIZE / 2 - newest.x) * z;
      // Extra upward shift when keyboard is visible (batch entry mode)
      const kbShift = keyboardOffset > 0 ? keyboardOffset / 2 : 0;
      const targetY = (CANVAS_SIZE / 2 - newest.y) * z - kbShift;
      animate(autoPanX, targetX, zenMotion.gentle);
      animate(autoPanY, targetY, zenMotion.gentle);
    }, [goalLayout, zoom, autoPanX, autoPanY, keyboardOffset]);

    // ── Auto-pan when BottomSheet opens/closes ──
    const sheetPanApplied = useRef(false);
    useEffect(() => {
      if (activeGoalMenuId && !sheetPanApplied.current) {
        sheetPanApplied.current = true;
        animate(autoPanY, autoPanY.get() - 120, zenMotion.gentle);
      } else if (!activeGoalMenuId && sheetPanApplied.current) {
        sheetPanApplied.current = false;
        animate(autoPanY, autoPanY.get() + 120, zenMotion.gentle);
      }
    }, [activeGoalMenuId, autoPanY]);

    // ── Imperative API ──

    useImperativeHandle(ref, () => ({
      recenter: () => {
        setDragKey(k => k + 1);
        zoom.set(1);
        animate(autoPanX, 0, zenMotion.gentle);
        animate(autoPanY, 0, zenMotion.gentle);
      },
      zoomIn: () => zoom.set(Math.min(MAX_ZOOM, zoom.get() * 1.2)),
      zoomOut: () => zoom.set(Math.max(MIN_ZOOM, zoom.get() / 1.2)),
    }), [zoom, autoPanX, autoPanY]);

    // ── Wheel zoom ──

    const handleWheel = useCallback((e: React.WheelEvent) => {
      e.stopPropagation();
      const factor = e.deltaY > 0 ? 0.95 : 1.05;
      zoom.set(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.get() * factor)));
    }, [zoom]);

    // ── Pinch zoom (two-finger touch) ──

    const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = {
          dist: Math.sqrt(dx * dx + dy * dy),
          zoom: zoom.get(),
        };
      }
    }, [zoom]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ratio = dist / pinchRef.current.dist;
        const next = pinchRef.current.zoom * ratio;
        zoom.set(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)));
      }
    }, [zoom]);

    const handleTouchEnd = useCallback(() => {
      pinchRef.current = null;
    }, []);

    // ── Background tap (collapse modes, dismiss menus) ──
    const dragStartPos = useRef<{ x: number; y: number } | null>(null);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
      dragStartPos.current = { x: e.clientX, y: e.clientY };
    }, []);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
      if (!dragStartPos.current) return;
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      dragStartPos.current = null;
      // Only fire if it was a tap (not a drag)
      if (dist < 5) {
        // Skip taps on interactive children — they handle themselves.
        // Letting pointer events bubble freely prevents Framer-motion
        // drag state corruption ("sticky mouse" bug).
        const target = e.target as HTMLElement;
        if (target.closest('button, input, [role="dialog"]')) return;

        // Dismiss local menus/inputs first
        if (activeGoalMenuId) {
          setActiveGoalMenuId(null);
          return;
        }
        if (subtaskInput) {
          setSubtaskInput(null);
          return;
        }
        // Don't dismiss emotion/goal flow via background tap
        if (!isEmotionFlow && !isGoalFlow) {
          onCanvasBackgroundTap();
        }
      }
    }, [onCanvasBackgroundTap, isEmotionFlow, isGoalFlow, activeGoalMenuId, subtaskInput]);

    // ── Emotion flow handlers ──

    const handleEmotionSave = useCallback((mood: MoodType, text?: string) => {
      setEmotionFlowMood(null);
      onEmotionSave(mood, text);
    }, [onEmotionSave]);

    const handleEmotionCancel = useCallback(() => {
      setEmotionFlowMood(null);
      onEmotionCancel();
    }, [onEmotionCancel]);

    // ── Goal flow handlers ──

    const handleGoalNodeTap = useCallback((goalId: string) => {
      // If menu is already open for this goal, close it
      if (activeGoalMenuId === goalId) {
        setActiveGoalMenuId(null);
      } else {
        setActiveGoalMenuId(goalId);
        setSubtaskInput(null); // dismiss any open subtask input
      }
    }, [activeGoalMenuId]);

    const handleAddSubtask = useCallback((parentId: string) => {
      setActiveGoalMenuId(null);
      // Find the parent node's position in the layout
      const parentNode = goalLayout.nodes.find(n => n.goal.id === parentId);
      if (parentNode) {
        // Position input offset from parent (outward from its angle)
        const offsetX = Math.cos(parentNode.angle) * 140;
        const offsetY = Math.sin(parentNode.angle) * 140;
        setSubtaskInput({
          parentId,
          x: parentNode.x + offsetX,
          y: parentNode.y + offsetY,
        });
      }
    }, [goalLayout.nodes]);

    const handleGoalToggle = useCallback((goalId: string) => {
      setActiveGoalMenuId(null);
      onGoalToggle(goalId);
    }, [onGoalToggle]);

    const handleGoalDelete = useCallback((goalId: string) => {
      setActiveGoalMenuId(null);
      onGoalDelete(goalId);
    }, [onGoalDelete]);

    const handleGoalFlowSubmit = useCallback((title: string, icon?: string) => {
      pendingAutoPanRef.current = true;
      onGoalCreate(title, null, icon);
    }, [onGoalCreate]);

    const handleGoalFlowCancel = useCallback(() => {
      onGoalCancel();
    }, [onGoalCancel]);

    const handleSubtaskSubmit = useCallback((title: string, icon?: string) => {
      if (!subtaskInput) return;
      pendingAutoPanRef.current = true;
      onGoalCreate(title, subtaskInput.parentId, icon);
      // Keep input open for batch entry — user can add more subtasks
      // without re-tapping the parent node. Cancel button closes it.
    }, [subtaskInput, onGoalCreate]);

    const handleSubtaskCancel = useCallback(() => {
      setSubtaskInput(null);
    }, []);

    const handleGoalMenuDismiss = useCallback(() => {
      setActiveGoalMenuId(null);
    }, []);

    const handleGoalUpdateIcon = useCallback((goalId: string, icon: string | undefined) => {
      onGoalUpdateIcon(goalId, icon);
    }, [onGoalUpdateIcon]);

    // Edge endpoint Y for emotion panel positioning
    const edgeEndY = getEdgeEndY(canvasCenter.y);

    // Find the active goal for the action menu
    const activeGoal = activeGoalMenuId
      ? canvasGoals.find(g => g.id === activeGoalMenuId) ?? null
      : null;
    return (
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 overflow-hidden"
        style={{ background: '#0D1117', touchAction: 'none', overscrollBehavior: 'none' }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {/* Auto-pan wrapper — programmatic pan via MotionValues, zero React re-renders */}
        <motion.div style={{ x: autoPanX, y: autoPanY }} className="absolute inset-0">
          <motion.div
            key={dragKey}
            drag={!isInputActive}
            dragConstraints={{
              left: -half,
              right: half,
              top: -half,
              bottom: half,
            }}
            dragElastic={0.1}
            dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
            onDragStart={() => {
              // Dismiss action menu as soon as user begins panning
              if (activeGoalMenuId) setActiveGoalMenuId(null);
              // Performance degradation: disable blur/animations during drag
              canvasContainerRef.current?.classList.add('canvas-drag-active');
            }}
            onDragEnd={() => {
              canvasContainerRef.current?.classList.remove('canvas-drag-active');
            }}
            className="relative will-change-transform"
            style={{
              width: CANVAS_SIZE,
              height: CANVAS_SIZE,
              left: `calc(50% - ${half}px)`,
              top: `calc(50% - ${half}px)`,
              scale: zoom,
              // Keyboard shift: pan canvas upward when keyboard is visible
              y: keyboardOffset > 0 ? -keyboardOffset / 2 : 0,
              transition: 'transform 0.2s ease-out',
            }}
          >
            {/* Goal tree edges (SVG Bezier curves from parent → child) */}
            <GoalTreeEdges nodes={goalLayout.nodes} canvasSize={CANVAS_SIZE} />

            {/* Goal tree nodes */}
            {goalLayout.nodes.map(node => (
              <GoalNode
                key={node.goal.id}
                goal={node.goal}
                x={node.x}
                y={node.y}
                progressPercent={node.progressPercent}
                onTap={handleGoalNodeTap}
                zoom={zoom}
              />
            ))}

            {/* Subtask creation input */}
            <GoalInput
              isVisible={subtaskInput !== null}
              anchorX={subtaskInput?.x ?? 0}
              anchorY={subtaskInput?.y ?? 0}
              placeholder="Add subtask..."
              onSubmit={handleSubtaskSubmit}
              onCancel={handleSubtaskCancel}
            />

            {/* Goal-flow: growing edge from Root outward + input for root goal */}
            {isGoalFlow && (
              <svg
                className="absolute inset-0 pointer-events-none z-0"
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
              >
                <defs>
                  <linearGradient
                    id="goal-flow-grad"
                    x1={canvasCenter.x} y1={canvasCenter.y}
                    x2={goalInputTarget.x} y2={goalInputTarget.y}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
                    <stop offset="100%" stopColor="rgba(52,211,153,0.5)" />
                  </linearGradient>
                </defs>
                <line
                  x1={canvasCenter.x}
                  y1={canvasCenter.y}
                  x2={goalInputTarget.x}
                  y2={goalInputTarget.y}
                  stroke="url(#goal-flow-grad)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  className="animate-pulse"
                />
              </svg>
            )}
            <GoalInput
              isVisible={isGoalFlow}
              anchorX={goalInputTarget.x}
              anchorY={goalInputTarget.y}
              placeholder="What's your goal?"
              onSubmit={handleGoalFlowSubmit}
              onCancel={handleGoalFlowCancel}
            />

            {/* Growing edge (emotion flow: Root → panel) */}
            <GrowingEdge
              canvasCenter={canvasCenter}
              isVisible={isEmotionFlow}
              selectedMood={emotionFlowMood}
            />

            {/* Emotion panel (anchored at edge endpoint) */}
            <EmotionPanel
              isVisible={isEmotionFlow}
              anchorX={canvasCenter.x}
              anchorY={edgeEndY}
              onSave={handleEmotionSave}
              onCancel={handleEmotionCancel}
            />

            {/* AuxPills (split mode: Emotions + Goals) */}
            <AuxPills
              canvasCenter={canvasCenter}
              canvasMode={canvasMode}
              onEmotionSelect={onEmotionSelect}
              onGoalSelect={onGoalSelect}
              zoom={zoom}
            />

            {/* Root node (on top) */}
            <RootNode
              latestMood={latestMood}
              canvasCenter={canvasCenter}
              completionPercent={completionPercent}
              canvasMode={canvasMode}
              onTap={onRootTap}
            />
          </motion.div>
        </motion.div>

        {/* GoalActionSheet — fixed BottomSheet, outside transform containers */}
        <GoalActionSheet
          goal={activeGoal}
          isBranch={activeGoalMenuId ? isBranchGoal(activeGoalMenuId, canvasGoals) : false}
          onAddSubtask={handleAddSubtask}
          onToggleComplete={handleGoalToggle}
          onDelete={handleGoalDelete}
          onUpdateIcon={handleGoalUpdateIcon}
          onDismiss={handleGoalMenuDismiss}
        />
      </div>
    );
  },
);
