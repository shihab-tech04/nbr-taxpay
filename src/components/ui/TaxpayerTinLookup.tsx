import React, { useEffect, useRef, useState } from 'react';
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
  /** Search suggestions only in the Other Tax progressive multi-taxpayer editor. */
  suggestedTins?: readonly string[];
  /** Keep the name in controlled form state, but show a read-only identity card after Search. */
  hideNameField?: boolean;
}

export function TaxpayerTinLookup({
  language, tinId, nameId, tin, name, onTinChange, onSearch, onClear, canSearch,
  heading, tinLabel, nameLabel, tinPlaceholder, namePlaceholder, maxTinLength = 12, maxNameLength = 160,
  readonlyTin = false, editableName = false, onNameChange, disabled = false, requiredTin = true,
  autofocusTin = false, invalidTin = false, tinDescribedBy, error, status, helper, className = '', card = false, suggestedTins, hideNameField = false,
}: TaxpayerTinLookupProps) {
  const bn = language === 'bn';
  const tinRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // After choosing a suggestion or using the clear X, keep keyboard focus on
  // the field without reopening the menu in the very same focus event.
  const suppressNextFocusOpen = useRef(false);
  const focusTinWithoutOpeningSuggestions = () => {
    setShowSuggestions(false);
    if (document.activeElement !== tinRef.current) {
      suppressNextFocusOpen.current = true;
      tinRef.current?.focus();
    }
  };
  const options = suggestedTins?.filter(suggestion => suggestion.includes(tin)) ?? [];
  useEffect(() => {
    if (!suggestedTins?.length || !showSuggestions) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [showSuggestions, suggestedTins]);
  const locked = disabled || readonlyTin;
  const change = (next: string) => onTinChange(next.replace(/\D/g, '').slice(0, maxTinLength));
  return <div ref={rootRef} className={['taxpayer-tin-lookup', card ? 'taxpayer-tin-lookup--card' : '', className].filter(Boolean).join(' ')}
    data-testid="shared-taxpayer-tin-lookup"
    onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setShowSuggestions(false);
    }}>
    {heading && <h3 className="taxpayer-tin-lookup__heading">{heading}</h3>}
    <div className="taxpayer-tin-lookup__field">
      <label htmlFor={tinId}>{tinLabel ?? (bn ? 'করদাতার টিআইএন' : 'Taxpayer TIN')}{requiredTin ? ' *' : ''}</label>
      <div className="taxpayer-tin-lookup__search-row taxpay-taxpayer-row__tin-search tin-lookup__row">
        <div className="taxpayer-tin-lookup__tin-entry taxpay-taxpayer-row__tin-entry">
          <input ref={tinRef} id={tinId} type="text" inputMode="numeric" autoComplete="off"
            maxLength={maxTinLength} value={tin} required={requiredTin} autoFocus={autofocusTin}
            readOnly={readonlyTin} disabled={disabled} aria-readonly={readonlyTin || undefined}
            role={suggestedTins?.length ? 'combobox' : undefined} aria-autocomplete={suggestedTins?.length ? 'list' : undefined}
            aria-controls={suggestedTins?.length ? tinId + '-suggestions' : undefined}
            aria-expanded={suggestedTins?.length ? showSuggestions : undefined}
            onFocus={() => {
              if (suppressNextFocusOpen.current) {
                suppressNextFocusOpen.current = false;
                return;
              }
              if (suggestedTins?.length && !locked) setShowSuggestions(true);
            }}
            onKeyDown={event => {
              if (event.key === 'Escape' && showSuggestions) {
                event.preventDefault();
                event.stopPropagation(); // Dismiss the dropdown, not its parent payment modal.
                setShowSuggestions(false);
              }
              if (event.key === 'ArrowDown' && showSuggestions) {
                event.preventDefault();
                rootRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();
              }
            }}
            aria-invalid={invalidTin || undefined} aria-describedby={tinDescribedBy || undefined}
            placeholder={tinPlaceholder ?? (bn ? '১২ সংখ্যার টিআইএন' : '12-digit TIN')}
            onChange={event => { change(event.target.value); if (suggestedTins?.length) setShowSuggestions(true); }} />
          {Boolean(tin) && !locked && <button type="button"
            className="taxpayer-tin-lookup__clear taxpay-taxpayer-row__tin-clear"
            aria-label={bn ? 'টিআইএন অনুসন্ধান মুছুন' : 'Clear TIN search'}
            title={bn ? 'টিআইএন মুছুন' : 'Clear TIN'}
            onClick={() => { onClear(); focusTinWithoutOpeningSuggestions(); }}>
            <X size={17} aria-hidden="true" />
          </button>}
        </div>
        <button type="button" className="tin-lookup__search taxpayer-tin-lookup__search"
          disabled={disabled || !canSearch} onClick={() => { setShowSuggestions(false); onSearch(); }}>
          <Search size={17} aria-hidden="true" />{bn ? 'খুঁজুন' : 'Search'}
        </button>
        {Boolean(suggestedTins?.length) && showSuggestions && !locked && <div
          className="taxpayer-tin-lookup__suggestions" id={tinId + '-suggestions'} role="listbox"
          aria-label={bn ? 'প্রস্তাবিত টিআইএন' : 'Suggested TIN numbers'}>
          <p className="taxpayer-tin-lookup__suggestions-heading" role="presentation">
            {bn ? 'প্রস্তাবিত টিআইএন নম্বর' : 'Suggested TIN numbers'}
          </p>
          {options.map(option => <button key={option} type="button" role="option"
            aria-selected={tin === option} onMouseDown={event => event.preventDefault()}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                focusTinWithoutOpeningSuggestions();
              } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const items = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])];
                const index = items.indexOf(event.currentTarget);
                const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
                if (items[next]) items[next].focus();
                else tinRef.current?.focus();
              }
            }}
            onClick={() => { change(option); focusTinWithoutOpeningSuggestions(); }}>
            <span>{option}</span>
          </button>)}
          {!options.length && <p className="taxpayer-tin-lookup__no-results" role="presentation">
            {bn ? 'কোনো প্রস্তাবিত টিআইএন নেই।' : 'No matching suggested TIN.'}
          </p>}
        </div>}
      </div>
      {error}
      {helper}
    </div>
    <div className="taxpayer-tin-lookup__field tin-lookup__name" hidden={hideNameField}>
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