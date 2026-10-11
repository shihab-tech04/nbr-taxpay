import React from 'react';
import { 
  Layers, 
  Database, 
  ShieldCheck, 
  Landmark, 
  Cpu, 
  ArrowRight, 
  ExternalLink, 
  Lock, 
  Server,
  Network
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';

export const ArchitectureView: React.FC = () => {
  const { navigate } = useTaxState();

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Title */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              NBR TaxPay System Architecture & Integration Topology
            </h1>
            <p className="text-xs text-slate-500">
              Technical boundaries, integration contracts, security controls, and separation of financial vs tax credit state.
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          The NBR TaxPay platform operates as a secure intermediary payment gateway orchestrator between citizens/deducting entities and the central Bangladesh Treasury (A-Challan). It enforces strict architectural separation between <strong>financial transaction settlement</strong> (cash clearing) and <strong>statutory tax credit entitlement</strong> (ledger posting).
        </p>
      </div>

      {/* Visual Architectural Topology Diagram */}
      <div className="bg-slate-950 text-white rounded-xl p-6 shadow-lg border border-slate-800 space-y-6">
        <h3 className="font-mono text-xs uppercase tracking-wider text-amber-400 font-bold flex items-center gap-2">
          <Network className="w-4 h-4 text-amber-400" />
          <span>Layered System Architecture & External Boundaries</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          {/* Layer 1: Client Ingress */}
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3">
            <div className="text-amber-300 font-bold border-b border-slate-800 pb-1 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-amber-400" />
              <span>1. Client Ingress Layer</span>
            </div>
            <ul className="space-y-2 text-slate-300 text-[11px]">
              <li className="p-2 rounded bg-slate-800/80">
                <strong className="text-white block">Public Guest Checkout</strong>
                No auth required; validates 12-digit e-TIN and economic head codes.
              </li>
              <li className="p-2 rounded bg-slate-800/80">
                <strong className="text-white block">Taxpayer Portal Session</strong>
                RBAC authenticated profile (Individual / Corporate).
              </li>
              <li className="p-2 rounded bg-slate-800/80">
                <strong className="text-white block">Revenue Officer Workspace</strong>
                Maker-Reviewer-Approver role segregation.
              </li>
            </ul>
          </div>

          {/* Layer 2: Core Domain Engine */}
          <div className="bg-emerald-950 border border-emerald-800 rounded-lg p-4 space-y-3">
            <div className="text-emerald-300 font-bold border-b border-emerald-900 pb-1 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>2. Core Domain Engine</span>
            </div>
            <ul className="space-y-2 text-emerald-100 text-[11px]">
              <li className="p-2 rounded bg-emerald-900/60">
                <strong className="text-white block">170 Payment-Head Engine</strong>
                Validates ITA 2023 vs ITO 1984 sections; locks blocked heads (#5, #150).
              </li>
              <li className="p-2 rounded bg-emerald-900/60">
                <strong className="text-white block">Financial Segregation Machine</strong>
                Separates Payer, Taxpayer, Withholding Agent, Deductee, and Tax Credit.
              </li>
              <li className="p-2 rounded bg-emerald-900/60">
                <strong className="text-white block">Immutable Audit Logger</strong>
                HMAC/SHA256 signature chain for all administrative corrections.
              </li>
            </ul>
          </div>

          {/* Layer 3: Government Adapters */}
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3">
            <div className="text-teal-300 font-bold border-b border-slate-800 pb-1 flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-teal-400" />
              <span>3. Statutory External Adapters</span>
            </div>
            <ul className="space-y-2 text-slate-300 text-[11px]">
              <li className="p-2 rounded bg-slate-800/80">
                <strong className="text-white block">A-Challan / Sonali Bank API</strong>
                Posts to Treasury Account 1-1141-XXXX-XXXX & scrolls challan token.
              </li>
              <li className="p-2 rounded bg-slate-800/80">
                <strong className="text-white block">e-TIN / e-Return / e-Ledger</strong>
                Validates registration jurisdiction & synchronizes tax return credit.
              </li>
              <li className="p-2 rounded bg-slate-800/80">
                <strong className="text-white block">Payment Switchways</strong>
                bKash, Nagad, Rocket, Q-Cash, Visa, MasterCard, BEFTN.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 5 Core Domain Invariants */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="font-serif-fraunces font-bold text-lg text-slate-900">
          Statutory Invariants & Non-Negotiable Financial Controls
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="font-bold text-slate-900 block flex items-center gap-1.5 text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Invariant 1: Payment Initiation ≠ Treasury Deposit
            </span>
            <p className="text-slate-600 leading-relaxed">
              A successful payment initiation or wallet debit does not constitute government deposit until confirmed by Sonali Bank / Bangladesh Bank scroll settlement.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="font-bold text-slate-900 block flex items-center gap-1.5 text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Invariant 2: Treasury Receipt ≠ Automatic Tax Credit
            </span>
            <p className="text-slate-600 leading-relaxed">
              A valid A-Challan proves that money arrived in the Government Treasury, but tax credit eligibility is recognized only when the TIN is verified and reconciled in the tax ledger.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="font-bold text-slate-900 block flex items-center gap-1.5 text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Invariant 3: Withholding Separation Rule
            </span>
            <p className="text-slate-600 leading-relaxed">
              A withholding agent\'s tax deposit (TDS) under Chapter VII can never become the agent\'s personal or corporate tax credit. The credit vests solely in the deductee beneficiary.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="font-bold text-slate-900 block flex items-center gap-1.5 text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Invariant 4: Three-Tier Maker-Reviewer-Approver
            </span>
            <p className="text-slate-600 leading-relaxed">
              No revenue officer can unilaterally re-attribute, cancel, or refund a Treasury challan. Ledger adjustments require formal tripartite segregation of duties.
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={() => navigate('ontology')}
            className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
          >
            <span>Explore Conceptual Tax Ontology</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
