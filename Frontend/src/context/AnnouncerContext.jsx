import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Announcer from '../components/Announcer';

const AnnouncerContext = createContext(() => {});

/** Provides announce(message) for a polite screen-reader live region. */
export function AnnouncerProvider({ children }) {
  const [message, setMessage] = useState('');
  const timer = useRef(0);

  const announce = useCallback((msg) => {
    // Clear first so repeating the same message is announced again.
    setMessage('');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(msg), 30);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <Announcer message={message} />
    </AnnouncerContext.Provider>
  );
}

export function useAnnounce() {
  return useContext(AnnouncerContext);
}
