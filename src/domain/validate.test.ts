import { parseNonNegativeInt, validateGroupDraft, validateItemDraft, validateStoreDraft } from './validate';

const draft = (over: Partial<{ name: string; price: string; taxRate: 8 | 10 | null }> = {}) => ({
  id: 'i1',
  name: 'たこ焼き',
  price: '300',
  taxRate: 8 as 8 | 10 | null,
  ...over,
});

const priceError = (price: string) => {
  const r = validateItemDraft(draft({ price }));
  return r.ok ? null : r.errors.price;
};

test('正しい入力は商品になる（名前の前後空白は除く）', () => {
  expect(validateItemDraft(draft({ name: '  たこ焼き ' }))).toEqual({
    ok: true,
    value: { id: 'i1', name: 'たこ焼き', price: 300, taxRate: 8 },
  });
});

test('商品名が空', () => {
  const r = validateItemDraft(draft({ name: '   ' }));
  expect(r.ok ? null : r.errors.name).toBe('商品名を入力してください');
});

test('金額の検証', () => {
  expect(priceError('')).toBe('金額を入力してください');
  for (const bad of ['0', '-5', '120.5', 'abc']) expect(priceError(bad)).toBe('1円以上の整数で入力してください');
  expect(priceError('1000000000')).toBe('金額が大きすぎます');
  expect(priceError('99999999')).toBeNull();
});

test('全角数字とカンマは受け付ける', () => {
  const r = validateItemDraft(draft({ price: '３，０００' }));
  expect(r.ok && r.value.price).toBe(3000);
});

test('税率が未選択なら登録できない', () => {
  const r = validateItemDraft(draft({ taxRate: null }));
  expect(r.ok ? null : r.errors.taxRate).toBe('税率（8% か 10%）を選んでください');
});

test('複数のエラーを同時に返す', () => {
  const r = validateItemDraft(draft({ name: '', price: '', taxRate: null }));
  expect(r.ok ? [] : Object.keys(r.errors).sort()).toEqual(['name', 'price', 'taxRate']);
});

test('店の検証', () => {
  expect(validateStoreDraft({ storeName: ' ', taxMode: null })).toEqual({
    storeName: '店名を入力してください',
    taxMode: '外税か内税かを選んでください',
  });
  expect(validateStoreDraft({ storeName: 'Seria', taxMode: 'exclusive' })).toEqual({});
});

test('グループ情報の検証', () => {
  expect(validateGroupDraft({ groupName: '', representative: '' })).toEqual({
    groupName: 'グループ名を入力してください',
    representative: '代表者名を入力してください',
  });
});

test('parseNonNegativeInt', () => {
  expect(parseNonNegativeInt('0')).toBe(0);
  expect(parseNonNegativeInt(' 1,200 ')).toBe(1200);
  expect(parseNonNegativeInt('1.5')).toBeNull();
  expect(parseNonNegativeInt('')).toBeNull();
});
