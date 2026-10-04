import ProvenanceBadge from './ProvenanceBadge';
import StatusPill from './StatusPill';
import { WithTerms } from '../Term';
import styles from './Result.module.css';

/** One row per packaging requirement: target, candidate status and provenance. Values render verbatim. */
export default function RequirementTable({ rows, caption = 'Packaging requirements' }) {
  if (!rows?.length) {
    return <p className={styles.empty}>The analysis returned no requirement rows.</p>;
  }
  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${styles.reqTable}`}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Requirement</th>
            <th scope="col">Target</th>
            <th scope="col">Candidate performance</th>
            <th scope="col">Provenance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.label + i}>
              <th scope="row"><WithTerms text={row.label} /></th>
              <td>{row.value ?? <span className={styles.na}>Not reported</span>}</td>
              <td><StatusPill status={row.status} /></td>
              <td><ProvenanceBadge value={row.provenance} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
