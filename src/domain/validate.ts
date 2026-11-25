import type { Item, TaxMode, TaxRate } from './types';

export const MAX_PRICE = 99_999_999;

export interface ItemDraft {
  id: string;
  name: string;
  price: string;
  taxRate: TaxRate | null;
}

export type ItemErrors = Partial<Record<'name' | 'price' | 'taxRate', string>>;

export type ItemValidation = { ok: true; value: Item } | { ok: false; errors: ItemErrors };

export interface StoreDraft {
  storeName: string;
  taxMode: TaxMode | null;
}

export type StoreErrors = Partial<Record<'storeName' | 'taxMode', string>>;

export interface GroupDraft {
  groupName: string;
  representative: string;
}

export type GroupErrors = Partial<Record<'groupName' | 'representative', string>>;

/** 全角数字・カンマ・前後の空白を許して、0以上の整数に変換する。整数でなければ null。 */
export function parseNonNegativeInt(input: string): number | null {
  const s = input.normalize('NFKC').replace(/[,\s]/g, '');
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

export function validateItemDraft(d: ItemDraft): ItemValidation {
  const errors: ItemErrors = {};
  const name = d.name.trim();
  if (!name) errors.name = '商品名を入力してください';

  let price = 0;
  if (!d.price.trim()) {
    errors.price = '金額を入力してください';
  } else {
    const n = parseNonNegativeInt(d.price);
    if (n === null || n < 1) errors.price = '1円以上の整数で入力してください';
    else if (n > MAX_PRICE) errors.price = '金額が大きすぎます';
    else price = n;
  }

  if (d.taxRate === null) errors.taxRate = '税率（8% か 10%）を選んでください';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { id: d.id, name, price, taxRate: d.taxRate as TaxRate } };
}

export function validateStoreDraft(d: StoreDraft): StoreErrors {
  const errors: StoreErrors = {};
  if (!d.storeName.trim()) errors.storeName = '店名を入力してください';
  if (d.taxMode === null) errors.taxMode = '外税か内税かを選んでください';
  return errors;
}

export function validateGroupDraft(d: GroupDraft): GroupErrors {
  const errors: GroupErrors = {};
  if (!d.groupName.trim()) errors.groupName = 'グループ名を入力してください';
  if (!d.representative.trim()) errors.representative = '代表者名を入力してください';
  return errors;
}
