import { days, inr, num } from '../../utils/format';
import styles from './Insights.module.css';

/** One-line shelf life / cost / footprint summary for an alternative. */
export default function AltFacts({ shelfLife, costAndImpact }) {
  const items = [
    days(shelfLife?.estimateDays) && `${days(shelfLife.estimateDays)} shelf life`,
    inr(costAndImpact?.inrPerPack) && `${inr(costAndImpact.inrPerPack)}/pack`,
    num(costAndImpact?.gCo2ePerPack) && `${num(costAndImpact.gCo2ePerPack)} g CO₂e`,
  ].filter(Boolean);
  if (!items.length) return null;
  return <p className={styles.altFacts}>{items.map((t) => <span key={t}>{t}</span>)}</p>;
}
