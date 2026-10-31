import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Send, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Phone, 
  User, 
  CreditCard,
  Building2,
  Info
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { IncidentReport } from '../../types/tax';
import { formatCurrency } from '../../services/numberFormat';

export const IncidentReporting: React.FC = () => {
  const { language, incidents, addIncidentReport } = useTaxState();

  const [reporterName, setReporterName] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  const [category, setCategory] = useState<IncidentReport['category']>('PAYMENT_DEBITED_NO_CHALLAN');
  const [transactionReference, setTransactionReference] = useState('');
  const [amount, setAmount] = useState<number>(5000);
  const [gateway, setGateway] = useState('bKash MFS');
  const [description, setDescription] = useState('');

  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reporterName.trim() || !reporterContact.trim() || !transactionReference.trim()) {
      setError('Please provide your name, phone number, and bank/gateway transaction reference.');
      return;
    }
    setError('');

    const ticketNo = addIncidentReport({
      reporterName,
      reporterContact,
      category,
      transactionReference,
      amount,
      gateway,
      description
    });

    setSubmittedTicket(ticketNo);
    // Reset form
    setReporterName('');
    setReporterContact('');
    setTransactionReference('');
    setDescription('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              Citizen Incident & Payment Discrepancy Reporting
            </h1>
            <p className="text-xs text-slate-500">
              Report funds deducted without an A-Challan, gateway timeouts, or typographical TIN attribution errors for priority revenue officer triage.
            </p>
          </div>
        </div>

        {submittedTicket && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-taxpay-dark space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Incident Ticket Logged: {submittedTicket}</span>
            </div>
            <p className="text-xs text-emerald-700">
              Your report has been queued for immediate investigation by the Treasury Gateway Reconciliation Cell. You will receive an SMS status notification once the clearing batch is checked.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Citizen / Payer Full Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Mohammad Kabir"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Contact Mobile Number *
              </label>
              <input
                type="text"
                placeholder="+880 1712-XXXXXX"
                value={reporterContact}
                onChange={(e) => setReporterContact(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-plex"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Discrepancy Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium"
              >
                <option value="PAYMENT_DEBITED_NO_CHALLAN">Bank/MFS Debited But No A-Challan Generated</option>
                <option value="WRONG_TIN_ATTRIBUTION">Payment Attributed to Typographical Wrong TIN</option>
                <option value="GATEWAY_TIMEOUT">Gateway Timeout / Network Error during Checkout</option>
                <option value="UNAUTHORIZED_SUBMISSION">Unauthorized Representative Payment Submission</option>
                <option value="OTHER">Other Technical or Settlement Issue</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Payment Channel / Gateway *
              </label>
              <select
                value={gateway}
                onChange={(e) => setGateway(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              >
                <option value="bKash MFS">bKash MFS Direct</option>
                <option value="Nagad Postal MFS">Nagad Postal Service</option>
                <option value="Rocket (DBBL)">Rocket (Dutch-Bangla Bank)</option>
                <option value="Sonali Bank e-Sheba">Sonali Bank e-Sheba / ACS</option>
                <option value="Visa / MasterCard">Credit/Debit Card Switch</option>
                <option value="BEFTN / RTGS">BEFTN Bank Transfer</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Gateway Txn ID or Bank Debit Reference *
              </label>
              <input
                type="text"
                placeholder="Transaction or bank reference"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-plex"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Debited Amount (৳) *
              </label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-plex font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 text-xs mb-1">
              Incident Description & Details
            </label>
            <textarea
              rows={3}
              placeholder="Describe the exact sequence of events, error messages, and browser behavior..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Send className="w-4 h-4" />
              <span>Submit Incident Report</span>
            </button>
          </div>
        </form>
      </div>

      {/* Existing Logged Incidents */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="font-serif-fraunces font-bold text-lg text-slate-900">
          Recent Incident Triage Log
        </h3>

        <div className="space-y-3">
          {incidents.map((inc) => (
            <div key={inc.id} className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono-plex font-bold text-slate-900">{inc.incidentNumber}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500">{inc.reportDate}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  inc.status === 'RECONCILED' ? 'bg-emerald-100 text-emerald-800' :
                  inc.status === 'INVESTIGATING' ? 'bg-amber-100 text-amber-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {inc.status}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <span className="text-slate-500 block">Reporter:</span>
                  <span className="font-medium text-slate-800">{inc.reporterName} ({inc.reporterContact})</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Txn Reference:</span>
                  <span className="font-mono-plex text-slate-800">{inc.transactionReference}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Gateway & Amount:</span>
                  <span className="font-medium text-slate-800">{inc.gateway} — {formatCurrency(inc.amount, language)}</span>
                </div>
              </div>

              <p className="text-slate-600 bg-white p-2 rounded border border-slate-200 text-[11px]">
                {inc.description}
              </p>

              {inc.officerFindings && (
                <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-[11px] text-taxpay-dark">
                  <strong>Officer Resolution Findings:</strong> {inc.officerFindings}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
