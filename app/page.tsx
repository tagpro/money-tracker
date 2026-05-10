'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Transaction, InterestRate } from '@/lib/types';
import { useSession, signOut } from '@/lib/auth/client';

function getLocalDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  const [transactionDate, setTransactionDate] = useState(getLocalDateString);
  const [transactionDescription, setTransactionDescription] = useState('');

  // Interest rate form state
  const [newRate, setNewRate] = useState('');
  const [rateEffectiveDate, setRateEffectiveDate] = useState(getLocalDateString);

  // Balance date
  const [balanceDate, setBalanceDate] = useState(getLocalDateString);

  // Re-calculate interest state
  const [showRecalcModal, setShowRecalcModal] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<Array<{
    date: string;
    month: string;
    expected: number;
    actual: number | null;
    existingTransactionId: number | null;
    action: 'update' | 'insert' | 'delete';
  }>>([]);
  const [recalcLoading, setRecalcLoading] = useState(false);

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session) {
      // Auto-accrue interest on load (idempotent, safe to call repeatedly)
      fetch('/api/accrue-interest', { method: 'POST' })
        .catch(() => {}) // fire-and-forget, errors are non-critical
        .finally(() => fetchData());
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

  async function handleRecalculate() {
    setRecalcLoading(true);
    try {
      const res = await fetch('/api/accrue-interest');
      const data = await res.json();

      if (data.allCorrect) {
        alert(`All interest calculations are correct! Current month accrued: $${data.currentMonthAccrued.toFixed(2)}`);
      } else {
        setDiscrepancies(data.discrepancies);
        setShowRecalcModal(true);
      }
    } catch (error) {
      console.error('Error verifying interest:', error);
      alert('Failed to verify interest');
    } finally {
      setRecalcLoading(false);
    }
  }

  async function handleApplyCorrections() {
    try {
      const res = await fetch('/api/accrue-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply' }),
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message);
        setShowRecalcModal(false);
        setDiscrepancies([]);
        fetchData();
      } else {
        alert('Error: ' + (data.error || 'Failed to apply corrections'));
      }
    } catch (error) {
      console.error('Error applying corrections:', error);
      alert('Failed to apply corrections');
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
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Loan Tracker</h1>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <a
              href="/invites"
              className="flex-1 sm:flex-none text-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm sm:text-base"
            >
              Manage Invites
            </a>
            <button
              onClick={handleRecalculate}
              disabled={recalcLoading}
              className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm sm:text-base"
              title="Verify and correct interest calculations"
            >
              {recalcLoading ? 'Checking...' : 'Re-calculate Interest'}
            </button>
            <button
              onClick={handleExport}
              className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm sm:text-base"
            >
              Export CSV
            </button>
            <button
              onClick={handleSignOut}
              className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm sm:text-base"
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
          
          {/* Mobile view: Cards */}
          <div className="md:hidden space-y-4">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="p-4 border border-gray-100 rounded-lg bg-gray-50 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-gray-500">
                    {new Date(transaction.date).toLocaleDateString()}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      transaction.type === 'deposit'
                        ? 'bg-green-100 text-green-800'
                        : transaction.type === 'withdrawal'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {transaction.type}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <div className="text-sm text-gray-600 max-w-[60%] truncate">
                    {transaction.description || '-'}
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    ${transaction.amount.toFixed(2)}
                  </div>
                </div>
                {transaction.type !== 'interest' && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => handleDeleteTransaction(transaction.id!)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop view: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-gray-700">Type</th>
                  <th className="text-left py-3 px-4 text-gray-700">Description</th>
                  <th className="text-right py-3 px-4 text-gray-700">Amount</th>
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
                    <td className="py-3 px-4 text-gray-600">{transaction.description || '-'}</td>
                    <td className="py-3 px-4 text-right font-mono">
                      ${transaction.amount.toFixed(2)}
                    </td>
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
          </div>
          {transactions.length === 0 && (
            <div className="text-center py-8 text-gray-500">No transactions yet</div>
          )}
        </div>
      </div>

      {showRecalcModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Interest Discrepancies Found</h2>
            <p className="text-gray-600 mb-4">
              The following interest calculations differ from the recorded values:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-700">Month</th>
                    <th className="text-right py-2 px-3 text-gray-700">Expected</th>
                    <th className="text-right py-2 px-3 text-gray-700">Recorded</th>
                    <th className="text-right py-2 px-3 text-gray-700">Difference</th>
                    <th className="text-left py-2 px-3 text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {discrepancies.map((d) => (
                    <tr key={d.date} className="border-b border-gray-100">
                      <td className="py-2 px-3">{d.month}</td>
                      <td className="py-2 px-3 text-right font-mono">${d.expected.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono">
                        {d.actual !== null ? `$${d.actual.toFixed(2)}` : '\u2014'}
                      </td>
                      <td className={`py-2 px-3 text-right font-mono ${
                        (d.expected - (d.actual || 0)) > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(d.expected - (d.actual || 0)) > 0 ? '+' : ''}
                        ${(d.expected - (d.actual || 0)).toFixed(2)}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          d.action === 'insert'
                            ? 'bg-yellow-100 text-yellow-800'
                            : d.action === 'update'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {d.action === 'insert' ? 'Missing' : d.action === 'update' ? 'Incorrect' : 'Extra'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => setShowRecalcModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyCorrections}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Apply Corrections
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
