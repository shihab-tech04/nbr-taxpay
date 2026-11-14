import React, { useRef, useState } from 'react';
import { BookOpen, Search, X } from 'lucide-react';
import { GLOSSARY_TERMS } from '../../data/glossaryData';
import { useTaxState } from '../../services/taxState';
import '../../styles/public-guide-p3.css';

const COPY = {
  en: {
    title: 'Payment terms',
    description: 'Plain-language meanings for terms used in this service. Check NBR publications for current legal requirements.',
    search: 'Search terms',
    searchPlaceholder: 'Search in English or Bangla',
    category: 'Topic',
    all: 'All topics',
    noResults: 'No terms match this search. Try another word or clear the search.',
    categories: {
      IDENTITY: 'Taxpayer identity',
      TAX: 'Tax terms',
      PAYMENT: 'Payment services',
      RECORD: 'Records and status',
      PROCESS: 'Other processes'
    }
  },
  bn: {
    title: 'কর ও পেমেন্টের শব্দ',
    description: 'এই সেবায় ব্যবহৃত শব্দের সহজ অর্থ। বর্তমান আইনি শর্ত এনবিআরের প্রকাশনায় যাচাই করুন।',
    search: 'শব্দ খুঁজুন',
    searchPlaceholder: 'বাংলা বা ইংরেজিতে খুঁজুন',
    category: 'বিষয়',
    all: 'সব বিষয়',
    noResults: 'এই অনুসন্ধানে কোনো শব্দ মেলেনি। অন্য শব্দ লিখুন বা অনুসন্ধান মুছুন।',
    categories: {
      IDENTITY: 'করদাতার পরিচয়',
      TAX: 'কর বিষয়ক শব্দ',
      PAYMENT: 'পেমেন্ট সেবা',
      RECORD: 'রেকর্ড ও অবস্থা',
      PROCESS: 'অন্যান্য প্রক্রিয়া'
    }
  }
} as const;

type Category = keyof typeof COPY.en.categories;
const CATEGORIES = Object.keys(COPY.en.categories) as Category[];

export const GlossaryView: React.FC = () => {
  const { language } = useTaxState();
  const bn = language === 'bn';
  const copy = COPY[bn ? 'bn' : 'en'];
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const [catFilter, setCatFilter] = useState<'ALL' | Category>('ALL');
  const resetFilters = () => {
    setSearch('');
    setCatFilter('ALL');
    searchRef.current?.focus();
  };
  const query = search.trim().toLocaleLowerCase();

  const filtered = GLOSSARY_TERMS.filter(term => {
    const matchCategory = catFilter === 'ALL' || term.category === catFilter;
    const matchSearch = !query || [
      term.termEn, term.termBn, term.acronym || '', term.definitionEn, term.definitionBn
    ].some(value => value.toLocaleLowerCase().includes(query));
    return matchCategory && matchSearch;
  });

  return (
    <main className="public-glossary" aria-labelledby="public-glossary-title">
      <section className="public-glossary-card">
        <header className="public-glossary-header">
          <span className="public-glossary-icon" aria-hidden="true"><BookOpen size={22}/></span>
          <div>
            <h1 id="public-glossary-title">{copy.title}</h1>
            <p>{copy.description}</p>
          </div>
        </header>

        <div className="public-glossary-filters">
          <div className="public-glossary-field">
            <label htmlFor="public-glossary-search">{copy.search}</label>
            <div className="public-glossary-search">
              <Search size={18} aria-hidden="true"/>
              <input
                ref={searchRef}
                id="public-glossary-search"
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={copy.searchPlaceholder}
                autoComplete="off"
              />
              {search && <button type="button" aria-label={bn?'অনুসন্ধান মুছুন':'Clear search'}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-taxpay-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary"
                onClick={() => { setSearch(''); searchRef.current?.focus(); }}>
                <X size={18} aria-hidden="true"/>
              </button>}
            </div>
          </div>
          <div className="public-glossary-field">
            <label htmlFor="public-glossary-topic">{copy.category}</label>
            <select id="public-glossary-topic" value={catFilter} onChange={event => setCatFilter(event.target.value as 'ALL' | Category)}>
              <option value="ALL">{copy.all}</option>
              {CATEGORIES.map(category => <option key={category} value={category}>{copy.categories[category]}</option>)}
            </select>
          </div>
        </div>

        {(query || catFilter !== 'ALL') && filtered.length > 0 &&
          <p role="status" className="mb-3 text-sm text-taxpay-muted">
            {bn?`${new Intl.NumberFormat('bn-BD').format(filtered.length)}টি শব্দ পাওয়া গেছে`:
              `${filtered.length} ${filtered.length===1?'term':'terms'} found`}
          </p>}
        {filtered.length ? <div className="public-glossary-terms" aria-live="polite">
          {filtered.map(term => <article className="public-glossary-term" key={term.termEn}>
            <div className="public-glossary-term-head">
              <div className="public-glossary-term-name">
                <h2>{term.termEn}</h2>
                {term.acronym && <span>{term.acronym}</span>}
              </div>
              <span className="public-glossary-category">{copy.categories[term.category]}</span>
            </div>
            <p className="public-glossary-term-bn">{term.termBn}</p>
            <p className="public-glossary-definition">{bn ? term.definitionBn : term.definitionEn}</p>
          </article>)}
        </div> : <div className="public-glossary-empty" role="status">
          <p>{copy.noResults}</p>
          <button type="button" onClick={resetFilters}
            className="mt-3 min-h-11 rounded-lg border border-taxpay-border bg-white px-4 text-sm font-semibold text-taxpay-primary hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary">
            {bn?'সব ফিল্টার মুছুন':'Clear filters'}
          </button>
        </div>}
      </section>
    </main>
  );
};
