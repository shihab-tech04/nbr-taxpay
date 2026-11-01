import { useEffect, useState } from 'react';
import { UiButton } from '../ui/Controls';
import { hasExistingGuestBeneficiaryAccess } from '../../services/guestBeneficiaries';
import { recoverBrowserBeneficiariesToAccount, type BeneficiaryRecoveryResult } from '../../services/beneficiaryAccountRecovery';

/**
 * Small, optional recovery affordance. A browser-local sample address book
 * is never silently presented as authenticated SQL data. A real account
 * owner must explicitly request a copy; the original remains available.
 */
export function BeneficiaryAccountRecovery({
  ownerUid, language, onRecovered,
}: {
  ownerUid: string;
  language: 'en' | 'bn';
  onRecovered: () => Promise<unknown>;
}) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BeneficiaryRecoveryResult | null>(null);
  const [error, setError] = useState('');
  const bn = language === 'bn';
  useEffect(() => {
    setAvailable(hasExistingGuestBeneficiaryAccess());
    setResult(null);
    setError('');
  }, [ownerUid]);

  if (!available) return null;

  const recover = async () => {
    if (busy || result) return;
    setBusy(true);
    setError('');
    try {
      const copied = await recoverBrowserBeneficiariesToAccount(ownerUid);
      // Reload the existing directory from owner-scoped SQL, not browser state.
      await onRecovered();
      setResult(copied);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not copy the saved beneficiaries.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="rounded-xl border border-taxpay-border bg-taxpay-surface px-4 py-3 sm:px-6"
    aria-label={bn ? 'ব্রাউজারের সংরক্ষিত তালিকা পুনরুদ্ধার' : 'Restore lists saved in this browser'}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-taxpay-text">
          {bn ? 'এই ব্রাউজারে আগে সংরক্ষিত তালিকা আছে?' : 'Previously saved lists in this browser?'}
        </p>
        <p className="mt-1 text-sm text-taxpay-muted">
          {bn
            ? 'আপনার অনুমতিতে এগুলো বর্তমান সাইন-ইন অ্যাকাউন্টে কপি হবে। আগের তালিকা মুছে যাবে না; একই তালিকার পুরোনো তথ্য বদলাবে না।'
            : 'Choose to copy them into this signed-in account. Original lists stay intact, and existing account contacts are not overwritten.'}
        </p>
      </div>
      <UiButton type="button" variant="outline" className="w-full shrink-0 sm:w-auto"
        disabled={busy || Boolean(result)} onClick={() => void recover()}>
        {busy ? (bn ? 'যাচাই করে কপি হচ্ছে…' : 'Copying and verifying…')
          : result ? (bn ? 'কপি সম্পন্ন' : 'Copy verified')
            : (bn ? 'আমার অ্যাকাউন্টে কপি করুন' : 'Copy to my account')}
      </UiButton>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {result && <p role="status" aria-live="polite" className="mt-3 text-sm text-taxpay-primary">
      {bn
        ? `${result.listsChecked}টি তালিকা ও ${result.beneficiariesChecked} জনের তথ্য অ্যাকাউন্টে যাচাই হয়েছে। নতুন: ${result.listsCreated}টি তালিকা, ${result.beneficiariesCreated} জন।`
        : `Verified ${result.listsChecked} lists and ${result.beneficiariesChecked} contacts in your account. Newly copied: ${result.listsCreated} lists and ${result.beneficiariesCreated} contacts.`}
    </p>}
  </section>;
}
