import { useState } from 'react';
import { formatYen } from '../domain/calc';
import { newId } from '../domain/id';
import type { MenuSale, Summary } from '../domain/types';
import { parseNonNegativeInt } from '../domain/validate';
import { ScreenHeader, TextField } from './common';

const NUM_ERROR = '0以上の整数で入力してください';

type NumKey = 'tickets' | 'budget' | 'totalCost' | 'remaining';

const toText = (n: number | null) => (n === null ? '' : String(n));

/**
 * 数値欄。入力中の文字はそのまま持ち、正しい数か空のときだけ保存する。
 * 外から値が変わったとき（「入れる」ボタン）は key を変えて作り直す。
 */
function NumberField(props: {
  label: string;
  value: number | null;
  suffix: string;
  prefix?: string;
  onCommit(value: number | null): void;
}) {
  const [text, setText] = useState(toText(props.value));
  const [error, setError] = useState('');
  return (
    <TextField
      label={props.label}
      value={text}
      numeric
      prefix={props.prefix}
      suffix={props.suffix}
      error={error}
      onChange={(t) => {
        setText(t);
        if (!t.trim()) {
          setError('');
          props.onCommit(null);
          return;
        }
        const n = parseNonNegativeInt(t);
        setError(n === null ? NUM_ERROR : '');
        if (n !== null) props.onCommit(n);
      }}
    />
  );
}

function MenuRow(props: { menu: MenuSale; index: number; onChange(m: MenuSale): void; onDelete(): void }) {
  const [countText, setCountText] = useState(toText(props.menu.count));
  const [error, setError] = useState('');
  return (
    <li className="menu-row">
      <div className="menu-row-fields">
        <TextField
          label={`メニュー ${props.index + 1}`}
          value={props.menu.name}
          placeholder="例：ワッフル"
          onChange={(name) => props.onChange({ ...props.menu, name })}
        />
        <TextField
          label="売上個数"
          value={countText}
          numeric
          suffix="個"
          error={error}
          onChange={(t) => {
            setCountText(t);
            const n = t.trim() ? parseNonNegativeInt(t) : null;
            setError(t.trim() && n === null ? NUM_ERROR : '');
            if (!t.trim() || n !== null) props.onChange({ ...props.menu, count: n });
          }}
        />
      </div>
      <button type="button" className="danger-link" onClick={props.onDelete} aria-label={`メニュー ${props.index + 1} を削除`}>
        削除
      </button>
    </li>
  );
}

export function SummaryScreen(props: {
  summary: Summary;
  receiptTotal: number;
  onChange(summary: Summary): void;
  onBack(): void;
}) {
  const { summary } = props;
  // 「入れる」ボタンで外から値を入れたときに欄を作り直すための番号
  const [version, setVersion] = useState<Record<NumKey, number>>({ tickets: 0, budget: 0, totalCost: 0, remaining: 0 });

  const set = (key: NumKey, v: number | null) => props.onChange({ ...summary, [key]: v });
  const fill = (key: NumKey, v: number) => {
    set(key, v);
    setVersion((p) => ({ ...p, [key]: p[key] + 1 }));
  };

  const suggestedRemaining =
    summary.budget !== null && summary.totalCost !== null ? summary.budget - summary.totalCost : null;

  const setMenus = (menus: MenuSale[]) => props.onChange({ ...summary, menus });

  return (
    <div className="screen">
      <ScreenHeader title="集計" onBack={props.onBack} backLabel="ホーム" />
      <main className="screen-body">
        <p className="lead">模擬店が終わったら入力してください。入力した内容は自動で保存され、PDFの下の表に出ます。</p>

        <section className="card">
          <NumberField key={`t${version.tickets}`} label="受け取った金券の枚数" suffix="枚" value={summary.tickets} onCommit={(v) => set('tickets', v)} />
          <NumberField key={`b${version.budget}`} label="予算" prefix="¥" suffix="円" value={summary.budget} onCommit={(v) => set('budget', v)} />
          <NumberField key={`c${version.totalCost}`} label="総費用" prefix="¥" suffix="円" value={summary.totalCost} onCommit={(v) => set('totalCost', v)} />
          <p className="hint">
            レシートの総合計：{formatYen(props.receiptTotal)}
            {summary.totalCost !== props.receiptTotal && (
              <button type="button" className="link-button" onClick={() => fill('totalCost', props.receiptTotal)}>
                総費用に入れる
              </button>
            )}
          </p>
          <NumberField key={`r${version.remaining}`} label="残金" prefix="¥" suffix="円" value={summary.remaining} onCommit={(v) => set('remaining', v)} />
          {suggestedRemaining !== null && (
            <p className={'hint' + (suggestedRemaining < 0 ? ' warn' : '')}>
              予算 − 総費用 = {formatYen(suggestedRemaining)}
              {suggestedRemaining >= 0 && summary.remaining !== suggestedRemaining && (
                <button type="button" className="link-button" onClick={() => fill('remaining', suggestedRemaining)}>
                  残金に入れる
                </button>
              )}
              {suggestedRemaining < 0 && '（予算を超えています）'}
            </p>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">メニューごとの売上個数（任意）</h2>
          {summary.menus.length === 0 && <p className="hint">「メニューを追加」で行を増やせます。</p>}
          <ul className="menu-list">
            {summary.menus.map((m, i) => (
              <MenuRow
                key={m.id}
                menu={m}
                index={i}
                onChange={(next) => setMenus(summary.menus.map((x) => (x.id === next.id ? next : x)))}
                onDelete={() => setMenus(summary.menus.filter((x) => x.id !== m.id))}
              />
            ))}
          </ul>
          <button type="button" className="secondary" onClick={() => setMenus([...summary.menus, { id: newId(), name: '', count: null }])}>
            ＋ メニューを追加
          </button>
        </section>
      </main>
    </div>
  );
}
