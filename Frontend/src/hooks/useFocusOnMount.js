import { useEffect, useRef } from 'react';

/** Moves focus to a step's heading when it mounts so screen readers hear the new step. */
export function useFocusOnMount() {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  return ref;
}
