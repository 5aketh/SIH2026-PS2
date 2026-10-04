import { useId } from 'react';
import { GLOSSARY, GLOSSARY_TERMS } from '../data/glossary';
import styles from './Term.module.css';

/** A jargon term with a one-line explanation on hover or keyboard focus. */
export default function Term({ term, children }) {
  const id = useId();
  const text = GLOSSARY[term];
  if (!text) return children ?? term;
  return (
    <span className={styles.term} tabIndex={0} aria-describedby={id}>
      {children ?? term}
      <span role="tooltip" id={id} className={styles.tip}>{text}</span>
    </span>
  );
}

/** `text` with each glossary term (case-insensitive, first occurrence) wrapped in a <Term>. */
export function WithTerms({ text }) {
  if (typeof text !== 'string') return text ?? null;
  const parts = [];
  let rest = text;
  const used = new Set();
  for (;;) {
    let best = null;
    for (const term of GLOSSARY_TERMS) {
      if (used.has(term)) continue;
      const m = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').exec(rest);
      if (m && (!best || m.index < best.index)) best = { term, index: m.index, match: m[0] };
    }
    if (!best) break;
    parts.push(rest.slice(0, best.index), <Term key={parts.length} term={best.term}>{best.match}</Term>);
    used.add(best.term);
    rest = rest.slice(best.index + best.match.length);
  }
  parts.push(rest);
  return <>{parts}</>;
}
