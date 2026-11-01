import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Shared TaxPay TIN → taxpayer-name entry pattern.
 * The parent owns lookup, identity/permission validation and persistence.
 * Displaying a matching name must never authorize an account or prove NBR identity.
 */
export interface TaxpayerTinLookupProps {
  language: 'en' | 'bn';
  tinId: string;
  nameId: string;
  tin: string;
  name: string;
  onTinChange: (tin: string) => void;
  onSearch: () => void;
  onClear: () => void;
  canSearch: boolean;
  heading?: string;
  tinLabel?: string;
  nameLabel?: string;
  tinPlaceholder?: string;
  namePlaceholder?: string;
  maxTinLength?: number;
  maxNameLength?: number;
  readonlyTin?: boolean;
  editableName?: boolean;
  onNameChange?: (name: string) => void;
  disabled?: boolean;
  requiredTin?: boolean;
  autofocusTin?: boolean;
  invalidTin?: boolean;
  tinDescribedBy?: string;
  error?: React.ReactNode;
  status?: React.ReactNode;
  helper?: React.ReactNode;
  className?: string;
  card?: boolean;
}

export function TaxpayerTinLookup({
  language, tinId, nameId, tin, name, onTinChange, onSearch, onClear, canSearch,
  heading, tinLabel, nameLabel, tinPlaceholder, namePlaceholder, maxTinLength = 12, maxNameLength = 160,
  readonlyTin = false, editableName = false, onNameChange, disabled = false, requiredTin = true,
  autofocusTin = false, invalidTin = false, tinDescribedBy, error, status, helper, className = '', card = false,
}: TaxpayerTinLookupProps) {
  const bn = language === 'bn';
  const tinRef = useRef<HTMLInputElement>(null);
  const locked = disabled || readonlyTin;
  const change = (next: string) => onTinChange(next.replace(/\D/g, '').slice(0, maxTinLength));
  return <div className={['taxpayer-tin-lookup', card ? 'taxpayer-tin-lookup--card' : '', className].filter(Boolean).join(' ')}
    data-testid="shared-taxpayer-tin-lookup">
    {heading && <h3 className="taxpayer-tin-lookup__heading">{heading}</h3>}
    <div className="taxpayer-tin-lookup__field">
      <label htmlFor={tinId}>{tinLabel ?? (bn ? 'করদাতার টিআইএন' : 'Taxpayer TIN')}{requiredTin ? ' *' : ''}</label>
      <div className="taxpayer-tin-lookup__search-row taxpay-taxpayer-row__tin-search tin-lookup__row">
        <div className="taxpayer-tin-lookup__tin-entry taxpay-taxpayer-row__tin-entry">
          <input ref={tinRef} id={tinId} type="text" inputMode="numeric" autoComplete="off"
            maxLength={maxTinLength} value={tin} required={requiredTin} autoFocus={autofocusTin}
            readOnly={readonlyTin} disabled={disabled} aria-readonly={readonlyTin || undefined}
            aria-invalid={invalidTin || undefined} aria-describedby={tinDescribedBy || undefined}
            placeholder={tinPlaceholder ?? (bn ? '১২ সংখ্যার টিআইএন' : '12-digit TIN')}
            onChange={event => change(event.target.value)} />
          {Boolean(tin) && !locked && <button type="button"
            className="taxpayer-tin-lookup__clear taxpay-taxpayer-row__tin-clear"
            aria-label={bn ? 'টিআইএন অনুসন্ধান মুছুন' : 'Clear TIN search'}
            title={bn ? 'টিআইএন মুছুন' : 'Clear TIN'}
            onClick={() => { onClear(); tinRef.current?.focus(); }}>
            <X size={17} aria-hidden="true" />
          </button>}
        </div>
        <button type="button" className="tin-lookup__search taxpayer-tin-lookup__search"
          disabled={disabled || !canSearch} onClick={onSearch}>
          <Search size={17} aria-hidden="true" />{bn ? 'খুঁজুন' : 'Search'}
        </button>
      </div>
      {error}
      {helper}
    </div>
    <div className="taxpayer-tin-lookup__field tin-lookup__name">
      <label htmlFor={nameId}>{nameLabel ?? (bn ? 'করদাতার নাম' : 'Taxpayer name')}</label>
      <input id={nameId} type="text" autoComplete="off" maxLength={maxNameLength}
        readOnly={!editableName} aria-readonly={!editableName || undefined}
        disabled={disabled} value={name}
        onChange={event => onNameChange?.(event.target.value)}
        placeholder={namePlaceholder ?? (bn ? 'টিআইএন খুঁজলে নাম এখানে দেখাবে' : 'Search TIN to fill name')} />
    </div>
    {status}
  </div>;
}
