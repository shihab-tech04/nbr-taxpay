import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AlertTriangle, BookOpen, Search } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { getVerifiedHeadReferences, isV11HeadReviewBlocked, V11_HEAD_GROUPS, V11_HEAD_SOURCE, V11_SOURCE_HEADS, type V11Head } from '../../data/v11SourceHeads';
import { verifyPublishedCandidateCatalogue } from '../../services/sourceCandidateRepository';

const PER_PAGE = 20;
const labels = {
  en: {
    title: 'Original v11 payment-head reference', source: 'Controlled source snapshot — not legally verified',
    intro: 'These 170 records are preserved exactly from the v11 prototype, not from an official ACS workbook. Section references here are source labels, NOT Treasury economic account codes.',
    back: 'Back to public portal', search: 'Search by head ID, English/Bangla name or original section reference',
    searchPlaceholder: 'Example: 16A, Surcharge, সারচার্জ', group: 'Original source group',
    all: 'All groups', matching: 'Matching source records', noMatch: 'No source records match this search. Nothing has been automatically selected.',
    legal: 'Legal validity and current applicability: UNVERIFIED', noCode: 'ACS Treasury economic code: NOT VERIFIED',
    applicability: 'No verified taxpayer-class, payment-event, effective-date or income/assessment-year rule is available. No head may be offered as payable.',
    note: 'Original source note', enName: 'English source label', bnName: 'Bangla source label',
    missingBn: 'No Bangla label in the original source', originalCode: 'Original v11 code (not a certified 1984 statute section)',
    oldLaw: 'Verified Income Tax Ordinance 1984 section', newLaw: 'Verified Income Tax Act 2023 section', noOldLaw: 'No official mapping verified', noNewLaw: 'No official mapping verified',
    review: 'OWNER REVIEW REQUIRED — not selectable', notCleared: 'Reference only — not cleared for payment',
    previous: 'Previous page', next: 'Next page', page: 'Page', of: 'of',
    checking: 'Checking protected source provenance against Supabase…',
    matched: 'Database reference matches all 170 controlled v11 source records. Legal validity remains UNVERIFIED.',
    offline: 'Supabase reference could not be verified. Showing read-only embedded v11 snapshot; payment execution stays disabled.',
  },
  bn: {
    title: 'মূল v11 কর পরিশোধের খাতের তালিকা', source: 'সংরক্ষিত মূল তালিকা — আইনগত যাচাই হয়নি',
    intro: 'এই ১৭০টি তথ্য v11 নমুনা থেকে অপরিবর্তিত রাখা হয়েছে; সরকারি ACS মূল তালিকা থেকে যাচাই করা হয়নি। এখানে প্রদর্শিত ধারা/কোড সরকারি ট্রেজারি অর্থনৈতিক কোড নয়।',
    back: 'পাবলিক পোর্টালে ফিরুন', search: 'আইডি, বাংলা/ইংরেজি নাম অথবা মূল ধারা/কোড দিয়ে খুঁজুন',
    searchPlaceholder: 'যেমন: 16A, Surcharge, সারচার্জ', group: 'মূল উৎসের বিভাগ',
    all: 'সব বিভাগ', matching: 'অনুসন্ধানে পাওয়া খাত', noMatch: 'কোনো খাত পাওয়া যায়নি; বিকল্প কোনো খাত স্বয়ংক্রিয়ভাবে নির্বাচন করা হয়নি।',
    legal: 'বর্তমান আইনি বৈধতা: যাচাই হয়নি', noCode: 'ACS ট্রেজারি অর্থনৈতিক কোড: যাচাই হয়নি',
    applicability: 'করদাতার ধরন, পরিশোধের ঘটনা, কার্যকারিতার তারিখ এবং আয়বর্ষ/করবর্ষ অনুযায়ী অনুমোদিত নিয়ম পাওয়া যায়নি। কোনো খাত পরিশোধযোগ্য নয়।',
    note: 'মূল উৎসের মন্তব্য', enName: 'মূল ইংরেজি নাম', bnName: 'মূল বাংলা নাম',
    missingBn: 'মূল উৎসে বাংলা নাম নেই', originalCode: 'মূল v11 কোড (১৯৮৪ অধ্যাদেশের যাচাইকৃত ধারা নয়)',
    oldLaw: 'আয়কর অধ্যাদেশ ১৯৮৪-এর যাচাইকৃত ধারা', newLaw: 'আয়কর আইন ২০২৩-এর যাচাইকৃত ধারা', noOldLaw: 'সরকারি মিল যাচাই হয়নি', noNewLaw: 'সরকারি মিল যাচাই হয়নি',
    review: 'মালিকের পর্যালোচনা প্রয়োজন — নির্বাচন নিষিদ্ধ', notCleared: 'শুধু তথ্য দেখার জন্য — পরিশোধের অনুমোদন নয়',
    previous: 'আগের পৃষ্ঠা', next: 'পরের পৃষ্ঠা', page: 'পৃষ্ঠা', of: 'এর মধ্যে',
    checking: 'Supabase-এর সাথে মূল উৎসের তথ্য যাচাই করা হচ্ছে…',
    matched: 'ডাটাবেসে সংরক্ষিত ১৭০টি উৎসের রেকর্ড মূল কপির সাথে মিলেছে। আইনগত বৈধতা এখনো যাচাই হয়নি।',
    offline: 'Supabase উৎস যাচাই সম্ভব হয়নি। শুধু সংরক্ষিত v11 নমুনা দেখানো হচ্ছে; প্রকৃত পরিশোধ বন্ধ।',
  }
} as const;

