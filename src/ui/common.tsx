import { useId } from 'react';
import type { ReactNode } from 'react';

interface ToggleOption<T> {
  value: T;
  label: string;
}

/** 初期状態で何も選ばれていない選択ボタン。選ばれたものは aria-pressed="true"。 */
export function ToggleGroup<T extends string | number>(props: {
  label: string;
  options: ToggleOption<T>[];
  value: T | null;
  onChange(value: T): void;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <span className="field-label" id={id}>
        {props.label}
      </span>
      <div className="toggle-group" role="group" aria-labelledby={id}>
        {props.options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            className="toggle"
            aria-pressed={props.value === o.value}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {props.error && <p className="error" role="alert">{props.error}</p>}
    </div>
  );
}

export function TextField(props: {
  label: string;
  value: string;
  onChange(value: string): void;
  error?: string;
  placeholder?: string;
  numeric?: boolean;
  prefix?: string;
  suffix?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {props.label}
      </label>
      <div className={'input-wrap' + (props.error ? ' invalid' : '')}>
        {props.prefix && <span className="affix">{props.prefix}</span>}
        <input
          id={id}
          value={props.value}
          placeholder={props.placeholder}
          inputMode={props.numeric ? 'numeric' : undefined}
          autoComplete="off"
          autoFocus={props.autoFocus}
          aria-invalid={!!props.error}
          onChange={(e) => props.onChange(e.target.value)}
        />
        {props.suffix && <span className="affix">{props.suffix}</span>}
      </div>
      {props.error && <p className="error" role="alert">{props.error}</p>}
    </div>
  );
}

export function ScreenHeader(props: { title: string; onBack?(): void; backLabel?: string; right?: ReactNode }) {
  return (
    <header className="screen-header">
      {props.onBack ? (
        <button type="button" className="link-button" onClick={props.onBack}>
          ‹ {props.backLabel ?? '戻る'}
        </button>
      ) : (
        <span />
      )}
      <h1>{props.title}</h1>
      <span className="screen-header-right">{props.right}</span>
    </header>
  );
}
