import React, { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, backendConfigured } from '../../services/supabaseClient';
import { useTaxState } from '../../services/taxState';
import { authRedirectUrl, verifiedDraftCategory, draftSeedForCategory, sameAuthenticatedOwner, confirmDraftDeletion, shouldApplyInitialAuthResolution } from '../../services/secureWorkspacePolicy';
import { formatBdtMinorUnits } from '../../services/minorUnitFormatting';
import { confirmPrivateDraftUpdate, confirmPrivateDraftReadBack, privateDraftToInput } from '../../services/privateDraftResume';
import { SourceChangeProposals } from './SourceChangeProposals';
import { CorrectionInquiries } from './CorrectionInquiries';
import { SharedReviewRequests } from './SharedReviewRequests';
import { UiButton, UiInput } from '../ui/Controls';
import { DRAFT_CATEGORIES, validateDraft, type DraftCategory, type DraftInput, type DraftPurpose } from '../../services/draftValidation';
import { getSecureWorkspaceCopy, localizeDraftValidationError, secureWorkspaceMessage, type SecureWorkspaceMessageKey } from '../../services/secureWorkspaceCopy';

type WorkspaceMessage =
  | { kind: 'copy'; key: SecureWorkspaceMessageKey; detail?: string }
  | { kind: 'validation'; englishText: string };

type SavedDraft = {
  id: string;
  purpose: DraftPurpose;
  category: DraftCategory;
  assessment_year: string;
  amount_minor: number;
  memo: string | null;
  created_at: string;
  owner_uid: string;
  record_status: string;
};

const categoryOptions = (purpose: DraftPurpose) =>
  (Object.keys(DRAFT_CATEGORIES) as DraftCategory[])
    .filter(category => purpose === 'WITHHOLDING_TAX_DEPOSIT'
      ? category === 'SOURCE_TAX_DEPOSIT' : category !== 'SOURCE_TAX_DEPOSIT');

const initial: DraftInput = {
  purpose: 'TAX_LIABILITY_PAYMENT',
  category: 'TAX_WITH_RETURN',
  assessmentYear: '',
  amount: '',
  memo: ''
};

