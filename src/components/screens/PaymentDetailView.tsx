import React from 'react';
import { useTaxState } from '../../services/taxState';
import { ReceiptView } from '../common/ReceiptView';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { receiptReturnRoute } from '../../services/routeContract';
import { useAccountIdentity } from '../../services/accountIdentity';
import { taxpayerPreviewReceipts } from '../../services/taxpayerEvidence';
import { INITIAL_RECEIPTS } from '../../data/mockData';

export const PaymentDetailView: React.FC = () => {
  const { selectedReceipt, receipts, taxpayerProfile, userRole, demoUser, routeParams, navigate } = useTaxState();
  const { user: authenticatedUser } = useAccountIdentity();
  const returnTo = receiptReturnRoute(routeParams.returnTo);
  const officerContext = returnTo === 'payment_search' || returnTo === 'taxpayer_360';
  const isPublicFixture = selectedReceipt && INITIAL_RECEIPTS.some(receipt => receipt.id === selectedReceipt.id);
  const allowedPreviewReceipts = taxpayerPreviewReceipts(receipts, taxpayerProfile.tin, userRole, demoUser, Boolean(authenticatedUser));
  const availableReceipt = officerContext || !isPublicFixture || allowedPreviewReceipts.some(receipt => receipt.id === selectedReceipt?.id)
    ? selectedReceipt : null;
  const backLabel = returnTo === 'payment_search' ? 'Back to Payment Search' :
    returnTo === 'taxpayer_360' ? 'Back to Taxpayer 360' :
    returnTo === 'dashboard' || returnTo === 'taxpayer_home' ? 'Back to Dashboard' : 'Back to Payment History';

  if (!availableReceipt) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-xl border border-slate-200 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
        <h2 className="font-serif-fraunces text-xl font-bold text-slate-800">No Challan Selected</h2>
        <p className="text-xs text-slate-500">
          Select a payment record from the originating list to inspect its details.
        </p>
        <button
          onClick={() => navigate(returnTo)}
          className="px-4 py-2 bg-emerald-900 text-amber-300 font-bold rounded-lg text-xs cursor-pointer inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLabel}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <ReceiptView receipt={availableReceipt} onBack={() => navigate(returnTo)} />
    </div>
  );
};
