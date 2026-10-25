import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { cleanQty, cleanSignedQty } from '../lib/calc';

const parse = (t: string) => (t === '' || t === '.' || t === '-' || t === '-.' ? null : Number(t));

/**
 * A stock quantity box that takes parts: 0.5, 2.5, 12.25. It keeps what is
 * being typed ("2." on the way to "2.5") instead of snapping it to a number
 * after every key, and hands the number up as soon as there is one.
 */
export function QtyInput({ value, onValue, limit, onOverLimit, allowNegative, ...rest }: {
  value: number | null | undefined;
  onValue: (n: number | null) => void;
  /** Most it may hold; a number above it is refused, not saved. */
  limit?: number;
  onOverLimit?: (limit: number) => void;
  /** Accept a leading minus, for taking stock back off. */
  allowNegative?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    setText((t) => (parse(t) === (value ?? null) ? t : value == null ? '' : String(value)));
  }, [value]);
  return (
    <input
      {...rest}
      inputMode={allowNegative ? 'text' : 'decimal'}
      value={text}
      onChange={(e) => {
        const t = allowNegative ? cleanSignedQty(e.target.value) : cleanQty(e.target.value);
        const n = parse(t);
        if (limit !== undefined && n !== null && n > limit) { onOverLimit?.(limit); return; }
        setText(t);
        onValue(parse(t));
      }}
    />
  );
}
