// src/pages/dashboard/tabs/2wallettab.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { FiArrowUp, FiArrowDown, FiCopy, FiDollarSign, FiCode, FiClock, FiRefreshCw, FiCheckCircle } from 'react-icons/fi';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-toastify';
import QRCode from 'react-qr-code';
import bitcore from 'bitcore-lib-cash'; // Keep for client-side address validation before sending

import { useNotification } from '../../../context/NotificationContext';

// --- Configuration ---
const API_BASE_URL = 'http://localhost:3000/api'; // For backend calls
const WEBSOCKET_URL = 'http://localhost:3000'; // For backend notifications
const BCH_EXPLORER_TX_URL = 'https://explorer.bitcoinabc.org/tx/';
const SATOSHIS_PER_BCH = 1e8;
const estimatedFee = 0.00001; // Used only for optimistic UI update, backend calculates real fee

// --- Types (Matching Backend Controller Output) ---
type Transaction = {
  _id: string; // Use txid as _id
  type: 'received' | 'sent' | 'unknown';
  amountBCH: number;
  amountBRL: number; // Backend calculates this
  address: string; // Recipient for 'sent', own for 'received', potentially 'N/A' or 'Multiple/Unknown'
  txid: string;
  timestamp: string; // ISO string format expected from backend
  status: 'pending' | 'confirmed';
  confirmations: number;
  blockHeight?: number;
  fee?: number; // Fee in BCH, only present for 'sent' type
};

type WalletBalance = {
  totalBCH: number;
  availableBCH: number; // Confirmed balance
  pendingBCH: number;   // Unconfirmed balance
  totalBRL: number;     // Backend calculates this based on totalBCH and current rate
  totalSatoshis: number;
  currentRateBRL?: number; // Backend provides the rate used for BRL conversion
};

