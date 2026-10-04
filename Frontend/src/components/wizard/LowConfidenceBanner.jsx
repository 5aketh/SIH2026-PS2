import Notice from './Notice';

/** Persists from the food profile through the report whenever confidence is reduced by the input itself. */
export default function LowConfidenceBanner({ isCustom, missing }) {
  if (!isCustom && missing.length === 0) return null;
  return (
    <Notice tone="warn" title={isCustom ? 'Custom entry — lower confidence' : 'Incomplete food profile — lower confidence'}>
      {isCustom && <p>This food isn't in the reference catalog, so its properties come from you rather than a cited source.</p>}
      {missing.length > 0 && <p>Missing: {missing.join(', ')}. Add them on the food profile step if you know them.</p>}
    </Notice>
  );
}
