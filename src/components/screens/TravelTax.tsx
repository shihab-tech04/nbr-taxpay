import React, { useState } from 'react';
import { 
  Plane, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Info, 
  Building2,
  Calendar,
  CreditCard
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { TRAVEL_TAX_RATES } from '../../data/mockData';
import { formatCurrency } from '../../services/numberFormat';
import { ChallanReceipt } from '../../types/tax';
import { ReceiptView } from '../common/ReceiptView';

export const TravelTax: React.FC = () => {
  const { language, navigate, addPaymentReceipt } = useTaxState();

  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [passengerCount, setPassengerCount] = useState(1);
  const [passengerName, setPassengerName] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [departurePort, setDeparturePort] = useState('Hazrat Shahjalal International Airport (DAC)');
  const [travelDate, setTravelDate] = useState('2026-10-25');
  const [createdReceipt, setCreatedReceipt] = useState<ChallanReceipt | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const route = TRAVEL_TAX_RATES[selectedRouteIdx];
  const unitRate = route.amount;
  const totalAmount = unitRate * passengerCount;

  const handlePayTravelTax = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passengerName.trim()) {
      setError('Please provide the principal passenger name as stated in passport.');
      return;
    }
    if (!passportNumber.trim()) {
      setError('Enter only synthetic test data. This prototype cannot perform electronic immigration clearance.');
      return;
    }
    setError('');
    setIsProcessing(true);

    setTimeout(() => {
      const year = new Date().getFullYear();
      const randChallan = Math.floor(10000000 + Math.random() * 90000000);
      const randToken = Math.floor(100000 + Math.random() * 900000);
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const newReceipt: ChallanReceipt = {
        id: `rcpt-trv-${Date.now()}`,
        challanNo: `AC-${year}-TRV-${randChallan}`,
        tokenNumber: `TRV-${randToken}`,
        paymentCategory: 'OTHER_TAX_PAYMENT',
        assessmentYear: '2025-2026',
        payerName: `${passengerName} (Passport: ${passportNumber})`,
        payerTin: 'NON-TIN-PASSENGER',
        isRepresentativePayment: false,
        taxZone: 'Customs & Travel Tax Division, Dhaka',
        taxCircle: 'Circle-Immigration Port',
        isWithholding: false,
        items: [
          {
            headId: 151 + selectedRouteIdx,
            economicCode: `1-1141-0040-070${3 + selectedRouteIdx}`,
            headNameEn: `Foreign Travel Tax - ${route.route}`,
            taxAmount: totalAmount,
            penaltyAmount: 0,
            surchargeAmount: 0,
            interestAmount: 0,
            totalAmount,
            note: `Port: ${departurePort} | Date: ${travelDate} | Pass: ${passportNumber}`
          }
        ],
        totalAmount,
        paymentMethod: 'BKASH',
        gatewayTransactionId: `BKSH-TRV-${Math.floor(10000000 + Math.random() * 90000000)}`,
        treasuryScrollNo: `BB-SCRL-${year}-${Math.floor(10000 + Math.random() * 90000)}`,
        treasuryDate: now,
        treasuryStatus: 'TREASURY_SCROLLED',
        taxCreditStatus: 'NOT_APPLICABLE',
        createdAt: now,
        completedAt: now,
        isSimulatedDemo: true
      };

      addPaymentReceipt(newReceipt);
      setCreatedReceipt(newReceipt);
      setIsProcessing(false);
    }, 1000);
  };

  if (createdReceipt) {
    return (
      <div className="space-y-6">
        <div className="p-4 rounded-lg bg-emerald-100 border border-emerald-300 text-taxpay-dark flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <p className="font-bold">Travel tax demo completed — no official challan was issued.</p>
              <p className="text-xs text-emerald-800">
                Demo-only reference <strong className="font-mono">{createdReceipt.tokenNumber}</strong>. Do NOT present this reference at an airport, border, bank or government office. No tax was paid.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCreatedReceipt(null)}
            className="px-3 py-1.5 rounded bg-emerald-800 text-white text-xs font-semibold hover:bg-taxpay-primary cursor-pointer"
          >
            New Travel Tax
          </button>
        </div>
        <ReceiptView receipt={createdReceipt} onBack={() => navigate('landing')} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              Foreign Travel Tax Payment Portal
            </h1>
            <p className="text-xs text-slate-500">
              Illustrative travel-tax form only. No official passenger verification, government fee collection or immigration clearance.
            </p>
          </div>
        </div>

        {/* Notice of Unverified Status */}
        <div className="mb-5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong className="block">Legal Verification Status:</strong>
            The travel tax rates displayed below are illustrative demonstration figures from the v11 prototype.
            Marked per project instructions: <em>SOURCE NOT IN INPUTS / LEGAL VALIDITY UNVERIFIED</em>.
          </div>
        </div>

        <form onSubmit={handlePayTravelTax} className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Route & Destination Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Select Destination Category & Mode of Travel
            </label>
            <div className="space-y-2">
              {TRAVEL_TAX_RATES.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedRouteIdx(idx)}
                  className={`p-3.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                    selectedRouteIdx === idx
                      ? 'bg-teal-50/80 border-teal-700 shadow-sm'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-900">{item.route}</div>
                    <div className="text-[11px] text-slate-500 font-bengali">{item.routeBn}</div>
                    <div className="text-[10px] text-slate-400">{item.statutoryRef}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono-plex font-bold text-sm text-teal-900">
                      {formatCurrency(item.amount, language)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">per passenger</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Passenger Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Principal Passenger Name (as in passport) *
              </label>
              <input
                type="text"
                placeholder="e.g. MOHAMMED RAHMAN"
                value={passengerName}
                onChange={(e) => setPassengerName(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Passport Number *
              </label>
              <input
                type="text"
                placeholder="Passport reference (demo only)"
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-plex font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Number of Outbound Passengers
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={passengerCount}
                onChange={(e) => setPassengerCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-plex"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Infants and children under 5 years are exempt under statutory rules.
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Mobile Number for SMS Challan Token
              </label>
              <input
                type="text"
                placeholder="+880 1712-XXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-plex"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Port of Departure
              </label>
              <select
                value={departurePort}
                onChange={(e) => setDeparturePort(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              >
                <option value="Hazrat Shahjalal International Airport (DAC)">Hazrat Shahjalal Int\'l Airport, Dhaka (DAC)</option>
                <option value="Shah Amanat International Airport (CGP)">Shah Amanat Int\'l Airport, Chattogram (CGP)</option>
                <option value="Osmani International Airport (ZYL)">Osmani Int\'l Airport, Sylhet (ZYL)</option>
                <option value="Benapole Land Port (Jashore)">Benapole Land Port Checkpost (Jashore)</option>
                <option value="Burimari Land Port (Lalmonirhat)">Burimari Land Port Checkpost</option>
                <option value="Akhaura Land Port (Brahmanbaria)">Akhaura Land Port Checkpost</option>
                <option value="Chattogram Sea Port">Chattogram Sea Port</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Date of Departure
              </label>
              <input
                type="date"
                value={travelDate}
                onChange={(e) => setTravelDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
          </div>

          {/* Checkout Breakdown */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs text-slate-500 block">Total Travel Tax Payable:</span>
              <span className="font-mono-plex font-bold text-2xl text-teal-900">
                {formatCurrency(totalAmount, language)}
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                ({passengerCount} passenger{passengerCount > 1 ? 's' : ''} × {formatCurrency(unitRate, language)})
              </span>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-taxpay-dark font-bold rounded-lg text-sm flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isProcessing ? (
                <span>Generating Travel Challan...</span>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 text-taxpay-dark" />
                  <span>Pay Travel Tax & Get Token</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
