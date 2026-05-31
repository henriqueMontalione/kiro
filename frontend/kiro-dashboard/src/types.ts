/** App-wide TypeScript types. */

export type TxStatus = 'success' | 'pending' | 'danger';

export interface Transaction {
  /** Order id, e.g. "10293". Hash is added at render time. */
  id: string;
  /** Free-text label shown as the row title. */
  label: string;
  /** Pre-formatted BRL string, e.g. "R$ 259,90" or "- R$ 49,90". */
  amount: string;
  status: TxStatus;
  /** Human-readable timestamp, e.g. "Hoje, 14:32". */
  when: string;
  /** Visual accent for the icon chip on the row. */
  accent: 'green' | 'purple';
  kind: 'pix' | 'refund' | 'transfer';
}

export interface PaymentLink {
  name: string;
  /** Pre-formatted BRL string. */
  amount: string;
  /** Number of times the link has been used. */
  uses: number;
  /** Short share-url displayed under the QR code. */
  url: string;
}

export interface NavItem {
  id: NavId;
  label: string;
  /** lucide-react icon name (PascalCase). */
  icon: string;
  /** Router path for react-router. */
  to: string;
}

export type NavId =
  | 'resumo'
  | 'transacoes'
  | 'analise'
  | 'links'
  | 'clientes'
  | 'relatorios'
  | 'integracoes'
  | 'config';
