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
  forwardRef, useCallback, useImperativeHandle,
  useMemo, useRef, useState,
} from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { RootNode } from './RootNode';
import { AuxPills } from './AuxPills';
import { GrowingEdge, getEdgeEndY } from './GrowingEdge';
import { EmotionPanel } from './EmotionPanel';
import { GoalTreeEdges } from './GoalTreeEdges';
import { GoalNode } from './GoalNode';
import { GoalActionMenu } from './GoalActionMenu';
import { GoalInput } from './GoalInput';
import { computeGoalTreeLayout } from './goalTreeLayout';
import { isBranchGoal } from '@/lib/canvasGoals';
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
  onGoalCancel: () => void;
}

// Fixed canvas size
const CANVAS_SIZE = 800;
const MIN_ZOOM = 0.5;
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
    onGoalCreate, onGoalToggle, onGoalDelete, onGoalCancel,
  }, ref) {
    const zoom = useMotionValue(1);

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

    // ── Imperative API ──

    useImperativeHandle(ref, () => ({
      recenter: () => {
        setDragKey(k => k + 1);
        zoom.set(1);
      },
      zoomIn: () => zoom.set(Math.min(MAX_ZOOM, zoom.get() * 1.2)),
      zoomOut: () => zoom.set(Math.max(MIN_ZOOM, zoom.get() / 1.2)),
    }), [zoom]);

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
      onGoalCreate(title, null, icon);
    }, [onGoalCreate]);

    const handleGoalFlowCancel = useCallback(() => {
      onGoalCancel();
    }, [onGoalCancel]);

    const handleSubtaskSubmit = useCallback((title: string, icon?: string) => {
      if (!subtaskInput) return;
      onGoalCreate(title, subtaskInput.parentId, icon);
      setSubtaskInput(null);
    }, [subtaskInput, onGoalCreate]);

    const handleSubtaskCancel = useCallback(() => {
      setSubtaskInput(null);
    }, []);

    const handleGoalMenuDismiss = useCallback(() => {
      setActiveGoalMenuId(null);
    }, []);

    // Edge endpoint Y for emotion panel positioning
    const edgeEndY = getEdgeEndY(canvasCenter.y);

    // Find the active goal for the action menu
    const activeGoal = activeGoalMenuId
      ? canvasGoals.find(g => g.id === activeGoalMenuId) ?? null
      : null;
    const activeGoalNode = activeGoalMenuId
      ? goalLayout.nodes.find(n => n.goal.id === activeGoalMenuId)
      : null;

    return (
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ background: '#0D1117', touchAction: 'none', overscrollBehavior: 'none' }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
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
            />
          ))}

          {/* Goal action menu (shown when a goal node is tapped) */}
          <GoalActionMenu
            goal={activeGoal}
            isBranch={activeGoalMenuId ? isBranchGoal(activeGoalMenuId, canvasGoals) : false}
            anchorX={activeGoalNode?.x ?? 0}
            anchorY={activeGoalNode?.y ?? 0}
            onAddSubtask={handleAddSubtask}
            onToggleComplete={handleGoalToggle}
            onDelete={handleGoalDelete}
            onDismiss={handleGoalMenuDismiss}
          />

          {/* Subtask creation input (from GoalActionMenu → "+" ) */}
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
      </div>
    );
  },
);
