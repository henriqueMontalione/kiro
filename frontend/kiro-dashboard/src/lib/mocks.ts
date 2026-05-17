/**
 * Hardcoded mock data for the Kiro merchant dashboard.
 * No backend — values mirror the reference design.
 */

import type { NavItem, PaymentLink, Transaction } from '@/types';

export const MERCHANT = {
  name: 'Loja Origem',
  role: 'Merchant',
  initials: 'LO',
  pixKey: 'kiro.loja.origem@pix.com.br',
  email: 'contato@lojaorigem.com.br',
};

export const BALANCE = {
  available: 'R$ 4.925,00',
  updatedLabel: 'Atualizado agora há poucos segundos',
};

export const YIELD = {
  /** Accumulated yield this month, pre-formatted. */
  accumulated: '+ R$ 312,00',
  thisMonthLabel: 'Este mês',
  trendLabel: '12,4% vs mês anterior',
  /** Daily yield in BRL, ascending — drives the YieldCard chart. */
  series: [
    { day: '01 Mai', value: 10 },
    { day: '02 Mai', value: 16 },
    { day: '03 Mai', value: 14 },
    { day: '04 Mai', value: 22 },
    { day: '05 Mai', value: 28 },
    { day: '06 Mai', value: 26 },
    { day: '07 Mai', value: 38 },
    { day: '08 Mai', value: 44 },
    { day: '09 Mai', value: 48 },
    { day: '10 Mai', value: 52 },
    { day: '11 Mai', value: 60 },
    { day: '12 Mai', value: 66 },
    { day: '13 Mai', value: 72 },
    { day: '14 Mai', value: 76 },
    { day: '15 Mai', value: 84 },
    { day: '20 Mai', value: 92 },
    { day: '29 Mai', value: 100 },
  ],
  tick: ['1 Mai', '8 Mai', '15 Mai', '22 Mai', '29 Mai'],
  yAxis: ['R$ 0', 'R$ 100', 'R$ 200', 'R$ 300', 'R$ 400'],
};

export const RECEBIMENTOS_TODAY = {
  total: 'R$ 1.250,90',
  count: '7 transações',
  /** Hourly bars, 24 entries 00h..23h. */
  hourly: [4, 6, 3, 5, 8, 10, 12, 18, 24, 32, 38, 42, 46, 40, 36, 24, 20, 18, 14, 10, 8, 6, 4, 3],
};

/** Receivables window shown on the mobile home (next 30 days). */
export const A_RECEBER = {
  total: 'R$ 5.000,00',
  window: '30 dias',
};

/** APY label used in the balance card pill. */
export const YIELD_APY_LABEL = '6% APY';

/** Recent transactions shown on the Resumo screen (top 5). */
export const RECENT_TX: Transaction[] = [
  { id: '10293', label: 'Pagamento via PIX', amount: 'R$ 259,90', status: 'success', when: 'Hoje, 14:32', accent: 'green', kind: 'pix' },
  { id: '10292', label: 'Pagamento via PIX', amount: 'R$ 189,00', status: 'success', when: 'Hoje, 11:07', accent: 'purple', kind: 'pix' },
  { id: '10291', label: 'Pagamento via PIX', amount: 'R$ 350,00', status: 'success', when: 'Ontem, 18:45', accent: 'green', kind: 'pix' },
  { id: '10290', label: 'Pagamento via PIX', amount: 'R$ 120,00', status: 'success', when: 'Ontem, 16:22', accent: 'purple', kind: 'pix' },
  { id: '10289', label: 'Pagamento via PIX', amount: 'R$ 230,00', status: 'success', when: 'Ontem, 13:10', accent: 'green', kind: 'pix' },
];

/** Full transaction list shown on the Transações screen. */
export const ALL_TX: Transaction[] = [
  ...RECENT_TX,
  { id: '10288', label: 'Pagamento via PIX', amount: 'R$ 450,00', status: 'success', when: 'Ontem, 09:14', accent: 'green', kind: 'pix' },
  { id: '10287', label: 'Pagamento via PIX', amount: 'R$ 89,00', status: 'pending', when: '2 dias atrás', accent: 'purple', kind: 'pix' },
  { id: '10286', label: 'Pagamento via PIX', amount: 'R$ 199,90', status: 'success', when: '2 dias atrás', accent: 'green', kind: 'pix' },
  { id: '10285', label: 'Reembolso enviado', amount: '- R$ 49,90', status: 'danger', when: '3 dias atrás', accent: 'purple', kind: 'refund' },
  { id: '10284', label: 'Pagamento via PIX', amount: 'R$ 720,00', status: 'success', when: '3 dias atrás', accent: 'green', kind: 'pix' },
  { id: '10283', label: 'Pagamento via PIX', amount: 'R$ 134,50', status: 'success', when: '4 dias atrás', accent: 'green', kind: 'pix' },
];

/** Saved payment links shown on Recebimentos. */
export const PAYMENT_LINKS: PaymentLink[] = [
  { name: 'Camisa Edição Limitada', amount: 'R$ 159,00', uses: 24, url: 'kiro.pay/q/Ax7m2' },
  { name: 'Hambúrguer + Refri', amount: 'R$ 35,90', uses: 142, url: 'kiro.pay/q/B9pLk' },
  { name: 'Mensalidade', amount: 'R$ 89,00', uses: 8, url: 'kiro.pay/q/C3vDe' },
];

/** Sidebar nav. The first three have built screens; the rest fall back to placeholders. */
export const NAV_ITEMS: NavItem[] = [
  { id: 'resumo', label: 'Resumo', icon: 'House', to: '/resumo' },
  { id: 'transacoes', label: 'Transações', icon: 'ArrowLeftRight', to: '/transacoes' },
  { id: 'recebimentos', label: 'Recebimentos', icon: 'QrCode', to: '/recebimentos' },
  { id: 'extrato', label: 'Extrato', icon: 'ReceiptText', to: '/extrato' },
  // { id: 'links', label: 'Links de Pagamento', icon: 'Link2', to: '/links' },
  // { id: 'clientes', label: 'Clientes', icon: 'Users', to: '/clientes' },
  // { id: 'relatorios', label: 'Relatórios', icon: 'BarChart3', to: '/relatorios' },
  // { id: 'integracoes', label: 'Integrações', icon: 'Puzzle', to: '/integracoes' },
  { id: 'config', label: 'Configurações', icon: 'Settings', to: '/config' },
];

/** Top tabs (header) — a subset of the sidebar. */
export const TOP_TABS: { id: NavItem['id']; label: string; to: string }[] = [
  { id: 'resumo', label: 'Resumo', to: '/resumo' },
  { id: 'transacoes', label: 'Transações', to: '/transacoes' },
  { id: 'recebimentos', label: 'Recebimentos', to: '/recebimentos' },
  { id: 'extrato', label: 'Extrato', to: '/extrato' },
  { id: 'config', label: 'Configurações', to: '/config' },
];
