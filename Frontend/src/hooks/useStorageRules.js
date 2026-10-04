import { useEffect, useState } from 'react';
import { getStorageRules } from '../services/api';

/** The storage-rules table, or null until it loads (the backend still validates every request). */
export function useStorageRules() {
  const [rules, setRules] = useState(null);
  useEffect(() => {
    let live = true;
    getStorageRules().then((r) => { if (live) setRules(r); }).catch(() => { /* backend validation still applies */ });
    return () => { live = false; };
  }, []);
  return rules;
}
