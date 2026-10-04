import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs `load(signal)` whenever `key` changes, cancelling the previous call.
 * `delay` debounces rapid changes (typing, sliders). Pass key === null to skip.
 * The last good data stays visible while a new request is in flight.
 */
export function useQuery(load, key, { delay = 0 } = {}) {
  const [state, setState] = useState({ status: key === null ? 'idle' : 'loading', data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (key === null) {
      setState((s) => ({ ...s, status: 'idle', error: null }));
      return undefined;
    }
    const ctrl = new AbortController();
    setState((s) => ({ ...s, status: 'loading', error: null }));
    const timer = setTimeout(async () => {
      try {
        const data = await loadRef.current(ctrl.signal);
        if (!ctrl.signal.aborted) setState({ status: 'success', data, error: null });
      } catch (error) {
        if (!ctrl.signal.aborted) setState((s) => ({ ...s, status: 'error', error }));
      }
    }, delay);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [key, attempt, delay]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
