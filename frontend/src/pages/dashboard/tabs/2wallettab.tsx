// src/pages/dashboard/tabs/2wallettab.tsx
import React, { useState, useEffect, useCallback } from 'react';
// Removed FiAlertCircle as it's not used
import { FiArrowUp, FiArrowDown, FiCopy, FiDollarSign, FiCode, FiClock, FiRefreshCw, FiCheckCircle } from 'react-icons/fi';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-toastify';
import QRCode from 'react-qr-code';
import bitcore from 'bitcore-lib-cash';

import { useNotification } from '../../../context/NotificationContext';

// --- Configuration ---
const API_BASE_URL = 'http://localhost:3000/api';
const WEBSOCKET_URL = 'http://localhost:3000';
const BCH_EXPLORER_TX_URL = 'https://explorer.bitcoinabc.org/tx/';
const SATOSHIS_PER_BCH = 1e8;
const estimatedFeeClientSide = 0.00000220; // Approx 220 sats

// --- Types ---
type Transaction = {
  _id: string;
  type: 'received' | 'sent' | 'unknown';
  amountBCH: number;
  amountBRL: number;
  address: string;
  txid: string;
  timestamp: string;
  status: 'pending' | 'confirmed';
  confirmations: number;
  blockHeight?: number;
  fee?: number;
};

type WalletBalance = {
  totalBCH: number;
  availableBCH: number; // Confirmed balance
  pendingBCH: number;   // Unconfirmed balance change
  totalBRL: number;
  totalSatoshis: number;
  currentRateBRL?: number;
};

