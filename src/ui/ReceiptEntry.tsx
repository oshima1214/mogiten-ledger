import { useState } from 'react';
import { newId } from '../domain/id';
import type { GroupInfo, Item, Receipt, TaxMode } from '../domain/types';
import { parseNonNegativeInt, validateGroupDraft, validateItemDraft, validateStoreDraft } from '../domain/validate';
import type { GroupErrors, ItemDraft, ItemErrors, StoreErrors } from '../domain/validate';
import { ScreenHeader, TextField, ToggleGroup } from './common';
import { ItemPanel } from './ItemPanel';
import { TotalsBlock } from './TotalsBlock';

type Step = 'group' | 'store' | 'items';

const MODE_OPTIONS = [
  { value: 'exclusive' as const, label: '外税' },
  { value: 'inclusive' as const, label: '内税' },
];

const emptyDraft = (): ItemDraft => ({ id: newId(), name: '', price: '', taxRate: null });
const toDraft = (i: Item): ItemDraft => ({ id: i.id, name: i.name, price: String(i.price), taxRate: i.taxRate });

/** 入力途中でも合計を見せるため、金額と税率がそろった欄だけで仮のレシートを作る。 */
function previewReceipt(storeName: string, taxMode: TaxMode, drafts: ItemDraft[]): Receipt {
  const items: Item[] = [];
  for (const d of drafts) {
    const price = parseNonNegativeInt(d.price);
    if (price && d.taxRate) items.push({ id: d.id, name: d.name, price, taxRate: d.taxRate });
  }
  return { id: 'preview', storeName, taxMode, items, createdAt: '' };
}