export const HeadCatalogue: React.FC = () => {
  const { navigate, language } = useTaxState();
  const t = labels[language];
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('ALL');
  const [page, setPage] = useState(1);
  const [sourceHeads, setSourceHeads] = useState<readonly V11Head[]>(V11_SOURCE_HEADS);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'matched' | 'offline'>('checking');

  useEffect(() => {
    let active = true;
    verifyPublishedCandidateCatalogue().then(records => {
      if (active) { setSourceHeads(records); setBackendStatus('matched'); }
    }).catch(() => {
      // Source-only display is permitted offline because the catalogue is read-only.
      // Never silently upgrade a source record into a legal or executable master.
      if (active) setBackendStatus('offline');
    });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return sourceHeads.filter(head => (group === 'ALL' || head.grpEn === group) &&
      (!needle || [String(head.id), head.code, head.codeEn, head.en, head.bn || '', head.grpBn]
        .some(text => text.toLocaleLowerCase().includes(needle))));
  }, [query, group, sourceHeads]);
  const pages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
  const safePage = Math.min(page, pages);
  const displayed = visible.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  return (
    <section aria-labelledby="source-heads-title" className="space-y-5 pb-12">
      <button type="button" onClick={() => navigate('landing')}
        className="min-h-11 inline-flex items-center gap-2 rounded-md px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500">
        <ArrowLeft aria-hidden="true" className="w-4 h-4" />{t.back}
      </button>

      <header className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-3">
        <div className="flex items-start gap-3">
          <BookOpen aria-hidden="true" className="w-7 h-7 shrink-0 text-emerald-900" />
          <div className="space-y-2 min-w-0">
            <h1 id="source-heads-title" className="font-serif-fraunces text-2xl sm:text-3xl font-bold text-emerald-950">{t.title}</h1>
            <p className="text-xs font-bold text-amber-800">{t.source}</p>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-700">{t.intro}</p>
        <p role="status" aria-live="polite" data-testid="catalogue-source-status"
          className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-800">
          {t[backendStatus]}
        </p>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-start gap-2" role="note">
          <AlertTriangle aria-hidden="true" className="w-5 h-5 shrink-0 text-amber-800" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-amber-900">{t.legal}</p>
            <p className="text-xs text-amber-900">{t.noCode}</p>
            <p className="text-xs text-amber-900">{t.applicability}</p>
            <p className="text-xs text-amber-900">Source SHA-256: <code className="break-all">{V11_HEAD_SOURCE.sourceSha256}</code></p>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="v11-head-query" className="block text-sm font-semibold text-slate-800">{t.search}</label>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-3.5 w-4 h-4 text-slate-500"/>
              <input id="v11-head-query" type="search" value={query}
                onChange={e => {setQuery(e.target.value);setPage(1);}}
                placeholder={t.searchPlaceholder}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"/>
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="v11-head-group" className="block text-sm font-semibold text-slate-800">{t.group}</label>
            <select id="v11-head-group" value={group} onChange={e => {setGroup(e.target.value);setPage(1);}}
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
              <option value="ALL">{t.all}</option>
              {V11_HEAD_GROUPS.map(name=><option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </div>
        <p role="status" aria-live="polite" className="text-sm font-semibold text-emerald-950">
          {t.matching}: {visible.length} / {V11_HEAD_SOURCE.records}
        </p>
      </section>

      {displayed.length === 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">{t.noMatch}</h2>
        </section>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {displayed.map(head => {
            const blocked = isV11HeadReviewBlocked(head);
            const refs = getVerifiedHeadReferences(head);
            return (
              <article key={head.id} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-600">ID {head.id} · {head.grpEn}</p>
                    <h2 className="font-serif-fraunces text-lg font-bold text-emerald-950 break-words">{head.en}</h2>
                  </div>
                  <p className={blocked ? 'max-w-full rounded-md border border-amber-400 bg-amber-50 px-2 py-1.5 text-xs font-bold text-amber-900' : 'text-xs font-medium text-slate-500'}>
                    {blocked ? t.review : t.notCleared}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-600">{t.originalCode}</h3>
                    <p className="font-mono-plex font-semibold text-slate-900 break-words">{refs.originalSourceReference} / {head.code}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-600">{t.bnName}</h3>
                    <p lang="bn" className="font-bengali text-slate-900 leading-6 break-words">{head.bn || t.missingBn}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-600">{t.oldLaw}</h3>
                    <p className="text-xs text-slate-700">{refs.verifiedOrdinance1984Section ?? t.noOldLaw}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-600">{t.newLaw}</h3>
                    <p className="text-xs text-slate-700">{refs.verifiedAct2023Section ?? t.noNewLaw}</p>
                  </div>
                </div>
                {head.note && (
                  <div className="border-t border-slate-100 pt-2">
                    <h3 className="text-xs font-semibold text-slate-600">{t.note}</h3>
                    <p className="text-xs text-slate-700 leading-5">{head.note}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <nav aria-label="Catalogue pagination" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <button type="button" disabled={safePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}
          className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-emerald-900 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500">{t.previous}</button>
        <p className="text-sm font-medium text-slate-700" aria-live="polite">{t.page} {safePage} {t.of} {pages}</p>
        <button type="button" disabled={safePage>=pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}
          className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-emerald-900 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500">{t.next}</button>
      </nav>
    </section>
  );
};
