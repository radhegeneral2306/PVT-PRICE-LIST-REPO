import { useEffect, useMemo, useState } from 'react';
import { useData } from '../../store/DataContext';
import type { Item, Pricelist } from '../../types';
import { Badge, ErrorState, SkeletonRows, Sheet, formatDate, formatRupee } from '../../ui';

const key = (i: Item) => [i.name, i.size, i.finish].map((s) => s.trim().toLowerCase()).join('|');

export function CompareSheet({ open, onClose, current, previous }: { open: boolean; onClose: () => void; current: Pricelist; previous: Pricelist }) {
  return (
    <Sheet open={open} onClose={onClose} title="Compare with previous">
      <Body current={current} previous={previous} />
    </Sheet>
  );
}

function Body({ current, previous }: { current: Pricelist; previous: Pricelist }) {
  const { getItems } = useData();
  const [data, setData] = useState<{ cur: Item[]; prev: Item[] } | null>(null);
  const [err, setErr] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    setData(null); setErr(false);
    Promise.all([getItems(current.id), getItems(previous.id)]).then(
      ([cur, prev]) => { if (live) setData({ cur, prev }); },
      () => { if (live) setErr(true); },
    );
    return () => { live = false; };
  }, [current.id, previous.id, getItems, tick]);

  const result = useMemo(() => {
    if (!data) return null;
    const prevMap = new Map<string, Item>();
    for (const i of data.prev) if (!prevMap.has(key(i))) prevMap.set(key(i), i);
    const curKeys = new Set<string>();
    const changed: { item: Item; oldRate: number; newRate: number }[] = [];
    let added = 0;
    for (const i of data.cur) {
      const k = key(i);
      if (curKeys.has(k)) continue;
      curKeys.add(k);
      const old = prevMap.get(k);
      if (!old) { added += 1; continue; }
      if (old.rate != null && i.rate != null && old.rate !== i.rate) changed.push({ item: i, oldRate: old.rate, newRate: i.rate });
    }
    let removed = 0;
    for (const k of prevMap.keys()) if (!curKeys.has(k)) removed += 1;
    const ratesHidden = data.cur.length > 0 && data.cur.every((i) => i.rate == null);
    changed.sort((a, b) => Math.abs(b.newRate - b.oldRate) / b.oldRate - Math.abs(a.newRate - a.oldRate) / a.oldRate);
    return { changed, added, removed, ratesHidden };
  }, [data]);

  if (err) return <ErrorState message="Could not load the items to compare." onRetry={() => setTick((t) => t + 1)} />;
  if (!result) return <SkeletonRows count={5} avatar={false} />;

  return (
    <div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        {current.title} ({formatDate(current.effectiveDate)}) against {previous.title} ({formatDate(previous.effectiveDate)}).
      </p>
      <div className="cmp-sum">
        <Badge tone="warn">{result.changed.length} rate {result.changed.length === 1 ? 'change' : 'changes'}</Badge>
        <Badge tone="ok">{result.added} new</Badge>
        <Badge>{result.removed} removed</Badge>
      </div>
      {result.ratesHidden ? (
        <p className="muted">Rates are hidden for your login, so rate changes cannot be shown.</p>
      ) : result.changed.length === 0 ? (
        <p className="muted">No rate changes. All matching items have the same rate.</p>
      ) : (
        <div className="cmp-scroll">
          <table className="cmp-table">
            <thead><tr><th>Item</th><th className="r">Old</th><th className="r">New</th><th className="r">Change</th></tr></thead>
            <tbody>
              {result.changed.map(({ item, oldRate, newRate }) => {
                const d = newRate - oldRate;
                return (
                  <tr key={item.id}>
                    <td><div className="nm">{item.name}</div><div className="sz">{[item.size, item.finish].filter(Boolean).join(' · ')}</div></td>
                    <td className="r mono">{formatRupee(oldRate)}</td>
                    <td className="r mono" style={{ fontWeight: 600 }}>{formatRupee(newRate)}</td>
                    <td className={`r mono ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '+' : '-'}{formatRupee(Math.abs(d))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
