import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-toastify';
import bitcore from 'bitcore-lib-cash';
import { Bitcoin, SearchIcon, TrendingUp, ArrowUpRight, ArrowDownLeft, RotateCcw, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { FiCheckCircle } from 'react-icons/fi';
import QRCode from 'react-qr-code';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

import { useNotification } from '../../../context/NotificationContext';

// --- Configuration ---
const API_BASE_URL = 'http://localhost:3000/api';
const WEBSOCKET_URL = 'http://localhost:3000';
const BCH_EXPLORER_TX_URL = 'https://explorer.bitcoinabc.org/tx/';
const SATOSHIS_PER_BCH = 1e8;
const estimatedFeeClientSide = 0.00000220;

// --- Types ---
type Transaction = {
  _id: string;
  type: 'received' | 'sent' | 'unknown' | 'self';
  amountBCH: number;
  amountBRL: number;
  address: string;
  txid: string;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'error';
  confirmations: number;
  blockHeight?: number;
  fee?: number;
  errorMessage?: string;
};

type WalletBalance = {
  totalBCH: number;
  availableBCH: number;
  pendingBCH: number;
  totalBRL: number;
  totalSatoshis: number;
  currentRateBRL?: number;
};

// Mock data for activity charts
const activityDataToday = [
  { hour: '08h', received: 0.002, sent: 0.001 },
  { hour: '10h', received: 0.001, sent: 0.000 },
  { hour: '12h', received: 0.0015, sent: 0.0005 },
  { hour: '14h', received: 0.003, sent: 0.002 },
  { hour: '16h', received: 0.0025, sent: 0.0015 },
  { hour: '18h', received: 0.001, sent: 0.001 },
  { hour: '20h', received: 0.0005, sent: 0.0025 },
];
const activityDataWeek = [
  { day: 'Seg', received: 0.02, sent: 0.01 },
  { day: 'Ter', received: 0.01, sent: 0.00 },
  { day: 'Qua', received: 0.015, sent: 0.005 },
  { day: 'Qui', received: 0.03, sent: 0.02 },
  { day: 'Sex', received: 0.025, sent: 0.015 },
  { day: 'Sáb', received: 0.01, sent: 0.01 },
  { day: 'Dom', received: 0.005, sent: 0.025 },
];
const activityDataMonth = [
  { week: '1ª', received: 0.08, sent: 0.04 },
  { week: '2ª', received: 0.06, sent: 0.03 },
  { week: '3ª', received: 0.09, sent: 0.05 },
  { week: '4ª', received: 0.07, sent: 0.06 },
];

export function WalletTab() {
  const { addNotification } = useNotification();
  const [balance, setBalance] = useState<WalletBalance>({ totalBCH: 0, availableBCH: 0, pendingBCH: 0, totalBRL: 0, totalSatoshis: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [sendModalOpen, setSendModalOpen] = useState<boolean>(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState<boolean>(false);
  const [sendForm, setSendForm] = useState({ address: '', amountBCH: '', amountBRL: '', fee: 'medium' as 'low' | 'medium' | 'high' });
  const [isSending, setIsSending] = useState<boolean>(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSent, setLastSent] = useState<{ address: string; amount: string; amountBRL: string } | null>(null);
  const [balanceVisible, setBalanceVisible] = useState(true);

  // UI state
  const [activeTab, setActiveTab] = useState<'tokens' | 'nft' | 'activity'>('tokens');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activityPeriod, setActivityPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [viewMode, setViewMode] = useState<'transactions' | 'analysis'>('transactions');

  const fetchWalletData = useCallback(async () => {
    if (!isInitialized) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token');
    if (!token) {
      setError("Usuário não autenticado.");
      setLoading(false);
      return;
    }

    try {
      const [balRes, txRes] = await Promise.all([
        fetch(`${API_BASE_URL}/wallet/balance`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/wallet/transactions`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (!balRes.ok) throw new Error('Erro ao buscar saldo.');
      const fetchedBalance: WalletBalance = await balRes.json();
      setBalance(fetchedBalance);

      if (!txRes.ok) throw new Error('Erro ao buscar transações.');
      const fetchedTxs: Transaction[] = await txRes.json();
      fetchedTxs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTransactions(fetchedTxs);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Token não encontrado.');
        const res = await fetch(`${API_BASE_URL}/wallet/address`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('Falha ao buscar endereço.');
        const d = await res.json();
        if (!d.address) throw new Error('Endereço não retornado.');
        setWalletAddress(d.address);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsInitialized(true);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (isInitialized) {
      fetchWalletData();
    }
  }, [isInitialized, fetchWalletData]);

  useEffect(() => {
    if (!isInitialized) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    let newSocket: Socket | null = null;

    try {
      newSocket = io(WEBSOCKET_URL, {
        auth: { token },
        reconnectionAttempts: 5,
        transports: ['websocket']
      });

      newSocket.on('connect', () => {
        setSocket(newSocket);
        setError(null);
      });

      newSocket.on('disconnect', () => {
        setSocket(null);
        setError("Desconectado do servidor de atualizações.");
      });

      newSocket.on('walletDataUpdate', (data: { balance: WalletBalance, transactions: Transaction[] }) => {
        if (data && data.balance && Array.isArray(data.transactions)) {
          setBalance(data.balance);
          const sorted = [...data.transactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setTransactions(sorted);
          setLoading(false);
          setError(null);
        } else {
          fetchWalletData();
        }
      });

      setSocket(newSocket);

    } catch {
      setError("Falha ao iniciar conexão para atualizações.");
    }

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
      setSocket(null);
    };
  }, [isInitialized, fetchWalletData]);

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountToSendNum = parseFloat(sendForm.amountBCH || '0');
    setIsSending(true);
    setError(null);

    if (amountToSendNum <= 0) {
      setError('Quantidade inválida.');
      setIsSending(false);
      return;
    }

    setTimeout(() => {
      setLastSent({ address: sendForm.address, amount: sendForm.amountBCH, amountBRL: sendForm.amountBRL });
      setSendModalOpen(false);
      setShowSuccessModal(true);
      setSendForm({ address: '', amountBCH: '', amountBRL: '', fee: 'medium' });
      setIsSending(false);
    }, 1000);
  };

  let chartData: any[] = [];
  let xKey = '';
  if (activityPeriod === 'today') {
    chartData = activityDataToday;
    xKey = 'hour';
  } else if (activityPeriod === 'week') {
    chartData = activityDataWeek;
    xKey = 'day';
  } else {
    chartData = activityDataMonth;
    xKey = 'week';
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#24292D] to-[#1E2328] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
      

        {/* Balance Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-8 mb-8 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent"></div>
          <div className="absolute top-0 right-0 w-64 h-64 opacity-10">
            <Bitcoin size={256} className="text-white" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-emerald-100 text-sm font-medium mb-1">Saldo Total Disponível</p>
                <div className="flex items-center">
                  
                  <div className="flex items-center gap-2">
                    {balanceVisible ? (
                      <h2 className="text-4xl font-bold text-white">0.1827 BCH</h2>
                    ) : (
                      <h2 className="text-4xl font-bold text-white">••••••••</h2>
                    )}
                    <button
                      onClick={() => setBalanceVisible(!balanceVisible)}
                      className="text-white/80 hover:text-white transition-colors"
                    >
                      {balanceVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>
                  </div>
                </div>
                {balanceVisible ? (
                  <p className="text-emerald-100 text-xl font-semibold">R$ 215.45</p>
                ) : (
                  <p className="text-emerald-100 text-xl font-semibold">R$ ••••••</p>
                )}
              </div>
              
              <div className="text-right">
                <div className="flex items-center gap-2 text-emerald-100 mb-2">
                  <TrendingUp size={16} />
                  <span className="text-sm">+2.3% hoje</span>
                </div>
                <p className="text-emerald-200 text-xs">Última atualização: agora</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-6">
              <div className="flex flex-col items-center group">
                <button
                  className="flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl text-white transition-all duration-300 hover:bg-white/20 hover:scale-110 hover:shadow-lg border border-white/20"
                  onClick={() => setSendModalOpen(true)}
                >
                  <ArrowUpRight size={24} />
                </button>
                <span className="text-sm mt-2 text-emerald-100 group-hover:text-white transition-colors">Enviar</span>
              </div>
              
              <div className="flex flex-col items-center group">
                <button
                  className="flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl text-white transition-all duration-300 hover:bg-white/20 hover:scale-110 hover:shadow-lg border border-white/20"
                  onClick={() => setReceiveModalOpen(true)}
                >
                  <ArrowDownLeft size={24} />
                </button>
                <span className="text-sm mt-2 text-emerald-100 group-hover:text-white transition-colors">Receber</span>
              </div>
              
              <div className="flex flex-col items-center group">
                <button className="flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl text-white transition-all duration-300 hover:bg-white/20 hover:scale-110 hover:shadow-lg border border-white/20">
                  <RotateCcw size={24} />
                </button>
                <span className="text-sm mt-2 text-emerald-100 group-hover:text-white transition-colors">Trocar</span>
              </div>
              
              <div className="flex flex-col items-center group">
                <button className="flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl text-white transition-all duration-300 hover:bg-white/20 hover:scale-110 hover:shadow-lg border border-white/20">
                  <RefreshCw size={24} />
                </button>
                <span className="text-sm mt-2 text-emerald-100 group-hover:text-white transition-colors">Converter</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-[#2F363E]/60 backdrop-blur-sm rounded-2xl p-1.5 border border-[#3A414A]/50">
            <button
              onClick={() => setViewMode('transactions')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                viewMode === 'transactions' 
                  ? 'bg-teal-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-[#3A414A]/50'
              }`}
            >
              Transações
            </button>
            <button
              onClick={() => setViewMode('analysis')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                viewMode === 'analysis' 
                  ? 'bg-teal-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-[#3A414A]/50'
              }`}
            >
              Análise
            </button>
          </div>
        </div>

        {/* Content */}
        {viewMode === 'transactions' && (
          <div className="bg-[#2F363E]/60 backdrop-blur-sm rounded-3xl border border-[#3A414A]/50 overflow-hidden shadow-xl">
            {/* Filters */}
            <div className="p-6 border-b border-[#3A414A]/50">
              <div className="flex flex-col lg:flex-row gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                  <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Pesquisar transações..."
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#24292D] border border-[#3A414A] text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-gray-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="flex gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-3 rounded-xl bg-[#24292D] border border-[#3A414A] text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="all">Todos Status</option>
                    <option value="confirmed">Confirmadas</option>
                    <option value="pending">Pendentes</option>
                    <option value="cancelled">Canceladas</option>
                  </select>
                  
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-4 py-3 rounded-xl bg-[#24292D] border border-[#3A414A] text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="all">Todas Categorias</option>
                    <option value="sent">Enviadas</option>
                    <option value="received">Recebidas</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#24292D]/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Transação</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Data</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Quantidade</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-400">
                        <div className="flex flex-col items-center gap-2">
                          <Bitcoin size={48} className="opacity-50" />
                          <p>Nenhuma transação encontrada</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx, index) => (
                      <tr
                        key={tx.txid}
                        className="border-b border-[#3A414A]/50 hover:bg-[#3A414A]/30 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                tx.type === 'received' 
                                  ? 'bg-green-500/20 text-green-400' 
                                  : tx.type === 'sent' 
                                  ? 'bg-red-500/20 text-red-400' 
                                  : 'bg-blue-500/20 text-blue-400'
                              }`}
                            >
                              {tx.type === 'received' ? (
                                <ArrowDownLeft size={20} />
                              ) : tx.type === 'sent' ? (
                                <ArrowUpRight size={20} />
                              ) : (
                                <RotateCcw size={20} />
                              )}
                            </div>
                            <div>
                              <p className="text-white font-medium">
                                {tx.type === 'received' ? 'Recebido' : tx.type === 'sent' ? 'Enviado' : 'Transferência'}
                              </p>
                              <p className="text-gray-300 text-sm">
                                {tx.address.slice(0, 6)}...{tx.address.slice(-6)}
                              </p>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 text-gray-200">
                          {new Date(tx.timestamp).toLocaleDateString('pt-BR')}
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="text-white font-medium">
                            {tx.amountBCH.toFixed(8)} BCH
                          </div>
                          <div className="text-gray-300 text-sm">
                            R$ {tx.amountBRL.toFixed(2)}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              tx.status === 'confirmed'
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : tx.status === 'pending'
                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {tx.status === 'confirmed' ? 'Confirmado' : tx.status === 'pending' ? 'Pendente' : 'Erro'}
                          </span>
                        </td>
                        
                        <td className="px-6 py-4">
                          <a
                            href={`${BCH_EXPLORER_TX_URL}${tx.txid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-teal-600/20 text-teal-400 rounded-lg  font-medium hover:bg-teal-600/30 transition-colors border border-teal-500/30"
                          >
                            Detalhes
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewMode === 'analysis' && (
          <div className="bg-[#2F363E]/60 backdrop-blur-sm rounded-3xl border border-[#3A414A]/50 p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-white">Análise de Atividade</h3>
              
              <div className="flex gap-2 bg-[#24292D]/70 rounded-xl p-1">
                {(['today', 'week', 'month'] as const).map((period) => (
                  <button
                    key={period}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      activityPeriod === period
                        ? 'bg-teal-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-[#3A414A]/50'
                    }`}
                    onClick={() => setActivityPeriod(period)}
                  >
                    {period === 'today' ? 'Hoje' : period === 'week' ? 'Semana' : 'Mês'}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-80 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="receivedGradientArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#14B8A6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="sentGradientArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey={xKey} 
                    stroke="#4A5568" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ 
                      background: "#24292D", 
                      border: "1px solid #3A414A", 
                      borderRadius: "12px",
                      color: "#e5e7eb" 
                    }}
                    labelStyle={{ color: "#14B8A6", fontWeight: "bold" }}
                    formatter={(value: number, name: string) =>
                      [`${value} BCH`, name === "received" ? "Recebido" : "Enviado"]
                    }
                  />
                  <Area 
                    type="monotone" 
                    dataKey="received" 
                    stroke="#14B8A6" 
                    strokeWidth={2}
                    fill="url(#receivedGradientArea)"
                    name="Recebido" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="sent" 
                    stroke="#F43F5E" 
                    strokeWidth={2}
                    fill="url(#sentGradientArea)"
                    name="Enviado" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#24292D]/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDownLeft className="text-green-400" size={20} />
                  <span className="text-gray-200 text-sm">Total Recebido</span>
                </div>
                <p className="text-2xl font-bold text-white">0.0456 BCH</p>
                <p className="text-green-300 text-sm">+12.5% vs período anterior</p> {/* Adjusted green for consistency if needed */}
              </div>
              
              <div className="bg-[#24292D]/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpRight className="text-red-400" size={20} />
                  <span className="text-gray-200 text-sm">Total Enviado</span>
                </div>
                <p className="text-2xl font-bold text-white">0.0123 BCH</p>
                <p className="text-red-300 text-sm">-5.3% vs período anterior</p> {/* Adjusted red for consistency if needed */}
              </div>
              
              <div className="bg-[#24292D]/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="text-blue-400" size={20} />
                  <span className="text-gray-200 text-sm">Saldo Líquido</span>
                </div>
                <p className="text-2xl font-bold text-white">+0.0333 BCH</p>
                <p className="text-blue-300 text-sm">+18.2% vs período anterior</p> {/* Adjusted blue for consistency if needed */}
              </div>
            </div>
          </div>
        )}

        {/* Send Modal */}
        {sendModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#2F363E] rounded-2xl w-full max-w-md shadow-2xl relative border border-[#3A414A]/70">
              <button
                className="absolute top-4 right-6 text-gray-400 hover:text-white text-2xl transition-colors"
                onClick={() => setSendModalOpen(false)}
              >
                ×
              </button>
              
              <div className="p-6 border-b border-[#3A414A]/70">
                <h2 className="text-xl font-semibold text-white mb-2">Enviar BCH</h2>
                <p className="text-gray-300 text-sm">Transfira Bitcoin Cash para outro endereço</p>
              </div>
              
              <form onSubmit={handleSendSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Destinatário</label>
                  <input
                    type="text"
                    placeholder="Digite o endereço BCH"
                    className="w-full px-4 py-3 rounded-xl bg-[#24292D] border border-[#3A414A] text-white focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder-gray-400"
                    value={sendForm.address}
                    onChange={e => setSendForm(f => ({ ...f, address: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Quantidade</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="0.00"
                      className="px-4 py-3 rounded-xl bg-[#24292D] border border-[#3A414A] text-white focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder-gray-400"
                      value={sendForm.amountBRL}
                      onChange={e => setSendForm(f => ({ ...f, amountBRL: e.target.value }))}
                      min="0"
                      step="any"
                    />
                    <input
                      type="number"
                      placeholder="0.00000000"
                      className="px-4 py-3 rounded-xl bg-[#24292D] border border-[#3A414A] text-white focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder-gray-400"
                      value={sendForm.amountBCH}
                      onChange={e => setSendForm(f => ({ ...f, amountBCH: e.target.value }))}
                      min="0"
                      step="any"
                      required
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-300 mt-1">
                    <span>BRL</span>
                    <span>BCH</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Taxa de Rede</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl bg-[#24292D] border border-[#3A414A] text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={sendForm.fee}
                    onChange={e => setSendForm(f => ({ ...f, fee: e.target.value as 'low' | 'medium' | 'high' }))}
                  >
                    <option value="low">Baixa (mais lenta)</option>
                    <option value="medium">Média (recomendada)</option>
                    <option value="high">Alta (mais rápida)</option>
                  </select>
                </div>
                
                <div className="bg-[#24292D]/50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-200">
                    <span>Taxa de Rede</span>
                    <span>{estimatedFeeClientSide.toFixed(8)} BCH</span>
                  </div>
                  <div className="flex justify-between text-white font-medium">
                    <span>Total</span>
                    <span>{(parseFloat(sendForm.amountBCH || '0') + estimatedFeeClientSide).toFixed(8)} BCH</span>
                  </div>
                </div>
                
                <button
                  type="submit"
                  className="w-full bg-teal-600 text-white rounded-xl py-3 font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSending}
                >
                  {isSending ? 'Enviando...' : 'Enviar Transação'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Receive Modal */}
        {receiveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#2F363E] rounded-2xl w-full max-w-md shadow-2xl relative border border-[#3A414A]/70">
              <button
                className="absolute top-4 right-6 text-gray-400 hover:text-white text-2xl transition-colors"
                onClick={() => setReceiveModalOpen(false)}
              >
                ×
              </button>
              
              <div className="p-6 border-b border-[#3A414A]/70">
                <h2 className="text-xl font-semibold text-white mb-2">Receber BCH</h2>
                <p className="text-gray-300 text-sm">Compartilhe este endereço para receber Bitcoin Cash</p>
              </div>
              
              <div className="p-6 text-center space-y-6">
                <div className="bg-white p-4 rounded-2xl inline-block">
                  <QRCode value={walletAddress || ''} size={200} />
                </div>
                
                <div>
                  <p className="text-teal-400 font-medium mb-2">Seu Endereço BCH</p>
                  <div className="bg-[#24292D]/70 rounded-xl p-4 border border-[#3A414A]/70">
                    <p className="text-white text-sm font-mono break-all mb-3">
                      {walletAddress}
                    </p>
                    <button
                      className="w-full bg-teal-600 text-white rounded-lg py-2 font-medium hover:bg-teal-700 transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(walletAddress);
                        setIsCopied(true);
                        toast.success("Endereço copiado!");
                        setTimeout(() => setIsCopied(false), 1500);
                      }}
                    >
                      {isCopied ? 'Copiado!' : 'Copiar Endereço'}
                    </button>
                  </div>
                </div>
                
                <button
                  className="w-full bg-[#3A414A] text-white rounded-xl py-3 font-medium hover:bg-[#4A5568] transition-colors border border-[#4A5568]/70"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: 'Meu Endereço BCH', text: walletAddress }).catch(err => toast.error("Não foi possível compartilhar."));
                    }
                  }}
                >
                  Compartilhar Endereço
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal */}
        {showSuccessModal && lastSent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#2F363E] rounded-2xl w-full max-w-lg shadow-2xl relative border border-[#3A414A]/70">
              <button
                className="absolute top-4 right-6 text-gray-400 hover:text-white text-2xl transition-colors"
                onClick={() => setShowSuccessModal(false)}
              >
                ×
              </button>
              
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-teal-600/20 border-2 border-teal-500/50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FiCheckCircle className="w-10 h-10 text-teal-400" />
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-2">Transação Enviada!</h3>
                <p className="text-gray-300 mb-6">
                  Você enviou <span className="font-medium text-teal-400">{parseFloat(lastSent.amount).toFixed(4)} BCH</span> com sucesso.
                </p>
                
                <div className="bg-[#24292D]/50 rounded-xl p-4 mb-6 space-y-2 text-sm border border-[#3A414A]/50">
                  <div className="flex justify-between text-gray-200">
                    <span>Valor Enviado</span>
                    <span>{lastSent.amount} BCH</span>
                  </div>
                  <div className="flex justify-between text-gray-200">
                    <span>Taxa de Rede</span>
                    <span>{estimatedFeeClientSide.toFixed(8)} BCH</span>
                  </div>
                  <div className="flex justify-between text-white font-medium border-t border-[#3A414A]/70 pt-2">
                    <span>Total</span>
                    <span>{(parseFloat(lastSent.amount) + estimatedFeeClientSide).toFixed(8)} BCH</span>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    className="flex-1 bg-teal-600 text-white rounded-xl py-3 font-medium hover:bg-teal-700 transition-colors"
                    onClick={() => setShowSuccessModal(false)}
                  >
                    Continuar
                  </button>
                  <button
                    onClick={() => { /* Logic to open explorer */ toast.info("Explorer link would open here.");}}
                    className="flex-1 bg-[#3A414A] text-white rounded-xl py-3 font-medium hover:bg-[#4A5568] transition-colors border border-[#4A5568]/70"
                  >
                    Ver Detalhes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
