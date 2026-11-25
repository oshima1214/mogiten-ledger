import { formatYen } from '../domain/calc';
import { parseNonNegativeInt } from '../domain/validate';
import type { ItemDraft, ItemErrors } from '../domain/validate';
import { TextField, ToggleGroup } from './common';

const RATE_OPTIONS = [
  { value: 8 as const, label: '8%' },
  { value: 10 as const, label: '10%' },
];

/** 購入品1つ分の折りたたみ欄。閉じていても見出しに商品名・税率・金額が見える。 */
export function ItemPanel(props: {
  index: number;
  draft: ItemDraft;
  open: boolean;
  errors?: ItemErrors;
  canDelete: boolean;
  onToggle(): void;
  onChange(draft: ItemDraft): void;
  onDelete(): void;
}) {
  const { draft, errors } = props;
  const price = parseNonNegativeInt(draft.price);
  const hasError = !!errors && Object.keys(errors).length > 0;
  const bodyId = `item-body-${draft.id}`;

  return (
    <section className={'item-panel' + (hasError ? ' has-error' : '')} aria-label={`購入品 ${props.index + 1}`}>
      <div className="item-panel-head">
        <button
          type="button"
          className="item-panel-toggle"
          aria-expanded={props.open}
          aria-controls={bodyId}
          onClick={props.onToggle}
        >
          <span className="item-no">{props.index + 1}</span>
          <span className="item-name">{draft.name.trim() || '（商品名未入力）'}</span>
          <span className="item-rate">{draft.taxRate ? `${draft.taxRate}%` : '税率?'}</span>
          <span className="item-price">{price !== null && draft.price.trim() ? formatYen(price) : '¥—'}</span>
          <span className="chevron" aria-hidden>
            {props.open ? '▲' : '▼'}
          </span>
        </button>
      </div>
      {props.open && (
        <div className="item-panel-body" id={bodyId}>
          <TextField
            label="商品名"
            value={draft.name}
            placeholder="例：竹串 80本入（2個×単100）"
            error={errors?.name}
            onChange={(name) => props.onChange({ ...draft, name })}
          />
          <TextField
            label="金額"
            value={draft.price}
            numeric
            prefix="¥"
            placeholder="0"
            error={errors?.price}
            onChange={(p) => props.onChange({ ...draft, price: p })}
          />
          <ToggleGroup
            label="税率"
            options={RATE_OPTIONS}
            value={draft.taxRate}
            error={errors?.taxRate}
            onChange={(taxRate) => props.onChange({ ...draft, taxRate })}
          />
          {props.canDelete && (
            <button type="button" className="danger-link" onClick={props.onDelete}>
              この購入品を削除
            </button>
          )}
        </div>
      )}
    </section>
  );
}
