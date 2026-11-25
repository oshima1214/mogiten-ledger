export type TaxRate = 8 | 10;
/** exclusive = 外税, inclusive = 内税 */
export type TaxMode = 'exclusive' | 'inclusive';

export interface Item {
  id: string;
  name: string;
  /** 円の整数。内税の店では税込金額、外税の店では税抜金額。 */
  price: number;
  taxRate: TaxRate;
}

export interface Receipt {
  id: string;
  storeName: string;
  taxMode: TaxMode;
  items: Item[];
  createdAt: string;
}

export interface GroupInfo {
  groupName: string;
  representative: string;
}

export interface MenuSale {
  id: string;
  name: string;
  count: number | null;
}

export interface Summary {
  tickets: number | null;
  budget: number | null;
  totalCost: number | null;
  remaining: number | null;
  menus: MenuSale[];
}

export interface AppData {
  group: GroupInfo | null;
  receipts: Receipt[];
  summary: Summary;
}

export interface ReceiptTotals {
  subtotal8: number;
  subtotal10: number;
  /** 内税の店では常に 0 */
  tax8: number;
  tax10: number;
  total: number;
}

export const emptySummary = (): Summary => ({
  tickets: null,
  budget: null,
  totalCost: null,
  remaining: null,
  menus: [],
});

export const emptyAppData = (): AppData => ({
  group: null,
  receipts: [],
  summary: emptySummary(),
});
