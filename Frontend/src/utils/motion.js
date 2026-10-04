export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function clamp01(v) { return clamp(v, 0, 1); }
/** Progress of p through the window [a, b], clamped to 0–1. */
export function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
/** easeInOutCubic */
export function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
export function lerp(a, b, t) { return a + (b - a) * t; }
