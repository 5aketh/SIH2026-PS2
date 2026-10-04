import { num } from '../../utils/format';
import styles from './Insights.module.css';

/** A structure's plies from outside (print) to inside (food contact); shading follows thickness. */
export default function LayerStack({ layers }) {
  if (!layers?.length) return null;
  const max = Math.max(...layers.map((l) => l.thicknessUm || 0), 1);
  return (
    <>
      <ol className={styles.stack} aria-label="Layers, outside to inside">
        {layers.map((l, i) => (
          <li key={i} className={styles.layer} style={{ '--weight': (l.thicknessUm || 0) / max }}>
            <span className={styles.layerName}>{l.name || l.materialId}</span>
            <span className={styles.layerGauge}>{num(l.thicknessUm, 'µm')}</span>
            {(l.role || l.function) && <span className={styles.layerRole}>{l.role || l.function}</span>}
          </li>
        ))}
      </ol>
      {layers.length > 1 && (
        <p className={styles.stackEnds} aria-hidden="true"><span>Outside</span><span>Food side</span></p>
      )}
    </>
  );
}