export const SecureWorkspace: React.FC = () => {
  const { language, routeParams, navigate } = useTaxState();
  const bn = language === 'bn';
  const copy = getSecureWorkspaceCopy(language);
  const sessionEpoch = useRef(0);
  const currentAuthUserId = useRef<string | null>(null);
  const draftFormRef = useRef<HTMLFormElement>(null);
  const draftBeforeEditing = useRef<DraftInput | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<WorkspaceMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedDraftCategory = verifiedDraftCategory(routeParams?.draftCategory,
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('draftCategory') : null);
  const seededDraft = (): DraftInput => draftSeedForCategory(selectedDraftCategory) ?? initial;
  const [draft, setDraft] = useState<DraftInput>(seededDraft);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [rows, setRows] = useState<SavedDraft[]>([]);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftLoadError, setDraftLoadError] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const messageText = message
    ? message.kind === 'copy'
      ? secureWorkspaceMessage(language, message.key, message.detail)
      : localizeDraftValidationError(message.englishText, language)
    : '';
  const showMessage = (key: SecureWorkspaceMessageKey, detail?: string) =>
    setMessage({ kind: 'copy', key, detail });

  useEffect(() => {
    const client = supabase;
    if (!client) { setAuthLoading(false); return; }
    let active = true;
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (active) {
        const nextId = session?.user?.id ?? null;
        if (currentAuthUserId.current !== nextId) {
          // Do not render private rows from the previous user while the new owner's GET is pending.
          setRows([]);
          setPendingDelete(null);
          setEditingDraftId(null);
        }
        currentAuthUserId.current = nextId;
        sessionEpoch.current++;
        setUser(session?.user ?? null);
        setAuthLoading(false);
      }
    });
    const startupRevision = sessionEpoch.current;
    client.auth.getUser().then(({ data, error }) => {
      if (active && shouldApplyInitialAuthResolution(startupRevision, sessionEpoch.current)) {
        sessionEpoch.current++;
        currentAuthUserId.current = error ? null : data.user?.id ?? null;
        setRows([]);
        setUser(error ? null : data.user);
        setAuthLoading(false);
      }
    }).catch(() => {
      if (active && shouldApplyInitialAuthResolution(startupRevision, sessionEpoch.current)) {
        sessionEpoch.current++;
        currentAuthUserId.current = null;
        setRows([]);
        setUser(null);
        setAuthLoading(false);
      }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const refresh = async (uid: string): Promise<SavedDraft[]> => {
    const client = supabase;
    if (!client) throw new Error('Backend disabled');
    const expectedEpoch = sessionEpoch.current;
    const { data: identity, error: identityError } = await client.auth.getUser();
    if (identityError || !sameAuthenticatedOwner(identity.user?.id, uid)) {
      if (sessionEpoch.current === expectedEpoch) setRows([]);
      throw new Error('SESSION_EXPIRED_LOAD');
    }
    const { data, error } = await client.from('taxpay_payment_drafts')
      .select('id,owner_uid,record_status,purpose,category,assessment_year,amount_minor,memo,created_at')
      .eq('owner_uid', uid).order('created_at', { ascending: false });
    if (error) throw error;
    if (sessionEpoch.current !== expectedEpoch) throw new Error('SESSION_EXPIRED_LOAD');
    const verifiedRows = (data ?? []) as SavedDraft[];
    setDraftLoadError(false);
    setRows(verifiedRows);
    return verifiedRows;
  };

  useEffect(() => {
    setPendingDelete(null);
    setEditingDraftId(null);
    setDraft(seededDraft());
    draftBeforeEditing.current = null;
    setRows([]);
    setDraftLoadError(false);
    if (!user) { setDraftLoading(false); return; }
    let active = true;
    setDraftLoading(true);
    refresh(user.id).catch((error: Error) => {
      if (!active) return;
      setDraftLoadError(true);
      if (error.message === 'SESSION_EXPIRED_LOAD') showMessage('sessionExpiredLoad');
      else showMessage('couldNotLoadDrafts', error.message);
    }).finally(() => { if (active) setDraftLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage(null);
    try {
      const redirect = authRedirectUrl(window.location.origin, import.meta.env.BASE_URL,
        selectedDraftCategory ?? undefined);
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirect, shouldCreateUser: true }
      });
      if (error) showMessage('signInRequestFailed', error.message);
      else showMessage('signInSuccess');
    } catch {
      showMessage('signInUnavailable');
    } finally {
      setBusy(false);
    }
  };

  const createDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = supabase;
    if (!client || !user) return;
    const result = validateDraft(draft);
    if (result.error) { setMessage({ kind: 'validation', englishText: result.error }); return; }
    const draftId = editingDraftId;
    setBusy(true); setMessage(null);
    let acknowledgedId: string | null = null;
    try {
      const { data: current, error: authError } = await client.auth.getUser();
      if (authError || !sameAuthenticatedOwner(current.user?.id, user.id)) {
        showMessage('sessionExpiredSave');
        return;
      }
      const values = {
        purpose: draft.purpose,
        category: draft.category,
        assessment_year: draft.assessmentYear,
        amount_minor: result.amountMinor,
        memo: draft.memo.trim() || null
      };
      if (draftId) {
        const original = rows.find(row => row.id === draftId && row.owner_uid === current.user!.id);
        if (!original) { showMessage('draftConflict'); return; }
        // Column-level optimistic matching: no new SQL version column, no lost update
        // if another session edited any of the stored draft fields in the meantime.
        const filteredUpdate = client.from('taxpay_payment_drafts')
          .update(values).eq('id', draftId).eq('owner_uid', current.user!.id)
          .eq('purpose', original.purpose).eq('category', original.category)
          .eq('assessment_year', original.assessment_year)
          .eq('amount_minor', original.amount_minor);
        const { data: updatedRows, error } = original.memo === null
          ? await filteredUpdate.is('memo', null).select('id')
          : await filteredUpdate.eq('memo', original.memo).select('id');
        if (error) { showMessage('draftWasNotSaved', error.message); return; }
        if (!confirmPrivateDraftUpdate(draftId, updatedRows)) {
          showMessage('draftConflict');
          return;
        }
        acknowledgedId = draftId;
      } else {
        const { data: insertedRows, error } = await client.from('taxpay_payment_drafts').insert({
          owner_uid: current.user!.id,
          ...values
        }).select('id');
        if (error) { showMessage('draftWasNotSaved', error.message); return; }
        if (!Array.isArray(insertedRows) || insertedRows.length !== 1 ||
          typeof insertedRows[0]?.id !== 'string' || !insertedRows[0].id) {
          showMessage('draftReadBackNotConfirmed');
          return;
        }
        acknowledgedId = insertedRows[0].id;
      }
      // An HTTP success is insufficient: reselect under this specific authenticated owner.
      // If the account changed while the request was in flight, do not show another owner's data.
      const reread = await refresh(current.user!.id);
      if (!confirmPrivateDraftReadBack({
        id: acknowledgedId!, owner_uid: current.user!.id, ...values
      }, reread)) {
        showMessage('draftReadBackNotConfirmed');
        return;
      }
      setEditingDraftId(null);
      setDraft(draftId && draftBeforeEditing.current
        ? draftBeforeEditing.current
        : { ...draft, amount: '', memo: '' });
      draftBeforeEditing.current = null;
      showMessage(draftId ? 'draftUpdated' : 'draftSaved');
    } catch (error) {
      // Network interruption after a write leaves the commit outcome unknown.
      showMessage(acknowledgedId ? 'draftSavedRefreshFailed' : 'draftOperationFailed', String(error));
    } finally { setBusy(false); }
  };

  const retryLoad = async () => {
    if (!user || busy || draftLoading) return;
    setDraftLoading(true);
    setDraftLoadError(false);
    setMessage(null);
    try {
      await refresh(user.id);
      showMessage('draftsRefreshed');
    } catch (error) {
      setDraftLoadError(true);
      showMessage('couldNotLoadDrafts', String(error));
    } finally { setDraftLoading(false); }
  };

  const resumeDraft = (row: SavedDraft) => {
    const resumed = privateDraftToInput(row);
    if (!resumed) { showMessage('draftCannotResume'); return; }
    if (!editingDraftId) draftBeforeEditing.current = draft;
    setPendingDelete(null);
    setEditingDraftId(row.id);
    setDraft(resumed);
    showMessage('draftLoadedForEditing');
    draftFormRef.current?.scrollIntoView({ block: 'start' });
  };

  const cancelDraftEditing = () => {
    setEditingDraftId(null);
    setDraft(draftBeforeEditing.current ?? initial);
    draftBeforeEditing.current = null;
    showMessage('draftEditingCancelled');
  };

  const deleteDraft = async (id: string) => {
    if (!supabase || !user) return;
    if (pendingDelete !== id) { setPendingDelete(id); return; }
    setBusy(true); setMessage(null);
    try {
      const { data: identity, error: authError } = await supabase.auth.getUser();
      if (authError || !sameAuthenticatedOwner(identity.user?.id, user.id)) {
        showMessage('sessionExpiredDelete');
        return;
      }
      // RLS may legitimately delete zero rows when the record is not owned by
      // this authenticated user. An error-free HTTP response is NOT proof of deletion.
      const { data: deletedRows, error } = await supabase.from('taxpay_payment_drafts')
        .delete().eq('id', id).eq('owner_uid', user.id).select('id');
      if (error) { showMessage('couldNotDeleteDraft', error.message); return; }
      if (!confirmDraftDeletion(id, deletedRows)) {
        showMessage('deletionNotConfirmed');
        return;
      }
      const reread = await refresh(user.id);
      if (reread.some(row => row.id === id)) {
        showMessage('deletionNotConfirmed');
        return;
      }
      setPendingDelete(null);
      if (editingDraftId === id) {
        setEditingDraftId(null);
        setDraft(draftBeforeEditing.current ?? initial);
        draftBeforeEditing.current = null;
      }
      showMessage('draftDeleted');
    } catch(error) {
      showMessage('draftDeletionUnconfirmed', String(error));
    } finally { setBusy(false); }
  };

  const signOut = async () => {
    if (!supabase) return;
    setBusy(true);
    try {
      // Signing out of this browser must not revoke every device session.
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) { showMessage('signOutNotConfirmed', error.message); return; }
      sessionEpoch.current++;
      setUser(null); setRows([]); setPendingDelete(null);
      setEditingDraftId(null); setDraft(initial);
      draftBeforeEditing.current = null;
      showMessage('signedOut');
    } catch {
      showMessage('signOutUnavailable');
    } finally { setBusy(false); }
  };

  return (
    <section lang={bn ? 'bn' : 'en'} className="taxpayer-reference-secure max-w-4xl mx-auto space-y-5 pb-12">
      <header className="bg-white border border-slate-200 rounded-xl p-6">
        <h1 className="font-serif-fraunces text-2xl font-bold text-emerald-950">{copy.workspaceTitle}</h1>
        <p className="text-sm text-slate-600 mt-2">{copy.workspaceDescription}</p>
      </header>
      {!backendConfigured ? (
        <article className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-amber-900">{copy.databaseUnavailableTitle}</h2>
          <p className="text-sm mt-2 text-amber-900">{copy.databaseUnavailableBody}</p>
          <button type="button" onClick={() => navigate('landing')}
            className="mt-4 min-h-11 rounded-lg border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100">
            {bn ? 'জনসাধারণের সেবায় ফিরুন' : 'Back to public services'}
          </button>
        </article>
      ) : authLoading ? <p role="status">{copy.checkingSession}</p> : !user ? (
        <form onSubmit={login} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-bold text-emerald-950">{copy.signInHeading}</h2>
          <p className="text-sm text-slate-600">{copy.signInDescription}</p>
          <label htmlFor="taxpay-auth-email" className="block text-sm font-semibold">{copy.emailAddress}</label>
          <UiInput id="taxpay-auth-email" required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
            className="min-h-11 w-full px-3 py-3 border border-slate-300 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700" placeholder={copy.emailPlaceholder}/>
          <div className="flex flex-wrap items-center gap-4">
            <UiButton type="submit" disabled={busy}>{copy.sendSignInLink}</UiButton>
            <a className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-blue-800 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
              href={bn ? '?action=office_login&lang=bn' : '?action=office_login'}>
              {bn ? 'ইউজার আইডি ও পাসওয়ার্ড' : 'Sign in with User ID or password'}
            </a>
          </div>
        </form>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap justify-between gap-3 items-center">
            <div><h2 className="font-bold text-emerald-950">{copy.signedInTitle}</h2><p className="text-xs text-slate-600">{user.email}</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>navigate('taxpayer_home')} className="min-h-11 border border-blue-700 bg-blue-700 text-white rounded-lg px-4 py-2 font-semibold text-sm">{bn?'আমার ড্যাশবোর্ড':'My dashboard'}</button>
            <button type="button" onClick={signOut} disabled={busy} className="min-h-11 border border-slate-300 rounded-lg px-4 py-2 font-semibold text-sm">{copy.signOut}</button></div>
          </div>
          <form ref={draftFormRef} onSubmit={createDraft} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-serif-fraunces text-xl font-bold text-emerald-950">{copy.draftHeading}</h2>
            <p className="text-xs text-slate-500">{copy.draftStorageNotice}</p>
            {editingDraftId && <p role="status" className="text-sm bg-emerald-50 border border-emerald-200 rounded-lg p-3">{copy.editingDraftNotice}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-sm font-semibold">{copy.paymentPurpose}
                <select className="block w-full mt-2 border border-slate-300 rounded-lg p-3" value={draft.purpose} onChange={e => {
                  const purpose = e.target.value as DraftPurpose;
                  setDraft(p => ({ ...p, purpose, category: purpose === 'WITHHOLDING_TAX_DEPOSIT' ? 'SOURCE_TAX_DEPOSIT' : 'TAX_WITH_RETURN' }));
                }}>
                  <option value="TAX_LIABILITY_PAYMENT">{copy.liabilityPlanning}</option><option value="WITHHOLDING_TAX_DEPOSIT">{copy.withholdingPlanning}</option>
                </select>
              </label>
              <label className="text-sm font-semibold">{copy.category}
                <select className="block w-full mt-2 border border-slate-300 rounded-lg p-3" value={draft.category} onChange={e => setDraft(p => ({ ...p, category: e.target.value as DraftCategory }))}>
                  {categoryOptions(draft.purpose).map(c => <option key={c} value={c}>{copy.categories[c]}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">{copy.assessmentYear}
                <input required className="block w-full mt-2 border border-slate-300 rounded-lg p-3" aria-describedby="draft-year-help" value={draft.assessmentYear} onChange={e => setDraft(p => ({ ...p, assessmentYear: e.target.value }))} placeholder={copy.assessmentYearPlaceholder}/>
                <p id="draft-year-help" className="mt-1 text-xs font-normal text-slate-600">{copy.assessmentYearHelp}</p>
              </label>
              <label className="text-sm font-semibold">{copy.proposedAmount}
                <input required inputMode="decimal" className="block w-full mt-2 border border-slate-300 rounded-lg p-3" value={draft.amount} onChange={e => setDraft(p => ({ ...p, amount: e.target.value }))} placeholder={copy.amountPlaceholder}/>
              </label>
            </div>
            <label className="block text-sm font-semibold">{copy.privateNote}
              <textarea maxLength={300} value={draft.memo} onChange={e => setDraft(p => ({ ...p, memo: e.target.value }))}
                className="block w-full mt-2 border border-slate-300 rounded-lg p-3" rows={2}/>
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={busy} className="min-h-11 px-5 py-3 rounded-lg bg-emerald-950 text-white font-semibold disabled:opacity-50">{busy ? copy.savingDraft : editingDraftId ? copy.updateDraft : copy.saveDraft}</button>
              {editingDraftId && <button type="button" disabled={busy} onClick={cancelDraftEditing} className="min-h-11 px-5 py-3 rounded-lg border border-slate-300 font-semibold disabled:opacity-50">{copy.cancelEditing}</button>}
            </div>
          </form>
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="font-serif-fraunces text-xl font-bold text-emerald-950">{copy.savedDrafts}</h2>
            {message?.kind === 'copy' && ['couldNotLoadDrafts', 'sessionExpiredLoad', 'draftSavedRefreshFailed', 'draftReadBackNotConfirmed', 'draftConflict', 'deletionNotConfirmed'].includes(message.key) && (
              <button type="button" disabled={busy || draftLoading} onClick={retryLoad}
                className="min-h-11 px-4 py-2 border border-taxpay-primary text-taxpay-primary rounded-lg font-semibold focus-visible:outline focus-visible:outline-2">
                {copy.retryLoad}
              </button>
            )}
            {draftLoading ? <p role="status" className="text-sm text-slate-600">{copy.loadingDrafts}</p> : draftLoadError ? <p role="alert" className="text-sm text-taxpay-error">{copy.draftListUnavailable}</p> : rows.length === 0 ? <p className="text-sm text-slate-500">{copy.emptyDrafts}</p> : (
              <ul className="divide-y divide-slate-200">
                {rows.map(row => <li key={row.id} className="py-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 break-words">
                    <p className="text-sm font-semibold">{copy.categories[row.category]} · {copy.assessmentYearShort} {row.assessment_year}</p>
                    <p className="text-xs text-slate-600">BDT {formatBdtMinorUnits(row.amount_minor, language)} · {copy.privateDraftOnly}</p>
                    {row.memo && <p className="text-xs text-slate-500">{row.memo}</p>}
                  </div>
                  <div className="flex flex-col items-stretch gap-2">
                    <button type="button" disabled={busy} onClick={() => resumeDraft(row)} className="min-h-11 px-3 py-2 border border-emerald-700 rounded-lg text-sm font-semibold text-emerald-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
                      {copy.resumeDraft}
                    </button>
                    <button type="button" disabled={busy} onClick={() => deleteDraft(row.id)} className="min-h-11 px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600">
                      {pendingDelete === row.id ? copy.confirmDelete : copy.deleteDraft}
                    </button>
                    {pendingDelete === row.id && <button type="button" onClick={() => setPendingDelete(null)} className="min-h-11 px-3 py-2 text-sm font-semibold text-emerald-900">{copy.cancel}</button>}
                  </div>
                </li>)}
              </ul>
            )}
          </section>
          <SharedReviewRequests key={'review-'+user.id} authenticatedUserId={user.id} language={language} drafts={rows} />
          <SourceChangeProposals key={user.id} authenticatedUserId={user.id} language={language} />
          <CorrectionInquiries key={'cor-'+user.id} authenticatedUserId={user.id} language={language} />
        </>
      )}
      {messageText && <p role="status" aria-live="polite" className="bg-white border border-slate-200 p-4 rounded-lg text-sm break-words">{messageText}</p>}
    </section>
  );
};
