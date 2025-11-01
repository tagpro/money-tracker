export interface Transaction {
  id?: number;
  type: 'deposit' | 'withdrawal' | 'interest';
  amount: number;
  date: string;
  description?: string;
  created_at?: string;
}

export interface InterestRate {
  id?: number;
  rate: number;
  effective_date: string;
  created_at?: string;
}

export interface BalanceSnapshot {
  id?: number;
  date: string;
  balance: number;
  created_at?: string;
}

export interface CalculatedBalance {
  date: string;
  balance: number;
  principal: number;
  accruedInterest: number;
}
