---
description: Orb & shader rules — applies to src/components/state-of-mind/orb*
---

# Orb & Shader Rules

- Design philosophy: `docs/orb-design-philosophy.md` — read before changes
- 60 FPS mandatory (Law 8): profile GPU usage, eliminate layout thrashing
- Superformula SDF for shape morphing — preserve mathematical correctness
- 9-stop color spectrum with smooth transitions between states
- Theme-specific animations: day and night themes have unique orb behaviors
- GLSL uniforms: minimize uniform count, batch updates per frame
- Glass rim effect uses clean superformula SDF (always use exact math, prefer over approximations)
- Touch interaction: responsive to user input with smooth interpolation
