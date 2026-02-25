/** Module-level flag to pause Canvas rAF during typing / image manipulation. Zero React overhead. */
let _paused = false;
export const setCanvasPaused = (v: boolean) => { _paused = v; };
export const isCanvasPaused = () => _paused;
