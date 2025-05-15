// z:\Kashy-Project\frontend\src\pages\dashboard\tabs\2wallettab.tsx
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
const BCH_EXPLORER_TX_URL = 'https://explorer.bitcoinabc.org/tx/'; // Example explorer URL
const SATOSHIS_PER_BCH = 1e8;
const estimatedFeeClientSide = 0.00000220; // Approx 220 sats (Used for optimistic UI only)

// --- Types ---
type Transaction = {
  _id: string;
  type: 'received' | 'sent' | 'unknown' | 'self'; // Added 'self'
  amount: number; // <--- CHANGE: Field for BCH amount (matches DB)
  convertedBRL: number; // <--- CHANGE: Field for BRL amount (matches DB)
  address: string;
  txid: string;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'error'; // Added 'error'
  confirmations: number;
  blockHeight?: number;
  fee?: number; // Keep fee potentially for other uses, but won't display it for sent/self
  errorMessage?: string; // For error type
};

type WalletBalance = {
  totalBCH: number;
  availableBCH: number; // Confirmed balance
  pendingBCH: number;   // Unconfirmed balance change (can be negative)
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

  // --- Formatting Functions ---
  const formatCurrency = (value: number | undefined) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  const formatBCH = (value: number | undefined) => (Number(value) || 0).toFixed(8) + ' BCH';
  const formatDate = (dateString: string | undefined) => { if (!dateString) return 'N/A'; try { const d = new Date(dateString); return isNaN(d.getTime()) ? 'Inválida' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return 'Inválida'; } };
  const formatAddress = (address: string | undefined, length: number = 6): string => { if (!address || typeof address !== 'string' || address.length < length * 2 + 3) return address || 'N/A'; const clean = address.includes(':') ? address.split(':')[1] : address; if (!clean || clean.length < length * 2 + 3) return clean || address; return `${clean.substring(0, length)}...${clean.substring(clean.length - length)}`; };

  // --- fetchWalletData ---
  const fetchWalletData = useCallback(async () => {
    // Removed check for walletAddress here, let it proceed if initialized
    if (!isInitialized) { setLoading(false); return; } // Only proceed if initialized

    console.log(`[WalletTab] fetchWalletData called`);
    setLoading(true); setError(null);
    const token = localStorage.getItem('token');
    if (!token) { setError("Usuário não autenticado."); setLoading(false); return; }

    try {
      const [balRes, txRes] = await Promise.all([
        fetch(`${API_BASE_URL}/wallet/balance`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/wallet/transactions`, { headers: { Authorization: `Bearer ${token}` } }) // TODO: Add pagination params ?page=1&limit=20
      ]);

      // Process Balance Response
      if (!balRes.ok) {
        const d = await balRes.json().catch(()=>({}));
        console.error(`[WalletTab] Balance fetch failed: ${balRes.status}`, d);
        throw new Error(`Erro ao buscar saldo: ${d.message || balRes.statusText}`);
      }
      const fetchedBalance: WalletBalance = await balRes.json();
      console.log("[WalletTab] Balance fetched:", fetchedBalance); // Log fetched balance
      setBalance(fetchedBalance);

      // Process Transactions Response
      if (!txRes.ok) {
        const d = await txRes.json().catch(()=>({}));
        console.error(`[WalletTab] Transactions fetch failed: ${txRes.status}`, d);
        throw new Error(`Erro ao buscar transações: ${d.message || txRes.statusText}`);
      }
      // --- MODIFICATION: Handle paginated response ---
      const txResponseData = await txRes.json();
      const fetchedTxs: Transaction[] = txResponseData.transactions; // Access the array

      if (Array.isArray(fetchedTxs)) {
        // Sort transactions by date descending
        fetchedTxs.sort((a, b) => (new Date(b.timestamp).getTime()) - (new Date(a.timestamp).getTime()));
        setTransactions(fetchedTxs);
        // TODO: Store txResponseData.total, txResponseData.page, txResponseData.limit for pagination UI if needed
      } else {
        console.error("[WalletTab] Fetched transactions data is not an array:", txResponseData);
        setTransactions([]); // Set to empty array on error
      }
      console.log(`[WalletTab] Transactions fetched (${fetchedTxs.length}).`);

    } catch (err: any) {
      console.error('[WalletTab] Error fetchWalletData:', err);
      setError(prev => prev === err.message ? prev : err.message); // Avoid duplicate error messages
      // Optionally reset balance on error? Or keep potentially stale data?
      // setBalance({ totalBCH: 0, availableBCH: 0, pendingBCH: 0, totalBRL: 0, totalSatoshis: 0 });
    } finally {
      setLoading(false);
    }
  }, [isInitialized]); // Removed walletAddress dependency, rely on isInitialized

  // --- Effects ---
  useEffect(() => { /* Initialize Wallet Address */
    const init = async () => {
      console.log('[WalletTab] Initializing wallet address...'); setLoading(true); setError(null);
      try {
        const token = localStorage.getItem('token'); if (!token) throw new Error('Token não encontrado.');
        const res = await fetch(`${API_BASE_URL}/wallet/address`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { const d = await res.json().catch(()=>({})); throw new Error(d.message || 'Falha ao buscar endereço.'); }
        const d = await res.json(); if (!d.address) throw new Error('Endereço não retornado.');
        setWalletAddress(d.address);
        console.log("[WalletTab] Wallet Address Initialized:", d.address);
      } catch (err: any) {
        console.error("[WalletTab] Init error:", err);
        setError(err.message);
      } finally {
        setIsInitialized(true); // Mark as initialized even on error
        // Don't set loading false here, let the data fetch effect handle it
      }
    };
    init();
  }, []);

  useEffect(() => { /* Fetch Data on Init */
    if (isInitialized) {
      fetchWalletData(); // Fetch data once initialized (address might still be fetching but fetchWalletData handles it)
    }
  }, [isInitialized, fetchWalletData]);

  useEffect(() => { /* Setup WebSocket */
    if (!isInitialized) return; // Only setup WS after initialization attempt
    const token = localStorage.getItem('token'); if (!token) return;

    console.log('[WalletTab] Setting up WebSocket...');
    let newSocket: Socket | null = null;

    try {
      newSocket = io(WEBSOCKET_URL, {
        auth: { token },
        reconnectionAttempts: 5,
        transports: ['websocket'] // Prefer websocket
      });

      newSocket.on('connect', () => {
        console.log('[WalletTab] WebSocket connected:', newSocket?.id);
        setSocket(newSocket);
        setError(p => p?.includes('conexão') || p?.includes('Desconectado') ? null : p); // Clear connection errors
      });

      newSocket.on('disconnect', (reason) => {
        console.log('[WalletTab] WebSocket disconnected:', reason);
        setSocket(null);
        // Only set error for unexpected disconnects
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
        console.log('[WalletTab] WS Received walletDataUpdate. Raw Data:', data); // Log raw data
        if (data && data.balance && Array.isArray(data.transactions)) {
          toast.info("Carteira atualizada.");
          console.log("[WalletTab] Updating state via WS. Balance:", data.balance, "Txs:", data.transactions.length);
          setBalance(data.balance);
          const sorted = [...data.transactions].sort((a, b) => (new Date(b.timestamp).getTime()) - (new Date(a.timestamp).getTime()));
          setTransactions(sorted);
          setLoading(false); // Ensure loading is off after WS update
          setError(null); // Clear previous errors on successful update
        } else {
          console.warn('[WalletTab] WS received unexpected data format. Re-fetching.', data);
          toast.warn("Dados da carteira recebidos em formato inesperado. Rebuscando...");
          fetchWalletData(); // Fallback to fetching via API
        }
      };

      newSocket.on('walletDataUpdate', handleUpdate);

      // Store the socket instance
      setSocket(newSocket);

    } catch (err) {
      console.error("[WalletTab] WebSocket initialization error:", err);
      setError("Falha ao iniciar conexão para atualizações.");
    }

    // Cleanup function
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
  }, [isInitialized, fetchWalletData]); // Rerun if isInitialized changes or fetchWalletData reference changes
  // --- End Effects ---

  // --- Function to handle sending BCH ---
  const handleSendSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const amountToSendNum = parseFloat(sendForm.amountBCH || '0');

      console.log('[WalletTab] handleSendSubmit started.');
      setIsSending(true);
      setError(null); // Clear previous modal errors

      try {
          const token = localStorage.getItem('token');
          if (!token) throw new Error('Usuário não autenticado.');
          if (amountToSendNum <= 0) throw new Error('Quantidade inválida.');
          let isValidAddress = false;
          try {
              // Basic validation - backend does the real check
              new bitcore.Address(sendForm.address.trim());
              isValidAddress = true;
          } catch {
              isValidAddress = false;
          }
          if (!isValidAddress) throw new Error('Endereço de destino parece inválido.');

          console.log('[WalletTab] Attempting send via backend API...');
          // --- FIX: Update API endpoint path ---
          const response = await fetch(`${API_BASE_URL}/wallet/transactions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ address: sendForm.address.trim(), amount: sendForm.amountBCH, fee: sendForm.fee })
          });

          const responseBody = await response.text(); // Read body once

          if (!response.ok) {
              let errorMsg = `Erro ${response.status}: Falha ao enviar.`;
              try { const d = JSON.parse(responseBody); errorMsg = d.message || errorMsg; }
              catch { errorMsg = `${errorMsg} Resposta: ${responseBody}`; }
              throw new Error(errorMsg);
          }

          const result = JSON.parse(responseBody);
          console.log('[WalletTab] Send successful:', result);
          toast.success(`Transação enviada! Hash: ${formatAddress(result.txid)}`);

          if (result.txid) { // Optimistic UI Update
              const currentRate = balance.currentRateBRL || 0;
              // Optimistic amount should include the estimated fee now
              const optimisticAmountBCH = amountToSendNum + estimatedFeeClientSide;
              const optimisticAmountBRL = optimisticAmountBCH * currentRate;

              const newTx: Transaction = {
                  _id: result.txid, type: 'sent',
                  amount: optimisticAmountBCH, // CHANGE: Use 'amount'
                  convertedBRL: optimisticAmountBRL, // CHANGE: Use 'convertedBRL'
                  address: sendForm.address.trim(), txid: result.txid, timestamp: new Date().toISOString(),
                  status: 'pending', confirmations: 0,
                  fee: undefined // Fee is now part of amount
              };
              // Add to transactions list
              setTransactions(prev => [newTx, ...prev].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

              // Optimistically update balance (approximate)
              const approxRequiredSatoshis = Math.round((amountToSendNum + estimatedFeeClientSide) * SATOSHIS_PER_BCH);
              setBalance(prev => {
                  // Reduce available immediately, pending reflects the outgoing amount until confirmed
                  const newAvailable = Math.max(0, prev.availableBCH - (amountToSendNum + estimatedFeeClientSide));
                  // Pending might already be negative, add the new negative amount
                  const newPending = prev.pendingBCH - (amountToSendNum + estimatedFeeClientSide);
                  const newTotal = newAvailable + newPending; // Total reflects pending changes
                  return {
                      ...prev,
                      availableBCH: newAvailable,
                      pendingBCH: newPending,
                      totalBCH: newTotal,
                      totalSatoshis: Math.max(0, prev.totalSatoshis - approxRequiredSatoshis),
                      totalBRL: newTotal * (prev.currentRateBRL || 0),
                  };
              });

              // Add notification
              addNotification({
                  id: result.txid, message: `Enviado ${amountToSendNum.toFixed(8)} BCH para ${formatAddress(sendForm.address.trim())}`,
                  amountBCH: amountToSendNum, // Notification might still show just the sent amount
                  amountBRL: amountToSendNum * currentRate,
                  timestamp: new Date().toISOString(),
                  receivedAt: new Date().toLocaleTimeString('pt-BR'),
                  onViewDetails: () => { window.open(`${BCH_EXPLORER_TX_URL}${result.txid}`, '_blank'); }
              });
          }

          console.log('[WalletTab] Scheduling data refresh after send...');
          setTimeout(fetchWalletData, 8000); // Refresh after a delay

          setSendModalOpen(false);
          setSendForm({ address: '', amountBCH: '', amountBRL: '', fee: 'medium' });

      } catch (err: any) {
          console.error('[WalletTab] Error handleSendSubmit:', err);
          setError(err.message || 'Erro inesperado ao tentar enviar.'); // Set error state for modal display
      } finally {
          setIsSending(false);
      }
  };

  // --- Copy to Clipboard ---
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

  // --- Handle Amount Change ---
  const handleAmountChange = (value: string, type: 'BCH' | 'BRL') => {
      const cleanValue = value.replace(',', '.');
      const currentRate = balance.currentRateBRL || 0;

      if (cleanValue === '' || cleanValue === '.') {
          setSendForm({ ...sendForm, amountBCH: '', amountBRL: '' });
          return;
      }

      // Allow only numbers and one decimal point
      if (!/^\d*\.?\d*$/.test(cleanValue)) {
          return; // Ignore invalid input
      }

      const numericValue = parseFloat(cleanValue);

      if (isNaN(numericValue) && cleanValue !== '.') {
          // Handle cases like "0." or "." which parseFloat turns into 0 or NaN
          if (type === 'BCH') setSendForm({ ...sendForm, amountBCH: cleanValue, amountBRL: '' });
          else setSendForm({ ...sendForm, amountBRL: cleanValue, amountBCH: '' });
          return;
      }

      if (type === 'BCH') {
          const bchAmountStr = cleanValue; // Keep user input format
          // Calculate BRL only if BCH is a valid number and rate exists
          const brlAmountStr = isNaN(numericValue) && currentRate > 0 ? (numericValue * currentRate).toFixed(2) : '';
          setSendForm({ ...sendForm, amountBCH: bchAmountStr, amountBRL: brlAmountStr });
      } else { // type === 'BRL'
          const brlAmountStr = cleanValue; // Keep user input format
          // Calculate BCH only if BRL is a valid number and rate exists
          const bchAmountNum = !isNaN(numericValue) && currentRate > 0 ? (numericValue / currentRate) : 0;
          // Format BCH to 8 decimal places if calculation is valid
          const bchAmountStr = bchAmountNum > 0 ? bchAmountNum.toFixed(8) : '';
          setSendForm({ ...sendForm, amountBRL: brlAmountStr, amountBCH: bchAmountStr });
      }
  };

  // --- Component Rendering ---
  return (
    <div className="p-6 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] min-h-screen">
      {/* Header */}
      <div className="flex flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold ">Minha Carteira Bitcoin Cash</h2>
        <div className="flex items-center gap-4 flex-wrap">
          {/* WS Status */}
          <div className="flex items-center gap-2 text-sm">
            {socket?.connected ? ( <span className="flex items-center gap-1 text-green-400"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> ON</span>
            ) : error?.includes('conexão') || error?.includes('Desconectado') ? ( <span className="flex items-center gap-1 text-red-400"><span className="w-2 h-2 rounded-full bg-red-500"></span> OFF</span>
            ) : ( <span className="flex items-center gap-1 text-yellow-400"><span className="w-2 h-2 rounded-full bg-yellow-500 animate-spin"></span> ...</span> )}
          </div>
          {/* Refresh */}
          <button onClick={fetchWalletData} disabled={loading || !isInitialized} className="p-2 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed">
            <FiRefreshCw className={` ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Error (outside modals) */}
      {error && !sendModalOpen && !receiveModalOpen && (
        <div className="bg-red-800 border border-red-600 text-white px-4 py-3 rounded relative mb-6 shadow-md" role="alert">
            <strong>Erro: </strong> <span className="block sm:inline">{error}</span>
            <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-300 hover:text-white">✕</button>
        </div>
      )}

      {/* Balance Section */}
      <div className="flex flex-col items-center mb-8">
        <div className="bg-[var(--color-bg-primary-dark)] rounded-lg p-6 shadow-lg text-center border-t-4 border-[rgb(112,255,189)]">
          <h3 className="text-white text-sm font-medium flex items-center gap-2">
            <FiDollarSign className="text-white" /> Saldo Disponível
          </h3>
          {loading || !isInitialized ? (
            <div className="mt-2 space-y-2 animate-pulse">
              <div className="h-6 bg-[var(--color-accent-dark)] rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-[var(--color-accent-dark)] rounded w-1/2 mx-auto"></div>
            </div>
          ) : (
            <>
              <p className="text-4xl font-bold mt-2 text-white">{formatBCH(balance.totalBCH)}</p>
              <p className="text-white mt-1">{formatCurrency(balance.totalBRL)}</p>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4 mb-8 justify-center">
        <button
          onClick={() => {
            if (!isInitialized || loading) {
              toast.warn("Aguarde inicialização.");
              return;
            }
            if (!walletAddress) {
              toast.error("Endereço indisponível.");
              return;
            }
            setSendModalOpen(true);
            setError(null);
          }}
          disabled={!isInitialized || loading}
          className="flex items-center gap-2 bg-green-600 bg-opacity-80 hover:border-green-400 hover:border-[4px] hover:brightness-110 transition-all duration-150 ease-in-out hover:-translate-y-0.5 hover:scale-110 hover:bg-green-700 text-white px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-md"

        >
          <FiArrowUp /> Enviar BCH
        </button>
        <button
          onClick={() => {
            if (!isInitialized || !walletAddress) {
              toast.error("Endereço indisponível.");
              return;
            }
            setReceiveModalOpen(true);
            setError(null);
          }}
          disabled={!isInitialized || !walletAddress}
          className="flex items-center gap-2 bg-green-600 transition delay-150 duration-150 ease-in-out hover:-translate-y-0.5 hover:scale-110 hover:bg-green-700 text-white px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-md"

        >
          <FiArrowDown /> Receber BCH
        </button>
        <button disabled title="Em breve" className="flex items-center gap-2 bg-gray-600 text-gray-400 px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-md"> <FiDollarSign /> Converter </button>
      </div>

      {/* Recent Transactions */}
      <div style={{
  }}className="bg-[var(--color-bg-primary-dark)] rounded-lg p-6 shadow-lg border-t-4 border-[rgb(112,255,189)]">
        <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
          <FiClock className="text-white" /> Transações Recentes
        </h3>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-white">
            Nenhuma transação encontrada.
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div
                key={tx._id}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 hover:bg-[var(--color-bg-secondary-dark)] rounded-lg border-b border-[var(--color-border-dark)] last:border-b-0"
              >
                <div className="flex items-center gap-4 mb-2 sm:mb-0 w-full sm:w-auto">
                  <div
                    className={`flex-shrink-0 p-3 rounded-full ${
                      tx.type === 'received'
                        ? 'bg-[var(--color-accent-dark)] text-green-400'
                        : tx.type === 'sent'
                        ? 'bg-[var(--color-accent-dark)] text-red-400'
                        : tx.type === 'self'
                        ? 'bg-[var(--color-accent-dark)] text-blue-400'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {tx.type === 'received' ? (
                      <FiArrowDown size={20} />
                    ) : tx.type === 'sent' ? (
                      <FiArrowUp size={20} />
                    ) : tx.type === 'self' ? (
                      <FiRefreshCw size={20} />
                    ) : (
                      <FiClock size={20} />
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-medium text-sm sm:text-base truncate text-white">
                      {tx.type === 'received'
                        ? 'Recebido'
                        : tx.type === 'sent'
                        ? 'Enviado'
                        : tx.type === 'self'
                        ? 'Para si'
                        : 'Desconhecido'}
                    </p>
                    <p className="text-xs sm:text-sm text-white">
                      {formatDate(tx.timestamp)}
                    </p>
                    <a
                      href={`${BCH_EXPLORER_TX_URL}${tx.txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-200 hover:text-blue-100 break-all block mt-1"
                      title={tx.txid}
                    >
                      Hash: {formatAddress(tx.txid, 8)}
                    </a>
                  </div>
                </div>
                <div className="flex flex-col items-end ml-auto sm:ml-0 pl-16 sm:pl-0 flex-shrink-0">
                  <p
                    className={`font-bold text-sm sm:text-base whitespace-nowrap ${
                      tx.type === 'received'
                        ? 'text-green-200'
                        : tx.type === 'sent'
                        ? 'text-red-200'
                        : 'text-gray-200'
                    }`}
                  >
                    {tx.type === 'received' ? '+' : tx.type === 'sent' ? '-' : ''} {formatBCH(tx.amount)}
                  </p>
                  <p className="text-xs sm:text-sm text-white whitespace-nowrap">
                    {formatCurrency(tx.convertedBRL)}
                  </p>
                  <div className="mt-1">
                    {tx.status === 'confirmed' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Confirmado ({tx.confirmations > 99 ? '99+' : tx.confirmations} conf.)
                      </span>
                    ) : tx.status === 'pending' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pendente ({tx.confirmations} conf.)
                      </span>
                    ) : tx.status === 'error' ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"
                        title={tx.errorMessage}
                      >
                        Erro
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        Desconhecido
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- Send Modal --- */}
      {sendModalOpen && (
        <div className="fixed inset-0 bg-opacity-75 transition delay-0 duration-150 ease-in-out hover:-translate-y-0.5 hover:scale-110 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 w-full max-w-md shadow-xl border border-[var(--color-border)]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Enviar Bitcoin Cash</h3>
                    <button onClick={() => !isSending && setSendModalOpen(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50" disabled={isSending}> ✕ </button>
                </div>
                {/* Modal-specific error display */}
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

                        {/* Use Available Balance Button */}
                        <button
                            type="button"
                            onClick={() => {
                                const available = balance.availableBCH;
                                // Subtract a slightly larger estimated fee just in case
                                const usableAmount = Math.max(0, available - (estimatedFeeClientSide * 1.1));
                                if (usableAmount > 0) {
                                    handleAmountChange(usableAmount.toFixed(8), 'BCH');
                                } else {
                                    handleAmountChange('0', 'BCH');
                                    toast.warn("Saldo disponível insuficiente para cobrir taxa estimada.");
                                }
                            }}
                            disabled={isSending || balance.availableBCH <= (estimatedFeeClientSide * 1.1)}
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
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* --- Receive Modal --- */}
      {receiveModalOpen && (
          <div className="fixed inset-0 bg-transparent bg-opacity-75 transition delay-0 duration-150 ease-in-out hover:-translate-y-0.5 hover:scale-110 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 w-full max-w-md shadow-xl border border-[var(--color-border)]">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Receber Bitcoin Cash</h3>
                      <button onClick={() => setReceiveModalOpen(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"> ✕ </button>
                  </div>
                  <div className="text-center">
                      <div className="bg-white p-4 rounded-lg inline-block mb-6 shadow-md">
                          {walletAddress ? (
                              <QRCode value={walletAddress} size={192} level="M" bgColor="#FFFFFF" fgColor="#000000"/>
                          ) : (
                              <div className="w-48 h-48 bg-gray-200 flex items-center justify-center text-gray-500 animate-pulse"> Carregando... </div>
                          )}
                      </div>
                      <div className="mb-6">
                          <p className="text-sm text-[var(--color-text-secondary)] mb-2">Seu endereço</p>
                          <div className="flex items-center justify-between bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] p-3 rounded-lg">
                              <span className="font-mono text-green-400 overflow-x-auto text-sm break-all mr-2">
                                  {walletAddress || 'Carregando...'}
                              </span>
                              <button onClick={copyToClipboard} disabled={!walletAddress || isCopied} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex-shrink-0 disabled:opacity-50" title={isCopied ? "Copiado!" : "Copiar"}>
                                  {isCopied ? <FiCheckCircle className="text-green-500" /> : <FiCopy />}
                              </button>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                          <button disabled title="Em breve" className="py-2 border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"> Compartilhar </button>
                          <button onClick={copyToClipboard} disabled={!walletAddress || isCopied} className="py-2 bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] rounded-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                              {isCopied ? <FiCheckCircle /> : <FiCopy />} {isCopied ? 'Copiado!' : 'Copiar'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div> // Closing main component div
  ); // Closing return statement
} // Closing WalletTab function

