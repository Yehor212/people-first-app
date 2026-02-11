/**
 * TreeTrunk — Stages 3-5: organic trunk with branches.
 * Stage 3: thin sapling trunk
 * Stage 4: thicker trunk with 2 branch forks
 * Stage 5: majestic wide trunk with root flares
 */

import { TreeStage } from '@/lib/seasonHelper';

interface TreeTrunkProps {
  id: string;
  stage: TreeStage;
}

export function TreeTrunk({ id, stage }: TreeTrunkProps) {
  const groundY = 212;

  if (stage === 3) {
    return (
      <g>
        {/* Ground line with grass tufts */}
        <path
          d="M40 212 Q70 210 100 212 Q130 210 160 212"
          stroke="#5a8a4a"
          strokeWidth={1.5}
          fill="none"
          opacity={0.5}
        />
        {/* Grass tufts */}
        <path d="M55 212 L52 205 L58 212" fill="#6aaa5a" opacity={0.5} />
        <path d="M80 212 L78 206 L83 212" fill="#5a9a4a" opacity={0.4} />
        <path d="M120 212 L118 206 L123 212" fill="#6aaa5a" opacity={0.4} />
        <path d="M145 212 L143 206 L148 212" fill="#5a9a4a" opacity={0.5} />

        {/* Thin sapling trunk */}
        <path
          d={`M97 ${groundY} Q95 185 96 165 Q97 150 100 140 Q103 150 104 165 Q105 185 103 ${groundY} Z`}
          fill={`url(#trunkGrad-${id})`}
        />

        {/* Subtle bark texture lines */}
        <line x1={99} y1={200} x2={99} y2={180} stroke="#5c3a1f" strokeWidth={0.5} opacity={0.3} />
        <line x1={101} y1={195} x2={101} y2={170} stroke="#5c3a1f" strokeWidth={0.5} opacity={0.25} />
      </g>
    );
  }

  if (stage === 4) {
    return (
      <g>
        {/* Ground */}
        <path
          d="M30 212 Q65 209 100 212 Q135 209 170 212"
          stroke="#5a8a4a"
          strokeWidth={1.5}
          fill="none"
          opacity={0.5}
        />
        <path d="M45 212 L42 204 L48 212" fill="#6aaa5a" opacity={0.5} />
        <path d="M75 212 L72 205 L78 212" fill="#5a9a4a" opacity={0.4} />
        <path d="M125 212 L122 205 L128 212" fill="#6aaa5a" opacity={0.4} />
        <path d="M155 212 L152 204 L158 212" fill="#5a9a4a" opacity={0.5} />

        {/* Thicker trunk */}
        <path
          d={`M93 ${groundY} Q90 180 92 160 Q95 145 100 133 Q105 145 108 160 Q110 180 107 ${groundY} Z`}
          fill={`url(#trunkGrad-${id})`}
        />

        {/* Left branch */}
        <path
          d="M96 160 Q82 150 68 155"
          stroke="#6b3f1f"
          strokeWidth={5.5}
          strokeLinecap="round"
          fill="none"
        />

        {/* Right branch */}
        <path
          d="M104 160 Q118 150 132 155"
          stroke="#6b3f1f"
          strokeWidth={5.5}
          strokeLinecap="round"
          fill="none"
        />

        {/* Bark texture */}
        <line x1={98} y1={200} x2={97} y2={175} stroke="#5c3a1f" strokeWidth={0.6} opacity={0.3} />
        <line x1={102} y1={195} x2={103} y2={168} stroke="#5c3a1f" strokeWidth={0.6} opacity={0.25} />
        <line x1={100} y1={205} x2={100} y2={185} stroke="#4a2e16" strokeWidth={0.4} opacity={0.2} />
      </g>
    );
  }

  // Stage 5: Great Tree
  return (
    <g>
      {/* Ground */}
      <path
        d="M20 212 Q60 208 100 212 Q140 208 180 212"
        stroke="#5a8a4a"
        strokeWidth={1.5}
        fill="none"
        opacity={0.5}
      />
      <path d="M35 212 L32 203 L38 212" fill="#6aaa5a" opacity={0.5} />
      <path d="M65 212 L62 204 L68 212" fill="#5a9a4a" opacity={0.4} />
      <path d="M135 212 L132 204 L138 212" fill="#6aaa5a" opacity={0.4} />
      <path d="M165 212 L162 203 L168 212" fill="#5a9a4a" opacity={0.5} />

      {/* Majestic wide trunk */}
      <path
        d={`M88 ${groundY} Q84 190 86 168 Q89 150 94 138 Q97 130 100 125
            Q103 130 106 138 Q111 150 114 168 Q116 190 112 ${groundY} Z`}
        fill={`url(#trunkGrad-${id})`}
      />

      {/* Root flares */}
      <path
        d={`M88 ${groundY} Q78 215 65 220`}
        stroke="#5c3a1f"
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M112 ${groundY} Q122 215 135 220`}
        stroke="#5c3a1f"
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M92 ${groundY} Q85 216 76 220`}
        stroke="#6b3f1f"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        opacity={0.6}
      />

      {/* Thick branches */}
      <path
        d="M94 155 Q75 140 55 148"
        stroke="#6b3f1f"
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M106 155 Q125 140 145 148"
        stroke="#6b3f1f"
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      />
      {/* Upper branches */}
      <path
        d="M97 143 Q85 130 70 132"
        stroke="#6b3f1f"
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M103 143 Q115 130 130 132"
        stroke="#6b3f1f"
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />

      {/* Bark texture */}
      <line x1={97} y1={205} x2={96} y2={175} stroke="#4a2e16" strokeWidth={0.7} opacity={0.3} />
      <line x1={103} y1={200} x2={104} y2={170} stroke="#4a2e16" strokeWidth={0.7} opacity={0.25} />
      <line x1={100} y1={208} x2={100} y2={180} stroke="#5c3a1f" strokeWidth={0.5} opacity={0.2} />
      <line x1={95} y1={198} x2={94} y2={178} stroke="#5c3a1f" strokeWidth={0.4} opacity={0.2} />
      <line x1={105} y1={198} x2={106} y2={178} stroke="#5c3a1f" strokeWidth={0.4} opacity={0.2} />
    </g>
  );
}
