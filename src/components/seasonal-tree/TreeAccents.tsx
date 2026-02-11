/**
 * TreeAccents — Seasonal decorative elements on the canopy.
 * Spring: cherry blossom circles
 * Summer: golden sun dapple dots
 * Autumn: orange-red fruit ellipses
 * Winter: snow cap on canopy top
 */

import { useMemo } from 'react';
import { Season, TreeStage } from '@/lib/seasonHelper';

interface TreeAccentsProps {
  season: Season;
  stage: TreeStage;
  stageScale: number;
  lowStimulus?: boolean;
}

interface AccentDot {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  delay: string;
}

export function TreeAccents({ season, stage, stageScale, lowStimulus }: TreeAccentsProps) {
  const canopyCenterY = stage === 3 ? 115 : stage === 4 ? 108 : 95;
  const canopyRadius = 50 * stageScale;

  const accentDots = useMemo(() => {
    if (lowStimulus || stage <= 2) return [];
    const count = season === 'spring' ? 8 : season === 'summer' ? 6 : season === 'autumn' ? 6 : 0;
    const dots: AccentDot[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + 0.3;
      const dist = 0.35 + (i % 3) * 0.2;
      dots.push({
        cx: 100 + Math.cos(angle) * canopyRadius * dist,
        cy: canopyCenterY + Math.sin(angle) * canopyRadius * dist * 0.7,
        rx: season === 'autumn' ? 3.5 : 2.8,
        ry: season === 'autumn' ? 2.8 : 2.8,
        delay: `${i * 0.4}s`,
      });
    }
    return dots;
  }, [season, canopyRadius, canopyCenterY, lowStimulus, stage]);

  if (lowStimulus || stage <= 2) return null;

  if (season === 'spring') {
    return (
      <g>
        {accentDots.map((dot, i) => (
          <g key={i}>
            <circle
              cx={dot.cx}
              cy={dot.cy}
              r={dot.rx}
              fill="#ffc7d6"
              opacity={0.7}
            >
              <animate
                attributeName="opacity"
                values="0.5;0.8;0.5"
                dur="3s"
                begin={dot.delay}
                repeatCount="indefinite"
              />
            </circle>
            <circle
              cx={dot.cx}
              cy={dot.cy}
              r={dot.rx * 0.4}
              fill="#fff0f5"
              opacity={0.6}
            />
          </g>
        ))}

        {stage >= 4 && (
          <>
            <circle cx={72} cy={210} r={2.5} fill="#ffb7c5" opacity={0.6} />
            <circle cx={78} cy={211} r={2} fill="#ffc7d6" opacity={0.5} />
            <circle cx={125} cy={210} r={2.5} fill="#ffb7c5" opacity={0.6} />
            <circle cx={130} cy={211} r={2} fill="#ffc7d6" opacity={0.5} />
          </>
        )}
      </g>
    );
  }

  if (season === 'summer') {
    return (
      <g>
        {accentDots.map((dot, i) => (
          <circle
            key={i}
            cx={dot.cx}
            cy={dot.cy}
            r={2}
            fill="#FFD700"
            opacity={0.4}
          >
            <animate
              attributeName="opacity"
              values="0.2;0.5;0.2"
              dur="4s"
              begin={dot.delay}
              repeatCount="indefinite"
            />
          </circle>
        ))}

        {stage >= 4 && (
          <>
            <path d="M60 212 L57 205 L63 212" fill="#4CAF50" opacity={0.6} />
            <path d="M70 212 L68 206 L73 212" fill="#66BB6A" opacity={0.5} />
            <path d="M130 212 L128 206 L133 212" fill="#66BB6A" opacity={0.5} />
            <path d="M140 212 L137 205 L143 212" fill="#4CAF50" opacity={0.6} />
          </>
        )}
      </g>
    );
  }

  if (season === 'autumn') {
    return (
      <g>
        {accentDots.map((dot, i) => (
          <ellipse
            key={i}
            cx={dot.cx}
            cy={dot.cy}
            rx={dot.rx}
            ry={dot.ry}
            fill={i % 2 === 0 ? '#f39c3d' : '#e8601c'}
            opacity={0.7}
          >
            <animate
              attributeName="opacity"
              values="0.5;0.8;0.5"
              dur="3.5s"
              begin={dot.delay}
              repeatCount="indefinite"
            />
          </ellipse>
        ))}

        {stage >= 4 && (
          <>
            <ellipse cx={68} cy={215} rx={3} ry={1.5} fill="#FF6B35" opacity={0.4} transform="rotate(20 68 215)" />
            <ellipse cx={85} cy={216} rx={2.5} ry={1.3} fill="#f39c3d" opacity={0.35} transform="rotate(-15 85 216)" />
            <ellipse cx={118} cy={215} rx={2.5} ry={1.3} fill="#FF6B35" opacity={0.35} transform="rotate(10 118 215)" />
            <ellipse cx={135} cy={216} rx={3} ry={1.5} fill="#f39c3d" opacity={0.4} transform="rotate(-25 135 216)" />
          </>
        )}
      </g>
    );
  }

  if (season === 'winter') {
    return (
      <g>
        <ellipse
          cx={100}
          cy={canopyCenterY - canopyRadius * 0.5}
          rx={canopyRadius * 0.55}
          ry={canopyRadius * 0.13}
          fill="rgba(255,255,255,0.85)"
        >
          <animate
            attributeName="opacity"
            values="0.7;0.9;0.7"
            dur="5s"
            repeatCount="indefinite"
          />
        </ellipse>
        {stage >= 4 && (
          <>
            <ellipse
              cx={100 - canopyRadius * 0.4}
              cy={canopyCenterY - canopyRadius * 0.25}
              rx={canopyRadius * 0.25}
              ry={canopyRadius * 0.08}
              fill="rgba(255,255,255,0.6)"
            />
            <ellipse
              cx={100 + canopyRadius * 0.4}
              cy={canopyCenterY - canopyRadius * 0.25}
              rx={canopyRadius * 0.25}
              ry={canopyRadius * 0.08}
              fill="rgba(255,255,255,0.6)"
            />
          </>
        )}

        {stage >= 4 && (
          <>
            <ellipse cx={75} cy={213} rx={12} ry={2.5} fill="rgba(255,255,255,0.4)" />
            <ellipse cx={125} cy={213} rx={12} ry={2.5} fill="rgba(255,255,255,0.4)" />
            <ellipse cx={100} cy={214} rx={15} ry={3} fill="rgba(255,255,255,0.3)" />
          </>
        )}
      </g>
    );
  }

  return null;
}
