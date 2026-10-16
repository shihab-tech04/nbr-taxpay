import React, { useState } from 'react';
import { 
  Layers, 
  Search, 
  ShieldCheck, 
  ArrowRight, 
  Info, 
  HelpCircle,
  Network,
  Share2
} from 'lucide-react';
import { TAX_ONTOLOGY_NODES, OntologyNode } from '../../data/taxOntologyData';

export const OntologyView: React.FC = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('TAXPAYER');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const filteredNodes = TAX_ONTOLOGY_NODES.filter(node => {
    const matchCat = categoryFilter === 'ALL' || node.category === categoryFilter;
    const matchSearch = search
      ? node.nameEn.toLowerCase().includes(search.toLowerCase()) ||
        node.nameBn.includes(search) ||
        node.definition.toLowerCase().includes(search.toLowerCase())
      : true;
    return matchCat && matchSearch;
  });

  const activeNode = TAX_ONTOLOGY_NODES.find(n => n.id === selectedNodeId) || TAX_ONTOLOGY_NODES[0];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              Tax Concept Ontology & Domain Taxonomy
            </h1>
            <p className="text-xs text-slate-500">
              Structural entity and relationship model under the Income Tax Act 2023.
            </p>
          </div>
        </div>

        {/* Mandatory Legal Status Warning */}
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2 mb-6">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-amber-900">LEGAL STATUS & ARCHITECTURAL BOUNDARY:</strong>
            This conceptual ontology is a <strong>draft product model and data architecture design</strong> for system development, not approved statutory law or gazetted NBR rules. Statutory provisions must be validated against the official gazette of the Income Tax Act 2023.
          </div>
        </div>

        {/* Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-xs">
          <input
            type="text"
            placeholder="Search concepts or rules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300"
          />

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 font-medium"
          >
            <option value="ALL">All Categories</option>
            <option value="LEGAL_ENTITY">Legal Entities (Taxpayer, Payer, Agent)</option>
            <option value="OBLIGATION">Obligations & Assessment</option>
            <option value="FINANCIAL_EVENT">Financial Events (Transactions, Receipts)</option>
            <option value="RECONCILIATION_PRIMITIVE">Reconciliation Primitives (Credits, Ledgers)</option>
            <option value="GOVERNANCE">Governance & Approval Workflows</option>
          </select>
        </div>

        {/* Two-Column Explorer: Nodes Grid + Detail Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Node Selector */}
          <div className="space-y-2 text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider block text-[10px]">
              Tax Concepts ({filteredNodes.length})
            </span>
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {filteredNodes.map(node => (
                <button
                  key={node.id}
                  type="button"
                  aria-pressed={selectedNodeId === node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`block w-full text-left p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedNodeId === node.id
                      ? 'bg-emerald-950 text-white border-emerald-950 shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                >
                  <span className="block font-bold text-xs">{node.nameEn}</span>
                  <span className={`block text-[11px] font-bengali ${selectedNodeId === node.id ? 'text-amber-300' : 'text-slate-500'}`}>
                    {node.nameBn}
                  </span>
                  <span className="block text-[10px] mt-1 font-mono uppercase opacity-75">
                    {node.category.replace(/_/g, ' ')}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right Active Node Inspector */}
          <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-6 text-xs space-y-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div>
                  <h2 className="font-serif-fraunces font-bold text-xl text-slate-900">
                    {activeNode.nameEn}
                  </h2>
                  <div className="text-xs text-slate-500 font-bengali">{activeNode.nameBn}</div>
                </div>
                <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-mono">
                  {activeNode.category}
                </span>
              </div>
              {activeNode.statutoryReference && (
                <div className="text-[11px] font-semibold text-emerald-900 mt-2 font-mono">
                  Statutory Reference: {activeNode.statutoryReference}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <strong className="text-slate-800 block">Formal Definition:</strong>
              <p className="text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                {activeNode.definition}
              </p>
            </div>

            <div className="space-y-2">
              <strong className="text-slate-800 block">Domain Rules & Invariants:</strong>
              <ul className="space-y-1.5 list-disc list-inside text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
                {activeNode.rules.map((rule, idx) => (
                  <li key={idx} className="leading-relaxed">{rule}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <strong className="text-slate-800 block">Ontological Entity Relationships:</strong>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeNode.relationships.map((rel, idx) => (
                  <div key={idx} className="p-2.5 rounded bg-white border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-500 font-mono text-[10px]">-- {rel.relation} --➔</span>
                    <strong className="text-emerald-900 font-mono">{rel.target}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
