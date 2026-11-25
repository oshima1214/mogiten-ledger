import { emptySummary } from '../domain/types';
import type { Item, Receipt, TaxMode } from '../domain/types';
import { buildLedger, buildMenuRows, buildSummaryRows } from './ledger';

let n = 0;
const item = (name: string, price: number, taxRate: 8 | 10): Item => ({ id: `i${n++}`, name, price, taxRate });
const receipt = (storeName: string, taxMode: TaxMode, items: Item[]): Receipt => ({
  id: `r${n++}`,
  storeName,
  taxMode,
  items,
  createdAt: '',
});

const pick = (rows: ReturnType<typeof buildLedger>['rows']) =>
  rows.map((r) => [r.kind, r.receiptIndex, r.name, r.c8, r.c10, r.amount, r.side]);

test('見本と同じ並び: 商品 → 外税対象 → 店の合計', () => {
  const seria = receipt('Seria', 'exclusive', [item('木製スティック', 200, 10), item('竹串', 100, 10)]);
  const trial = receipt('TRIAL', 'inclusive', [item('レジ袋', 3, 10), item('あじわい便り', 378, 8)]);
  const { rows, footer } = buildLedger([seria, trial]);
  expect(pick(rows)).toEqual([
    ['item', 0, '木製スティック', '', '200', '200', ''],
    ['item', 0, '竹串', '', '100', '100', ''],
    ['tax', 0, '外税10%対象', '', '30', '30', 'Seria（外税）'],
    ['storeEnd', 0, '', '', '', '', '330'],
    ['spacer', 1, '', '', '', '', ''],
    ['item', 1, 'レジ袋', '', '3', '3', ''],
    ['item', 1, 'あじわい便り', '378', '', '378', 'TRIAL（内税）'],
    ['storeEnd', 1, '', '', '', '', '381'],
  ]);
  expect(footer).toEqual({ c8: '378', c10: '333', total: '711' });
});

test('税額0円の行は出さない', () => {
  const { rows } = buildLedger([receipt('A', 'exclusive', [item('x', 10, 8)])]);
  expect(rows.map((r) => r.kind)).toEqual(['item', 'storeEnd']);
});

test('8%と10%の両方があれば両方の外税行', () => {
  const { rows } = buildLedger([receipt('A', 'exclusive', [item('x', 1000, 8), item('y', 1000, 10)])]);
  expect(rows.filter((r) => r.kind === 'tax').map((r) => [r.name, r.amount])).toEqual([
    ['外税8%対象', '80'],
    ['外税10%対象', '100'],
  ]);
});

test('商品0件の店は合計の行だけで、店名も同じ行に出す', () => {
  const { rows } = buildLedger([receipt('空の店', 'inclusive', [])]);
  expect(pick(rows)).toEqual([['storeEnd', 0, '', '', '', '', '空の店（内税）\n0']]);
});

test('レシートが無ければ合計0', () => {
  expect(buildLedger([])).toEqual({ rows: [], footer: { c8: '0', c10: '0', total: '0' } });
});

test('集計とメニュー: 未入力は出さない', () => {
  const s = {
    ...emptySummary(),
    tickets: 170,
    budget: 4000,
    remaining: 0,
    menus: [
      { id: 'a', name: 'ワッフル', count: 64 },
      { id: 'b', name: '  ', count: 3 },
      { id: 'c', name: 'おかず', count: null },
    ],
  };
  expect(buildSummaryRows(s)).toEqual([
    ['金券枚数', '170'],
    ['予算', '4,000'],
    ['残金', '0'],
  ]);
  expect(buildMenuRows(s)).toEqual([
    ['ワッフル', '64'],
    ['おかず', ''],
  ]);
});

test('空欄の行は店と店の間だけ（先頭と末尾には入れない）', () => {
  const { rows } = buildLedger([receipt('A', 'inclusive', []), receipt('B', 'inclusive', []), receipt('C', 'inclusive', [])]);
  expect(rows.map((r) => r.kind)).toEqual(['storeEnd', 'spacer', 'storeEnd', 'spacer', 'storeEnd']);
});
