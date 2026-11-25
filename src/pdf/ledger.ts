import { calcReceiptTotals, formatNumber } from '../domain/calc';
import type { Receipt, Summary } from '../domain/types';

export const LEDGER_HEAD = ['材料・消耗品費等', '消費税8%', '消費税10%', '金額', ''] as const;

export type LedgerRowKind = 'item' | 'tax' | 'storeEnd' | 'spacer';

export interface LedgerRow {
  kind: LedgerRowKind;
  /** 何番目のレシートか（色分けに使う） */
  receiptIndex: number;
  name: string;
  c8: string;
  c10: string;
  amount: string;
  /** 右端の列。店名の行は店名、storeEnd の行は店の合計 */
  side: string;
}

export interface LedgerTable {
  rows: LedgerRow[];
  footer: { c8: string; c10: string; total: string };
}

export const modeLabel = (r: Receipt) => (r.taxMode === 'exclusive' ? '外税' : '内税');

/**
 * 見本の「領収書集計」と同じ並びの表を作る。
 * 店と店の間には空欄の行。店ごとに: 商品行 → 外税なら「外税8%対象」「外税10%対象」（0円は出さない）→ 店の合計の行。
 */
export function buildLedger(receipts: Receipt[]): LedgerTable {
  const rows: LedgerRow[] = [];
  let sum8 = 0;
  let sum10 = 0;
  let total = 0;

  receipts.forEach((r, receiptIndex) => {
    const t = calcReceiptTotals(r);
    const body: LedgerRow[] = r.items.map((item) => ({
      kind: 'item',
      receiptIndex,
      name: item.name,
      c8: item.taxRate === 8 ? formatNumber(item.price) : '',
      c10: item.taxRate === 10 ? formatNumber(item.price) : '',
      amount: formatNumber(item.price),
      side: '',
    }));
    if (t.tax8 > 0) {
      body.push({ kind: 'tax', receiptIndex, name: '外税8%対象', c8: formatNumber(t.tax8), c10: '', amount: formatNumber(t.tax8), side: '' });
    }
    if (t.tax10 > 0) {
      body.push({ kind: 'tax', receiptIndex, name: '外税10%対象', c8: '', c10: formatNumber(t.tax10), amount: formatNumber(t.tax10), side: '' });
    }
    const label = `${r.storeName}（${modeLabel(r)}）`;
    const end: LedgerRow = { kind: 'storeEnd', receiptIndex, name: '', c8: '', c10: '', amount: '', side: formatNumber(t.total) };
    if (body.length > 0) body[body.length - 1].side = label;
    else end.side = `${label}\n${end.side}`;
    // 店と店の間に白い空欄の行を入れる
    if (receiptIndex > 0) rows.push({ kind: 'spacer', receiptIndex, name: '', c8: '', c10: '', amount: '', side: '' });
    rows.push(...body, end);

    sum8 += t.subtotal8 + t.tax8;
    sum10 += t.subtotal10 + t.tax10;
    total += t.total;
  });

  return { rows, footer: { c8: formatNumber(sum8), c10: formatNumber(sum10), total: formatNumber(total) } };
}

/** 集計表の行。未入力の項目は出さない。 */
export function buildSummaryRows(s: Summary): [string, string][] {
  const rows: [string, string][] = [];
  const add = (label: string, v: number | null) => {
    if (v !== null) rows.push([label, formatNumber(v)]);
  };
  add('金券枚数', s.tickets);
  add('予算', s.budget);
  add('総費用', s.totalCost);
  add('残金', s.remaining);
  return rows;
}

/** メニュー別売上個数の行。名前のないメニューは出さない。 */
export function buildMenuRows(s: Summary): [string, string][] {
  return s.menus
    .filter((m) => m.name.trim())
    .map((m) => [m.name.trim(), m.count === null ? '' : formatNumber(m.count)]);
}
