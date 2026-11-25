import { calcReceiptTotals, formatYen } from '../domain/calc';
import type { Receipt } from '../domain/types';

/** レシートの小計・外税額・合計。税額が0円の行は出さない。 */
export function TotalsBlock({ receipt }: { receipt: Receipt }) {
  const t = calcReceiptTotals(receipt);
  const exclusive = receipt.taxMode === 'exclusive';
  return (
    <dl className="totals" aria-label="このレシートの合計">
      {exclusive && (
        <div>
          <dt>小計（税抜）</dt>
          <dd>{formatYen(t.subtotal8 + t.subtotal10)}</dd>
        </div>
      )}
      {t.tax8 > 0 && (
        <div>
          <dt>消費税 8%</dt>
          <dd>{formatYen(t.tax8)}</dd>
        </div>
      )}
      {t.tax10 > 0 && (
        <div>
          <dt>消費税 10%</dt>
          <dd>{formatYen(t.tax10)}</dd>
        </div>
      )}
      <div className="totals-grand">
        <dt>店の合計{exclusive ? '' : '（税込）'}</dt>
        <dd>{formatYen(t.total)}</dd>
      </div>
    </dl>
  );
}
