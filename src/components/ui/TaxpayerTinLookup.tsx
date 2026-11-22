import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Plus, Search, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { SAMPLE_TIN_SUGGESTIONS } from '../../data/sampleTinSuggestions';
import { maskTinForDisplay } from '../../services/tinDisplay';

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
  /** Opt-in to removing the duplicate field entirely in v5 payer lookup only. */
  omitNameField?: boolean;
  /** Opt-in keyboard shortcut for parallel entry; shared lookup behavior remains unchanged elsewhere. */
  submitOnEnter?: boolean;
  /** Stable selector for a host's existing TIN input contract. */
  inputTestId?: string;
  /** Stable selector for the approved 12/13 digit visual blocks. */
  segmentsTestId?: string;
  /** One accessible input drives the approved visible digit blocks. */
  segmented?: boolean;
  /** Opt-in: click a visible digit to replace it without clearing preceding digits. */
  directDigitEdit?: boolean;
  /** Only the approved All Tax Payments Step 1 hides the optional clear control. All other flows keep it. */
  showClearButton?: boolean;
}

export function TaxpayerTinLookup({
  language, tinId, nameId, tin, name, onTinChange, onSearch, onClear, canSearch,
  heading, tinLabel, nameLabel, searchLabel, tinPlaceholder, namePlaceholder, maxTinLength = 12, maxNameLength = 160,
  readonlyTin = false, editableName = false, onNameChange, disabled = false, requiredTin = true,
  autofocusTin = false, invalidTin = false, tinDescribedBy, error, status, helper, className = '', card = false, suggestedTins = SAMPLE_TIN_SUGGESTIONS, hideNameField = false, omitNameField = false, submitOnEnter = false, inputTestId, segmentsTestId, segmented = true, directDigitEdit = false, showClearButton = true,
}: TaxpayerTinLookupProps) {
  const bn = language === 'bn';
  const tinRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRowRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeDigit, setActiveDigit] = useState<number | null>(null);
  const pointerDigitRef = useRef<number | null>(null);
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
  // Never suggest a 12-digit TIN inside a 13-digit authorization/account-reference field.
  const validSuggestions = useMemo(() => (suggestedTins ?? []).filter(option => option.length === maxTinLength), [suggestedTins, maxTinLength]);
  const options = tin ? validSuggestions.filter(suggestion => suggestion.includes(tin)) : [];
  useEffect(() => {
    if (!validSuggestions.length || !showSuggestions) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !suggestionsRef.current?.contains(event.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [showSuggestions, validSuggestions]);
  // A single shared placement contract: suggestions open only after typing,
  // always *below* the input, and overlay the fixed modal footer when needed.
  // Portal to the dialog shell to avoid clipping inside its scrolling body.
  useLayoutEffect(() => {
    if (!showSuggestions || !tin || !validSuggestions.length) return;
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
  }, [showSuggestions, tin, validSuggestions.length]);
  const locked = disabled || readonlyTin;
  const searchReady = canSearch && !locked;
  const change = (next: string) => onTinChange(next.replace(/\D/g, '').slice(0, maxTinLength));
  return <div ref={rootRef} className={['taxpayer-tin-lookup', card ? 'taxpayer-tin-lookup--card' : '', className].filter(Boolean).join(' ')}
    data-testid="shared-taxpayer-tin-lookup"
    onBlur={event => {
      const next = event.relatedTarget as Node | null;
      if (!event.currentTarget.contains(next) && !suggestionsRef.current?.contains(next)) setShowSuggestions(false);
    }}>
    {heading && <h3 className="taxpayer-tin-lookup__heading">{heading}</h3>}
    <div className="taxpayer-tin-lookup__field">
      <div className="taxpayer-tin-lookup__field-heading">
        <label htmlFor={tinId}>{tinLabel ?? (bn ? 'করদাতার টিআইএন' : 'Taxpayer TIN')}{requiredTin ? ' *' : ''}</label>
        {showClearButton && Boolean(tin) && !locked && <button type="button" className="taxpayer-tin-lookup__clear"
          aria-label={bn ? 'টিআইএন অনুসন্ধান মুছুন' : 'Clear TIN search'}
          title={bn ? 'টিআইএন মুছুন' : 'Clear TIN'}
          onClick={() => { onClear(); focusTinWithoutOpeningSuggestions(); }}>
          <X size={17} aria-hidden="true" />
        </button>}
      </div>
      <div ref={searchRowRef} className="taxpayer-tin-lookup__search-row taxpay-taxpayer-row__tin-search tin-lookup__row">
        <div className={['taxpayer-tin-lookup__tin-entry', 'taxpay-taxpayer-row__tin-entry', segmented ? 'taxpayer-tin-lookup__tin-entry--segmented' : '', segmented && directDigitEdit ? 'taxpayer-tin-lookup__tin-entry--direct-edit' : ''].filter(Boolean).join(' ')}
          data-testid={segmented ? segmentsTestId ?? 'taxpayer-tin-digits' : undefined}
          style={segmented ? ({'--taxpay-tin-digit-count': maxTinLength} as React.CSSProperties) : undefined}
          onPointerDown={event => {
            if (!directDigitEdit || locked || event.button !== 0) return;
            const input = tinRef.current;
            if (!input) return;
            // Prevent the transparent full-width input from resetting the
            // selection after the user explicitly chooses a digit cell.
            event.preventDefault();
            const cells = Array.from(event.currentTarget.querySelectorAll(':scope > span'));
            // On narrow phones the 12 visible cells wrap to two rows of
            // six: X-only matching aliases digit 7 to digit 1.
            const hit = cells.findIndex(cell => {
              const rect = cell.getBoundingClientRect();
              return event.clientX >= rect.left && event.clientX <= rect.right &&
                event.clientY >= rect.top && event.clientY <= rect.bottom;
            });
            const index = Math.min(hit < 0 ? maxTinLength - 1 : hit, tin.length);
            pointerDigitRef.current = index;
            input.focus();
            input.setSelectionRange(index, index < tin.length ? index + 1 : index);
            setActiveDigit(Math.min(index, maxTinLength - 1));
          }}
          onPointerUp={() => {
            // Mobile emulation may move the native caret during pointerup.
            // Reassert the chosen cell after the browser processes the pointer.
            const index = pointerDigitRef.current;
            pointerDigitRef.current = null;
            if (!directDigitEdit || locked || index === null) return;
            const input = tinRef.current;
            if (!input) return;
            input.setSelectionRange(index, index < tin.length ? index + 1 : index);
            setActiveDigit(Math.min(index, maxTinLength - 1));
          }}
          onPointerCancel={() => { pointerDigitRef.current = null; }}>
          {segmented && Array.from({length: maxTinLength}, (_, index) => <span key={index}
            className={[index < tin.length ? 'is-filled' : '', directDigitEdit && activeDigit === index ? 'is-active' : ''].filter(Boolean).join(' ')} aria-hidden="true">{tin[index] ?? ''}</span>)}
          <input ref={tinRef} id={tinId} data-testid={inputTestId} type="text" inputMode="numeric" autoComplete="off"
            maxLength={maxTinLength} value={tin} required={requiredTin} autoFocus={autofocusTin}
            readOnly={readonlyTin} disabled={disabled} aria-readonly={readonlyTin || undefined}
            role={validSuggestions.length ? 'combobox' : undefined} aria-autocomplete={validSuggestions.length ? 'list' : undefined}
            aria-controls={validSuggestions.length ? tinId + '-suggestions' : undefined}
            aria-expanded={validSuggestions.length ? showSuggestions : undefined}
            onFocus={() => {
              // Entering a fresh Add beneficiary modal must NOT expose all TINs.
              if (suppressNextFocusOpen.current) suppressNextFocusOpen.current = false;
              if (directDigitEdit) setActiveDigit(Math.min(tinRef.current?.selectionStart ?? tin.length, maxTinLength - 1));
            }}
            onBlur={() => { if (directDigitEdit) setActiveDigit(null); }}
            onKeyUp={event => {
              if (directDigitEdit) setActiveDigit(Math.min(event.currentTarget.selectionStart ?? tin.length, maxTinLength - 1));
            }}
            onPaste={event => {
              if (!directDigitEdit || locked) return;
              const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
              if (pasted.length === maxTinLength) {
                event.preventDefault();
                change(pasted);
                setShowSuggestions(false);
                setActiveDigit(maxTinLength - 1);
              }
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
              if (event.key === 'Enter' && submitOnEnter && searchReady) {
                event.preventDefault();
                setShowSuggestions(false);
                onSearch();
              }
            }}
            aria-invalid={invalidTin || undefined} aria-describedby={tinDescribedBy || undefined}
            placeholder={tinPlaceholder ?? (bn ? '১২ সংখ্যার টিআইএন' : '12-digit TIN')}
            onChange={event => {
              const next = event.target.value.replace(/\D/g, '').slice(0, maxTinLength);
              change(next);
              if (directDigitEdit) setActiveDigit(Math.min(event.target.selectionStart ?? next.length, maxTinLength - 1));
              // A full-length 12- or 13-digit TIN is ready for the separate Search action.
              // Close the optional popup so it cannot cover that action in a
              // narrow dialog; partial TINs still offer suggestions/keyboard use.
              setShowSuggestions(Boolean(next && validSuggestions.length && next.length < maxTinLength));
            }} />
          
        </div>
        <button type="button" className={['tin-lookup__search', 'taxpayer-tin-lookup__search', searchReady ? 'is-ready' : ''].filter(Boolean).join(' ')}
          disabled={!searchReady} aria-label={searchLabel} onClick={() => { setShowSuggestions(false); onSearch(); }}>
          <Search size={17} aria-hidden="true" />{bn ? 'খুঁজুন' : 'Search'}
        </button>
        {Boolean(validSuggestions.length) && showSuggestions && tin && !locked && suggestionLayout && createPortal(<div
          ref={suggestionsRef} className="taxpayer-tin-lookup__suggestions" id={tinId + '-suggestions'} role="listbox"
          data-placement="below"
          style={{position:suggestionLayout.inDialog?'absolute':'fixed',top:suggestionLayout.top,
            left:suggestionLayout.left,width:suggestionLayout.width,right:'auto',bottom:'auto',
            maxHeight:suggestionLayout.maxHeight,zIndex:9999}}
          aria-label={bn ? 'নমুনা টিআইএন — সরকারি যাচাইকৃত নয়' : 'Sample TIN suggestions — not NBR verified'}>
          <p className="taxpayer-tin-lookup__suggestions-heading" role="presentation">
            {bn ? 'নমুনা টিআইএন নম্বর — NBR যাচাইকৃত নয়' : 'Sample TIN numbers — not verified NBR records'}
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
    {!omitNameField && <div className="taxpayer-tin-lookup__field tin-lookup__name" hidden={hideNameField}>
      <label htmlFor={nameId}>{nameLabel ?? (bn ? 'করদাতার নাম' : 'Taxpayer name')}</label>
      <input id={nameId} type="text" autoComplete="off" maxLength={maxNameLength}
        readOnly={!editableName} aria-readonly={!editableName || undefined}
        disabled={disabled} value={name}
        onChange={event => onNameChange?.(event.target.value)}
        placeholder={namePlaceholder ?? (bn ? 'টিআইএন খুঁজলে নাম এখানে দেখাবে' : 'Search TIN to fill name')} />
    </div>}
    {status}
  </div>;
}

/** Approved lookup result for flows that explicitly require search → review → add.
 * Caller controls the verified-match state, identity classification and permission to add.
 * This card never copies a TIN or authorizes access to private records.
 */
export interface TaxpayerTinSearchResultCardProps {
  language: 'en' | 'bn';
  tin: string;
  name: string;
  classification?: string | null;
  duplicateMessage?: string;
  classificationError?: string;
  onAdd?: () => void;
  canAdd?: boolean;
  testId?: string;
  summaryTestId?: string;
  addButtonTestId?: string;
  addLabel?: string;
  /** Match-only preview. Only flows with an Add action supply onAdd. */
  disabledAddLabel?: string;
}

export function TaxpayerTinSearchResultCard({
  language, tin, name, classification, duplicateMessage, classificationError, onAdd, canAdd = false, testId,
  summaryTestId, addButtonTestId, addLabel, disabledAddLabel,
}: TaxpayerTinSearchResultCardProps) {
  const bn = language === 'bn';
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { setRevealed(false); }, [tin]);
  const masked = maskTinForDisplay(tin);
  return <div className="taxpayer-tin-lookup__result-card unified-taxpayer-workspace__profile" data-testid={testId}
    role="group" aria-live="polite" aria-atomic="true" aria-label={bn ? 'করদাতার অনুসন্ধান ফলাফল' : 'Taxpayer search result'}>
    <dl data-testid={summaryTestId}>
      <div><dt>{bn ? 'করদাতার নাম' : 'Taxpayer name'}</dt><dd className="unified-v5-profile-name">
        <strong>{name}</strong>{classification && <span> · {classification}</span>}
      </dd></div>
      <div><dt>{bn ? 'টিআইএন' : 'TIN'}</dt><dd className="unified-taxpayer-workspace__masked">
        {revealed ? tin : masked}
        <button type="button" aria-label={revealed ? (bn ? 'টিআইএন আড়াল করুন' : 'Hide TIN') : (bn ? 'টিআইএন দেখুন' : 'Reveal TIN')}
          onClick={() => setRevealed(current => !current)}>{revealed ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}</button>
      </dd></div>
    </dl>
    {duplicateMessage && <p className="unified-taxpayer-workspace__error" role="status">{duplicateMessage}</p>}
    {classificationError && <p className="unified-taxpayer-workspace__error" role="status">{classificationError}</p>}
    {onAdd && <button type="button" data-testid={addButtonTestId}
      className="unified-taxpayer-workspace__add" onClick={onAdd} disabled={!canAdd}>
      <Plus size={18} aria-hidden="true"/>{!canAdd && disabledAddLabel ? disabledAddLabel : addLabel ?? (bn ? 'করদাতা যোগ করুন' : 'Add taxpayer')}
    </button>}
  </div>;
}
