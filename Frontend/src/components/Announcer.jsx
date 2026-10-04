/** Visually hidden live region; driven by AnnouncerProvider. */
export default function Announcer({ message }) {
  return <div className="sr-only" id="announcer" aria-live="polite">{message}</div>;
}
