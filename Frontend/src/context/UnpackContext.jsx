import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { createUnpackEngine } from '../lib/unpackEngine';

const UnpackContext = createContext(null);

/**
 * Owns the scroll-driven unpacking engine. Components register the DOM
 * nodes it animates through `register(key)` / `register(key, index)`
 * callback refs; the engine starts once everything is mounted.
 */
export function UnpackProvider({ children }) {
  const els = useRef({ cards: [], cardIcons: [], tokens: [] });
  const refCache = useRef({});
  const engineRef = useRef(null);

  const register = useCallback((key, index) => {
    const id = index === undefined ? key : `${key}:${index}`;
    let setEl = refCache.current[id];
    if (!setEl) {
      setEl = (el) => {
        if (index === undefined) els.current[key] = el;
        else els.current[key][index] = el;
      };
      refCache.current[id] = setEl;
    }
    return setEl;
  }, []);

  useEffect(() => {
    const engine = createUnpackEngine(els.current);
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  const value = useMemo(() => ({
    register,
    jumpToGrid: (focusHeading) => engineRef.current?.jumpToGrid(focusHeading),
    isAssembling: () => Boolean(engineRef.current?.isAssembling()),
  }), [register]);

  return <UnpackContext.Provider value={value}>{children}</UnpackContext.Provider>;
}

/** Null outside the landing page (the wizard has no unpack animation). */
export function useUnpack() {
  return useContext(UnpackContext);
}

/** Click handler for links that skip to the resolved category grid. */
export function useJumpToGrid() {
  const unpack = useUnpack();
  return useCallback((e) => {
    if (!unpack) return;
    e.preventDefault();
    unpack.jumpToGrid(true);
  }, [unpack]);
}