// --- WalletTab Component ---
export function WalletTab() {
  const { addNotification } = useNotification();
  // --- States ---
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

  // --- fetchWalletData (No changes) ---
  const fetchWalletData = useCallback(async () => {
    if (!walletAddress) {
      if (isInitialized) setLoading(false); return;
    }
    console.log(`[WalletTab] fetchWalletData called`);
    setLoading(true); setError(null);
    const token = localStorage.getItem('token');
    if (!token) { setError("Usuário não autenticado."); setLoading(false); return; }
    try {
      const [balRes, txRes] = await Promise.all([
        fetch(`${API_BASE_URL}/wallet/balance`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/wallet/transactions`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (!balRes.ok) { const d = await balRes.json().catch(()=>({})); throw new Error(`Erro saldo: ${d.message || balRes.statusText}`); }
      const fetchedBalance: WalletBalance = await balRes.json();
      setBalance(fetchedBalance);
      console.log("[WalletTab] Balance updated:", fetchedBalance);
      if (!txRes.ok) { const d = await txRes.json().catch(()=>({})); throw new Error(`Erro txs: ${d.message || txRes.statusText}`); }
      const fetchedTxs: Transaction[] = await txRes.json();
      fetchedTxs.sort((a, b) => (new Date(b.timestamp).getTime()) - (new Date(a.timestamp).getTime()));
      setTransactions(fetchedTxs);
      console.log(`[WalletTab] Transactions updated (${fetchedTxs.length}).`);
    } catch (err: any) {
      console.error('[WalletTab] Error fetchWalletData:', err);
      setError(prev => prev === err.message ? prev : err.message);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, isInitialized]);

  // --- Effects (No changes) ---
  useEffect(() => { /* Initialize Wallet */
    const init = async () => {
      console.log('[WalletTab] Initializing wallet...'); setLoading(true); setError(null);
      try {
        const token = localStorage.getItem('token'); if (!token) throw new Error('Token não encontrado.');
        const res = await fetch(`${API_BASE_URL}/wallet/address`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { const d = await res.json().catch(()=>({})); throw new Error(d.message || 'Falha ao buscar endereço.'); }
        const d = await res.json(); if (!d.address) throw new Error('Endereço não retornado.');
        setWalletAddress(d.address); setIsInitialized(true); console.log("Addr:", d.address);
      } catch (err: any) { console.error("Init error:", err); setError(err.message); setIsInitialized(true); setLoading(false); }
    };
    init();
  }, []);

  useEffect(() => { /* Fetch Data on Init/Address Change */
    if (isInitialized && walletAddress) { fetchWalletData(); }
    else if (isInitialized && !walletAddress) { setLoading(false); }
  }, [isInitialized, walletAddress, fetchWalletData]);

  useEffect(() => { /* Setup WebSocket */
    if (!isInitialized) return;
    const token = localStorage.getItem('token'); if (!token) return;
    console.log('[WalletTab] Setting up WebSocket...'); let newSocket: Socket | null = null;
    try {
      newSocket = io(WEBSOCKET_URL, { auth: { token }, reconnectionAttempts: 5, transports: ['websocket'] });
      newSocket.on('connect', () => { console.log('WS connected:', newSocket?.id); setSocket(newSocket); setError(p => p?.includes('conexão') ? null : p); });
      newSocket.on('disconnect', (r) => { console.log('WS disconnected:', r); setSocket(null); if (r !== 'io client disconnect' && r !== 'io server disconnect') setError("Desconectado."); });
      newSocket.on('connect_error', (e) => { console.error('WS conn error:', e.message); setError(`Erro WS: ${e.message}.`); setSocket(null); });
      const handleUpdate = (d: { balance: WalletBalance, transactions: Transaction[] }) => {
        console.log('WS Received walletDataUpdate.', d);
        if (d && d.balance && Array.isArray(d.transactions)) {
          toast.info("Carteira atualizada via WebSocket."); setBalance(d.balance);
          const sorted = [...d.transactions].sort((a, b) => (new Date(b.timestamp).getTime()) - (new Date(a.timestamp).getTime()));
          setTransactions(sorted); setLoading(false); setError(null); console.log("State updated via WS.");
        } else { console.warn('WS unexpected data format. Re-fetching.', d); toast.warn("Formato inesperado. Rebuscando..."); fetchWalletData(); }
      };
      newSocket.on('walletDataUpdate', handleUpdate);
    } catch (err) { console.error("WS init error:", err); setError("Falha ao iniciar WS."); }
    return () => { if (newSocket) { console.log('WS Cleaning up...'); newSocket.off(); newSocket.disconnect(); } setSocket(null); };
  }, [isInitialized, fetchWalletData]);
  // --- End Effects ---

  // --- Function to handle sending BCH ---
  const handleSendSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const amountToSendNum = parseFloat(sendForm.amountBCH || '0');

      // Frontend check removed as requested

      console.log('[WalletTab] handleSendSubmit started.');
      setIsSending(true);
      setError(null);

      try {
          const token = localStorage.getItem('token');
          if (!token) throw new Error('Usuário não autenticado.');
          if (amountToSendNum <= 0) throw new Error('Quantidade inválida.');
          let isValidAddress = false;
          try { new bitcore.Address(sendForm.address.trim(), bitcore.Networks.mainnet); isValidAddress = true; } catch {}
          if (!isValidAddress) throw new Error('Endereço de destino inválido.');

          console.log('[WalletTab] Attempting send via backend API...');
          const response = await fetch(`${API_BASE_URL}/wallet/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ address: sendForm.address.trim(), amount: sendForm.amountBCH, fee: sendForm.fee })
          });

          if (!response.ok) {
              let errorMsg = `Erro ${response.status}: Falha ao enviar.`;
              try { const d = await response.json(); errorMsg = d.message || errorMsg; }
              catch { errorMsg = `${errorMsg} Resposta: ${await response.text()}`; }
              throw new Error(errorMsg);
          }

          const result = await response.json();
          console.log('[WalletTab] Send successful:', result);
          toast.success(`Transação enviada! Hash: ${formatAddress(result.txid)}`);

          if (result.txid) { // Optimistic UI Update
              const currentRate = balance.currentRateBRL || 0;
              const optimisticAmountBRL = amountToSendNum * currentRate;
              const newTx: Transaction = {
                  _id: result.txid, type: 'sent', amountBCH: amountToSendNum, amountBRL: optimisticAmountBRL,
                  address: sendForm.address.trim(), txid: result.txid, timestamp: new Date().toISOString(),
                  status: 'pending', confirmations: 0, fee: estimatedFeeClientSide
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
                  amountBCH: amountToSendNum, amountBRL: optimisticAmountBRL, timestamp: new Date().toISOString(),
                  receivedAt: new Date().toLocaleTimeString('pt-BR'),
                  onViewDetails: () => { window.open(`${BCH_EXPLORER_TX_URL}${result.txid}`, '_blank'); }
              });
          }

          console.log('[WalletTab] Scheduling data refresh...');
          setTimeout(fetchWalletData, 8000);

          setSendModalOpen(false);
          setSendForm({ address: '', amountBCH: '', amountBRL: '', fee: 'medium' });

      } catch (err: any) {
          console.error('[WalletTab] Error handleSendSubmit:', err);
          setError(err.message || 'Erro inesperado ao tentar enviar.');
      } finally {
          setIsSending(false);
      }
  };

  // --- Formatting Functions (No changes) ---
    const formatCurrency = (value: number | undefined) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatBCH = (value: number | undefined) => (Number(value) || 0).toFixed(8) + ' BCH';
    const formatDate = (dateString: string | undefined) => { if (!dateString) return 'N/A'; try { const d = new Date(dateString); return isNaN(d.getTime()) ? 'Inválida' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return 'Inválida'; } };
    const formatAddress = (address: string | undefined, length: number = 6): string => { if (!address || typeof address !== 'string' || address.length < length * 2 + 3) return address || 'N/A'; const clean = address.includes(':') ? address.split(':')[1] : address; if (!clean || clean.length < length * 2 + 3) return clean || address; return `${clean.substring(0, length)}...${clean.substring(clean.length - length)}`; };

  // --- Copy to Clipboard (No changes) ---
    const copyToClipboard = () => { if (!walletAddress) return; navigator.clipboard.writeText(walletAddress).then(() => { setIsCopied(true); toast.success('Endereço copiado!'); setTimeout(() => setIsCopied(false), 2000); }).catch(err => { console.error('Copy error:', err); toast.error('Falha ao copiar.'); }); };

  // --- Handle Amount Change (No changes needed here as check was removed) ---
    const handleAmountChange = (value: string, type: 'BCH' | 'BRL') => {
        const cleanValue = value.replace(',', '.');
        const currentRate = balance.currentRateBRL || 0;

        if (cleanValue === '') {
            setSendForm({ ...sendForm, amountBCH: '', amountBRL: '' });
            return;
        }

        const numericValue = parseFloat(cleanValue);

        if (isNaN(numericValue) && cleanValue !== '.' && !/^\d+\.$/.test(cleanValue) && !/^\d*\.\d*$/.test(cleanValue) && !/^\d+$/.test(cleanValue)) {
             if (type === 'BCH') setSendForm({ ...sendForm, amountBCH: value, amountBRL: '' });
             else setSendForm({ ...sendForm, amountBRL: value, amountBCH: '' });
             return;
        }

        if (type === 'BCH') {
            const bchAmountStr = value;
            const brlAmountStr = !isNaN(numericValue) && currentRate > 0 ? (numericValue * currentRate).toFixed(2) : '';
            setSendForm({ ...sendForm, amountBCH: bchAmountStr, amountBRL: brlAmountStr });
        } else {
            const brlAmountStr = value;
            const bchAmountNum = !isNaN(numericValue) && currentRate > 0 ? (numericValue / currentRate) : 0;
            const bchAmountStr = bchAmountNum > 0 ? bchAmountNum.toFixed(8) : '';
            setSendForm({ ...sendForm, amountBRL: brlAmountStr, amountBCH: bchAmountStr });
        }
    };

  // --- Prepare content for the spendable balance card ---
  let spendableBalanceContent: React.ReactNode;
  let displayableSpendable = 0;

  if (loading || !isInitialized) {
    spendableBalanceContent = (
      <div className="mt-2 space-y-2 animate-pulse">
        <div className="h-6 bg-green-700 rounded w-3/4"></div>
        <div className="h-4 bg-green-700 rounded w-1/2"></div>
      </div>
    );
  } else {
    if (balance.pendingBCH < 0) {
      displayableSpendable = Math.max(0, balance.availableBCH + balance.pendingBCH);
    } else {
      displayableSpendable = balance.availableBCH;
    }
    const displayableSpendableBRL = displayableSpendable * (balance.currentRateBRL || 0);

    spendableBalanceContent = (
      <React.Fragment>
        <p className="text-2xl font-bold mt-2">{formatBCH(displayableSpendable)}</p>
        <p className="text-green-200 mt-1">{formatCurrency(displayableSpendableBRL)}</p>
      </React.Fragment>
    );
  }
  // --- End preparation ---

  // --- Component Rendering ---
  return (
    <div className="p-6 min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold">Minha Carteira Bitcoin Cash</h2>
        <div className="flex items-center gap-4 flex-wrap">
          {/* WS Status */}
          <div className="flex items-center gap-2 text-sm">
            {socket?.connected ? ( <span className="flex items-center gap-1 text-green-400"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> ON</span>
            ) : error?.includes('backend') || error?.includes('conexão') ? ( <span className="flex items-center gap-1 text-red-400"><span className="w-2 h-2 rounded-full bg-red-500"></span> OFF</span>
            ) : ( <span className="flex items-center gap-1 text-yellow-400"><span className="w-2 h-2 rounded-full bg-yellow-500 animate-spin"></span> ...</span> )}
          </div>
          {/* Refresh */}
          <button onClick={fetchWalletData} disabled={loading || !isInitialized} className="p-2 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed">
            <FiRefreshCw className={` ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Error */}
      {error && !sendModalOpen && !receiveModalOpen && (
        <div className="bg-red-800 border border-red-600 text-white px-4 py-3 rounded relative mb-6 shadow-md" role="alert">
            <strong>Erro: </strong> <span className="block sm:inline">{error}</span>
            <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-300 hover:text-white">✕</button>
        </div>
      )}

      {/* Balance Cards */}
      {!isInitialized ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 animate-pulse">
              {[...Array(2)].map((_, i) => <div key={i} className="bg-[var(--color-bg-secondary)] h-32 rounded-lg p-6 shadow-md"></div>)}
          </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Spendable Card - Shows intuitive balance */}
          <div className="bg-gradient-to-br from-green-800 to-green-900 rounded-lg p-6 shadow-lg text-white">
              <div className="flex justify-between items-start">
                  <div>
                      <h3 className="text-green-200 text-sm font-medium">Saldo Disponível</h3>
                      {/* Use pre-rendered content */}
                      {spendableBalanceContent}
                  </div>
                  <div className="bg-green-700 p-3 rounded-full"> <FiCheckCircle size={24} /> </div>
              </div>
              {!loading && ( <p className="text-xs text-green-300 mt-2 opacity-70">Confirmado: {formatBCH(balance.availableBCH)}</p> )}
          </div>
          {/* Pending Incoming Card */}
          {(loading || balance.pendingBCH > 0) && (
              <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-lg p-6 shadow-lg text-white">
                  <div className="flex justify-between items-start">
                      <div>
                          <h3 className="text-yellow-200 text-sm font-medium">Entrada Pendente</h3>
                          {loading ? ( <div className="mt-2 space-y-2 animate-pulse"><div className="h-6 bg-yellow-500 rounded w-3/4"></div><div className="h-4 bg-yellow-500 rounded w-1/2"></div></div> )
                           : ( <> <p className="text-2xl font-bold mt-2">+{formatBCH(balance.pendingBCH)}</p> <p className="text-yellow-200 mt-1">{formatCurrency(balance.pendingBCH * (balance.currentRateBRL || 0))}</p> </> )}
                      </div>
                      <div className="bg-yellow-500 p-3 rounded-full"> <FiClock size={24} /> </div>
                  </div>
              </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4 mb-8">
        <button onClick={() => { if (!isInitialized || loading) { toast.warn("Aguarde."); return; } if (!walletAddress) { toast.error("Endereço indisponível."); return; } setSendModalOpen(true); setError(null); }} disabled={!isInitialized || loading} className="flex items-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-md"> <FiArrowUp /> Enviar BCH </button>
        <button onClick={() => { if (!isInitialized || !walletAddress) { toast.error("Endereço indisponível."); return; } setReceiveModalOpen(true); setError(null); }} disabled={!isInitialized || !walletAddress} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-md"> <FiArrowDown /> Receber BCH </button>
        <button disabled title="Em breve" className="flex items-center gap-2 bg-gray-600 text-gray-400 px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-md"> <FiDollarSign /> Converter </button>
      </div>

      {/* Recent Transactions */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 shadow-lg">
        <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)]">Transações Recentes</h3>
        {/* --- FIXED: Conditional rendering structure --- */}
        {!isInitialized ? (
          <div className="space-y-4 animate-pulse">{[...Array(3)].map((_, i) => ( <div key={i} className="flex justify-between items-center p-4 rounded-lg bg-[var(--color-bg-tertiary)]"><div className="flex items-center gap-4"><div className="p-3 rounded-full bg-gray-700 h-12 w-12"></div><div><div className="h-4 bg-gray-700 rounded w-48 mb-2"></div><div className="h-3 bg-gray-700 rounded w-32"></div></div></div><div className="text-right"><div className="h-4 bg-gray-700 rounded w-24 mb-2"></div><div className="h-3 bg-gray-700 rounded w-20"></div></div></div> ))}</div>
        ) : loading && transactions.length === 0 ? (
          <div className="space-y-4 animate-pulse">{[...Array(3)].map((_, i) => ( <div key={i} className="flex justify-between items-center p-4 rounded-lg bg-[var(--color-bg-tertiary)]"><div className="flex items-center gap-4"><div className="p-3 rounded-full bg-gray-700 h-12 w-12"></div><div><div className="h-4 bg-gray-700 rounded w-48 mb-2"></div><div className="h-3 bg-gray-700 rounded w-32"></div></div></div><div className="text-right"><div className="h-4 bg-gray-700 rounded w-24 mb-2"></div><div className="h-3 bg-gray-700 rounded w-20"></div></div></div> ))}</div>
        ) : !loading && transactions.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-text-secondary)]"> Nenhuma transação encontrada. </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div key={tx._id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 hover:bg-[var(--color-bg-tertiary)] rounded-lg border-b border-[var(--color-border)] last:border-b-0">
                <div className="flex items-center gap-4 mb-2 sm:mb-0 w-full sm:w-auto">
                  <div className={`flex-shrink-0 p-3 rounded-full ${ tx.type === 'received' ? 'bg-green-900 text-green-400' : tx.type === 'sent' ? 'bg-red-900 text-red-400' : 'bg-gray-700 text-gray-400' }`}>
                    {tx.type === 'received' ? <FiArrowDown size={20} /> : tx.type === 'sent' ? <FiArrowUp size={20} /> : <FiClock size={20} />}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-medium text-sm sm:text-base truncate text-[var(--color-text-primary)]">
                      {tx.type === 'received' ? 'Recebido' : tx.type === 'sent' ? 'Enviado' : 'Desconhecido'}
                    </p>
                    <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">{formatDate(tx.timestamp)}</p>
                    <a href={`${BCH_EXPLORER_TX_URL}${tx.txid}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 break-all block mt-1" title={tx.txid}>
                      Hash: {formatAddress(tx.txid, 8)}
                    </a>
                  </div>
                </div>
                <div className="flex flex-col items-end ml-auto sm:ml-0 pl-16 sm:pl-0 flex-shrink-0">
                  <p className={`font-bold text-sm sm:text-base whitespace-nowrap ${ tx.type === 'received' ? 'text-green-400' : tx.type === 'sent' ? 'text-red-400' : 'text-gray-400' }`}>
                    {tx.type === 'received' ? '+' : tx.type === 'sent' ? '-' : ''} {formatBCH(tx.amountBCH)}
                  </p>
                  <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] whitespace-nowrap">{formatCurrency(tx.amountBRL)}</p>
                  <div className="mt-1">
                    {tx.status === 'confirmed' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Confirmado ({tx.confirmations > 99 ? '99+' : tx.confirmations} conf.)
                      </span>
                    ) : tx.status === 'pending' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        Pendente ({tx.confirmations} conf.)
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                        Desconhecido
                      </span>
                    )}
                  </div>
                  {tx.type === 'sent' && tx.fee !== undefined && (
                    <p className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap mt-1">Taxa: {formatBCH(tx.fee)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {/* --- END FIX --- */}
      </div>

      {/* --- Send Modal --- */}
      {sendModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 w-full max-w-md shadow-xl border border-[var(--color-border)]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Enviar Bitcoin Cash</h3>
                    <button onClick={() => !isSending && setSendModalOpen(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50" disabled={isSending}> ✕ </button>
                </div>
                {/* Modal-specific error display (Shows backend errors) */}
                {error && (
                    <div className="bg-red-800 border border-red-600 text-white px-4 py-2 rounded relative mb-4 text-sm" role="alert">
                        {error}
                        <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-3 py-2 text-red-300 hover:text-white">✕</button>
                    </div>
                )}
                <form onSubmit={handleSendSubmit}>
                    <div className="space-y-4">
                        {/* Address */}
                        <div>
                            <label htmlFor="send-address" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Endereço</label>
                            <div className="relative">
                                <input id="send-address" type="text" value={sendForm.address} onChange={(e) => setSendForm({...sendForm, address: e.target.value})} placeholder="bitcoincash:q..." className="w-full px-3 py-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] font-mono text-sm" required disabled={isSending} />
                                <button type="button" disabled title="Scan QR (Em breve)" className="absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-500 hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"> <FiCode /> </button>
                            </div>
                        </div>
                        {/* Amounts */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="send-amount-bch" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Qtd (BCH)</label>
                                <input id="send-amount-bch" type="text" inputMode="decimal" value={sendForm.amountBCH} onChange={(e) => handleAmountChange(e.target.value, 'BCH')} className="w-full px-3 py-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] text-sm" required disabled={isSending} placeholder="0.00000000" />
                            </div>
                            <div>
                                <label htmlFor="send-amount-brl" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Valor (BRL)</label>
                                <input id="send-amount-brl" type="text" inputMode="decimal" value={sendForm.amountBRL} onChange={(e) => handleAmountChange(e.target.value, 'BRL')} className="w-full px-3 py-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] text-sm" required disabled={isSending} placeholder="0,00" />
                            </div>
                        </div>
                        {/* --- REMOVED: Insufficient Balance Warning Display --- */}

                        {/* Use Available Balance Button */}
                        <button
                            type="button"
                            onClick={() => {
                                const available = balance.availableBCH;
                                const usableAmount = Math.max(0, available - estimatedFeeClientSide);
                                if (usableAmount > 0) {
                                    handleAmountChange(usableAmount.toFixed(8), 'BCH');
                                } else {
                                    handleAmountChange('0', 'BCH');
                                    toast.warn("Saldo disponível insuficiente para cobrir taxa estimada.");
                                }
                            }}
                            disabled={isSending || balance.availableBCH <= estimatedFeeClientSide}
                            className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Usar saldo disponível (aprox.)
                        </button>
                        {/* Fee Selection */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Taxa</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['low', 'medium', 'high'] as const).map((feeLevel) => ( <button key={feeLevel} type="button" onClick={() => !isSending && setSendForm({...sendForm, fee: feeLevel})} disabled={isSending} className={`py-2 rounded border-2 text-sm transition-colors disabled:opacity-50 ${ sendForm.fee === feeLevel ? 'border-[var(--color-accent)] bg-[var(--color-accent-hover)] text-white font-semibold' : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:border-gray-500 hover:text-[var(--color-text-primary)]' }`}> {feeLevel === 'low' ? 'Lenta' : feeLevel === 'medium' ? 'Normal' : 'Rápida'} </button> ))}
                            </div>
                            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                                Taxa de rede estimada: ~{estimatedFeeClientSide.toFixed(8)} BCH. A taxa real será calculada pelo servidor.
                            </p>
                        </div>
                    </div>
                    {/* Actions */}
                    <div className="mt-8 flex justify-end gap-3">
                        <button type="button" onClick={() => setSendModalOpen(false)} disabled={isSending} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"> Cancelar </button>
                        {/* --- FIXED: Completed submit button --- */}
                        <button
                            type="submit"
                            disabled={
                                isSending ||
                                !sendForm.address ||
                                !sendForm.amountBCH ||
                                parseFloat(sendForm.amountBCH) <= 0
                            }
                            className={`px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px] ${isSending ? 'animate-pulse' : ''}`}
                        >
                            {isSending ? (
                                <>
                                    <FiClock className="animate-spin h-5 w-5 mr-2" /> Enviando...
                                </>
                             ) : (
                                <>
                                    <FiArrowUp className="h-5 w-5 mr-1" /> Enviar
                                </>
                            )}
                        </button>
                        {/* --- END FIX --- */}
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* --- Receive Modal (No changes) --- */}
      {receiveModalOpen && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 backdrop-blur-sm"> <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 w-full max-w-md shadow-xl border border-[var(--color-border)]"> <div className="flex justify-between items-center mb-6"> <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Receber Bitcoin Cash</h3> <button onClick={() => setReceiveModalOpen(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"> ✕ </button> </div> <div className="text-center"> <div className="bg-white p-4 rounded-lg inline-block mb-6 shadow-md"> {walletAddress ? ( <QRCode value={walletAddress} size={192} level="M" bgColor="#FFFFFF" fgColor="#000000"/> ) : ( <div className="w-48 h-48 bg-gray-200 flex items-center justify-center text-gray-500 animate-pulse"> Carregando... </div> )} </div> <div className="mb-6"> <p className="text-sm text-[var(--color-text-secondary)] mb-2">Seu endereço</p> <div className="flex items-center justify-between bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] p-3 rounded-lg"> <span className="font-mono text-blue-400 overflow-x-auto text-sm break-all mr-2"> {walletAddress || 'Carregando...'} </span> <button onClick={copyToClipboard} disabled={!walletAddress || isCopied} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex-shrink-0 disabled:opacity-50" title={isCopied ? "Copiado!" : "Copiar"}> {isCopied ? <FiCheckCircle className="text-green-500" /> : <FiCopy />} </button> </div> </div> <div className="grid grid-cols-2 gap-3"> <button disabled title="Em breve" className="py-2 border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"> Compartilhar </button> <button onClick={copyToClipboard} disabled={!walletAddress || isCopied} className="py-2 bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] rounded-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50"> {isCopied ? <FiCheckCircle /> : <FiCopy />} {isCopied ? 'Copiado!' : 'Copiar'} </button> </div> </div> </div> </div> )}

    </div> // Closing main component div
  ); // Closing return statement
} // Closing WalletTab function
