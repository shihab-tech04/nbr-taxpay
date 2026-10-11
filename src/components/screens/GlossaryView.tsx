import React, { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  Filter, 
  FileText, 
  Building2, 
  CheckCircle2 
} from 'lucide-react';
import { GLOSSARY_TERMS, GlossaryTerm } from '../../data/glossaryData';
import { useTaxState } from '../../services/taxState';

export const GlossaryView: React.FC = () => {
  const { language } = useTaxState();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');

  const filtered = GLOSSARY_TERMS.filter(term => {
    const matchCat = catFilter === 'ALL' || term.category === catFilter;
    const matchSearch = search
      ? term.termEn.toLowerCase().includes(search.toLowerCase()) ||
        term.termBn.includes(search) ||
        (term.acronym && term.acronym.toLowerCase().includes(search.toLowerCase())) ||
        term.definitionEn.toLowerCase().includes(search.toLowerCase())
      : true;
    return matchCat && matchSearch;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              Statutory Tax & Financial Glossary
            </h1>
            <p className="text-xs text-slate-500">
              Official terminology and definitions under the Income Tax Act 2023 and Bangladesh Treasury Rules.
            </p>
          </div>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-xs">
          <input
            type="text"
            placeholder="Search glossary terms or acronyms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300"
          />

          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 font-medium"
          >
            <option value="ALL">All Categories</option>
            <option value="STATUTORY">Statutory Legal Terms</option>
            <option value="PROCEDURAL">Procedural Tax Administration</option>
            <option value="BANKING">Banking & Treasury Clearing</option>
            <option value="TAX_HEAD">Tax Head Categories</option>
          </select>
        </div>

        {/* Terms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {filtered.map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-serif-fraunces font-bold text-base text-slate-900">
                    {item.termEn}
                  </h3>
                  {item.acronym && (
                    <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                      {item.acronym}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-semibold">
                  {item.category}
                </span>
              </div>

              <div className="text-[12px] text-emerald-900 font-bengali font-semibold">
                {item.termBn}
              </div>

              <p className="text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
                {language === 'bn' ? item.definitionBn : item.definitionEn}
              </p>

              {item.actReference && (
                <div className="text-[10px] text-slate-400 font-mono">
                  Reference: {item.actReference}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
