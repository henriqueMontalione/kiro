/** KYC verification status for a customer. */
export type KycStatus = 'pending' | 'approved' | 'rejected' | 'not_started' | 'update_required';

/** Lifecycle status for on-ramp and off-ramp transactions. */
export type TransactionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelled'
  | 'refunded';

/** A customer record as returned by an anchor provider. */
export interface Customer {
  id: string;
  email?: string;
  kycStatus: KycStatus;
  country?: string;
  bankAccountId?: string;
  createdAt: string;
  updatedAt: string;
}

/** A currency conversion quote from an anchor provider. */
export interface Quote {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  toAmount: string;
  exchangeRate: string;
  fee: string;
  expiresAt: string;
  createdAt: string;
}

/** A saved fiat account returned by the anchor. */
export interface SavedFiatAccount {
  id: string;
  type: string;
  accountNumber: string;
  bankName: string;
  accountHolderName: string;
  createdAt: string;
}

/** An off-ramp (crypto → fiat) transaction. */
export interface OffRampTransaction {
  id: string;
  customerId: string;
  quoteId: string;
  status: TransactionStatus;
  fromAmount: string;
  fromCurrency: string;
  toAmount: string;
  toCurrency: string;
  stellarAddress: string;
  memo?: string;
  stellarTxHash?: string;
  signableTransaction?: string;
  createdAt: string;
  updatedAt: string;
}

/** Capability flags for runtime detection of anchor features. */
export interface AnchorCapabilities {
  emailLookup?: boolean;
  kycUrl?: boolean;
  requiresOffRampSigning?: boolean;
  deferredOffRampSigning?: boolean;
  fiatAccountRegistration?: 'inline' | 'hosted';
}

/**
 * Error thrown by anchor client operations.
 */
export class AnchorError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = 'AnchorError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
