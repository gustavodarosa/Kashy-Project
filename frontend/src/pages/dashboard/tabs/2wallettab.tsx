// src/pages/dashboard/tabs/2wallettab.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-toastify';
import bitcore from 'bitcore-lib-cash';
import { Bitcoin, SearchIcon, TrendingUp, ArrowUp ,ChevronLeft, ChevronRight, ArrowDown, RotateCcw, RefreshCw, Eye, EyeOff, Copy as CopyLucide, Code as CodeLucide, Clock as ClockLucide, CheckCircle as CheckCircleLucide } from 'lucide-react';
import { FiCheckCircle } from 'react-icons/fi'; // Kept for success modal, can be replaced
import QRCode from 'react-qr-code';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Listbox } from '@headlessui/react';

import { useNotification } from '../../../context/NotificationContext';

// --- Configuration ---
const API_BASE_URL = 'http://localhost:3000/api';
const WEBSOCKET_URL = 'http://localhost:3000';
const BCH_EXPLORER_TX_URL = 'https://explorer.bitcoinabc.org/tx/';
const SATOSHIS_PER_BCH = 1e8;
const estimatedFeeClientSide = 0.00000220; // Approx 220 sats (Used for optimistic UI and display)

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
  { hour: '08h', received: 0.002, sent: 0.001 }, { hour: '10h', received: 0.001, sent: 0.000 },
  { hour: '12h', received: 0.0015, sent: 0.0005 }, { hour: '14h', received: 0.003, sent: 0.002 },
  { hour: '16h', received: 0.0025, sent: 0.0015 }, { hour: '18h', received: 0.001, sent: 0.001 },
  { hour: '20h', received: 0.0005, sent: 0.0025 },
];
const activityDataWeek = [
  { day: 'Seg', received: 0.02, sent: 0.01 }, { day: 'Ter', received: 0.01, sent: 0.00 },
  { day: 'Qua', received: 0.015, sent: 0.005 }, { day: 'Qui', received: 0.03, sent: 0.02 },
  { day: 'Sex', received: 0.025, sent: 0.015 }, { day: 'Sáb', received: 0.01, sent: 0.01 },
  { day: 'Dom', received: 0.005, sent: 0.025 },
];
const activityDataMonth = [
  { week: '1ª', received: 0.08, sent: 0.04 }, { week: '2ª', received: 0.06, sent: 0.03 },
  { week: '3ª', received: 0.09, sent: 0.05 }, { week: '4ª', received: 0.07, sent: 0.06 },
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
  const [lastSent, setLastSent] = useState<{ address: string; amount: string; amountBRL: string; txid?: string } | null>(null);
  const [balanceVisible, setBalanceVisible] = useState(true);

  // UI state
  const [viewMode, setViewMode] = useState<'transactions' | 'analysis'>('transactions');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'confirmed', 'pending', 'error'
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all', 'sent', 'received'
  const [activityPeriod, setActivityPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(transactions.length / itemsPerPage);

  // --- Formatting Functions ---
  const formatCurrency = (value: number | undefined) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  const formatBCH = (value: number | undefined) => (Number(value) || 0).toFixed(8) + ' BCH';
  const formatDate = (dateString: string | undefined) => { if (!dateString) return 'N/A'; try { const d = new Date(dateString); return isNaN(d.getTime()) ? 'Inválida' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return 'Inválida'; } };
  const formatAddress = (address: string | undefined, length: number = 6): string => { if (!address || typeof address !== 'string' || address.length < length * 2 + 3) return address || 'N/A'; const clean = address.includes(':') ? address.split(':')[1] : address; if (!clean || clean.length < length * 2 + 3) return clean || address; return `${clean.substring(0, length)}...${clean.substring(clean.length - length)}`; };

  const fetchWalletData = useCallback(async () => {
    if (!isInitialized) {
      setLoading(false);
      return;
    }

    console.log(`[WalletTab] fetchWalletData called`);
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

      if (!balRes.ok) {
        const d = await balRes.json().catch(() => ({}));
        console.error(`[WalletTab] Balance fetch failed: ${balRes.status}`, d);
        throw new Error(`Erro ao buscar saldo: ${d.message || balRes.statusText}`);
      }
      const fetchedBalance: WalletBalance = await balRes.json();
      setBalance(fetchedBalance);

      if (!txRes.ok) {
        const d = await txRes.json().catch(() => ({}));
        console.error(`[WalletTab] Transactions fetch failed: ${txRes.status}`, d);
        throw new Error(`Erro ao buscar transações: ${d.message || txRes.statusText}`);
      }
      const fetchedTxs: Transaction[] = await txRes.json();
      fetchedTxs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTransactions(fetchedTxs);

    } catch (err: any) {
      console.error('[WalletTab] Error fetchWalletData:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);

  useEffect(() => {
    const init = async () => {
      console.log('[WalletTab] Initializing wallet address...');
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Token não encontrado.');
        const res = await fetch(`${API_BASE_URL}/wallet/address`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || 'Falha ao buscar endereço.'); }
        const d = await res.json();
        if (!d.address) throw new Error('Endereço não retornado.');
        setWalletAddress(d.address);
        console.log("[WalletTab] Wallet Address Initialized:", d.address);
      } catch (err: any) {
        console.error("[WalletTab] Init error:", err);
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

    console.log('[WalletTab] Setting up WebSocket...');
    let newSocket: Socket | null = null;

    try {
      newSocket = io(WEBSOCKET_URL, {
        auth: { token },
        reconnectionAttempts: 5,
        transports: ['websocket']
      });

      newSocket.on('connect', () => {
        console.log('[WalletTab] WebSocket connected:', newSocket?.id);
        setSocket(newSocket);
        setError(p => p?.includes('conexão') || p?.includes('Desconectado') ? null : p);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('[WalletTab] WebSocket disconnected:', reason);
        setSocket(null);
        if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
          setError("Desconectado do servidor de atualizações.");
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('[WalletTab] WebSocket connection error:', error.message);
        setError(`Erro de conexão com atualizações: ${error.message}.`);
        setSocket(null);
      });

      const handleUpdate = (data: { balance: WalletBalance, transactions: Transaction[] }) => {
        console.log('[WalletTab] WS Received walletDataUpdate. Raw Data:', data);
        if (data && data.balance && Array.isArray(data.transactions)) {
          toast.info("Carteira atualizada via WebSocket.");
          setBalance(data.balance);
          const sorted = [...data.transactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setTransactions(sorted);
          setLoading(false);
          setError(null);
        } else {
          console.warn('[WalletTab] WS received unexpected data format. Re-fetching.', data);
          toast.warn("Dados da carteira recebidos em formato inesperado. Rebuscando...");
          fetchWalletData();
        }
      };
      newSocket.on('walletDataUpdate', handleUpdate);
      setSocket(newSocket);

    } catch (err) {
      console.error("[WalletTab] WebSocket initialization error:", err);
      setError("Falha ao iniciar conexão para atualizações.");
    }

    return () => {
      if (newSocket) {
        console.log('[WalletTab] Cleaning up WebSocket...');
        newSocket.off('connect');
        newSocket.off('disconnect');
        newSocket.off('connect_error');
        newSocket.off('walletDataUpdate');
        newSocket.disconnect();
      }
      setSocket(null);
    };
  }, [isInitialized, fetchWalletData]);

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountToSendNum = parseFloat(sendForm.amountBCH || '0');

    console.log('[WalletTab] handleSendSubmit started.');
    setIsSending(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Usuário não autenticado.');
      if (amountToSendNum <= 0) throw new Error('Quantidade inválida.');
      let isValidAddress = false;
      try {
        new bitcore.Address(sendForm.address.trim());
        isValidAddress = true;
      } catch {
        isValidAddress = false;
      }
      if (!isValidAddress) throw new Error('Endereço de destino parece inválido.');

      console.log('[WalletTab] Attempting send via backend API...');
      const response = await fetch(`${API_BASE_URL}/wallet/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address: sendForm.address.trim(), amount: sendForm.amountBCH, fee: sendForm.fee })
      });

      const responseBody = await response.text();

      if (!response.ok) {
        let errorMsg = `Erro ${response.status}: Falha ao enviar.`;
        try { const d = JSON.parse(responseBody); errorMsg = d.message || errorMsg; }
        catch { errorMsg = `${errorMsg} Resposta: ${responseBody}`; }
        throw new Error(errorMsg);
      }

      const result = JSON.parse(responseBody);
      console.log('[WalletTab] Send successful:', result);
      toast.success(`Transação enviada! Hash: ${formatAddress(result.txid)}`);

      setLastSent({ address: sendForm.address.trim(), amount: sendForm.amountBCH, amountBRL: sendForm.amountBRL, txid: result.txid });
      setShowSuccessModal(true);

      if (result.txid) {
        const currentRate = balance.currentRateBRL || 0;
        const optimisticAmountBCH = amountToSendNum + estimatedFeeClientSide;
        const optimisticAmountBRL = optimisticAmountBCH * currentRate;

        const newTx: Transaction = {
          _id: result.txid, type: 'sent',
          amountBCH: optimisticAmountBCH,
          amountBRL: optimisticAmountBRL,
          address: sendForm.address.trim(), txid: result.txid, timestamp: new Date().toISOString(),
          status: 'pending', confirmations: 0,
        };
        setTransactions(prev => [newTx, ...prev].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

        const approxRequiredSatoshis = Math.round((amountToSendNum + estimatedFeeClientSide) * SATOSHIS_PER_BCH);
        setBalance(prev => {
          const newAvailable = Math.max(0, prev.availableBCH - (amountToSendNum + estimatedFeeClientSide));
          const newPending = prev.pendingBCH - (amountToSendNum + estimatedFeeClientSide);
          const newTotal = newAvailable + newPending;
          return {
            ...prev,
            availableBCH: newAvailable,
            pendingBCH: newPending,
            totalBCH: newTotal,
            totalSatoshis: Math.max(0, prev.totalSatoshis - approxRequiredSatoshis),
            totalBRL: newTotal * (prev.currentRateBRL || 0),
          };
        });

        addNotification({
          id: result.txid, message: `Enviado ${amountToSendNum.toFixed(8)} BCH para ${formatAddress(sendForm.address.trim())}`,
          amountBCH: amountToSendNum,
          amountBRL: amountToSendNum * currentRate,
          timestamp: new Date().toISOString(),
          receivedAt: new Date().toLocaleTimeString('pt-BR'),
          onViewDetails: () => { window.open(`${BCH_EXPLORER_TX_URL}${result.txid}`, '_blank'); }
        });
      }

      console.log('[WalletTab] Scheduling data refresh after send...');
      setTimeout(fetchWalletData, 8000);

      setSendModalOpen(false); // Success modal will be shown
      setSendForm({ address: '', amountBCH: '', amountBRL: '', fee: 'medium' });

    } catch (err: any) {
      console.error('[WalletTab] Error handleSendSubmit:', err);
      setError(err.message || 'Erro inesperado ao tentar enviar.');
    } finally {
      setIsSending(false);
    }
  };

  const copyToClipboard = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress).then(() => {
      setIsCopied(true);
      toast.success('Endereço copiado!');
      setTimeout(() => setIsCopied(false), 2000);
    }).catch(err => {
      console.error('[WalletTab] Copy error:', err);
      toast.error('Falha ao copiar endereço.');
    });
  };

  const handleAmountChange = (value: string, type: 'BCH' | 'BRL') => {
    const cleanValue = value.replace(',', '.');
    const currentRate = balance.currentRateBRL || 0;

    if (cleanValue === '' || cleanValue === '.') {
      setSendForm({ ...sendForm, amountBCH: '', amountBRL: '' });
      return;
    }
    if (!/^\d*\.?\d*$/.test(cleanValue)) return;

    const numericValue = parseFloat(cleanValue);

    if (isNaN(numericValue) && cleanValue !== '.') {
      if (type === 'BCH') setSendForm({ ...sendForm, amountBCH: cleanValue, amountBRL: '' });
      else setSendForm({ ...sendForm, amountBRL: cleanValue, amountBCH: '' });
      return;
    }

    if (type === 'BCH') {
      const bchAmountStr = cleanValue;
      const brlAmountStr = !isNaN(numericValue) && currentRate > 0 ? (numericValue * currentRate).toFixed(2) : '';
      setSendForm(f => ({ ...f, amountBCH: bchAmountStr, amountBRL: brlAmountStr }));
    } else { // type === 'BRL'
      const brlAmountStr = cleanValue;
      const bchAmountNum = !isNaN(numericValue) && currentRate > 0 ? (numericValue / currentRate) : 0;
      const bchAmountStr = bchAmountNum > 0 ? bchAmountNum.toFixed(8) : '';
      setSendForm(f => ({ ...f, amountBRL: brlAmountStr, amountBCH: bchAmountStr }));
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const searchTermLower = searchTerm.toLowerCase();
    const matchesSearch =
      tx.txid.toLowerCase().includes(searchTermLower) ||
      tx.address.toLowerCase().includes(searchTermLower) ||
      tx.amountBCH.toString().includes(searchTermLower) ||
      (tx.type === 'received' ? 'recebido' : tx.type === 'sent' ? 'enviado' : 'transferência').includes(searchTermLower);

    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
    
    const matchesCategory = 
      categoryFilter === 'all' ||
      (categoryFilter === 'sent' && (tx.type === 'sent' || tx.type === 'self')) || // 'self' can be considered 'sent' for filtering
      (categoryFilter === 'received' && tx.type === 'received');

    return matchesSearch && matchesStatus && matchesCategory;
  });

  let chartData: any[] = [];
  let xKey = '';
  if (activityPeriod === 'today') {
    chartData = activityDataToday;
    xKey = 'hour';
  } else if (activityPeriod === 'week') {
    chartData = activityDataWeek;
    xKey = 'day';
  } else { // month
    chartData = activityDataMonth;
    xKey = 'week';
  }

  const statusOptions = [
    { value: 'all', label: 'Todos Status' },
    { value: 'confirmed', label: 'Confirmadas' },
    { value: 'pending', label: 'Pendentes' },
    { value: 'error', label: 'Com Erro' },
  ];

  const categoryOptions = [
    { value: 'all', label: 'Todas Categorias' },
    { value: 'sent', label: 'Enviadas' },
    { value: 'received', label: 'Recebidas' },
  ];


  return (
    <div className="min-h-screen bg-gradient-to-b from-[#24292D] to-[#1E2328] p-4 md:p-6">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Global Error */}
        {error && !sendModalOpen && !receiveModalOpen && !showSuccessModal && (
          <div className="bg-red-700/20 border border-red-600/30 text-red-300 px-4 py-3 rounded-xl relative mb-6 shadow-md" role="alert">
            <strong>Erro: </strong> <span className="block sm:inline">{error}</span>
            <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-300 hover:text-white">✕</button>
          </div>
        )}
      
        {/* Balance Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 md:p-8 mb-8 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent"></div>
          <div className="absolute top-0 right-0 w-32 h-32 md:w-64 md:h-64 opacity-10">
            <Bitcoin size="100%" className="text-white" />
          </div>
          
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
              <div>
                <p className="text-emerald-100 text-sm font-medium mb-1">Saldo Total Disponível</p>
                {loading && !isInitialized ? (
                  <div className="mt-1 space-y-1 animate-pulse">
                    <div className="h-10 bg-white/20 rounded w-48"></div>
                    <div className="h-6 bg-white/20 rounded w-32"></div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {balanceVisible ? (
                        <h2 className="text-3xl md:text-4xl font-bold text-white">{formatBCH(balance.totalBCH)}</h2>
                      ) : (
                        <h2 className="text-3xl md:text-4xl font-bold text-white">•••••••• BCH</h2>
                      )}
                      <button
                        onClick={() => setBalanceVisible(!balanceVisible)}
                        className="text-white/80 hover:text-white transition-colors"
                        title={balanceVisible ? "Ocultar saldo" : "Mostrar saldo"}
                      >
                        {balanceVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                      </button>
                    </div>
                    {balanceVisible ? (
                      <p className="text-emerald-100 text-lg md:text-xl font-semibold">{formatCurrency(balance.totalBRL)}</p>
                    ) : (
                      <p className="text-emerald-100 text-lg md:text-xl font-semibold">R$ ••••••</p>
                    )}
                  </>
                )}
              </div>
              
              <div className="text-right mt-4 sm:mt-0">
                <div className="flex items-center justify-end gap-2 text-emerald-100 mb-2">
                  <TrendingUp size={16} />
                  <span className="text-sm">BCH/BRL: {formatCurrency(balance.currentRateBRL)}</span>
                </div>
                <p className="text-emerald-200 text-xs">Última atualização: {loading ? '...' : 'agora'}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap justify-center gap-4 md:gap-6 mt-4">
              {[
                { label: 'Enviar', icon: ArrowUp, action: () => { if (!isInitialized || !walletAddress) { toast.error("Endereço indisponível ou carteira não inicializada."); return; } setSendModalOpen(true); setError(null); } },
                { label: 'Receber', icon: ArrowDown, action: () => { if (!isInitialized || !walletAddress) { toast.error("Endereço indisponível ou carteira não inicializada."); return; } setReceiveModalOpen(true); setError(null); } },
                { label: 'Trocar', icon: RotateCcw, action: () => toast.info("Funcionalidade de Troca em breve!") },
                { label: 'Converter', icon: RefreshCw, action: () => toast.info("Funcionalidade de Conversão em breve!") },
              ].map(item => (
                <div key={item.label} className="flex flex-col items-center group">
                  <button
                    className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 bg-white/10 backdrop-blur-sm rounded-2xl text-white transition-all duration-300 hover:bg-white/20 hover:scale-110 hover:shadow-lg border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={item.action}
                    disabled={(!isInitialized && (item.label === 'Enviar' || item.label === 'Receber')) || (loading && (item.label === 'Enviar' || item.label === 'Receber'))}
                    title={item.label}
                  >
                    <item.icon size={20} />
                  </button>
                  <span className="text-xs md:text-sm mt-2 text-emerald-100 group-hover:text-white transition-colors">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl p-1.5 border border-white/10 shadow-xl">
            <button
              onClick={() => setViewMode('transactions')}
              className={`px-4 md:px-6 py-2 md:py-3 rounded-xl font-medium transition-all duration-300 text-sm ${
                viewMode === 'transactions'
                  ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Transações
            </button>
            <button
              onClick={() => setViewMode('analysis')}
              className={`px-4 md:px-6 py-2 md:py-3 rounded-xl font-medium transition-all duration-300 text-sm ${
                viewMode === 'analysis'
                  ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Análises
            </button>
          </div>
        </div>

        {/* Content */}
        {viewMode === 'transactions' && (
          <>
            {/* Filters - fora do container da tabela */}
            <div className="mb-6">
              <div className="p-4 md:p-6 bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl relative z-10">
                <div className="flex flex-col lg:flex-row gap-4 items-center">
                  <div className="relative flex-1 w-full lg:max-w-md">
                    <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Pesquisar transações..."
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#24292D]/80 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-gray-400 transition-all text-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3 w-full lg:w-auto">
                    <Listbox value={statusFilter} onChange={setStatusFilter}>
                      <div className="relative min-w-[160px]">
                        <Listbox.Button className="w-full px-4 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 transition-all text-sm text-left whitespace-nowrap hover:bg-[#2d3338] truncate">
                          {statusOptions.find(s => s.value === statusFilter)?.label || 'Todos Status'}
                        </Listbox.Button>
                        <Listbox.Options className="text-white absolute w-full bg-[#24292D] border border-white/10 rounded-xl shadow-lg z-20 mt-1">
                          {statusOptions.map(opt => (
                            <Listbox.Option key={opt.value} value={opt.value} className="px-4 py-2 hover:bg-[#2d3338] cursor-pointer ui-active:bg-[#2d3338] ui-selected:font-semibold text-sm">
                              {opt.label}
                            </Listbox.Option>
                          ))}
                        </Listbox.Options>
                      </div>
                    </Listbox>
                    <Listbox value={categoryFilter} onChange={setCategoryFilter}>
                      <div className="relative min-w-[160px]">
                        <Listbox.Button className="w-full px-4 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 transition-all text-sm text-left whitespace-nowrap hover:bg-[#2d3338] truncate">
                          {categoryOptions.find(c => c.value === categoryFilter)?.label || 'Todas Categorias'}
                        </Listbox.Button>
                        <Listbox.Options className="text-white absolute w-full bg-[#24292D] border border-white/10 rounded-xl shadow-lg z-20 mt-1">
                          {categoryOptions.map(opt => (
                            <Listbox.Option key={opt.value} value={opt.value} className="px-4 py-2 hover:bg-[#2d3338] cursor-pointer ui-active:bg-[#2d3338] ui-selected:font-semibold text-sm">
                              {opt.label}
                            </Listbox.Option>
                          ))}
                        </Listbox.Options>
                      </div>
                    </Listbox>
                  </div>
                </div>
              </div>
            </div>

            {/* Transactions Table - container isolado */}
           
              {/* Transactions Table - padrão unificado */}
              <div
                className="bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                style={{ minHeight: 520, maxHeight: 600, overflowY: 'auto' }}
              >
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="inline-flex items-center gap-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent"></div>
                      <span className="text-white font-medium">Carregando transações...</span>
                    </div>
                  </div>
                ) : error ? (
                  <div className="p-8 text-center">
                    <div className="text-red-400 font-medium">{error}</div>
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="text-gray-400">Nenhuma transação encontrada.</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#24292D]/80 backdrop-blur-sm border-b border-white/10">
                        <tr className="text-xs">
                          <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Transação</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider hidden md:table-cell">Data</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Quantidade</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.map((tx) => (
                          <tr
                            key={tx._id}
                            className="border-b border-[#3A414A]/50 hover:bg-[#3A414A]/30 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    tx.type === 'received' 
                                      ? 'bg-green-500/20 text-green-400' 
                                      : (tx.type === 'sent' || tx.type === 'self')
                                      ? 'bg-red-500/20 text-red-400' 
                                      : 'bg-blue-500/20 text-blue-400'
                                  }`}
                                >
                                  {tx.type === 'received' ? 
                                    <ArrowDown size={16} /> : 
                                    (tx.type === 'sent' || tx.type === 'self') ? 
                                    <ArrowUp size={16} /> : 
                                    <RotateCcw size={16} />
                                  }
                                </div>
                                <div>
                                  <p className="text-white font-medium text-xs md:text-sm">
                                    {tx.type === 'received' ? 'Recebido' : (tx.type === 'sent' || tx.type === 'self') ? 'Enviado' : 'Desconhecido'}
                                  </p>
                                  <p className="text-gray-300 text-xs truncate max-w-[80px] sm:max-w-[120px]" title={tx.address}>
                                    {formatAddress(tx.address)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-200 text-xs hidden md:table-cell">
                              {formatDate(tx.timestamp)}
                            </td>
                            <td className="px-4 py-3">
                              <div className={`text-xs md:text-sm font-medium ${tx.type === 'received' ? 'text-green-400' : (tx.type === 'sent' || tx.type === 'self') ? 'text-red-400' : 'text-white'}`}>
                                {tx.type === 'received' ? '+' : (tx.type === 'sent' || tx.type === 'self') ? '-' : ''}{tx.amountBCH.toFixed(8)} BCH
                              </div>
                              <div className="text-gray-300 text-xs">
                                {formatCurrency(tx.amountBRL)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                                  tx.status === 'confirmed'
                                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                    : tx.status === 'pending'
                                    ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                }`}
                              >
                                {tx.status === 'confirmed' ? `Confirmado (${tx.confirmations > 99 ? "99+" : tx.confirmations})` : tx.status === 'pending' ? `Pendente (${tx.confirmations})` : 'Erro'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <a
                                href={`${BCH_EXPLORER_TX_URL}${tx.txid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 md:px-4 md:py-2 bg-teal-600/20 text-teal-300 rounded-lg text-xs md:text-sm font-medium hover:bg-teal-600/30 transition-colors border border-teal-500/30"
                              >
                                Detalhes
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pagination Controls - fora do container da tabela */}
              {!loading && !error && filteredTransactions.length > 0 && (
                <div className="mt-6 flex items-center justify-between px-4 py-3 bg-[#2F363E]/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl">
                  <div>
                    <p className="text-xs text-gray-300">
                      Página <span className="font-semibold text-white">{currentPage}</span> de <span className="font-semibold text-white">{totalPages}</span>
                    </p>
                    <p className="text-[11px] text-gray-400">
                      Mostrando{' '}
                      <span className="font-medium text-gray-200">
                        {Math.min((currentPage - 1) * itemsPerPage + 1, filteredTransactions.length)}
                      </span>
                      {' - '}
                      <span className="font-medium text-gray-200">
                        {Math.min(currentPage * itemsPerPage, filteredTransactions.length)}
                      </span>
                      {' de '}
                      <span className="font-medium text-gray-200">{filteredTransactions.length}</span> transações
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 rounded-md border border-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      <ChevronLeft size={16} /> Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="flex items-center gap-1 px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 rounded-md border border-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      Próximo <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
           
          </>
        )}

        {viewMode === 'analysis' && (
          <div className="bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 p-4 md:p-6 shadow-xl">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="group p-4 bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-xl backdrop-blur-sm border border-green-400/20 hover:border-green-400/40 transition-all duration-300 hover:scale-105">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 rounded-full bg-green-500/20 flex items-center justify-center">
                    <ArrowDown className="text-green-400" size={24} />
                  </div>
                  <div className="text-white">
                    <p className="text-xs font-medium uppercase">Total Recebido</p>
                    <p className="text-lg md:text-xl font-bold">{formatBCH(balance.totalBCH)}</p>
                  </div>
                </div>
                <div className="text-green-300 text-xs">
                  <p>+12.5% vs período anterior</p>
                </div>
              </div>
              <div className="group p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl backdrop-blur-sm border border-blue-400/20 hover:border-blue-400/40 transition-all duration-300 hover:scale-105">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <TrendingUp className="text-blue-400" size={24} />
                  </div>
                  <div className="text-white">
                    <p className="text-xs font-medium uppercase">Saldo Líquido</p>
                    <p className="text-lg md:text-xl font-bold">{formatBCH(balance.totalBCH)}</p>
                  </div>
                </div>
                <div className="text-blue-300 text-xs">
                  <p>+18.2% vs período anterior</p>
                </div>
              </div>
              <div className="group p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 rounded-xl backdrop-blur-sm border border-yellow-400/20 hover:border-yellow-400/40 transition-all duration-300 hover:scale-105">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <ClockLucide className="text-yellow-400" size={24} />
                  </div>
                  <div className="text-white">
                    <p className="text-xs font-medium uppercase">Média de Taxa</p>
                    <p className="text-lg md:text-xl font-bold">{formatBCH(estimatedFeeClientSide)}</p>
                  </div>
                </div>
                <div className="text-yellow-300 text-xs">
                  <p>-5.3% vs período anterior</p>
                </div>
              </div>
              <div className="group p-4 bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl backdrop-blur-sm border border-red-400/20 hover:border-red-400/40 transition-all duration-300 hover:scale-105">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 rounded-full bg-red-500/20 flex items-center justify-center">
                    <ArrowUp className="text-red-400" size={24} />
                  </div>
                  <div className="text-white">
                    <p className="text-xs font-medium uppercase">Total Enviado</p>
                    <p className="text-lg md:text-xl font-bold">{formatBCH(balance.totalBCH)}</p>
                  </div>
                </div>
                <div className="text-red-300 text-xs">
                  <p>-7.8% vs período anterior</p>
                </div>
              </div>
            </div>

            <div className="h-64 md:h-80 mb-6">
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
                    fontSize={10}
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
                      [`${value.toFixed(8)} BCH`, name === "received" ? "Recebido" : "Enviado"]
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
              {[
                { title: 'Total Recebido', value: '0.0456 BCH', change: '+12.5%', changeColor: 'text-green-400', icon: ArrowDown, iconColor: 'text-green-400' },
                { title: 'Total Enviado', value: '0.0123 BCH', change: '-5.3%', changeColor: 'text-red-400', icon: ArrowUp, iconColor: 'text-red-400' },
                { title: 'Saldo Líquido', value: '+0.0333 BCH', change: '+18.2%', changeColor: 'text-blue-400', icon: TrendingUp, iconColor: 'text-blue-400' },
              ].map(item => (
                <div key={item.title} className="bg-[#24292D]/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <item.icon className={item.iconColor} size={18} />
                    <span className="text-gray-200 text-sm">{item.title}</span>
                  </div>
                  <p className="text-xl md:text-2xl font-bold text-white">{item.value}</p>
                  <p className={`${item.changeColor} text-xs md:text-sm`}>{item.change} vs período anterior</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Send Modal */}
        {sendModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#2F363E] rounded-2xl w-full max-w-md shadow-2xl relative border border-[#3A414A]/70">
              <button
                className="absolute top-4 right-5 text-gray-400 hover:text-white text-2xl transition-colors"
                onClick={() => !isSending && setSendModalOpen(false)}
                disabled={isSending}
              >
                ×
              </button>
              
              <div className="p-6 border-b border-[#3A414A]/70">
                <h2 className="text-xl font-semibold text-white mb-1">Enviar BCH</h2>
                <p className="text-gray-300 text-sm">Transfira Bitcoin Cash para outro endereço.</p>
              </div>
              
              {error && (
                <div className="m-6 bg-red-700/20 border border-red-600/30 text-red-300 px-4 py-2 rounded-xl relative text-sm" role="alert">
                  {error}
                  <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-3 py-2 text-red-300 hover:text-white">✕</button>
                </div>
              )}

              <form onSubmit={handleSendSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Destinatário</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Digite o endereço BCH (ex: bitcoincash:q...)"
                      className="w-full pl-4 pr-10 py-3 rounded-xl bg-[#24292D] border border-[#3A414A] text-white focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder-gray-400 font-mono text-sm"
                      value={sendForm.address}
                      onChange={e => setSendForm(f => ({ ...f, address: e.target.value }))}
                      required
                      disabled={isSending}
                    />
                     <button type="button" title="Scan QR (Em breve)" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-teal-400 hover:text-teal-300 disabled:opacity-50 disabled:cursor-not-allowed" disabled> <CodeLucide size={20}/> </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Quantidade</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text" inputMode="decimal"
                      placeholder="0,00"
                      className="px-4 py-3 rounded-xl bg-[#24292D] border border-[#3A414A] text-white focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder-gray-400 text-sm"
                      value={sendForm.amountBRL}
                      onChange={e => handleAmountChange(e.target.value, 'BRL')}
                      disabled={isSending}
                    />
                    <input
                      type="text" inputMode="decimal"
                      placeholder="0.00000000"
                      className="px-4 py-3 rounded-xl bg-[#24292D] border border-[#3A414A] text-white focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder-gray-400 text-sm"
                      value={sendForm.amountBCH}
                      onChange={e => handleAmountChange(e.target.value, 'BCH')}
                      required
                      disabled={isSending}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
                    <span>BRL</span>
                    <span>BCH</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const available = balance.availableBCH;
                      const usableAmount = Math.max(0, available - (estimatedFeeClientSide * 1.05)); // Small buffer for fee fluctuation
                      if (usableAmount > 0) {
                        handleAmountChange(usableAmount.toFixed(8), 'BCH');
                      } else {
                        handleAmountChange('0', 'BCH');
                        toast.warn("Saldo disponível insuficiente para cobrir taxa estimada.");
                      }
                    }}
                    disabled={isSending || balance.availableBCH <= (estimatedFeeClientSide * 1.05)}
                    className="text-xs text-teal-400 hover:text-teal-300 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                  >
                    Usar saldo disponível (aprox.)
                  </button>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Taxa de Rede</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl bg-[#24292D] border border-[#3A414A] text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={sendForm.fee}
                    onChange={e => setSendForm(f => ({ ...f, fee: e.target.value as 'low' | 'medium' | 'high' }))}
                    disabled={isSending}
                  >
                    <option value="low">Baixa (mais lenta)</option>
                    <option value="medium">Média (recomendada)</option>
                    <option value="high">Alta (mais rápida)</option>
                  </select>
                </div>
                
                <div className="bg-[#24292D]/50 rounded-xl p-3 space-y-1.5 text-sm border border-[#3A414A]/50">
                  <div className="flex justify-between text-gray-300">
                    <span>Taxa Estimada</span>
                    <span>{estimatedFeeClientSide.toFixed(8)} BCH</span>
                  </div>
                  <div className="flex justify-between text-white font-medium">
                    <span>Total</span>
                    <span>{(parseFloat(sendForm.amountBCH || '0') + estimatedFeeClientSide).toFixed(8)} BCH</span>
                  </div>
                </div>
                
                <button
                  type="submit"
                  className={`w-full bg-teal-600 text-white rounded-xl py-3 font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${isSending ? 'animate-pulse' : ''}`}
                  disabled={isSending || !sendForm.address || !sendForm.amountBCH || parseFloat(sendForm.amountBCH) <= 0}
                >
                  {isSending ? <><ClockLucide className="animate-spin h-5 w-5 mr-2" /> Enviando...</> : <><ArrowUp className="h-5 w-5 mr-1" /> Enviar Transação</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Receive Modal */}
        {receiveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#2F363E] rounded-2xl w-full max-w-md shadow-2xl relative border border-[#3A414A]/70">
              <button
                className="absolute top-4 right-5 text-gray-400 hover:text-white text-2xl transition-colors"
                onClick={() => setReceiveModalOpen(false)}
              >
                ×
              </button>
              
              <div className="p-6 border-b border-[#3A414A]/70">
                <h2 className="text-xl font-semibold text-white mb-1">Receber BCH</h2>
                <p className="text-gray-300 text-sm">Compartilhe este endereço para receber Bitcoin Cash.</p>
              </div>
              
              <div className="p-6 text-center space-y-6">
                <div className="bg-white p-3 md:p-4 rounded-2xl inline-block shadow-md">
                  {walletAddress ? (
                    <QRCode value={walletAddress} size={180} level="M" bgColor="#FFFFFF" fgColor="#000000" />
                  ) : (
                    <div className="w-48 h-48 md:w-52 md:h-52 bg-gray-200 flex items-center justify-center text-gray-500 animate-pulse">Carregando...</div>
                  )}
                </div>
                
                <div>
                  <p className="text-teal-400 font-medium text-sm mb-1.5">Seu Endereço BCH</p>
                  <div className="bg-[#24292D]/70 rounded-xl p-3 border border-[#3A414A]/70">
                    <p className="text-white text-xs md:text-sm font-mono break-all mb-3">
                      {walletAddress || 'Carregando...'}
                    </p>
                    <button
                      className="w-full bg-teal-600 text-white rounded-lg py-2.5 font-medium hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                      onClick={copyToClipboard}
                      disabled={!walletAddress || isCopied}
                    >
                      {isCopied ? <><CheckCircleLucide size={18}/>Copiado!</> : <><CopyLucide size={18}/>Copiar Endereço</>}
                    </button>
                  </div>
                </div>
                
                <button
                  className="w-full bg-[#3A414A] text-white rounded-xl py-3 font-medium hover:bg-[#4A5568] transition-colors border border-[#4A5568]/70"
                  onClick={() => {
                    if (navigator.share && walletAddress) {
                      navigator.share({ title: 'Meu Endereço BCH', text: walletAddress }).catch(err => toast.error("Não foi possível compartilhar."));
                    } else if (walletAddress) {
                      toast.info("Compartilhamento não suportado. Copie o endereço manualmente.");
                    } else {
                       toast.warn("Endereço não disponível para compartilhar.");
                    }
                  }}
                  disabled={!walletAddress}
                >
                  Compartilhar Endereço
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal */}
        {showSuccessModal && lastSent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#2F363E] rounded-2xl w-full max-w-md shadow-2xl relative border border-[#3A414A]/70">
              <button
                className="absolute top-4 right-5 text-gray-400 hover:text-white text-2xl transition-colors"
                onClick={() => setShowSuccessModal(false)}
              >
                ×
              </button>
              
              <div className="p-6 md:p-8 text-center">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-teal-600/20 border-2 border-teal-500/50 rounded-full flex items-center justify-center mx-auto mb-5">
                  <FiCheckCircle className="w-8 h-8 md:w-10 md:h-10 text-teal-400" /> {/* Or use CheckCircleLucide */}
                </div>
                
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Transação Enviada!</h3>
                <p className="text-gray-300 mb-5 text-sm md:text-base">
                  Você enviou <span className="font-medium text-teal-400">{parseFloat(lastSent.amount).toFixed(8)} BCH</span> com sucesso.
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
                  <div className="flex justify-between text-white font-medium border-t border-[#3A414A]/70 pt-2 mt-1">
                    <span>Total</span>
                    <span>{(parseFloat(lastSent.amount) + estimatedFeeClientSide).toFixed(8)} BCH</span>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    className="flex-1 bg-teal-600 text-white rounded-xl py-2.5 md:py-3 font-medium hover:bg-teal-700 transition-colors"
                    onClick={() => setShowSuccessModal(false)}
                  >
                    Continuar
                  </button>
                  <button
                    onClick={() => { 
                      if (lastSent.txid) {
                        window.open(`${BCH_EXPLORER_TX_URL}${lastSent.txid}`, '_blank');
                      } else {
                        toast.info("Detalhes da transação estarão disponíveis em breve.");
                      }
                    }}
                    className="flex-1 bg-[#3A414A] text-white rounded-xl py-2.5 md:py-3 font-medium hover:bg-[#4A5568] transition-colors border border-[#4A5568]/70"
                    disabled={!lastSent.txid}
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
