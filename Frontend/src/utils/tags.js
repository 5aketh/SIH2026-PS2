export const MAX_DESCRIPTION = 400;

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** True when the tag appears in the text as a whole word (case-insensitive). */
export function hasTag(text, tag) {
  return new RegExp('(^|[^a-z0-9-])' + escapeRe(tag) + '(?=$|[^a-z0-9-])', 'i').test(text);
}

/** Appends a tag, comma-separated. Returns the new text, or null if it would exceed the limit. */
export function appendTag(text, tag, max = MAX_DESCRIPTION) {
  const base = text.replace(/\s+$/, '');
  const next = !base ? tag : /,$/.test(base) ? base + ' ' + tag : base + ', ' + tag;
  return next.length > max ? null : next;
}
