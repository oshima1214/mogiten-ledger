import { calcGrandTotal, calcReceiptTotals, formatYen } from '../domain/calc';
import { rgb, storeColor } from '../domain/colors';
import type { GroupInfo, Receipt } from '../domain/types';

export const PREVIEW_ITEM_LIMIT = 3;

export function ReceiptCard(props: { receipt: Receipt; index: number; onEdit(): void }) {
  const { receipt } = props;
  const shown = receipt.items.slice(0, PREVIEW_ITEM_LIMIT);
  const rest = receipt.items.length - shown.length;
  return (
    <li className="receipt-card" style={{ borderLeftColor: rgb(storeColor(props.index).solid) }}>
      <div className="receipt-card-main">
        <div className="receipt-card-title">
          <h2>{receipt.storeName}</h2>
          <span className="badge">{receipt.taxMode === 'exclusive' ? '外税' : '内税'}</span>
        </div>
        <p className="receipt-card-items">
          {shown.length === 0 ? '購入品なし' : shown.map((i) => i.name).join('、')}
          {rest > 0 && <span className="more">…ほか{rest}点</span>}
        </p>
      </div>
      <div className="receipt-card-side">
        <span className="receipt-card-total">{formatYen(calcReceiptTotals(receipt).total)}</span>
        <button type="button" className="small" onClick={props.onEdit} aria-label={`${receipt.storeName}を編集`}>
          編集
        </button>
      </div>
    </li>
  );
}

export function Home(props: {
  group: GroupInfo | null;
  receipts: Receipt[];
  exporting: boolean;
  exportError: string;
  saveError: boolean;
  onEditGroup(): void;
  onExport(): void;
  onSummary(): void;
  onNewReceipt(): void;
  onEditReceipt(id: string): void;
}) {
  const { receipts } = props;
  return (
    <div className="screen home">
      <header className="home-header">
        <button type="button" className="group-name" onClick={props.onEditGroup} aria-label="グループ情報を編集">
          <span className="group-title">{props.group?.groupName || 'mogiten-ledger'}</span>
          {props.group?.representative && <span className="group-rep">代表：{props.group.representative}</span>}
        </button>
        <div className="home-actions">
          <button type="button" className="secondary" onClick={props.onExport} disabled={props.exporting || receipts.length === 0}>
            {props.exporting ? '作成中…' : 'PDF出力'}
          </button>
          <button type="button" className="secondary" onClick={props.onSummary}>
            集計
          </button>
        </div>
      </header>
      {props.exportError && (
        <p className="error banner" role="alert">
          {props.exportError}
        </p>
      )}
      {props.saveError && (
        <p className="error banner" role="alert">
          この端末に保存できませんでした。プライベートブラウズを解除するか、空き容量を確認してください。
        </p>
      )}
      <main className="screen-body">
        {receipts.length === 0 ? (
          <div className="empty">
            <p>まだレシートがありません。</p>
            <p>下の「レシートを記録」から、買い物したお店ごとに入力しましょう。</p>
          </div>
        ) : (
          <>
            <ul className="receipt-list">
              {receipts.map((r, i) => (
                <ReceiptCard key={r.id} receipt={r} index={i} onEdit={() => props.onEditReceipt(r.id)} />
              ))}
            </ul>
            <p className="grand-total">
              <span>{receipts.length}店 の総合計</span>
              <strong>{formatYen(calcGrandTotal(receipts))}</strong>
            </p>
          </>
        )}
      </main>
      <footer className="fab-area">
        <button type="button" className="primary fab" onClick={props.onNewReceipt}>
          ＋ レシートを記録
        </button>
      </footer>
    </div>
  );
}
