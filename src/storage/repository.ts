import { emptyAppData, emptySummary } from '../domain/types';
import type { AppData, GroupInfo, Item, MenuSale, Receipt, Summary } from '../domain/types';

export const STORAGE_KEY = 'mogiten-ledger/v1';

const defaultStorage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isPosInt = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 1;
const optInt = (v: unknown): number | null => (Number.isSafeInteger(v) && (v as number) >= 0 ? (v as number) : null);

function parseItem(v: unknown): Item | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.name) || !isPosInt(v.price)) return null;
  if (v.taxRate !== 8 && v.taxRate !== 10) return null;
  return { id: v.id, name: v.name, price: v.price, taxRate: v.taxRate };
}

function parseReceipt(v: unknown): Receipt | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.storeName)) return null;
  if (v.taxMode !== 'exclusive' && v.taxMode !== 'inclusive') return null;
  const items = Array.isArray(v.items) ? v.items.map(parseItem).filter((i): i is Item => i !== null) : [];
  return {
    id: v.id,
    storeName: v.storeName,
    taxMode: v.taxMode,
    items,
    createdAt: isStr(v.createdAt) ? v.createdAt : new Date(0).toISOString(),
  };
}

function parseGroup(v: unknown): GroupInfo | null {
  if (!isObj(v) || !isStr(v.groupName) || !isStr(v.representative)) return null;
  return { groupName: v.groupName, representative: v.representative };
}

function parseSummary(v: unknown): Summary {
  if (!isObj(v)) return emptySummary();
  const menus = Array.isArray(v.menus)
    ? v.menus
        .filter((m): m is Record<string, unknown> => isObj(m) && isStr(m.id) && isStr(m.name))
        .map((m): MenuSale => ({ id: m.id as string, name: m.name as string, count: optInt(m.count) }))
    : [];
  return {
    tickets: optInt(v.tickets),
    budget: optInt(v.budget),
    totalCost: optInt(v.totalCost),
    remaining: optInt(v.remaining),
    menus,
  };
}

export function loadData(storage: Storage | undefined = defaultStorage()): AppData {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return emptyAppData();
    const parsed: unknown = JSON.parse(raw);
    if (!isObj(parsed) || parsed.version !== 1) return emptyAppData();
    const receipts = Array.isArray(parsed.receipts)
      ? parsed.receipts.map(parseReceipt).filter((r): r is Receipt => r !== null)
      : [];
    return { group: parseGroup(parsed.group), receipts, summary: parseSummary(parsed.summary) };
  } catch {
    return emptyAppData();
  }
}

export function saveData(data: AppData, storage: Storage | undefined = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...data }));
    return true;
  } catch {
    return false;
  }
}
