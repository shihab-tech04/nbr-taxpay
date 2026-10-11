import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle, 
  Lock, 
  Search, 
  Building2, 
  Info,
  Calendar,
  Layers
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { MASTER_PAYMENT_HEADS, BLOCKED_HEAD_IDS, CATEGORY_LABELS } from '../../data/paymentHeads';
import { ASSESSMENT_YEARS } from '../../data/mockData';
import { PaymentCategory, MasterPaymentHead, ChallanReceipt, PaymentLineItem } from '../../types/tax';
import { formatCurrency } from '../../services/numberFormat';
import { ReceiptView } from '../common/ReceiptView';

export const PaymentWizard: React.FC = () => {
  const { taxpayerProfile, addPaymentReceipt, routeParams, language, navigate } = useTaxState();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Initial category from params if any
  const [category, setCategory] = useState<PaymentCategory>(
    (routeParams?.initialCategory as PaymentCategory) || 'TAX_WITH_RETURN'
  );

  const [assessmentYear, setAssessmentYear] = useState('2025-2026');
  const [selectedHeadId, setSelectedHeadId] = useState<number>(1);
  const [headSearch, setHeadSearch] = useState('');

  // Breakdown
  const [taxAmount, setTaxAmount] = useState<number>(25000);
  const [penaltyAmount, setPenaltyAmount] = useState<number>(0);
  const [surchargeAmount, setSurchargeAmount] = useState<number>(0);
  const [interestAmount, setInterestAmount] = useState<number>(0);
  const [note, setNote] = useState('');

  // Gateway
  const [paymentMethod, setPaymentMethod] = useState<'BKASH' | 'NAGAD' | 'ROCKET' | 'SONALI_E_SHEBA' | 'A_CHALLAN_CARD' | 'BEFTN_RTGS'>('BKASH');
  const [isProcessing, setIsProcessing] = useState(false);
  const [createdReceipt, setCreatedReceipt] = useState<ChallanReceipt | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (routeParams?.initialCategory) {
      setCategory(routeParams.initialCategory as PaymentCategory);
      const first = MASTER_PAYMENT_HEADS.find(h => h.category === routeParams.initialCategory);
      if (first) setSelectedHeadId(first.id);
    }
  }, [routeParams]);

  const availableHeads = MASTER_PAYMENT_HEADS.filter(head => {
    const matchCat = head.category === category;
    const matchQuery = headSearch
      ? head.nameEn.toLowerCase().includes(headSearch.toLowerCase()) ||
        head.economicCode.includes(headSearch) ||
        head.sectionAct2023.toLowerCase().includes(headSearch.toLowerCase())
      : true;
    return matchCat && matchQuery;
  });

  const selectedHead = MASTER_PAYMENT_HEADS.find(h => h.id === selectedHeadId) || availableHeads[0];

  const totalAmount = Number(taxAmount || 0) + Number(penaltyAmount || 0) + Number(surchargeAmount || 0) + Number(interestAmount || 0);

  const handleStep1Next = () => {
    if (!selectedHead) {
      setErrorMessage('Please select an active payment head.');
      return;
    }
    if (BLOCKED_HEAD_IDS.includes(selectedHead.id)) {
      setErrorMessage(`Head #${selectedHead.id} is explicitly BLOCKED for owner review.`);
      return;
    }
    setErrorMessage('');
    setStep(2);
  };

  const handleStep2Next = () => {
    if (totalAmount <= 0) {
      setErrorMessage('Total payable amount must be greater than zero.');
      return;
    }
    setErrorMessage('');
    setStep(3);
  };

  const handleExecutePayment = () => {
    setIsProcessing(true);
    setErrorMessage('');

    setTimeout(() => {
      const year = new Date().getFullYear();
      const randChallan = Math.floor(10000000 + Math.random() * 90000000);
      const randToken = Math.floor(100000 + Math.random() * 900000);
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const lineItem: PaymentLineItem = {
        headId: selectedHead.id,
        economicCode: selectedHead.economicCode,
        headNameEn: selectedHead.nameEn,
        taxAmount: Number(taxAmount),
        penaltyAmount: Number(penaltyAmount),
        surchargeAmount: Number(surchargeAmount),
        interestAmount: Number(interestAmount),
        totalAmount,
        note: note || undefined
      };

      const newReceipt: ChallanReceipt = {
        id: `rcpt-wiz-${Date.now()}`,
        challanNo: `AC-${year}-${randChallan}`,
        tokenNumber: `TKN-${randToken}`,
        paymentCategory: category,
        assessmentYear,
        payerName: taxpayerProfile.nameEn,
        payerTin: taxpayerProfile.tin,
        isRepresentativePayment: false,
        taxZone: taxpayerProfile.taxZone,
        taxCircle: taxpayerProfile.taxCircle,
        isWithholding: category === 'SOURCE_TAX_DEPOSIT',
        items: [lineItem],
        totalAmount,
        paymentMethod,
        gatewayTransactionId: `${paymentMethod.substring(0, 4)}-TXN-${Math.floor(10000000 + Math.random() * 90000000)}`,
        treasuryScrollNo: `BB-SCRL-${year}-${Math.floor(10000 + Math.random() * 90000)}`,
        treasuryDate: now,
        treasuryStatus: 'TREASURY_SCROLLED',
        taxCreditStatus: category === 'SOURCE_TAX_DEPOSIT' ? 'NOT_APPLICABLE' : 'PENDING_RECONCILIATION',
        createdAt: now,
        completedAt: now,
        isSimulatedDemo: true
      };

      addPaymentReceipt(newReceipt);
      setCreatedReceipt(newReceipt);
      setIsProcessing(false);
      setStep(4);
    }, 1200);
  };

  if (step === 4 && createdReceipt) {
    return (
      <div className="space-y-6">
        <div className="p-4 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <span className="font-bold">Demonstration payment flow completed.</span>
              <p className="text-xs text-emerald-800">
                Simulated receipt reference: <strong className="font-mono">{createdReceipt.challanNo}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setStep(1);
              setCreatedReceipt(null);
            }}
            className="px-3 py-1.5 rounded bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 cursor-pointer"
          >
            New Payment
          </button>
        </div>
        <ReceiptView receipt={createdReceipt} onBack={() => navigate('taxpayer_home')} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Taxpayer Electronic Payment Gateway
            </span>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              Income Tax Payment Wizard
            </h1>
            <p className="text-xs text-slate-500">
              Taxpayer: <strong className="text-slate-800">{taxpayerProfile.nameEn}</strong> (TIN: {taxpayerProfile.tin})
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Step {step} of 3
          </span>
        </div>

        {/* Stepper Header */}
        <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-center mb-6">
          <div className={`p-2 rounded border ${step >= 1 ? 'bg-emerald-900 text-amber-300 border-emerald-900' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            1. Category & Head Code
          </div>
          <div className={`p-2 rounded border ${step >= 2 ? 'bg-emerald-900 text-amber-300 border-emerald-900' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            2. Financial Breakdown
          </div>
          <div className={`p-2 rounded border ${step >= 3 ? 'bg-emerald-900 text-amber-300 border-emerald-900' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            3. Review & Gateway
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assessment Year *
                </label>
                <select
                  value={assessmentYear}
                  onChange={(e) => setAssessmentYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium"
                >
                  {ASSESSMENT_YEARS.map(ay => (
                    <option key={ay} value={ay}>{ay}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Category (7 Statutory Types) *
                </label>
                <select
                  value={category}
                  onChange={(e) => {
                    const newCat = e.target.value as PaymentCategory;
                    setCategory(newCat);
                    const first = MASTER_PAYMENT_HEADS.find(h => h.category === newCat);
                    if (first) setSelectedHeadId(first.id);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label.en}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Master Heads List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Select Economic Accounting Head ({availableHeads.length} available)
                </label>
                <input
                  type="text"
                  placeholder="Filter by code or title..."
                  value={headSearch}
                  onChange={(e) => setHeadSearch(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded border border-slate-300 w-48"
                />
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50/50">
                {availableHeads.map(head => {
                  const isBlocked = BLOCKED_HEAD_IDS.includes(head.id);
                  const isSelected = selectedHead?.id === head.id;
                  return (
                    <div
                      key={head.id}
                      onClick={() => !isBlocked && setSelectedHeadId(head.id)}
                      className={`p-3 text-xs flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-emerald-100/70 border-l-4 border-emerald-900'
                          : isBlocked
                          ? 'bg-rose-50/60 opacity-70 cursor-not-allowed'
                          : 'hover:bg-white'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-plex font-bold text-emerald-950">
                            {head.economicCode}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {head.nameEn}
                          </span>
                          {isBlocked && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                              <Lock className="w-3 h-3" />
                              BLOCKED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-bengali">
                          {head.nameBn}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-600">
                          <span>Act: <strong>{head.sectionAct2023}</strong></span>
                          <span>Legacy: {head.sectionOrdinance1984}</span>
                          <span className="text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            {head.verificationStatus}
                          </span>
                        </div>
                        {head.rateNote && (
                          <div className="text-[11px] text-emerald-800 font-medium">
                            Note: {head.rateNote}
                          </div>
                        )}
                      </div>
                      <input
                        type="radio"
                        checked={isSelected}
                        disabled={isBlocked}
                        onChange={() => !isBlocked && setSelectedHeadId(head.id)}
                        className="mt-1"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={handleStep1Next}
                className="px-5 py-2.5 bg-emerald-900 hover:bg-emerald-950 text-amber-300 font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <span>Continue to Financial Amounts</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
              <span className="text-slate-500 block">Selected Head:</span>
              <div className="font-mono-plex font-bold text-sm text-emerald-950 mt-0.5">
                {selectedHead?.economicCode} — {selectedHead?.nameEn}
              </div>
              <div className="text-[11px] text-emerald-800 mt-1">
                Act Reference: {selectedHead?.sectionAct2023} | Assessment Year: {assessmentYear}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-900">
                Payment Component Breakdown
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Tax Amount (৳) *</label>
                  <input
                    type="number"
                    min="0"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono-plex font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Penalty (৳)</label>
                  <input
                    type="number"
                    min="0"
                    value={penaltyAmount}
                    onChange={(e) => setPenaltyAmount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono-plex"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Surcharge (৳)</label>
                  <input
                    type="number"
                    min="0"
                    value={surchargeAmount}
                    onChange={(e) => setSurchargeAmount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono-plex"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Simple Interest (৳)</label>
                  <input
                    type="number"
                    min="0"
                    value={interestAmount}
                    onChange={(e) => setInterestAmount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono-plex"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 text-xs font-medium mb-1">
                  Payment Reference / Assessment Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Self-assessment return deposit AY 2025-2026"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800">
                  Total Payable Amount:
                </span>
                <span className="font-mono-plex font-bold text-xl text-emerald-900">
                  {formatCurrency(totalAmount, language)}
                </span>
              </div>
            </div>

            <div className="flex justify-between pt-3">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                onClick={handleStep2Next}
                className="px-5 py-2.5 bg-emerald-900 hover:bg-emerald-950 text-amber-300 font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <span>Continue to Review</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3 text-xs">
              <h3 className="font-serif-fraunces font-bold text-base text-slate-900 border-b border-slate-200 pb-2">
                Pre-submission Challan Verification
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 block">Payer & Taxpayer:</span>
                  <strong className="text-slate-900">{taxpayerProfile.nameEn}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">e-TIN:</span>
                  <strong className="font-mono-plex text-emerald-900">{taxpayerProfile.tin}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Assessment Year:</span>
                  <strong className="text-slate-900">{assessmentYear}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Head Code:</span>
                  <strong className="font-mono-plex text-emerald-900">{selectedHead?.economicCode}</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800">Total Remittance:</span>
                <span className="font-mono-plex font-bold text-xl text-emerald-900">
                  {formatCurrency(totalAmount, language)}
                </span>
              </div>
            </div>

            {/* Gateway choices */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Payment Channel
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                {[
                  { id: 'BKASH', label: 'bKash MFS' },
                  { id: 'NAGAD', label: 'Nagad MFS' },
                  { id: 'ROCKET', label: 'Rocket DBBL' },
                  { id: 'SONALI_E_SHEBA', label: 'Sonali Bank' },
                  { id: 'A_CHALLAN_CARD', label: 'Cards' },
                  { id: 'BEFTN_RTGS', label: 'BEFTN Bank' }
                ].map(gw => (
                  <button
                    key={gw.id}
                    type="button"
                    onClick={() => setPaymentMethod(gw.id as any)}
                    className={`p-2.5 rounded-lg border text-xs font-semibold cursor-pointer text-center ${
                      paymentMethod === gw.id
                        ? 'bg-emerald-900 text-white border-emerald-900'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {gw.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-3">
              <button
                disabled={isProcessing}
                onClick={() => setStep(2)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                disabled={isProcessing}
                onClick={handleExecutePayment}
                className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isProcessing ? (
                  <span>Transmitting to A-Challan Gateway...</span>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 text-emerald-950" />
                    <span>Confirm & Pay {formatCurrency(totalAmount, language)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
