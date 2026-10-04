/*
 * Display formatting for backend figures. Values are shown, never derived:
 * these helpers only add units and handle missing values.
 */

const MAX_DAYS = 3650; // backend's cap for "doesn't limit shelf life"

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function days(d) {
  if (!isNum(d)) return null;
  if (d >= MAX_DAYS) return '10+ years';
  return `${d % 1 === 0 ? d : d.toFixed(1)} ${d === 1 ? 'day' : 'days'}`;
}

export function dayRange(lo, hi) {
  if (!isNum(lo) || !isNum(hi)) return null;
  if (hi >= MAX_DAYS) return `${lo}+ days`;
  return `${lo}–${hi} days`;
}

export function inr(v) {
  return isNum(v) ? `₹${v.toFixed(2)}` : null;
}

export function num(v, unit) {
  if (!isNum(v)) return null;
  const text = Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-IN') : String(v);
  return unit ? `${text} ${unit}` : text;
}

export function label(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