export function ReceiptEntry(props: {
  /** 編集するレシート。新規なら null */
  receipt: Receipt | null;
  /** グループ情報の入力から始めるか */
  askGroup: boolean;
  group: GroupInfo | null;
  onSaveGroup(group: GroupInfo): void;
  onSave(receipt: Receipt): void;
  onDelete(id: string): void;
  onClose(): void;
}) {
  const editing = props.receipt !== null;
  const [step, setStep] = useState<Step>(props.askGroup ? 'group' : 'store');

  const [groupName, setGroupName] = useState(props.group?.groupName ?? '');
  const [representative, setRepresentative] = useState(props.group?.representative ?? '');
  const [groupErrors, setGroupErrors] = useState<GroupErrors>({});

  const [storeName, setStoreName] = useState(props.receipt?.storeName ?? '');
  const [taxMode, setTaxMode] = useState<TaxMode | null>(props.receipt?.taxMode ?? null);
  const [storeErrors, setStoreErrors] = useState<StoreErrors>({});

  const [drafts, setDrafts] = useState<ItemDraft[]>(() =>
    props.receipt && props.receipt.items.length > 0 ? props.receipt.items.map(toDraft) : [emptyDraft()],
  );
  // 新規は1つ目を開く。編集時は全部閉じた状態から（見出しで内容は見える）。
  const [openIds, setOpenIds] = useState<Set<string>>(() => (editing ? new Set() : new Set([drafts[0].id])));
  const [itemErrors, setItemErrors] = useState<Record<string, ItemErrors>>({});
  const [listError, setListError] = useState('');

  const goGroupNext = () => {
    const errors = validateGroupDraft({ groupName, representative });
    setGroupErrors(errors);
    if (Object.keys(errors).length > 0) return;
    props.onSaveGroup({ groupName: groupName.trim(), representative: representative.trim() });
    setStep('store');
  };

  const goStoreNext = () => {
    const errors = validateStoreDraft({ storeName, taxMode });
    setStoreErrors(errors);
    if (Object.keys(errors).length === 0) setStep('items');
  };

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const updateDraft = (d: ItemDraft) => {
    setDrafts((prev) => prev.map((x) => (x.id === d.id ? d : x)));
    if (itemErrors[d.id]) {
      // 直した項目のエラーは消す
      const r = validateItemDraft(d);
      setItemErrors((prev) => ({ ...prev, [d.id]: r.ok ? {} : r.errors }));
    }
  };

  const addDraft = () => {
    const d = emptyDraft();
    setDrafts((prev) => [...prev, d]);
    setOpenIds((prev) => new Set(prev).add(d.id));
    setListError('');
  };

  const deleteDraft = (id: string) => {
    setDrafts((prev) => prev.filter((x) => x.id !== id));
  };

  const finish = () => {
    const errors: Record<string, ItemErrors> = {};
    const items: Item[] = [];
    for (const d of drafts) {
      const r = validateItemDraft(d);
      if (r.ok) items.push(r.value);
      else errors[d.id] = r.errors;
    }
    setItemErrors(errors);
    const bad = Object.keys(errors);
    if (bad.length > 0) {
      setOpenIds((prev) => new Set([...prev, ...bad]));
      setListError('入力に誤りがある購入品があります');
      return;
    }
    if (items.length === 0) {
      setListError('購入品を1つ以上入力してください');
      return;
    }
    props.onSave({
      id: props.receipt?.id ?? newId(),
      storeName: storeName.trim(),
      taxMode: taxMode!,
      items,
      createdAt: props.receipt?.createdAt ?? new Date().toISOString(),
    });
  };

  const confirmClose = () => {
    if (step === 'items' && !window.confirm('入力を終えずに戻ると、この画面の入力内容は保存されません。戻りますか？')) return;
    props.onClose();
  };

  const title = editing ? 'レシートを編集' : 'レシートを記録';

  if (step === 'group') {
    return (
      <div className="screen">
        <ScreenHeader title="はじめに" onBack={props.onClose} backLabel="ホーム" />
        <main className="screen-body">
          <p className="lead">最初にグループの情報を入力してください。PDFの見出しに使います。</p>
          <TextField label="グループ名" value={groupName} onChange={setGroupName} error={groupErrors.groupName} placeholder="例：3年A組" />
          <TextField label="代表者名" value={representative} onChange={setRepresentative} error={groupErrors.representative} placeholder="例：見本 海" />
        </main>
        <footer className="screen-footer">
          <button type="button" className="primary" onClick={goGroupNext}>
            次へ（購入した店）
          </button>
        </footer>
      </div>
    );
  }

  if (step === 'store') {
    return (
      <div className="screen">
        <ScreenHeader title={title} onBack={props.onClose} backLabel="ホーム" />
        <main className="screen-body">
          <p className="step-label">1 / 2　どこで買いましたか？</p>
          <TextField label="店名" value={storeName} onChange={setStoreName} error={storeErrors.storeName} placeholder="例：Seria" />
          <ToggleGroup<TaxMode>
            label="レシートの税表示"
            options={MODE_OPTIONS}
            value={taxMode}
            onChange={setTaxMode}
            error={storeErrors.taxMode}
          />
          <p className="hint">外税：レシートで商品の金額とは別に消費税が足されている／内税：商品の金額に消費税が含まれている</p>
          {editing && (
            <button
              type="button"
              className="danger-link"
              onClick={() => {
                if (window.confirm(`「${props.receipt!.storeName}」のレシートを削除しますか？`)) props.onDelete(props.receipt!.id);
              }}
            >
              このレシートを削除
            </button>
          )}
        </main>
        <footer className="screen-footer">
          <button type="button" className="primary" onClick={goStoreNext}>
            次へ（購入品）
          </button>
        </footer>
      </div>
    );
  }

  const preview = previewReceipt(storeName, taxMode!, drafts);
  return (
    <div className="screen">
      <ScreenHeader title={title} onBack={confirmClose} backLabel="ホーム" />
      <main className="screen-body">
        <p className="step-label">2 / 2　何を買いましたか？</p>
        <div className="store-chip">
          <span>
            <strong>{storeName.trim()}</strong>
            <span className="badge">{taxMode === 'exclusive' ? '外税' : '内税'}</span>
          </span>
          <button type="button" className="link-button" onClick={() => setStep('store')}>
            店を変更
          </button>
        </div>
        <div className="item-list">
          {drafts.map((d, i) => (
            <ItemPanel
              key={d.id}
              index={i}
              draft={d}
              open={openIds.has(d.id)}
              errors={itemErrors[d.id]}
              canDelete={drafts.length > 1}
              onToggle={() => toggle(d.id)}
              onChange={updateDraft}
              onDelete={() => deleteDraft(d.id)}
            />
          ))}
        </div>
        <button type="button" className="secondary add-item" onClick={addDraft}>
          ＋ 購入品を追加する
        </button>
        <TotalsBlock receipt={preview} />
        {listError && (
          <p className="error" role="alert">
            {listError}
          </p>
        )}
      </main>
      <footer className="screen-footer">
        <button type="button" className="primary" onClick={finish}>
          入力を終える
        </button>
      </footer>
    </div>
  );
}
