import React from 'react';

interface PaymentRadioCardProps {
  id?: string;
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  description?: string;
  invalid?: boolean;
  errorId?: string;
}

/** Shared, native-radio choice used by taxpayer relationship and income-tax type. */
export function PaymentRadioCard({ id, name, value, checked, onChange, title, description, invalid, errorId }: PaymentRadioCardProps) {
  return <label className={`payment-radio-card${checked ? ' payment-radio-card--selected' : ''}`}>
    <input id={id} type="radio" name={name} value={value} checked={checked} onChange={onChange} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined} />
    <span className="payment-radio-card__copy"><strong>{title}</strong>{description && <small>{description}</small>}</span>
  </label>;
}
