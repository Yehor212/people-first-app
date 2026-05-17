export function OrbLottie() {
  return (
    <div
      className="absolute inset-[-24px] pointer-events-none rounded-full bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.24),hsl(var(--accent)/0.12)_42%,transparent_72%)] opacity-40 motion-safe:animate-zen-glow-breathe"
      aria-hidden="true"
    >
      <span className="zen-particle absolute left-[22%] top-[30%] h-2 w-2 rounded-full bg-primary/60" />
      <span className="zen-particle absolute right-[20%] top-[45%] h-1.5 w-1.5 rounded-full bg-accent/70 [--particle-delay:160ms]" />
      <span className="zen-particle absolute bottom-[22%] left-[50%] h-2.5 w-2.5 rounded-full bg-secondary/70 [--particle-delay:280ms]" />
    </div>
  );
}
