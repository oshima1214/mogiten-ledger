import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emptySummary } from '../domain/types';
import type { AppData, Item } from '../domain/types';
import { createPdf, japaneseEraDate, pdfFileName } from './exportPdf';

const font = readFileSync(resolve(__dirname, '../../public/fonts/BIZUDPGothic-Regular.ttf')).toString('base64');

const items = (count: number): Item[] =>
  Array.from({ length: count }, (_, i) => ({ id: `i${i}`, name: `商品${i}`, price: 100 + i, taxRate: i % 2 ? 8 : 10 }));

const data = (itemCount: number): AppData => ({
  group: { groupName: '3年A組', representative: '見本 海' },
  receipts: [
    { id: 'r1', storeName: 'Seria', taxMode: 'exclusive', createdAt: '', items: items(itemCount) },
    { id: 'r2', storeName: 'TRIAL', taxMode: 'inclusive', createdAt: '', items: items(2) },
  ],
  summary: { ...emptySummary(), tickets: 170, budget: 4000, menus: [{ id: 'm', name: 'ワッフル', count: 64 }] },
});

test('ファイル名と和暦の日付', () => {
  const d = new Date(2026, 10, 25);
  expect(pdfFileName(d)).toBe('模擬店領収書集計_2026-11-25.pdf');
  expect(japaneseEraDate(d)).toBe('令和8年11月25日');
});

test('PDFを作れる', () => {
  const doc = createPdf(data(3), font);
  expect(doc.getNumberOfPages()).toBe(1);
  expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
});

test('商品が多いと改ページする', () => {
  expect(createPdf(data(80), font).getNumberOfPages()).toBeGreaterThanOrEqual(2);
});

test('空のデータでも作れる', () => {
  const doc = createPdf({ group: null, receipts: [], summary: emptySummary() }, font);
  expect(doc.getNumberOfPages()).toBe(1);
});
