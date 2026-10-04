import { days, inr, num } from '../../utils/format';
import ProvenanceBadge from './ProvenanceBadge';
import StatusPill from './StatusPill';
import { WithTerms } from '../Term';
import styles from './Result.module.css';

/**
 * Recommendation vs selected alternatives, using the same rows as the
 * requirement table. Cells the payload doesn't cover say so instead of
 * being filled in.
 */
export default function ComparisonTable({ primary, alternatives }) {
  const columns = [{ ...primary, isPrimary: true }, ...alternatives];
  const labels = [];
  for (const col of columns) {
    for (const r of col.requirements || []) if (!labels.includes(r.label)) labels.push(r.label);
  }
  const find = (col, label) => (col.requirements || []).find((r) => r.label === label);
  const figureRows = [
    ['Estimated shelf life', (c) => days(c.shelfLife?.estimateDays)],
    ['Packaging cost', (c) => inr(c.costAndImpact?.inrPerPack)],
    ['Carbon footprint', (c) => num(c.costAndImpact?.gCo2ePerPack, 'g CO₂e')],
    ['Recyclability index', (c) => num(c.costAndImpact?.recyclabilityIndex)],
  ].filter(([, get]) => columns.some((c) => get(c)));

  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${styles.compare}`}>
        <caption className="sr-only">Recommendation compared with alternatives</caption>
        <thead>
          <tr>
            <th scope="col">Requirement</th>
            {columns.map((col, i) => (
              <th scope="col" key={i}>
                {col.isPrimary && <span className={styles.colTag}>Recommended</span>}
                {!col.isPrimary && <span className={styles.colTag} data-alt>Alternative</span>}
                <span className={styles.colName}>{col.structure}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label) => (
            <tr key={label}>
              <th scope="row"><WithTerms text={label} /></th>
              {columns.map((col, i) => {
                const r = find(col, label);
                return (
                  <td key={i}>
                    {r ? (
                      <div className={styles.cell}>
                        <span>{r.value ?? <span className={styles.na}>Not reported</span>}</span>
                        <span className={styles.cellBadges}>
                          <StatusPill status={r.status} />
                          <ProvenanceBadge value={r.provenance} />
                        </span>
                      </div>
                    ) : <span className={styles.na}>Not reported</span>}
                  </td>
                );
              })}
            </tr>
          ))}
          {figureRows.map(([label, get]) => (
            <tr key={label}>
              <th scope="row"><WithTerms text={label} /></th>
              {columns.map((col, i) => <td key={i}>{get(col) ?? <span className={styles.na}>Not reported</span>}</td>)}
            </tr>
          ))}
          <tr>
            <th scope="row">Trade-off</th>
            {columns.map((col, i) => (
              <td key={i}>{col.isPrimary ? <span className={styles.na}>Baseline</span> : (col.tradeoffSummary || <span className={styles.na}>Not reported</span>)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
