'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Transaction, InterestRate } from '@/lib/types';
import { useSession, signOut } from '@/lib/auth/client';

export default function Home() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [interestRates, setInterestRates] = useState<InterestRate[]>([]);
  const [balance, setBalance] = useState({ balance: 0, principal: 0, accruedInterest: 0 });
  const [loading, setLoading] = useState(true);

  // Transaction form state
  const [transactionType, setTransactionType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [transactionDescription, setTransactionDescription] = useState('');

  // Interest rate form state
  const [newRate, setNewRate] = useState('');
  const [rateEffectiveDate, setRateEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

  // Balance date
  const [balanceDate, setBalanceDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchBalance();
    }
  }, [balanceDate, transactions, interestRates, session]);

  async function fetchData() {
    try {
      setLoading(true);
      const [txRes, ratesRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/interest-rates'),
      ]);

      const txData = await txRes.json();
      const ratesData = await ratesRes.json();

      setTransactions(txData);
      setInterestRates(ratesData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchBalance() {
    try {
      const res = await fetch(`/api/balance?date=${balanceDate}`);
      const data = await res.json();
      setBalance(data);
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: transactionType,
          amount: parseFloat(transactionAmount),
          date: transactionDate,
          description: transactionDescription,
        }),
      });

      if (res.ok) {
        setTransactionAmount('');
        setTransactionDescription('');
        fetchData();
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
    }
  }

  async function handleAddInterestRate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/interest-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rate: parseFloat(newRate),
          effective_date: rateEffectiveDate,
        }),
      });

      if (res.ok) {
        setNewRate('');
        fetchData();
      }
    } catch (error) {
      console.error('Error adding interest rate:', error);
    }
  }

  async function handleDeleteTransaction(id: number) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      const res = await fetch(`/api/transactions?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  }

  async function handleDeleteRate(id: number) {
    if (!confirm('Are you sure you want to delete this interest rate?')) return;
    try {
      const res = await fetch(`/api/interest-rates?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting interest rate:', error);
    }
  }

  async function handleExport() {
    try {
      const res = await fetch('/api/export');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loan-tracker-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  }

  async function handleAccrueInterest() {
    if (!confirm('This will add interest transactions to your history for all past months. Continue?')) {
      return;
    }
    
    try {
      const res = await fetch('/api/accrue-interest', {
        method: 'POST',
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert(data.message);
        fetchData(); // Refresh data
      } else {
        alert('Error: ' + (data.error || 'Failed to accrue interest'));
      }
    } catch (error) {
      console.error('Error accruing interest:', error);
      alert('Failed to accrue interest');
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  if (isPending || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Loan Tracker</h1>
          <div className="flex gap-2">
            <a
              href="/invites"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              Manage Invites
            </a>
            <button
              onClick={handleAccrueInterest}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              title="Add monthly interest to transaction history"
            >
              Accrue Interest
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Export CSV
            </button>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="mb-4 text-sm text-gray-600">
          Signed in as: {session.user.email}
        </div>

        {/* Balance Display */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-2xl font-semibold text-gray-900">Current Balance</h2>
            <input
              type="date"
              value={balanceDate}
              onChange={(e) => setBalanceDate(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Total Balance</div>
              <div className="text-3xl font-bold text-blue-600">
                ${balance.balance.toFixed(2)}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Principal</div>
              <div className="text-3xl font-bold text-green-600">
                ${balance.principal.toFixed(2)}
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Accrued Interest</div>
              <div className="text-3xl font-bold text-purple-600">
                ${balance.accruedInterest.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Add Transaction */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900">Add Transaction</h2>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value as 'deposit' | 'withdrawal')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="deposit">Deposit</option>
                  <option value="withdrawal">Withdrawal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={transactionAmount}
                  onChange={(e) => setTransactionAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={transactionDescription}
                  onChange={(e) => setTransactionDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Add Transaction
              </button>
            </form>
          </div>

          {/* Add Interest Rate */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900">Set Interest Rate</h2>
            <form onSubmit={handleAddInterestRate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Annual Interest Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Effective Date
                </label>
                <input
                  type="date"
                  value={rateEffectiveDate}
                  onChange={(e) => setRateEffectiveDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                Set Interest Rate
              </button>
            </form>

            {/* Current Interest Rates */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2 text-gray-900">Interest Rate History</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {interestRates.map((rate) => (
                  <div
                    key={rate.id}
                    className="flex justify-between items-center p-2 bg-gray-50 rounded"
                  >
                    <span className="text-sm">
                      {rate.rate}% from {rate.effective_date}
                    </span>
                    <button
                      onClick={() => handleDeleteRate(rate.id!)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900">Transaction History</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-gray-700">Type</th>
                  <th className="text-right py-3 px-4 text-gray-700">Amount</th>
                  <th className="text-left py-3 px-4 text-gray-700">Description</th>
                  <th className="text-right py-3 px-4 text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          transaction.type === 'deposit'
                            ? 'bg-green-100 text-green-800'
                            : transaction.type === 'withdrawal'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {transaction.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      ${transaction.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{transaction.description || '-'}</td>
                    <td className="py-3 px-4 text-right">
                      {transaction.type !== 'interest' && (
                        <button
                          onClick={() => handleDeleteTransaction(transaction.id!)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length === 0 && (
              <div className="text-center py-8 text-gray-500">No transactions yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
