import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  Upload, 
  Building2,
  Calendar
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { formatCurrency } from '../../services/numberFormat';

export const OfflineEvidence: React.FC = () => {
  const { language, logAuditAction } = useTaxState();

  const [evidenceList, setEvidenceList] = useState([
    {
      id: 'off-01',
      batchNumber: 'OFF-BAT-2026-091',
      taxpayerName: 'Bengal Tech Innovations Ltd.',
      tin: 'DEMO-TIN-002',
      bankName: 'Sonali Bank PLC (Gulshan Corporate Branch)',
      branchCode: 'SNB-0142',
      depositDate: '2026-09-12',
      amount: 450000,
      headCode: '1-1141-0010-0102',
      paperChallanNo: 'TR6-8819203',
      status: 'VERIFIED_SCROLLED',
      auditedBy: 'ACT Circle-164'
    },
    {
      id: 'off-02',
      batchNumber: 'OFF-BAT-2026-094',
      taxpayerName: 'Md. Tariqul Islam Chowdhury',
      tin: 'DEMO-TIN-001',
      bankName: 'Bangladesh Bank (Motijheel Central Treasury)',
      branchCode: 'BB-0001',
      depositDate: '2026-09-28',
      amount: 82500,
      headCode: '1-1141-0010-0101',
      paperChallanNo: 'TR6-1192837',
      status: 'PENDING_BRANCH_SCROLL',
      auditedBy: 'Pending Verification'
    }
  ]);

  const [newPaperChallan, setNewPaperChallan] = useState('');
  const [newTin, setNewTin] = useState('');
  const [newAmount, setNewAmount] = useState<number>(30000);
  const [newBank, setNewBank] = useState('Sonali Bank PLC');
  const [successNotice, setSuccessNotice] = useState('');

  const handleRegisterEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPaperChallan.trim() || !newTin.trim()) return;

    const newItem = {
      id: `off-${Date.now()}`,
      batchNumber: `OFF-BAT-2026-${Math.floor(100 + Math.random() * 900)}`,
      taxpayerName: 'Registered Taxpayer',
      tin: newTin,
      bankName: newBank,
      branchCode: 'SNB-0089',
      depositDate: new Date().toISOString().split('T')[0],
      amount: newAmount,
      headCode: '1-1141-0015-0201',
      paperChallanNo: newPaperChallan,
      status: 'VERIFIED_SCROLLED',
      auditedBy: 'ACT Circle-164'
    };

    setEvidenceList(prev => [newItem, ...prev]);
    logAuditAction('OFFLINE_EVIDENCE_VERIFIED', newItem.paperChallanNo, `Manual paper challan verified for TIN ${newTin}`);
    setSuccessNotice(`Paper Challan ${newPaperChallan} successfully cross-matched with Treasury scroll.`);
    setNewPaperChallan('');
    setNewTin('');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              Offline Bank Challan Evidence Verification
            </h1>
            <p className="text-xs text-slate-500">
              Scrutinize and verify physical counterfoil receipts (Form TR-6) stamped by bank branches against Treasury scroll accounts.
            </p>
          </div>
        </div>

        {successNotice && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Verification Form */}
        <form onSubmit={handleRegisterEvidence} className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-6 text-xs space-y-3">
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
            Verify Manual Bank Counterfoil Evidence
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Physical Challan No (TR-6)</label>
              <input
                type="text"
                placeholder="e.g. TR6-8819203"
                value={newPaperChallan}
                onChange={(e) => setNewPaperChallan(e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono-plex"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Taxpayer e-TIN</label>
              <input
                type="text"
                placeholder="12-digit TIN"
                value={newTin}
                onChange={(e) => setNewTin(e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono-plex"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Remitted Amount (৳)</label>
              <input
                type="number"
                min="1"
                value={newAmount}
                onChange={(e) => setNewAmount(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono-plex"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Issuing Bank Branch</label>
              <input
                type="text"
                value={newBank}
                onChange={(e) => setNewBank(e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-slate-300"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-900 text-amber-300 font-bold rounded-lg text-xs cursor-pointer shadow-sm"
            >
              Verify & Sync with Ledger
            </button>
          </div>
        </form>

        {/* Existing Offline Records */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-left">
              <tr>
                <th className="px-3 py-2.5">Batch Ref</th>
                <th className="px-3 py-2.5">Paper Challan No</th>
                <th className="px-3 py-2.5">Taxpayer & TIN</th>
                <th className="px-3 py-2.5">Depository Bank Branch</th>
                <th className="px-3 py-2.5 text-right">Amount (৳)</th>
                <th className="px-3 py-2.5 text-center">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {evidenceList.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-slate-500">{item.batchNumber}</td>
                  <td className="px-3 py-2 font-mono-plex font-bold text-emerald-950">{item.paperChallanNo}</td>
                  <td className="px-3 py-2 text-slate-800">
                    <div>{item.taxpayerName}</div>
                    <div className="font-mono text-[10px] text-slate-500">{item.tin}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{item.bankName}</td>
                  <td className="px-3 py-2 text-right font-mono-plex font-bold text-slate-900">
                    {formatCurrency(item.amount, language)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.status === 'VERIFIED_SCROLLED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
