export default function LeafIcon({ strokeWidth = 1.7, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 19c0-8.5 5.5-14 14-14 0 8.5-5.5 14-14 14z" />
      <path d="M5 19l7.5-7.5" />
    </svg>
  );
}
