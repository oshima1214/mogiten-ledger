import { emptyAppData } from '../domain/types';
import type { AppData } from '../domain/types';
import { loadData, saveData, STORAGE_KEY } from './repository';

const sample: AppData = {
  group: { groupName: '3年A組', representative: '見本 海' },
  receipts: [
    {
      id: 'r1',
      storeName: 'Seria',
      taxMode: 'exclusive',
      createdAt: '2026-11-25T00:00:00.000Z',
      items: [{ id: 'i1', name: '竹串', price: 100, taxRate: 10 }],
    },
  ],
  summary: { tickets: 170, budget: 4000, totalCost: null, remaining: null, menus: [{ id: 'm1', name: 'ワッフル', count: 64 }] },
};

beforeEach(() => localStorage.clear());

test('保存して読み込むと同じ内容', () => {
  expect(saveData(sample)).toBe(true);
  expect(loadData()).toEqual(sample);
});

test('キーが無ければ空', () => {
  expect(loadData()).toEqual(emptyAppData());
});

test('壊れたJSONや別バージョンは空として扱う', () => {
  for (const raw of ['{broken', '{"version":2,"receipts":[]}', '"x"', 'null']) {
    localStorage.setItem(STORAGE_KEY, raw);
    expect(loadData()).toEqual(emptyAppData());
  }
});

test('不正な商品だけ捨てて残りは読む', () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      receipts: [
        {
          id: 'r1',
          storeName: 'A',
          taxMode: 'inclusive',
          createdAt: 'x',
          items: [
            { id: 'a', name: 'ok', price: 100, taxRate: 8 },
            { id: 'b', name: 'bad rate', price: 100, taxRate: 5 },
            { id: 'c', name: 'bad price', price: 1.5, taxRate: 8 },
          ],
        },
        { id: 'r2', storeName: 'B', taxMode: 'other', items: [] },
      ],
    }),
  );
  const data = loadData();
  expect(data.receipts).toHaveLength(1);
  expect(data.receipts[0].items.map((i) => i.id)).toEqual(['a']);
  expect(data.group).toBeNull();
});

test('例外を投げるストレージでも止まらない', () => {
  const broken = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('quota');
    },
  } as unknown as Storage;
  expect(loadData(broken)).toEqual(emptyAppData());
  expect(saveData(sample, broken)).toBe(false);
});
