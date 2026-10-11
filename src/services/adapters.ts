/**
 * Replaceable Integration Adapters for Future Official NBR & Treasury Systems
 * 
 * DESIGN CONTRACT:
 * These adapters define the formal interfaces for external government and financial
 * system boundaries. They currently operate as simulated local stub providers.
 * They MUST NOT connect to real production systems or databases without official certification.
 */

export interface EtinVerificationResult {
  valid: boolean;
  tin: string;
  taxpayerName: string;
  zone: string;
  circle: string;
  status: 'ACTIVE' | 'CANCELLED' | 'SUSPENDED';
  isWithholdingEntity: boolean;
  error?: string;
}

export interface AcsChallanSubmissionResult {
  success: boolean;
  challanNo: string;
  tokenNumber: string;
  treasuryScrollNo: string;
  scrolledAt: string;
  clearingBank: string;
  status: 'SCROLLED' | 'PENDING_CLEARANCE' | 'REJECTED';
}

export interface PaymentGatewayResponse {
  transactionId: string;
  status: 'SUCCESS' | 'FAILED' | 'USER_CANCELLED';
  amount: number;
  currency: 'BDT';
  gatewayFee: number;
  timestamp: string;
}

export class EtinAdapter {
  static async verifyTin(tin: string): Promise<EtinVerificationResult> {
    // Demonstration-only format check; no government registration service is contacted.
    await new Promise(res => setTimeout(res, 300));
    const clean = tin.replace(/\D/g, '');
    if (clean.length !== 12) {
      return {
        valid: false,
        tin,
        taxpayerName: '',
        zone: '',
        circle: '',
        status: 'SUSPENDED',
        isWithholdingEntity: false,
        error: 'Enter a 12-digit number for the demonstration; this does not verify a government registration.'
      };
    }
    return {
      valid: true,
      tin: clean,
      taxpayerName: 'Synthetic demo taxpayer',
      zone: 'Taxes Zone-08, Dhaka',
      circle: 'Circle-164 (Mohakhali)',
      status: 'ACTIVE',
      isWithholdingEntity: clean.startsWith('38') || clean.startsWith('77')
    };
  }
}

export class AcsTreasuryAdapter {
  static async issueChallan(payload: {
    tin: string;
    amount: number;
    headCode: string;
    assessmentYear: string;
    method: string;
  }): Promise<AcsChallanSubmissionResult> {
    await new Promise(res => setTimeout(res, 500));
    const year = new Date().getFullYear();
    const rand = Math.floor(10000000 + Math.random() * 90000000);
    return {
      success: true,
      challanNo: `AC-${year}-${rand}`,
      tokenNumber: `TKN-${Math.floor(100000 + Math.random() * 900000)}`,
      treasuryScrollNo: `BB-SCRL-${year}-${Math.floor(10000 + Math.random() * 90000)}`,
      scrolledAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      clearingBank: 'Sonali Bank PLC (Dhaka Treasury Branch)',
      status: 'SCROLLED'
    };
  }
}

export class PaymentGatewayAdapter {
  static async initiateMfsPayment(provider: 'BKASH' | 'NAGAD' | 'ROCKET', amount: number): Promise<PaymentGatewayResponse> {
    await new Promise(res => setTimeout(res, 600));
    const prefix = provider === 'BKASH' ? 'BKSH' : provider === 'NAGAD' ? 'NGD' : 'RCKT';
    return {
      transactionId: `${prefix}-TXN-${Math.floor(10000000 + Math.random() * 90000000)}`,
      status: 'SUCCESS',
      amount,
      currency: 'BDT',
      gatewayFee: 0, // NBR absorbs or waives MFS fees on tax collection
      timestamp: new Date().toISOString()
    };
  }
}
