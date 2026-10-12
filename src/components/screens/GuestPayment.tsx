import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle, 
  Building2, 
  Info, 
  Lock, 
  HelpCircle,
  FileCheck2,
  ShieldCheck
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { MASTER_PAYMENT_HEADS, BLOCKED_HEAD_IDS, CATEGORY_LABELS } from '../../data/paymentHeads';
import { ASSESSMENT_YEARS } from '../../data/mockData';
import { PaymentCategory, MasterPaymentHead, ChallanReceipt, PaymentLineItem } from '../../types/tax';
import { formatCurrency } from '../../services/numberFormat';
import { ReceiptView } from '../common/ReceiptView';

interface GuestPaymentProps {
  isWithholdingMode?: boolean;
}

export const GuestPayment: React.FC<GuestPaymentProps> = ({ isWithholdingMode = false }) => {
  const { language, navigate, addPaymentReceipt, routeParams } = useTaxState();

  // Wizard state steps: 1: Taxpayer & Identification, 2: Head & Amount, 3: Review & Gateway, 4: Receipt
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form inputs
  const [tin, setTin] = useState('');
  const [payerName, setPayerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [taxZone, setTaxZone] = useState('Taxes Zone-08, Dhaka');
  const [taxCircle, setTaxCircle] = useState('Circle-164 (Mohakhali)');
  const [assessmentYear, setAssessmentYear] = useState('2025-2026');
  
  // Representative fields
  const [isRepresentative, setIsRepresentative] = useState(false);
  const [representativeName, setRepresentativeName] = useState('');
  const [representativeTin, setRepresentativeTin] = useState('');

  // Withholding Deductee fields (if withholding mode)
  const [deducteeTin, setDeducteeTin] = useState('');
  const [deducteeName, setDeducteeName] = useState('');

  // Category and Head selection
  const [category, setCategory] = useState<PaymentCategory>(
    isWithholdingMode ? 'SOURCE_TAX_DEPOSIT' : ((routeParams?.initialCategory as PaymentCategory) || 'TAX_WITH_RETURN')
  );
  const [selectedHeadId, setSelectedHeadId] = useState<number>(
    isWithholdingMode ? 59 : (MASTER_PAYMENT_HEADS.find(h => h.category === routeParams?.initialCategory)?.id || 1)
  );
  const [headSearch, setHeadSearch] = useState('');

  // Amounts
  const [taxAmount, setTaxAmount] = useState<number>(15000);
  const [penaltyAmount, setPenaltyAmount] = useState<number>(0);
  const [surchargeAmount, setSurchargeAmount] = useState<number>(0);
  const [interestAmount, setInterestAmount] = useState<number>(0);
  const [note, setNote] = useState('');

  // Payment gateway choice
  const [paymentMethod, setPaymentMethod] = useState<'BKASH' | 'NAGAD' | 'ROCKET' | 'SONALI_E_SHEBA' | 'A_CHALLAN_CARD'>('BKASH');
  const [isProcessing, setIsProcessing] = useState(false);
  const [createdReceipt, setCreatedReceipt] = useState<ChallanReceipt | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isWithholdingMode) {
      setCategory('SOURCE_TAX_DEPOSIT');
      setSelectedHeadId(59); // Contract supply TDS
    }
  }, [isWithholdingMode]);

  useEffect(() => {
    if (!isWithholdingMode && routeParams?.initialCategory && CATEGORY_LABELS[routeParams.initialCategory]) {
      const next = routeParams.initialCategory as PaymentCategory;
      setCategory(next);
      const firstHead = MASTER_PAYMENT_HEADS.find(h => h.category === next && !BLOCKED_HEAD_IDS.includes(h.id));
      if (firstHead) setSelectedHeadId(firstHead.id);
    }
  }, [routeParams, isWithholdingMode]);

  // Filter available heads
  const availableHeads = MASTER_PAYMENT_HEADS.filter(head => {
    const matchCat = head.category === category;
    const matchQuery = headSearch
      ? head.nameEn.toLowerCase().includes(headSearch.toLowerCase()) ||
        head.economicCode.includes(headSearch) ||
        head.sectionAct2023.toLowerCase().includes(headSearch.toLowerCase())
      : true;
    return matchCat && matchQuery;
  });

  const selectedHead = availableHeads.find(h => h.id === selectedHeadId) || availableHeads[0];

  const totalAmount = Number(taxAmount || 0) + Number(penaltyAmount || 0) + Number(surchargeAmount || 0) + Number(interestAmount || 0);

  const handleStep1Next = () => {
    if (!tin.trim() || tin.length < 10) {
      setErrorMessage('Please enter a valid Taxpayer Identification Number (minimum 10-12 digits).');
      return;
    }
    if (!payerName.trim()) {
      setErrorMessage('Please enter the payer full legal name.');
      return;
    }
    if (isRepresentative && (!representativeTin || !representativeName)) {
      setErrorMessage('Representative name and TIN are required when paying on behalf of another taxpayer.');
      return;
    }
    if (isWithholdingMode && !deducteeTin.trim()) {
      setErrorMessage('Deductee (supplier/beneficiary) TIN is mandatory for source tax deposits.');
      return;
    }
    setErrorMessage('');
    setStep(2);
  };

  const handleStep2Next = () => {
    if (!selectedHead) {
      setErrorMessage('Please select a valid payment head.');
      return;
    }
    if (BLOCKED_HEAD_IDS.includes(selectedHead.id)) {
      setErrorMessage(`Head #${selectedHead.id} is BLOCKED for owner review and cannot be processed.`);
      return;
    }
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
        id: `rcpt-${Date.now()}`,
        challanNo: `AC-${year}-${randChallan}`,
        tokenNumber: `TKN-${randToken}`,
        paymentCategory: category,
        assessmentYear,
        payerName,
        payerTin: tin,
        isRepresentativePayment: isRepresentative,
        representativeTin: isRepresentative ? representativeTin : undefined,
        taxZone,
        taxCircle,
        isWithholding: isWithholdingMode || category === 'SOURCE_TAX_DEPOSIT',
        deducteeTin: isWithholdingMode ? deducteeTin : undefined,
        deducteeName: isWithholdingMode ? deducteeName : undefined,
        items: [lineItem],
        totalAmount,
        paymentMethod,
        gatewayTransactionId: `${paymentMethod.substring(0, 4)}-TXN-${Math.floor(10000000 + Math.random() * 90000000)}`,
        treasuryScrollNo: `BB-SCRL-${year}-${Math.floor(10000 + Math.random() * 90000)}`,
        treasuryDate: now,
        treasuryStatus: 'TREASURY_SCROLLED',
        // CRITICAL DOMAIN SEPARATION:
        taxCreditStatus: (isWithholdingMode || category === 'SOURCE_TAX_DEPOSIT') 
          ? 'NOT_APPLICABLE' 
          : 'PENDING_RECONCILIATION',
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
        <div className="no-print p-4 rounded-lg bg-emerald-100 border border-emerald-300 text-taxpay-dark flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <span className="font-bold">Simulation complete — fictional Treasury scroll created.</span>
              <p className="text-xs text-emerald-800">
                Demo receipt (not an official A-Challan). Reference: <strong className="font-mono">{createdReceipt.challanNo}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setStep(1);
              setCreatedReceipt(null);
            }}
            className="px-3 py-1.5 rounded bg-emerald-800 text-white text-xs font-semibold hover:bg-taxpay-primary cursor-pointer"
          >
            Initiate Another Payment
          </button>
        </div>
        <ReceiptView receipt={createdReceipt} onBack={() => navigate('landing')} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Title & Mode Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              {isWithholdingMode ? 'Withholding Agent Mode' : 'Public Guest Portal'}
            </span>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              {isWithholdingMode ? 'Source Tax Deposit (TDS / TCS)' : 'Guest Income Tax Payment'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Explore illustrative guest payment steps without a live Treasury or payment gateway connection.
            </p>
            <p className="mt-2 text-xs font-semibold text-taxpay-dark" aria-live="polite">
              Selected purpose: {CATEGORY_LABELS[category]?.en || 'Under review'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Step {step} of 3
            </span>
          </div>
        </div>

        {/* Stepper Progress */}
        <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-center mb-6">
          <div className={`p-2 rounded border ${step >= 1 ? 'bg-taxpay-primary text-amber-300 border-taxpay-primary' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            1. Payer & TIN Info
          </div>
          <div className={`p-2 rounded border ${step >= 2 ? 'bg-taxpay-primary text-amber-300 border-taxpay-primary' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            2. Head & Calculation
          </div>
          <div className={`p-2 rounded border ${step >= 3 ? 'bg-taxpay-primary text-amber-300 border-taxpay-primary' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            3. Review & Gateway
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Taxpayer Identification */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Taxpayer Identification Number (e-TIN) *
                </label>
                <input
                  type="text"
                  placeholder="12-digit e-TIN format (demo only)"
                  value={tin}
                  onChange={(e) => setTin(e.target.value.replace(/\s+/g, ''))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary font-mono-plex"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  12-digit format for demonstration only; no government identity check is performed.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payer Legal Name *
                </label>
                <input
                  type="text"
                  placeholder="Full name as registered on TIN certificate"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assessment Year *
                </label>
                <select
                  value={assessmentYear}
                  onChange={(e) => setAssessmentYear(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary"
                >
                  {ASSESSMENT_YEARS.map(ay => (
                    <option key={ay} value={ay}>{ay}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Taxes Zone & Circle
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={taxZone}
                    onChange={(e) => setTaxZone(e.target.value)}
                    className="px-2.5 py-2 text-xs rounded border border-slate-300"
                  />
                  <input
                    type="text"
                    value={taxCircle}
                    onChange={(e) => setTaxCircle(e.target.value)}
                    className="px-2.5 py-2 text-xs rounded border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number (for SMS token & receipt link)
                </label>
                <input
                  type="text"
                  placeholder="Contact number (demo only)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary font-mono-plex"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address (optional)
                </label>
                <input
                  type="email"
                  placeholder="taxpayer@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary"
                />
              </div>
            </div>

            {/* WITHHOLDING AGENT MODE: Deductee TIN Fields */}
            {isWithholdingMode && (
              <div className="p-4 rounded-lg bg-teal-50 border border-teal-200 space-y-3">
                <div className="flex items-center gap-2 text-teal-900 font-semibold text-xs">
                  <Building2 className="w-4 h-4 text-teal-700" />
                  <span>Deductee (Supplier / Beneficiary) Particulars</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Deductee TIN *</label>
                    <input
                      type="text"
                      placeholder="Beneficiary Vendor 12-digit TIN"
                      value={deducteeTin}
                      onChange={(e) => setDeducteeTin(e.target.value)}
                      className="w-full px-3 py-1.5 rounded border border-teal-300 font-mono-plex"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Deductee Entity Name</label>
                    <input
                      type="text"
                      placeholder="Beneficiary Supplier / Contractor Name"
                      value={deducteeName}
                      onChange={(e) => setDeducteeName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded border border-teal-300"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-teal-800 italic">
                  Legal Note: The tax credit for this deposit will be assigned strictly to the Deductee TIN, not the depositing withholding agent.
                </p>
              </div>
            )}

            {/* Representative Checkbox */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRepresentative}
                  onChange={(e) => setIsRepresentative(e.target.checked)}
                  className="rounded text-emerald-800 focus:ring-taxpay-primary"
                />
                <span>I am an authorized legal representative paying on behalf of this taxpayer</span>
              </label>

              {isRepresentative && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                  <div>
                    <label className="block text-slate-600 mb-1">Representative Name *</label>
                    <input
                      type="text"
                      placeholder="Lawyer / CA / Authorized Relative"
                      value={representativeName}
                      onChange={(e) => setRepresentativeName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Representative TIN *</label>
                    <input
                      type="text"
                      placeholder="Representative 12-digit TIN"
                      value={representativeTin}
                      onChange={(e) => setRepresentativeTin(e.target.value)}
                      className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono-plex"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={handleStep1Next}
                className="px-5 py-2.5 bg-taxpay-primary hover:bg-taxpay-dark text-amber-300 font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <span>Continue to Payment Head</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Head Selection & Financial Amounts */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Category Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Category
              </label>
              <select
                disabled={isWithholdingMode}
                value={category}
                onChange={(e) => {
                  const newCat = e.target.value as PaymentCategory;
                  setCategory(newCat);
                  const firstInCat = MASTER_PAYMENT_HEADS.find(h => h.category === newCat);
                  if (firstInCat) setSelectedHeadId(firstInCat.id);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-taxpay-primary font-medium"
              >
                {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
                  <option key={catKey} value={catKey}>
                    {label.en} ({label.bn})
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Head Selector with 170 heads */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Select Master Payment Head ({availableHeads.length} available in category)
                </label>
                <input
                  type="text"
                  placeholder="Filter by code or section..."
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
                          ? 'bg-emerald-100/70 border-l-4 border-taxpay-primary'
                          : isBlocked
                          ? 'bg-rose-50/60 opacity-70 cursor-not-allowed'
                          : 'hover:bg-white'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-plex font-bold text-taxpay-dark">
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
                        {head.blockedReason && (
                          <div className="text-[11px] text-rose-700 font-medium">
                            {head.blockedReason}
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

            {/* Financial Amounts Breakdown */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-taxpay-dark">
                Payment Amount Breakdown (BDT)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Tax Amount (৳) *</label>
                  <input
                    type="number"
                    min="0"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono-plex"
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
                  <label className="block text-slate-600 font-medium mb-1">Interest (৳)</label>
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
                  Payment Remarks / Invoice Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Assessment order #190 / Salary withholding month Oct 2026"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800">
                  Total Payable Amount:
                </span>
                <span className="font-mono-plex font-bold text-lg text-taxpay-dark">
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
                className="px-5 py-2.5 bg-taxpay-primary hover:bg-taxpay-dark text-amber-300 font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <span>Continue to Review & Gateway</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Review Challan & Execute Simulated Gateway */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Challan Preview Summary Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
              <h3 className="font-serif-fraunces font-bold text-base text-slate-900 border-b border-slate-200 pb-2">
                Challan Pre-submission Summary
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div>
                    <span className="text-slate-500">Payer Name:</span>{' '}
                    <strong className="text-slate-900">{payerName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">e-TIN:</span>{' '}
                    <strong className="font-mono-plex text-taxpay-dark">{tin}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Assessment Year:</span>{' '}
                    <strong className="text-slate-900">{assessmentYear}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Jurisdiction:</span>{' '}
                    <span className="text-slate-800">{taxZone}, {taxCircle}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div>
                    <span className="text-slate-500">Category:</span>{' '}
                    <strong className="text-slate-900">{category}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Head Code:</span>{' '}
                    <strong className="font-mono-plex text-taxpay-dark">{selectedHead?.economicCode}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Head Title:</span>{' '}
                    <span className="text-slate-800">{selectedHead?.nameEn}</span>
                  </div>
                  {isWithholdingMode && (
                    <div className="text-teal-900 font-semibold bg-teal-100/60 p-1.5 rounded">
                      Deductee TIN: {deducteeTin} ({deducteeName || 'Unspecified'})
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800">Grand Total BDT:</span>
                <span className="font-mono-plex font-bold text-xl text-taxpay-dark">
                  {formatCurrency(totalAmount, language)}
                </span>
              </div>
            </div>

            {/* Gateway Provider Selection */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Select Electronic Payment Channel (Simulated Gateway)
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { id: 'BKASH', label: 'bKash MFS', fee: 'No fee' },
                  { id: 'NAGAD', label: 'Nagad MFS', fee: 'No fee' },
                  { id: 'ROCKET', label: 'Rocket DBBL', fee: 'No fee' },
                  { id: 'SONALI_E_SHEBA', label: 'Sonali e-Sheba', fee: 'Direct Treasury' },
                  { id: 'A_CHALLAN_CARD', label: 'Cards (Visa/MC)', fee: 'Gov Switch' }
                ].map(gw => (
                  <button
                    key={gw.id}
                    type="button"
                    onClick={() => setPaymentMethod(gw.id as any)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      paymentMethod === gw.id
                        ? 'bg-taxpay-primary text-white border-taxpay-primary shadow-sm'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="font-bold text-xs">{gw.label}</div>
                    <div className={`text-[10px] mt-0.5 ${paymentMethod === gw.id ? 'text-amber-300' : 'text-slate-500'}`}>
                      {gw.fee}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Strict Legal Disclaimer */}
            <div className="p-3 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Simulation Confirmation:</strong> Clicking "Confirm & Pay via Gateway" triggers a simulated payment authorization and instant A-Challan Treasury scroll generation. No actual funds are deducted.
              </div>
            </div>

            <div className="flex justify-between pt-3">
              <button
                disabled={isProcessing}
                onClick={() => setStep(2)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Head</span>
              </button>
              <button
                disabled={isProcessing}
                onClick={handleExecutePayment}
                className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-taxpay-dark font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isProcessing ? (
                  <span>Processing Treasury Gateway...</span>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 text-taxpay-dark" />
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
