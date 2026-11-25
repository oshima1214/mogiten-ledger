import type { Receipt, ReceiptTotals } from './types';

export function calcReceiptTotals(receipt: Receipt): ReceiptTotals {
  let subtotal8 = 0;
  let subtotal10 = 0;
  for (const item of receipt.items) {
    if (item.taxRate === 8) subtotal8 += item.price;
    else subtotal10 += item.price;
  }
  const exclusive = receipt.taxMode === 'exclusive';
  // 外税はレシートごと・税率ごとに小計から1回だけ計算し、端数は切り捨て。
  const tax8 = exclusive ? Math.floor((subtotal8 * 8) / 100) : 0;
  const tax10 = exclusive ? Math.floor((subtotal10 * 10) / 100) : 0;
  return { subtotal8, subtotal10, tax8, tax10, total: subtotal8 + subtotal10 + tax8 + tax10 };
}

export function calcGrandTotal(receipts: Receipt[]): number {
  return receipts.reduce((sum, r) => sum + calcReceiptTotals(r).total, 0);
}

export function formatYen(n: number): string {
  return '¥' + n.toLocaleString('ja-JP');
}

export function formatNumber(n: number): string {
  return n.toLocaleString('ja-JP');
}
