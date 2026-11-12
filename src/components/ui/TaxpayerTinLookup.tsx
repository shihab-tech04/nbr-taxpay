import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { SAMPLE_TIN_SUGGESTIONS } from '../../data/sampleTinSuggestions';

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
  /** Optional accessible name when two separate TIN lookups share a form. */
  searchLabel?: string;
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
  heading, tinLabel, nameLabel, searchLabel, tinPlaceholder, namePlaceholder, maxTinLength = 12, maxNameLength = 160,
  readonlyTin = false, editableName = false, onNameChange, disabled = false, requiredTin = true,
  autofocusTin = false, invalidTin = false, tinDescribedBy, error, status, helper, className = '', card = false, suggestedTins = SAMPLE_TIN_SUGGESTIONS, hideNameField = false,
}: TaxpayerTinLookupProps) {
  const bn = language === 'bn';
  const tinRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRowRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionLayout, setSuggestionLayout] = useState<{top: number; left: number; width: number; maxHeight: number; inDialog: boolean} | null>(null);
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
  const options = tin ? (suggestedTins?.filter(suggestion => suggestion.includes(tin)) ?? []) : [];
  useEffect(() => {
    if (!suggestedTins?.length || !showSuggestions) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !suggestionsRef.current?.contains(event.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [showSuggestions, suggestedTins]);
  // A single shared placement contract: suggestions open only after typing,
  // always *below* the input, and overlay the fixed modal footer when needed.
  // Portal to the dialog shell to avoid clipping inside its scrolling body.
  useLayoutEffect(() => {
    if (!showSuggestions || !tin || !suggestedTins?.length) return;
    const row = searchRowRef.current;
    if (!row) return;
    const dialog = row.closest<HTMLElement>('.taxpay-modal');
    const body = row.closest<HTMLElement>('.taxpay-modal__body');
    const measure = () => {
      const anchor = row.getBoundingClientRect();
      const dialogRect = dialog?.getBoundingClientRect();
      const viewportBottom = (window.visualViewport?.offsetTop ?? 0)
        + (window.visualViewport?.height ?? window.innerHeight);
      const lowerLimit = Math.min(viewportBottom - 8, (dialogRect?.bottom ?? viewportBottom) - 10);
      const roomBelow = Math.max(0, lowerLimit - anchor.bottom - 4);
      const desired = Math.min(190, Math.round(window.innerHeight * .3));
      const next = {
        top: anchor.bottom + 4 - (dialogRect?.top ?? 0),
        left: anchor.left - (dialogRect?.left ?? 0),
        width: anchor.width,
        maxHeight: Math.max(48, Math.min(desired, roomBelow)),
        inDialog: Boolean(dialog),
      };
      setSuggestionLayout(previous => previous && Object.keys(next).every(key =>
        previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
    };
    measure();
    body?.addEventListener('scroll', measure, {passive: true});
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', measure);
    return () => {
      body?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('scroll', measure);
    };
  }, [showSuggestions, tin, suggestedTins?.length]);
  const locked = disabled || readonlyTin;
  const change = (next: string) => onTinChange(next.replace(/\D/g, '').slice(0, maxTinLength));
  return <div ref={rootRef} className={['taxpayer-tin-lookup', card ? 'taxpayer-tin-lookup--card' : '', className].filter(Boolean).join(' ')}
    data-testid="shared-taxpayer-tin-lookup"
    onBlur={event => {
      const next = event.relatedTarget as Node | null;
      if (!event.currentTarget.contains(next) && !suggestionsRef.current?.contains(next)) setShowSuggestions(false);
    }}>
    {heading && <h3 className="taxpayer-tin-lookup__heading">{heading}</h3>}
    <div className="taxpayer-tin-lookup__field">
      <label htmlFor={tinId}>{tinLabel ?? (bn ? 'করদাতার টিআইএন' : 'Taxpayer TIN')}{requiredTin ? ' *' : ''}</label>
      <div ref={searchRowRef} className="taxpayer-tin-lookup__search-row taxpay-taxpayer-row__tin-search tin-lookup__row">
        <div className="taxpayer-tin-lookup__tin-entry taxpay-taxpayer-row__tin-entry">
          <input ref={tinRef} id={tinId} type="text" inputMode="numeric" autoComplete="off"
            maxLength={maxTinLength} value={tin} required={requiredTin} autoFocus={autofocusTin}
            readOnly={readonlyTin} disabled={disabled} aria-readonly={readonlyTin || undefined}
            role={suggestedTins?.length ? 'combobox' : undefined} aria-autocomplete={suggestedTins?.length ? 'list' : undefined}
            aria-controls={suggestedTins?.length ? tinId + '-suggestions' : undefined}
            aria-expanded={suggestedTins?.length ? showSuggestions : undefined}
            onFocus={() => {
              // Entering a fresh Add beneficiary modal must NOT expose all TINs.
              if (suppressNextFocusOpen.current) suppressNextFocusOpen.current = false;
            }}
            onKeyDown={event => {
              if (event.key === 'Escape' && showSuggestions) {
                event.preventDefault();
                event.stopPropagation(); // Dismiss the dropdown, not its parent payment modal.
                setShowSuggestions(false);
              }
              if (event.key === 'ArrowDown' && showSuggestions) {
                event.preventDefault();
                suggestionsRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();
              }
            }}
            aria-invalid={invalidTin || undefined} aria-describedby={tinDescribedBy || undefined}
            placeholder={tinPlaceholder ?? (bn ? '১২ সংখ্যার টিআইএন' : '12-digit TIN')}
            onChange={event => {
              const next = event.target.value.replace(/\D/g, '').slice(0, maxTinLength);
              change(next);
              setShowSuggestions(Boolean(next && suggestedTins?.length));
            }} />
          {Boolean(tin) && !locked && <button type="button"
            className="taxpayer-tin-lookup__clear taxpay-taxpayer-row__tin-clear"
            aria-label={bn ? 'টিআইএন অনুসন্ধান মুছুন' : 'Clear TIN search'}
            title={bn ? 'টিআইএন মুছুন' : 'Clear TIN'}
            onClick={() => { onClear(); focusTinWithoutOpeningSuggestions(); }}>
            <X size={17} aria-hidden="true" />
          </button>}
        </div>
        <button type="button" className="tin-lookup__search taxpayer-tin-lookup__search"
          disabled={disabled || !canSearch} aria-label={searchLabel} onClick={() => { setShowSuggestions(false); onSearch(); }}>
          <Search size={17} aria-hidden="true" />{bn ? 'খুঁজুন' : 'Search'}
        </button>
        {Boolean(suggestedTins?.length) && showSuggestions && tin && !locked && suggestionLayout && createPortal(<div
          ref={suggestionsRef} className="taxpayer-tin-lookup__suggestions" id={tinId + '-suggestions'} role="listbox"
          data-placement="below"
          style={{position:suggestionLayout.inDialog?'absolute':'fixed',top:suggestionLayout.top,
            left:suggestionLayout.left,width:suggestionLayout.width,right:'auto',bottom:'auto',
            maxHeight:suggestionLayout.maxHeight,zIndex:9999}}
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
                const items = [...(suggestionsRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])];
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
        </div>, rootRef.current?.closest('.taxpay-modal') ?? document.body)}
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