/** Etherfuse KYC status values. */
export type EtherfuseKycStatus =
  | 'not_started'
  | 'proposed'
  | 'approved'
  | 'approved_chain_deploying'
  | 'rejected';

/** Etherfuse order status values. */
export type EtherfuseOrderStatus =
  | 'created'
  | 'funded'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'canceled';

/** Response from `POST /ramp/onboarding-url`. */
export interface EtherfuseOnboardingResponse {
  presigned_url: string;
}

/** Quote asset pair with ramp direction. */
export interface EtherfuseQuoteAssets {
  type: 'onramp' | 'offramp' | 'swap';
  /** Source asset — fiat code for on-ramp, `CODE:ISSUER` for off-ramp. */
  sourceAsset: string;
  /** Target asset — `CODE:ISSUER` for on-ramp, fiat code for off-ramp. */
  targetAsset: string;
}

/** Response from `POST /ramp/quote`. */
export interface EtherfuseQuoteResponse {
  quoteId: string;
  customerId: string;
  blockchain: string;
  quoteAssets: EtherfuseQuoteAssets;
  sourceAmount: string;
  destinationAmount: string;
  exchangeRate: string;
  feeBps: string | null;
  feeAmount: string | null;
  destinationAmountAfterFee: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

/** Response from `POST /ramp/order` (off-ramp creation). */
export interface EtherfuseCreateOffRampResponse {
  offramp: {
    orderId: string;
  };
}

/** Response from `GET /ramp/order/{order_id}`. */
export interface EtherfuseOrderResponse {
  orderId: string;
  customerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  completedAt?: string;
  amountInFiat?: string;
  amountInTokens?: string;
  confirmedTxSignature?: string;
  walletId: string;
  bankAccountId: string;
  /** Base64 XDR of the burn transaction — present once ready for signing (off-ramp). */
  burnTransaction?: string;
  memo?: string;
  orderType: 'onramp' | 'offramp';
  status: EtherfuseOrderStatus;
  statusPage: string;
  feeBps?: number;
  feeAmountInFiat?: string;
}

/** Response from `GET /ramp/customer/{id}/kyc/{pubkey}`. */
export interface EtherfuseKycStatusResponse {
  customerId: string;
  walletPublicKey: string;
  status: EtherfuseKycStatus;
  onChainMarked?: boolean;
  currentRejectionReason?: string | null;
  approvedAt?: string | null;
}

/** A single bank account in the list response from `POST /ramp/customer/{id}/bank-accounts`. */
export interface EtherfuseBankAccountListItem {
  bankAccountId: string;
  customerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  pixKey?: string;
  pixKeyType?: string;
  accountHolderName?: string;
  label?: string | null;
  compliant: boolean;
  status: string;
}

/** Paginated response from `POST /ramp/customer/{id}/bank-accounts`. */
export interface EtherfuseBankAccountListResponse {
  items: EtherfuseBankAccountListItem[];
  totalItems: number;
  pageSize: number;
  pageNumber: number;
  totalPages: number;
}