// --- WalletTab Component ---
export function WalletTab() {
  const { addNotification } = useNotification();
  // --- States ---
  const [balance, setBalance] = useState<WalletBalance>({ totalBCH: 0, availableBCH: 0, pendingBCH: 0, totalBRL: 0, totalSatoshis: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true); // True initially until address and first data load
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [sendModalOpen, setSendModalOpen] = useState<boolean>(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState<boolean>(false);
  const [sendForm, setSendForm] = useState({ address: '', amountBCH: '', amountBRL: '', fee: 'medium' as 'low' | 'medium' | 'high' });
  const [isSending, setIsSending] = useState<boolean>(false);
  const [socket, setSocket] = useState<Socket | null>(null); // Backend socket
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState(false); // Tracks if wallet address is fetched

  // --- fetchWalletData using NEW Backend API Endpoints ---
  const fetchWalletData = useCallback(async () => {
    // Don't fetch if address isn't initialized yet
    if (!walletAddress) {
      console.log("[WalletTab] fetchWalletData: Skipping, walletAddress not yet available.");
      // Ensure loading is false if we skip here after initialization failed
      if (isInitialized) setLoading(false);
      return;
    }

    console.log(`[WalletTab] fetchWalletData called (Using Backend API)`);
    setLoading(true);
    setError(null); // Clear previous errors on fetch start

    const token = localStorage.getItem('token');
    if (!token) {
        setError("Usuário não autenticado.");
        setLoading(false);
        return;
    }

    try {
      // Fetch balance and transactions concurrently using new endpoints
      const [balanceResponse, transactionsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/wallet/balance`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/wallet/transactions`, { // Add query params later if needed (e.g., ?limit=50)
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      // Process Balance Response
      if (!balanceResponse.ok) {
        const errorData = await balanceResponse.json().catch(() => ({ message: balanceResponse.statusText }));
        throw new Error(`Erro ao buscar saldo: ${errorData.message}`);
      }
      const fetchedBalance: WalletBalance = await balanceResponse.json();
      setBalance(fetchedBalance);
      console.log("[WalletTab] Balance state updated from backend:", fetchedBalance);

      // Process Transactions Response
      if (!transactionsResponse.ok) {
        const errorData = await transactionsResponse.json().catch(() => ({ message: transactionsResponse.statusText }));
        throw new Error(`Erro ao buscar transações: ${errorData.message}`);
      }
      const fetchedTransactions: Transaction[] = await transactionsResponse.json();
      // Backend controller should already sort, but sorting here ensures order
      fetchedTransactions.sort((a, b) => (new Date(b.timestamp).getTime()) - (new Date(a.timestamp).getTime()));
      setTransactions(fetchedTransactions);
      console.log(`[WalletTab] Transactions state updated from backend (${fetchedTransactions.length} items).`);

      console.log("[WalletTab] fetchWalletData completed successfully (Backend API).");

    } catch (err: any) {
      console.error('[WalletTab] Error in fetchWalletData (Backend API):', err);
      // Avoid setting the same error message repeatedly if fetch fails multiple times
      setError(prevError => prevError === err.message ? prevError : err.message);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, isInitialized]); // Depend on walletAddress and initialization status

  // --- Effects ---
  // Effect 1: Initialize Wallet Address (Using NEW Backend API Endpoint)
  useEffect(() => {
    const initializeWallet = async () => {
        console.log('[WalletTab] Initializing wallet address (using backend API)...');
        setLoading(true); // Start loading
        setError(null);
        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('Token não encontrado.');

            const addrResponse = await fetch(`${API_BASE_URL}/wallet/address`, { // Use new endpoint
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!addrResponse.ok) {
                const errorData = await addrResponse.json().catch(() => ({ message: 'Falha ao buscar endereço do backend.' }));
                throw new Error(errorData.message);
            }

            const addrData = await addrResponse.json();
            if (!addrData.address) throw new Error('Endereço não retornado pelo backend.');

            setWalletAddress(addrData.address);
            setIsInitialized(true); // Mark as initialized *after* getting address
            console.log("[WalletTab] Wallet address obtained from backend:", addrData.address);
            // fetchWalletData will be triggered by the state change in Effect 2

        } catch (initError: any) {
            console.error("[WalletTab] Error initializing wallet (backend fetch):", initError);
            setError(initError.message || "Erro ao obter endereço da carteira do backend.");
            setIsInitialized(true); // Mark as initialized even on error to stop trying
            setLoading(false); // Stop loading on initialization error
        }
    };
    initializeWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Effect 2: Fetch Data when Wallet Address is Ready (or re-fetch if address changes - unlikely)
  useEffect(() => {
    if (isInitialized && walletAddress) {
        console.log("[WalletTab] Effect 2: Wallet initialized and address available, fetching data...");
        fetchWalletData();
    } else if (isInitialized && !walletAddress) {
        // Handle case where initialization finished but failed to get address
        console.log("[WalletTab] Effect 2: Wallet initialized but no address obtained.");
        setLoading(false); // Ensure loading stops
    } else {
        console.log(`[WalletTab] Effect 2: Skipping data fetch (Initialized: ${isInitialized}, Address: ${!!walletAddress})`);
    }
  }, [isInitialized, walletAddress, fetchWalletData]); // Depend on initialization status, address, and the fetch function itself

  // Effect 3: Setup Backend WebSocket (Listens for backend notifications, DIRECTLY updates state)
  useEffect(() => {
    // Only connect AFTER the address is initialized (successfully or not)
    if (!isInitialized) {
        console.log(`[WalletTab] BackendWS Effect: Skipping, not initialized yet.`);
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        console.warn("[WalletTab] Backend WebSocket: No token found, cannot connect.");
        return;
    }

    console.log('[WalletTab] Setting up WebSocket connection to backend...');
    let newSocket: Socket | null = null;
    try {
        newSocket = io(WEBSOCKET_URL, {
            auth: { token },
            reconnectionAttempts: 5,
            transports: ['websocket'] // Match backend config
        });

        newSocket.on('connect', () => {
            console.log('[WalletTab] Backend WebSocket connected:', newSocket?.id);
            setSocket(newSocket);
            setError(prev => prev?.includes('conexão') ? null : prev);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('[WalletTab] Backend WebSocket disconnected:', reason);
            setSocket(null);
            if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
                setError("Desconectado das atualizações em tempo real do backend.");
            }
        });

        newSocket.on('connect_error', (err) => {
            console.error('[WalletTab] Backend WebSocket connection error:', err.message);
            setError(`Erro na conexão real-time com backend: ${err.message}.`);
            setSocket(null);
        });

        // --- MODIFIED: Handler to directly use WebSocket payload ---
        const handleWalletDataUpdate = (updateData: { balance: WalletBalance, transactions: Transaction[] }) => {
            console.log('[WalletTab] Backend WebSocket: Received walletDataUpdate.', updateData);

            // Validate received data structure
            if (updateData && updateData.balance && Array.isArray(updateData.transactions)) {
                toast.info("Dados da carteira atualizados via WebSocket.");

                // Directly update state from WebSocket payload
                setBalance(updateData.balance);

                // Ensure transactions are sorted by timestamp (descending)
                const sortedTransactions = [...updateData.transactions].sort((a, b) => (new Date(b.timestamp).getTime()) - (new Date(a.timestamp).getTime()));
                setTransactions(sortedTransactions);

                setLoading(false); // Ensure loading state is off
                setError(null); // Clear any previous errors
                console.log("[WalletTab] State updated directly from WebSocket payload.");

            } else {
                // Fallback if data format is unexpected
                console.warn('[WalletTab] Received walletDataUpdate event, but data format is unexpected. Re-fetching via API as fallback.', updateData);
                toast.warn("Formato de atualização inesperado. Rebuscando dados...");
                fetchWalletData(); // Trigger API fetch as a fallback
            }
        };

        // --- MODIFIED: Listen to the correct event name ---
        newSocket.on('walletDataUpdate', handleWalletDataUpdate); // Changed event name here

    } catch (socketError) {
        console.error("[WalletTab] Error initializing backend WebSocket:", socketError);
        setError("Falha ao iniciar a conexão para atualizações em tempo real do backend.");
    }

    // Cleanup function
    return () => {
        if (newSocket) {
            console.log('[WalletTab] BackendWS Effect: Cleaning up backend WebSocket...');
            newSocket.off('connect');
            newSocket.off('disconnect');
            newSocket.off('connect_error');
            // --- MODIFIED: Ensure the correct listener is removed ---
            newSocket.off('walletDataUpdate', handleWalletDataUpdate);
            newSocket.disconnect();
        }
        setSocket(null); // Clear socket state on cleanup
    };
    // Re-run if initialization status changes or fetchWalletData function reference changes
  }, [isInitialized, fetchWalletData]); // fetchWalletData is still needed for the fallback

  // --- Function to handle sending BCH (Uses NEW Backend API Endpoint) ---
  const handleSendSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      console.log('[WalletTab] handleSendSubmit started (using backend API).');
      setIsSending(true);
      setError(null); // Clear previous send errors

      try {
          const token = localStorage.getItem('token');
          if (!token) throw new Error('Usuário não autenticado.');

          const amountToSend = parseFloat(sendForm.amountBCH);
          if (isNaN(amountToSend) || amountToSend <= 0) throw new Error('Quantidade inválida.');

          // Client-side address validation (optional but good UX)
          let isValidAddress = false;
          try {
              new bitcore.Address(sendForm.address.trim(), bitcore.Networks.mainnet); // Or use config.network from backend if available client-side
              isValidAddress = true;
          } catch {}
          if (!isValidAddress) throw new Error('Endereço de destino inválido.');

          console.log('[WalletTab] Attempting to send transaction via backend API...');
          const response = await fetch(`${API_BASE_URL}/wallet/send`, { // Use new endpoint
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                  address: sendForm.address.trim(),
                  amount: sendForm.amountBCH, // Send as string, backend parses
                  fee: sendForm.fee // Send fee level ('low', 'medium', 'high')
              })
          });

          // Handle backend response (success or error)
          if (!response.ok) {
              let errorMsg = `Erro ${response.status}: Falha ao enviar via backend.`;
              try {
                  const errorData = await response.json();
                  // Use the specific message from the backend controller
                  errorMsg = errorData.message || errorMsg;
              } catch {
                  // Fallback if parsing error JSON fails
                  errorMsg = `${errorMsg} Resposta: ${await response.text()}`;
              }
              throw new Error(errorMsg); // Throw backend error message
          }

          // Handle successful response from backend
          const result = await response.json(); // Expects { txid: '...' }
          console.log('[WalletTab] Send successful (backend response):', result);
          toast.success(`Transação enviada! Hash: ${formatAddress(result.txid)}`);

          if (result.txid) {
              // --- Optimistic UI Update ---
              // Add a pending 'sent' transaction locally
              const currentRate = balance.currentRateBRL || 0; // Use last known rate
              const optimisticAmountBRL = amountToSend * currentRate;
              const newTransaction: Transaction = {
                  _id: result.txid, // Use txid as key
                  type: 'sent',
                  amountBCH: amountToSend,
                  amountBRL: optimisticAmountBRL,
                  address: sendForm.address.trim(),
                  txid: result.txid,
                  timestamp: new Date().toISOString(), // Use current time
                  status: 'pending', // Mark as pending
                  confirmations: 0,
                  fee: estimatedFee // Show estimated fee optimistically
              };
              setTransactions((prev) => [newTransaction, ...prev].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

              // Optionally, update balance optimistically (less critical, fetchWalletData will correct)
              const approxRequiredSatoshis = Math.round((amountToSend + estimatedFee) * SATOSHIS_PER_BCH);
              setBalance(prev => ({
                  ...prev,
                  // Reduce available and total immediately for better UX
                  availableBCH: Math.max(0, prev.availableBCH - (amountToSend + estimatedFee)),
                  totalBCH: Math.max(0, prev.totalBCH - (amountToSend + estimatedFee)),
                  totalSatoshis: Math.max(0, prev.totalSatoshis - approxRequiredSatoshis),
                  // Recalculate BRL based on new estimated total BCH
                  totalBRL: Math.max(0, prev.totalBCH - (amountToSend + estimatedFee)) * (prev.currentRateBRL || 0),
                  // Pending balance might not change immediately, depends on backend logic
              }));

              // Add notification
              addNotification({
                  id: result.txid,
                  message: `Enviado ${amountToSend.toFixed(8)} BCH para ${formatAddress(sendForm.address.trim())}`,
                  amountBCH: amountToSend,
                  amountBRL: optimisticAmountBRL,
                  timestamp: new Date().toISOString(),
                  receivedAt: new Date().toLocaleTimeString('pt-BR'),
                  onViewDetails: () => { window.open(`${BCH_EXPLORER_TX_URL}${result.txid}`, '_blank'); }
              });
              // --- End Optimistic UI Update ---
          }

          // Schedule data refresh from backend after a delay (still useful as a final confirmation)
          console.log('[WalletTab] Scheduling data refresh after send...');
          setTimeout(fetchWalletData, 8000); // Refresh after 8 seconds

          // Reset form and close modal
          setSendModalOpen(false);
          setSendForm({ address: '', amountBCH: '', amountBRL: '', fee: 'medium' });

      } catch (err: any) {
          console.error('[WalletTab] Error in handleSendSubmit:', err);
          setError(err.message || 'Erro inesperado ao tentar enviar.'); // Show error in modal
      } finally {
          setIsSending(false); // Re-enable send button
      }
  };

  // --- Formatting Functions (Unchanged, rely on backend for BRL rate via balance state) ---
    const formatCurrency = (value: number | undefined) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatBCH = (value: number | undefined) => (Number(value) || 0).toFixed(8) + ' BCH';
    const formatDate = (dateString: string | undefined) => { if (!dateString) return 'Data indisponível'; try { const date = new Date(dateString); return isNaN(date.getTime()) ? 'Data inválida' : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return 'Data inválida'; } };
    const formatAddress = (address: string | undefined, length: number = 6): string => { if (!address || typeof address !== 'string' || address.length < length * 2 + 3) return address || 'N/A'; const cleanAddress = address.includes(':') ? address.split(':')[1] : address; if (!cleanAddress || cleanAddress.length < length * 2 + 3) return cleanAddress || address; return `${cleanAddress.substring(0, length)}...${cleanAddress.substring(cleanAddress.length - length)}`; };

  // --- Copy to Clipboard (Unchanged) ---
    const copyToClipboard = () => { if (!walletAddress) return; navigator.clipboard.writeText(walletAddress).then(() => { setIsCopied(true); toast.success('Endereço copiado!'); setTimeout(() => setIsCopied(false), 2000); }).catch(err => { console.error('Erro ao copiar:', err); toast.error('Falha ao copiar.'); }); };

  // --- Handle Amount Change (Uses currentRateBRL from balance state) ---
    const handleAmountChange = (value: string, type: 'BCH' | 'BRL') => {
        const cleanValue = value.replace(',', '.');
        // Use rate fetched from backend via balance state
        const currentRate = balance.currentRateBRL || 0;

        if (cleanValue === '') {
            setSendForm({ ...sendForm, amountBCH: '', amountBRL: '' });
            return;
        }

        const numericValue = parseFloat(cleanValue);

        // Basic input validation
        if (isNaN(numericValue) && cleanValue !== '.' && !/^\d+\.$/.test(cleanValue) && !/^\d*\.\d*$/.test(cleanValue) && !/^\d+$/.test(cleanValue)) {
            if (type === 'BCH') setSendForm({ ...sendForm, amountBCH: value, amountBRL: '' });
            else setSendForm({ ...sendForm, amountBRL: value, amountBCH: '' });
            return;
        }

        // Calculate the other field
        if (type === 'BCH') {
            const bchAmount = value;
            const brlAmount = !isNaN(numericValue) && currentRate > 0 ? (numericValue * currentRate).toFixed(2) : '';
            setSendForm({ ...sendForm, amountBCH: bchAmount, amountBRL: brlAmount });
        } else { // type === 'BRL'
            const brlAmount = value;
            const bchAmount = !isNaN(numericValue) && currentRate > 0 ? (numericValue / currentRate).toFixed(8) : '';
            setSendForm({ ...sendForm, amountBRL: brlAmount, amountBCH: bchAmount });
        }
    };

  // --- Component Rendering (Largely unchanged, but relies on state updated by backend fetches or WebSocket) ---
  return (
    <div className="p-6 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold">Minha Carteira Bitcoin Cash</h2>
        <div className="flex items-center gap-4 flex-wrap">
          {/* Backend WebSocket Status */}
          <div className="flex items-center gap-2 text-sm">
            {socket?.connected ? ( <span className="flex items-center gap-1 text-green-400" title="Conectado ao backend"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Backend ON</span>
            ) : error?.includes('backend') || error?.includes('conexão') ? ( <span className="flex items-center gap-1 text-red-400" title={error || "Desconectado do backend"}><span className="w-2 h-2 rounded-full bg-red-500"></span> Backend OFF</span>
            ) : ( <span className="flex items-center gap-1 text-yellow-400" title="Conectando ao backend..."><span className="w-2 h-2 rounded-full bg-yellow-500 animate-spin"></span> Conectando...</span> )}
          </div>
          {/* Refresh Button */}
          <button
            onClick={fetchWalletData}
            disabled={loading || !isInitialized} // Disable if loading or not yet initialized
            className="p-2 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Atualizar dados da carteira"
          >
            <FiRefreshCw className={` ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Error Display (Show non-modal errors) */}
      {error && !sendModalOpen && !receiveModalOpen && (
        <div className="bg-red-800 border border-red-600 text-white px-4 py-3 rounded relative mb-6 shadow-md" role="alert">
            <strong className="font-bold">Erro: </strong>
            <span className="block sm:inline">{error}</span>
            <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-300 hover:text-white focus:outline-none">✕</button>
        </div>
      )}

      {/* Balance Cards - Skeleton shown until initialized */}
      {!isInitialized ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-pulse">
              {[...Array(3)].map((_, i) => <div key={i} className="bg-[var(--color-bg-secondary)] h-32 rounded-lg p-6 shadow-md"></div>)}
          </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Total Balance */}
          <div className="bg-gradient-to-br from-blue-800 to-blue-900 rounded-lg p-6 shadow-lg text-white">
              <div className="flex justify-between items-start">
                  <div>
                      <h3 className="text-blue-200 text-sm font-medium">Saldo Total</h3>
                      {loading ? (
                          <div className="mt-2 space-y-2 animate-pulse">
                              <div className="h-6 bg-blue-700 rounded w-3/4"></div>
                              <div className="h-4 bg-blue-700 rounded w-1/2"></div>
                          </div>
                      ) : (
                          <>
                              <p className="text-2xl font-bold mt-2">{formatBCH(balance.totalBCH)}</p>
                              <p className="text-blue-200 mt-1">{formatCurrency(balance.totalBRL)}</p>
                          </>
                      )}
                  </div>
                  <div className="bg-blue-700 p-3 rounded-full"> <FiDollarSign size={24} /> </div>
              </div>
          </div>
          {/* Available Balance */}
          <div className="bg-gradient-to-br from-green-800 to-green-900 rounded-lg p-6 shadow-lg text-white">
              <div className="flex justify-between items-start">
                  <div>
                      <h3 className="text-green-200 text-sm font-medium">Disponível</h3>
                      {loading ? (
                          <div className="mt-2 space-y-2 animate-pulse">
                              <div className="h-6 bg-green-700 rounded w-3/4"></div>
                              <div className="h-4 bg-green-700 rounded w-1/2"></div>
                          </div>
                      ) : (
                          <>
                              <p className="text-2xl font-bold mt-2">{formatBCH(balance.availableBCH)}</p>
                              {/* Calculate available BRL using fetched rate */}
                              <p className="text-green-200 mt-1">{formatCurrency(balance.availableBCH * (balance.currentRateBRL || 0))}</p>
                          </>
                      )}
                  </div>
                  <div className="bg-green-700 p-3 rounded-full"> <FiCheckCircle size={24} /> </div>
              </div>
          </div>
          {/* Pending Balance - Only show if pending > 0 OR loading */}
          {(loading || balance.pendingBCH > 0) && (
              <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-lg p-6 shadow-lg text-white">
                  <div className="flex justify-between items-start">
                      <div>
                          <h3 className="text-yellow-200 text-sm font-medium">Pendente</h3>
                          {loading ? (
                              <div className="mt-2 space-y-2 animate-pulse">
                                  <div className="h-6 bg-yellow-500 rounded w-3/4"></div>
                                  <div className="h-4 bg-yellow-500 rounded w-1/2"></div>
                              </div>
                          ) : (
                              <>
                                  <p className="text-2xl font-bold mt-2">{formatBCH(balance.pendingBCH)}</p>
                                  <p className="text-yellow-200 mt-1">{formatCurrency(balance.pendingBCH * (balance.currentRateBRL || 0))}</p>
                              </>
                          )}
                      </div>
                      <div className="bg-yellow-500 p-3 rounded-full"> <FiClock size={24} /> </div>
                  </div>
              </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4 mb-8">
        <button
          onClick={() => {
            if (!isInitialized || loading) { toast.warn("Aguarde a inicialização e carregamento dos dados."); return; }
            if (!walletAddress) { toast.error("Endereço da carteira não disponível."); return; }
            // Backend handles the actual balance check before sending
            setSendModalOpen(true);
            setError(null); // Clear global errors when opening modal
          }}
          disabled={!isInitialized || loading} // Disable until initialized and not loading
          className="flex items-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
        >
          <FiArrowUp /> Enviar BCH
        </button>
        <button
            onClick={() => {
                if (!isInitialized || !walletAddress) { toast.error("Endereço da carteira não disponível."); return; }
                setReceiveModalOpen(true);
                setError(null);
            }}
            disabled={!isInitialized || !walletAddress} // Disable until address is available
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
        >
            <FiArrowDown /> Receber BCH
        </button>
        <button disabled title="Em breve" className="flex items-center gap-2 bg-gray-600 text-gray-400 px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"> <FiDollarSign /> Converter (Em breve) </button>
      </div>

      {/* Recent Transactions - Skeleton shown until initialized */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 shadow-lg">
        <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)]">Transações Recentes</h3>
        {!isInitialized ? (
            <div className="space-y-4 animate-pulse">
                {[...Array(3)].map((_, i) => ( <div key={i} className="flex justify-between items-center p-4 rounded-lg bg-[var(--color-bg-tertiary)]"> <div className="flex items-center gap-4"> <div className="p-3 rounded-full bg-gray-700 h-12 w-12"></div> <div> <div className="h-4 bg-gray-700 rounded w-48 mb-2"></div> <div className="h-3 bg-gray-700 rounded w-32"></div> </div> </div> <div className="text-right"> <div className="h-4 bg-gray-700 rounded w-24 mb-2"></div> <div className="h-3 bg-gray-700 rounded w-20"></div> </div> </div> ))}
            </div>
        ) : loading && transactions.length === 0 ? ( // Show skeleton if loading initial transactions
            <div className="space-y-4 animate-pulse">
                {[...Array(3)].map((_, i) => ( <div key={i} className="flex justify-between items-center p-4 rounded-lg bg-[var(--color-bg-tertiary)]"> <div className="flex items-center gap-4"> <div className="p-3 rounded-full bg-gray-700 h-12 w-12"></div> <div> <div className="h-4 bg-gray-700 rounded w-48 mb-2"></div> <div className="h-3 bg-gray-700 rounded w-32"></div> </div> </div> <div className="text-right"> <div className="h-4 bg-gray-700 rounded w-24 mb-2"></div> <div className="h-3 bg-gray-700 rounded w-20"></div> </div> </div> ))}
            </div>
        ) : !loading && transactions.length === 0 ? ( // Show message if not loading and no transactions
            <div className="text-center py-8 text-[var(--color-text-secondary)]"> Nenhuma transação encontrada. <br /> Clique em "Receber BCH" para obter seu endereço. </div>
        ) : ( // Display transactions
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div key={tx._id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors border-b border-[var(--color-border)] last:border-b-0">
                {/* Left Side */}
                <div className="flex items-center gap-4 mb-2 sm:mb-0 w-full sm:w-auto">
                  <div className={`flex-shrink-0 p-3 rounded-full ${ tx.type === 'received' ? 'bg-green-900 text-green-400' : tx.type === 'sent' ? 'bg-red-900 text-red-400' : 'bg-gray-700 text-gray-400' }`}> {tx.type === 'received' ? <FiArrowDown size={20} /> : tx.type === 'sent' ? <FiArrowUp size={20} /> : <FiClock size={20} />} </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-medium text-sm sm:text-base truncate text-[var(--color-text-primary)]"> {tx.type === 'received' ? 'Recebido' : tx.type === 'sent' ? 'Enviado' : 'Desconhecido'} </p>
                    <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">{formatDate(tx.timestamp)}</p>
                    <a href={`${BCH_EXPLORER_TX_URL}${tx.txid}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 break-all block mt-1" title={tx.txid}> Hash: {formatAddress(tx.txid, 8)} </a>
                  </div>
                </div>
                {/* Right Side */}
                <div className="flex flex-col items-end ml-auto sm:ml-0 pl-16 sm:pl-0 flex-shrink-0">
                   <p className={`font-bold text-sm sm:text-base whitespace-nowrap ${ tx.type === 'received' ? 'text-green-400' : tx.type === 'sent' ? 'text-red-400' : 'text-gray-400' }`}> {tx.type === 'received' ? '+' : tx.type === 'sent' ? '-' : ''} {formatBCH(tx.amountBCH)} </p>
                   <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] whitespace-nowrap">{formatCurrency(tx.amountBRL)}</p>
                   <div className="mt-1"> {tx.status === 'confirmed' ? ( <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"> Confirmado ({tx.confirmations > 99 ? '99+' : tx.confirmations} conf.) </span> ) : tx.status === 'pending' ? ( <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"> Pendente ({tx.confirmations} conf.) </span> ) : ( <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"> Desconhecido </span> )} </div>
                   {/* Optionally display fee for sent transactions */}
                   {tx.type === 'sent' && tx.fee !== undefined && (
                       <p className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap mt-1">Taxa: {formatBCH(tx.fee)}</p>
                   )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- Send Modal (Uses Backend API) --- */}
      {sendModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
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
                        {/* Address Input */}
                        <div>
                            <label htmlFor="send-address" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Endereço</label>
                            <div className="relative">
                                <input id="send-address" type="text" value={sendForm.address} onChange={(e) => setSendForm({...sendForm, address: e.target.value})} placeholder="bitcoincash:q..." className="w-full px-3 py-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] font-mono text-sm" required disabled={isSending} />
                                <button type="button" disabled title="Scan QR (Em breve)" className="absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-500 hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"> <FiCode /> </button>
                            </div>
                        </div>
                        {/* Amount Inputs */}
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
                                // Subtract a small buffer for potential fee, backend does exact calc
                                const usableAmount = Math.max(0, available - estimatedFee * 2); // Be conservative
                                if (usableAmount > 0) {
                                    handleAmountChange(usableAmount.toFixed(8), 'BCH');
                                } else {
                                    handleAmountChange('0', 'BCH');
                                    toast.warn("Saldo disponível insuficiente para cobrir taxa estimada.");
                                }
                            }}
                            disabled={isSending || balance.availableBCH <= estimatedFee} // Disable if sending or balance too low
                            className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Usar saldo disponível (aprox.)
                        </button>
                        {/* Fee Selection */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Taxa</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['low', 'medium', 'high'] as const).map((feeLevel) => (
                                    <button
                                        key={feeLevel}
                                        type="button"
                                        onClick={() => !isSending && setSendForm({...sendForm, fee: feeLevel})}
                                        disabled={isSending}
                                        className={`py-2 rounded border-2 text-sm transition-colors disabled:opacity-50 ${
                                            sendForm.fee === feeLevel
                                                ? 'border-[var(--color-accent)] bg-[var(--color-accent-hover)] text-white font-semibold'
                                                : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:border-gray-500 hover:text-[var(--color-text-primary)]'
                                        }`}
                                    >
                                        {feeLevel === 'low' ? 'Lenta' : feeLevel === 'medium' ? 'Normal' : 'Rápida'}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-[var(--color-text-secondary)] mt-1"> A taxa será calculada pelo servidor. </p>
                        </div>
                    </div>
                    {/* Action Buttons */}
                    <div className="mt-8 flex justify-end gap-3">
                        <button type="button" onClick={() => setSendModalOpen(false)} disabled={isSending} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"> Cancelar </button>
                        <button
                            type="submit"
                            disabled={isSending || !sendForm.address || !sendForm.amountBCH || parseFloat(sendForm.amountBCH) <= 0} // Basic client validation
                            className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
                        >
                            <>
                                {isSending ? ( <FiRefreshCw className="animate-spin mr-2" /> ) : ( <FiArrowUp className="mr-2" /> )}
                                {isSending ? 'Enviando...' : 'Enviar'}
                            </>
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* --- Receive Modal (Unchanged) --- */}
      {receiveModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
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
                            <span className="font-mono text-blue-400 overflow-x-auto text-sm break-all mr-2"> {walletAddress || 'Carregando...'} </span>
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

    </div>
  );
}
