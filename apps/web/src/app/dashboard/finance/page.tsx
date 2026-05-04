"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  Wallet,
  TrendingUp,
  Download,
  Filter,
  X,
  CreditCard
} from "lucide-react";
import Link from "next/link";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

type TransactionType = "Income" | "Expense";
type TransactionCategory = "Sales" | "Payroll" | "Materials" | "Logistics" | "Equipment" | "Software";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  status: "Completed" | "Pending";
}

const initialTransactions: Transaction[] = [
  { id: "TRX-8921", date: "2026-05-04", description: "B2B Sale - North America", amount: 145000, type: "Income", category: "Sales", status: "Completed" },
  { id: "TRX-8920", date: "2026-05-03", description: "Raw Aluminum Restock", amount: 28400, type: "Expense", category: "Materials", status: "Completed" },
  { id: "TRX-8919", date: "2026-05-01", description: "Factory Payroll Q2", amount: 84000, type: "Expense", category: "Payroll", status: "Completed" },
  { id: "TRX-8918", date: "2026-04-28", description: "Logistics Partner EU", amount: 12500, type: "Expense", category: "Logistics", status: "Pending" },
  { id: "TRX-8917", date: "2026-04-25", description: "Enterprise Software Licenses", amount: 5200, type: "Expense", category: "Software", status: "Completed" },
  { id: "TRX-8916", date: "2026-04-20", description: "B2B Sale - Asia Pacific", amount: 210000, type: "Income", category: "Sales", status: "Completed" },
];

const chartData = [
  { month: 'Jan', revenue: 400000, expenses: 240000 },
  { month: 'Feb', revenue: 450000, expenses: 280000 },
  { month: 'Mar', revenue: 520000, expenses: 310000 },
  { month: 'Apr', revenue: 480000, expenses: 290000 },
  { month: 'May', revenue: 355000, expenses: 125000 }, // Current partial month
];

export default function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTrx, setNewTrx] = useState<Partial<Transaction>>({
    type: "Income",
    category: "Sales",
    status: "Completed",
    date: new Date().toISOString().split('T')[0]
  });

  const totals = useMemo(() => {
    return transactions.reduce((acc, curr) => {
      if (curr.type === "Income") acc.income += curr.amount;
      else acc.expense += curr.amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [transactions]);

  const balance = totals.income - totals.expense;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trx: Transaction = {
      id: `TRX-${Math.floor(Math.random() * 9000) + 1000}`,
      date: newTrx.date as string,
      description: newTrx.description as string,
      amount: Number(newTrx.amount),
      type: newTrx.type as TransactionType,
      category: newTrx.category as TransactionCategory,
      status: newTrx.status as "Completed" | "Pending",
    };
    setTransactions([trx, ...transactions]);
    setIsModalOpen(false);
    setNewTrx({ type: "Income", category: "Sales", status: "Completed", date: new Date().toISOString().split('T')[0] });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] p-6 md:p-10 lg:p-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="p-3 bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-sm">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-1">Financial Ledger</h1>
            <p className="text-gray-500 dark:text-gray-400 font-light">Real-time Costing, Revenue & Cash Flow</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-3 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-medium hover:bg-white dark:hover:bg-white/5 transition-all flex items-center gap-2">
            <Download className="w-4 h-4" /> Export Report
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold shadow-xl shadow-black/10 dark:shadow-white/5 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Transaction
          </button>
        </div>
      </header>

      {/* Top Level KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 p-8 rounded-[2rem] shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 dark:bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-100 dark:group-hover:bg-blue-500/10 transition-all" />
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-2xl"><Wallet className="w-6 h-6" /></div>
            <h2 className="font-bold text-gray-500 dark:text-gray-400">Total Balance</h2>
          </div>
          <p className="text-5xl font-bold tracking-tighter mb-2">${balance.toLocaleString()}</p>
          <p className="text-xs font-medium text-green-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +12.5% from last month</p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 p-8 rounded-[2rem] shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 dark:bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/10 transition-all" />
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-2xl"><ArrowUpRight className="w-6 h-6" /></div>
            <h2 className="font-bold text-gray-500 dark:text-gray-400">Total Income</h2>
          </div>
          <p className="text-5xl font-bold tracking-tighter mb-2">${totals.income.toLocaleString()}</p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 p-8 rounded-[2rem] shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-50 dark:bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-100 dark:group-hover:bg-rose-500/10 transition-all" />
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 rounded-2xl"><ArrowDownRight className="w-6 h-6" /></div>
            <h2 className="font-bold text-gray-500 dark:text-gray-400">Total Expenses</h2>
          </div>
          <p className="text-5xl font-bold tracking-tighter mb-2">${totals.expense.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-[2rem] p-8 shadow-sm flex flex-col">
          <h2 className="font-bold text-xl mb-6">Cash Flow Overview</h2>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.2} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} tickFormatter={(v) => `$${v/1000}k`} dx={-10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                  formatter={(value: any) => [`$${Number(value).toLocaleString()}`, undefined]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-[2rem] flex flex-col shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/[0.02]">
            <h2 className="font-bold">Recent Ledger</h2>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"><Filter className="w-4 h-4 text-gray-500" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <AnimatePresence>
              {transactions.map((trx, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={trx.id}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-white/5 rounded-2xl transition-colors cursor-pointer group"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${trx.type === 'Income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10'}`}>
                    {trx.type === 'Income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm truncate">{trx.description}</h4>
                    <p className="text-[10px] text-gray-500 font-medium mt-0.5">{trx.category} • {trx.date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold ${trx.type === 'Income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {trx.type === 'Income' ? '+' : '-'}${trx.amount.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{trx.status}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#111] rounded-[2rem] p-8 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-white/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="w-6 h-6" /> Record Transaction</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Type</label>
                    <div className="flex bg-gray-50 dark:bg-white/5 rounded-xl p-1">
                      <button type="button" onClick={() => setNewTrx({...newTrx, type: "Income"})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${newTrx.type === "Income" ? 'bg-white dark:bg-[#222] shadow-sm text-emerald-500' : 'text-gray-500'}`}>Income</button>
                      <button type="button" onClick={() => setNewTrx({...newTrx, type: "Expense"})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${newTrx.type === "Expense" ? 'bg-white dark:bg-[#222] shadow-sm text-rose-500' : 'text-gray-500'}`}>Expense</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Amount ($)</label>
                    <input 
                      type="number" required min="0" step="0.01"
                      value={newTrx.amount || ''} 
                      onChange={e => setNewTrx({...newTrx, amount: Number(e.target.value)})}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Description</label>
                  <input 
                    type="text" required 
                    value={newTrx.description || ''} 
                    onChange={e => setNewTrx({...newTrx, description: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                    placeholder="E.g. Raw materials purchase"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Category</label>
                    <select 
                      value={newTrx.category || 'Sales'} 
                      onChange={e => setNewTrx({...newTrx, category: e.target.value as TransactionCategory})}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                    >
                      <option value="Sales">Sales & Revenue</option>
                      <option value="Payroll">Payroll</option>
                      <option value="Materials">Materials & Supplies</option>
                      <option value="Logistics">Logistics</option>
                      <option value="Equipment">Equipment</option>
                      <option value="Software">Software & IT</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Date</label>
                    <input 
                      type="date" required 
                      value={newTrx.date || ''} 
                      onChange={e => setNewTrx({...newTrx, date: e.target.value})}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                    />
                  </div>
                </div>
                
                <button type="submit" className="w-full py-4 mt-4 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all">
                  <Plus className="w-4 h-4" /> Add Transaction
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
