import { useEffect, useId, useRef, useState } from 'react';
import { searchCommodities } from '../../services/api';
import { foodCategory } from '../../data/wizard';
import { cx } from '../../utils/cx';
import Skeleton from './Skeleton';
import tile from '../../styles/iconTile.module.css';
import styles from './CommoditySearch.module.css';

/** Typeahead over the commodity catalog (GET /api/commodities?query=). ARIA combobox pattern. */
export default function CommoditySearch({ onSelect, onCustom }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const inputRef = useRef(null);

  const q = query.trim();

  useEffect(() => {
    if (!q) { setStatus('idle'); setResults([]); return undefined; }
    setStatus('loading');
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const data = await searchCommodities(q, { signal: ctrl.signal });
        setResults(data.results || []);
        setStatus('done');
        setActive(-1);
      } catch {
        if (!ctrl.signal.aborted) setStatus('error');
      }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  function choose(item) {
    setOpen(false);
    onSelect(item);
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === 'Enter') {
      if (open && active >= 0 && results[active]) {
        e.preventDefault();
        choose(results[active]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && q.length > 0;
  const optionId = (i) => `${listId}-opt-${i}`;
  const statusText = status === 'loading' ? 'Searching…'
    : status === 'error' ? 'Search failed.'
      : status === 'done' ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}` : '';

  return (
    <div className={styles.search}>
      <label className={styles.label} htmlFor={listId + '-input'}>Search foods</label>
      <div className={styles.inputWrap}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" />
        </svg>
        <input
          ref={inputRef}
          id={listId + '-input'}
          className={styles.input}
          type="text"
          role="combobox"
          autoComplete="off"
          placeholder="e.g. tomato, chips, paneer"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <p className="sr-only" role="status" aria-live="polite">{showList ? statusText : ''}</p>

      {showList && (
        <div className={styles.popover}>
          {status === 'loading' && (
            <div className={styles.skeletons} aria-hidden="true">
              {[0, 1, 2].map((i) => <div key={i} className={styles.skelRow}><Skeleton width={32} height={32} radius={8} /><Skeleton width="45%" /></div>)}
            </div>
          )}
          {status === 'error' && <p className={styles.message}>Search isn't available right now. Pick a popular food below or enter a custom commodity.</p>}
          <ul id={listId} role="listbox" aria-label="Matching foods" className={styles.list} hidden={status !== 'done' || results.length === 0}>
            {status === 'done' && results.map((item, i) => {
              const cat = foodCategory(item.category);
              return (
                <li
                  key={item.commodityId}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  className={styles.option}
                  data-cat={cat.cat}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(item)}
                >
                  <span className={cx(tile.tile, styles.optTile)} aria-hidden="true"><cat.Icon /></span>
                  <span className={styles.optName}>{item.name}</span>
                  <span className={styles.optCat}>{cat.label}</span>
                </li>
              );
            })}
          </ul>
          {status === 'done' && results.length === 0 && (
            <div className={styles.message}>
              <p>No foods match “{q}”.</p>
              <button type="button" className={styles.customBtn} onMouseDown={(e) => e.preventDefault()} onClick={() => onCustom(q)}>
                Use “{q}” as a custom commodity →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
