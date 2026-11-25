import { calcGrandTotal, calcReceiptTotals, formatYen } from './calc';
import type { Item, Receipt, TaxMode } from './types';

let n = 0;
const item = (price: number, taxRate: 8 | 10): Item => ({ id: `i${n++}`, name: 'x', price, taxRate });
const receipt = (taxMode: TaxMode, items: Item[]): Receipt => ({
  id: `r${n++}`,
  storeName: 'A',
  taxMode,
  items,
  createdAt: '2026-11-25T00:00:00.000Z',
});

test('外税: 税率ごとに小計から切り捨てで税額を出す', () => {
  const r = receipt('exclusive', [item(150, 8), item(155, 8), item(300, 10), item(105, 10)]);
  expect(calcReceiptTotals(r)).toEqual({ subtotal8: 305, subtotal10: 405, tax8: 24, tax10: 40, total: 774 });
});

test('外税: 商品ごとではなく小計で丸める', () => {
  expect(calcReceiptTotals(receipt('exclusive', [item(10, 8), item(10, 8)])).tax8).toBe(1);
});

test('外税: 見本の Seria (10% 200円+100円 → 税30円, 合計330円)', () => {
  expect(calcReceiptTotals(receipt('exclusive', [item(200, 10), item(100, 10)])).total).toBe(330);
});

test('内税: 税額は0で合計は金額の和', () => {
  const r = receipt('inclusive', [item(300, 8), item(500, 10)]);
  expect(calcReceiptTotals(r)).toEqual({ subtotal8: 300, subtotal10: 500, tax8: 0, tax10: 0, total: 800 });
});

test('商品0件', () => {
  expect(calcReceiptTotals(receipt('exclusive', [])).total).toBe(0);
});

test('総合計', () => {
  const a = receipt('exclusive', [item(150, 8), item(155, 8), item(300, 10), item(105, 10)]);
  const b = receipt('inclusive', [item(300, 8), item(500, 10)]);
  expect(calcGrandTotal([a, b])).toBe(1574);
  expect(calcGrandTotal([])).toBe(0);
});

test('formatYen', () => {
  expect(formatYen(1234)).toBe('¥1,234');
  expect(formatYen(0)).toBe('¥0');
});
