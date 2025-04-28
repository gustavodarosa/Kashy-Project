// src/pages/dashboard/tabs/2wallettab.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FiArrowUp, FiArrowDown, FiCopy, FiDollarSign, FiCode, FiClock, FiRefreshCw, FiCheckCircle } from 'react-icons/fi';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-toastify';
import QRCode from 'react-qr-code';
import BCHJS from '@psf/bch-js'; // Import bch-js

import { useNotification } from '../../../context/NotificationContext';

// --- Configuration ---
const API_BASE_URL = 'http://localhost:3000/api'; // Kept for send/initial address fetch from YOUR backend
const WEBSOCKET_URL = 'http://localhost:3000'; // Kept for YOUR backend WebSocket
const BCH_EXPLORER_TX_URL = 'https://explorer.bitcoinabc.org/tx/';
const SATOSHIS_PER_BCH = 1e8;
const BRL_PER_BCH = 7000;
const estimatedFee = 0.00001;

// --- ElectrumX Server List ---
const FULCRUM_SERVERS_RANKED = [
    { host: 'blackie.c3-soft.com', port: 50002, protocol: 'ssl' },
    { host: 'fulcrum.criptolayer.net', port: 50002, protocol: 'ssl' },
    { host: 'bitcoincash.network', port: 50002, protocol: 'ssl' },
    { host: 'cashnode.bch.ninja', port: 50002, protocol: 'ssl' },
    { host: 'fulcrum.aglauck.com', port: 50002, protocol: 'ssl' },
    { host: 'fulcrum2.electroncash.de', port: 50002, protocol: 'ssl' },
    { host: 'node.minisatoshi.cash', port: 50002, protocol: 'ssl' },
    { host: 'bch.soul-dev.com', port: 50002, protocol: 'ssl' },
    { host: 'bch.imaginary.cash', port: 50002, protocol: 'ssl' },
    { host: 'bch0.kister.net', port: 50002, protocol: 'ssl' },
    { host: 'electrum.imaginary.cash', port: 50002, protocol: 'ssl' },
    { host: 'electroncash.de', port: 50002, protocol: 'ssl' },
    { host: 'fulcrum.jettscythe.xyz', port: 50002, protocol: 'ssl' },
    { host: 'electron.jochen-hoenicke.de', port: 51002, protocol: 'ssl' },
    { host: 'bch.cyberbits.eu', port: 50002, protocol: 'ssl' },
    { host: 'fulcrum.greyh.at', port: 50002, protocol: 'ssl' },
    { host: 'bch.loping.net', port: 50002, protocol: 'ssl' },
    { host: 'electrs.bitcoinunlimited.info', port: 50002, protocol: 'ssl' },
    { host: 'electroncash.dk', port: 50002, protocol: 'ssl' },
];

const electrumxServerStrings = FULCRUM_SERVERS_RANKED.map(
    server => `${server.protocol}://${server.host}:${server.port}`
);

// --- Initialize bch-js with ONLY ElectrumX servers ---
console.log('[WalletTab] Initializing bch-js with ONLY custom ElectrumX servers...');
const bchjs = new BCHJS({
    electrumxServers: electrumxServerStrings
    // NO restURL provided - we will avoid REST API calls
});
console.log('[WalletTab] bch-js configured ElectrumX Servers:', electrumxServerStrings);
// console.log('[WalletTab] bch-js configured REST URL:', bchjs.restURL); // Should be default/undefined


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
  availableBCH: number;
  pendingBCH: number;
  totalBRL: number;
  totalSatoshis: number;
};

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

  // --- Helper: Process Transaction Details (using ElectrumX + Local Decoding) ---
  const processTxDetails = useCallback(async (txHash: string, walletAddr: string, currentBlockHeight: number): Promise<Transaction | null> => {
    console.log(`[WalletTab] processTxDetails: Fetching RAW TX ${txHash} via ElectrumX...`);
    try {
      // 1. Fetch RAW transaction hex using ElectrumX
      // Assuming bchjs.Electrumx.getRawTransaction(txHash) exists and returns the hex string
      const rawTxHex = await bchjs.Electrumx.getRawTransaction(txHash);

      if (!rawTxHex || typeof rawTxHex !== 'string') {
           console.warn(`[WalletTab] processTxDetails: No raw TX hex returned for ${txHash} via ElectrumX.`);
           return null; // Skip this transaction if raw hex isn't available
      }

      // 2. Decode the raw transaction hex LOCALLY using bch-js
      console.log(`[WalletTab] processTxDetails: Decoding RAW TX ${txHash} locally...`);
      const verboseTx = await bchjs.RawTransactions.decodeRawTransaction(rawTxHex);

      if (!verboseTx || typeof verboseTx !== 'object') {
          console.warn(`[WalletTab] processTxDetails: Failed to decode raw TX ${txHash} locally.`);
          return null; // Skip if decoding fails
      }

      // 3. Process the decoded transaction (same logic as before)
      let receivedAmountSatoshis = 0;
      let isReceiver = false;
      verboseTx.vout.forEach((vout: any) => {
        // Ensure vout.scriptPubKey and addresses exist before accessing
        if (vout.scriptPubKey?.addresses?.includes(walletAddr)) {
          const voutValueSatoshis = Math.round(Number(vout.value) * SATOSHIS_PER_BCH);
          if (!isNaN(voutValueSatoshis)) {
            receivedAmountSatoshis += voutValueSatoshis;
            isReceiver = true;
          } else {
             console.warn(`[WalletTab] processTxDetails: Invalid vout value in decoded TX ${txHash}:`, vout.value);
          }
        }
      });

      const type = isReceiver ? 'received' : 'unknown';
      // Block height might not be directly in decoded raw tx, ElectrumX history usually provides it
      // We rely on the historyResult providing height, or confirmations might be 0
      const blockHeight = verboseTx.blockheight; // Check if decodeRawTransaction provides this
      const isConfirmed = blockHeight && blockHeight > 0;
      // Use currentBlockHeight obtained via ElectrumX earlier
      const confirmations = isConfirmed && currentBlockHeight > 0 ? (currentBlockHeight - blockHeight) + 1 : 0;
      const status: 'confirmed' | 'pending' = isConfirmed ? 'confirmed' : 'pending';
      // Timestamp might also not be in raw tx, rely on ElectrumX history or block time if available
      const timestamp = verboseTx.time ? new Date(verboseTx.time * 1000).toISOString() : new Date().toISOString(); // Fallback to now
      const receivedAmountBCH = receivedAmountSatoshis / SATOSHIS_PER_BCH;

      return {
        _id: txHash, txid: txHash, type: type,
        amountBCH: receivedAmountBCH,
        amountBRL: receivedAmountBCH * BRL_PER_BCH,
        address: walletAddr, timestamp: timestamp, status: status,
        confirmations: confirmations,
        blockHeight: isConfirmed ? blockHeight : undefined,
      };
    } catch (error: any) {
      // Catch errors during ElectrumX fetch or local decoding
      console.error(`[WalletTab] processTxDetails Error for ${txHash} (ElectrumX/Decode):`, error.message);
      // Handle specific errors if needed, e.g., transaction not found
      if (error.message?.includes('No such mempool or blockchain transaction')) {
           console.warn(`[WalletTab] processTxDetails: Transaction ${txHash} not found via ElectrumX.`);
      }
      return null; // Return null on error to skip this transaction
    }
  }, [BRL_PER_BCH]); // Dependency on BRL_PER_BCH

  // --- Function to fetch wallet data (using ONLY ElectrumX) ---
  const fetchWalletData = useCallback(async () => {
    if (!walletAddress) return;
    console.log(`[WalletTab] fetchWalletData called for: ${walletAddress} (ElectrumX ONLY)`);
    setLoading(true);
    // setError(null); // Clear error at the start? Maybe better to clear only on success.

    try {
      // --- Fetch Current Block Height (Attempt via ElectrumX) ---
      let currentBlockHeight = 0;
      try {
        console.log('[WalletTab] Calling bchjs.Electrumx.getLastBlockHeader (using configured servers)...');
        // Assuming bchjs.Electrumx.getLastBlockHeader() or similar exists and returns { height: number }
        const header = await bchjs.Electrumx.getLastBlockHeader();
        if (header && typeof header.height === 'number' && header.height > 0) {
            currentBlockHeight = header.height;
            console.log(`[WalletTab] Current block height from ElectrumX: ${currentBlockHeight}`);
        } else {
             console.warn("[WalletTab] Could not get valid block header/height from ElectrumX. Confirmations might be inaccurate.");
             // Proceed with currentBlockHeight = 0
        }
      } catch (blockHeightError: any) {
        console.warn("[WalletTab] Error fetching block height via ElectrumX:", blockHeightError.message, ". Confirmations might be inaccurate.");
        // Proceed with currentBlockHeight = 0
      }

      // --- Fetch Balance using bch-js ElectrumX (Uses configured servers) ---
      console.log('[WalletTab] Calling bchjs.Electrumx.balance (using configured servers)...');
      const balanceResult = await bchjs.Electrumx.balance(walletAddress);
      console.log('[WalletTab] Raw balanceResult received:', balanceResult);
      if (!balanceResult || !balanceResult.success || !balanceResult.balance) {
        const electrumError = balanceResult?.message || 'Resposta inválida do servidor ElectrumX.';
        throw new Error(`Falha ao buscar saldo via ElectrumX: ${electrumError}`);
      }
      const confirmedSats = balanceResult.balance.confirmed;
      const unconfirmedSats = balanceResult.balance.unconfirmed;
      const totalSats = confirmedSats + unconfirmedSats;
      const fetchedBalance: WalletBalance = {
        totalBCH: totalSats / SATOSHIS_PER_BCH,
        availableBCH: confirmedSats / SATOSHIS_PER_BCH,
        pendingBCH: unconfirmedSats / SATOSHIS_PER_BCH,
        totalBRL: (totalSats / SATOSHIS_PER_BCH) * BRL_PER_BCH,
        totalSatoshis: totalSats,
      };
      setBalance(fetchedBalance);
      console.log("[WalletTab] Balance state updated.");

      // --- Fetch Transaction History using bch-js ElectrumX (Uses configured servers) ---
      // ElectrumX history usually includes tx_hash and height
      console.log('[WalletTab] Calling bchjs.Electrumx.transactions (using configured servers)...');
      const historyResult = await bchjs.Electrumx.transactions(walletAddress);
      console.log('[WalletTab] Raw historyResult received:', historyResult);
      if (!historyResult || !historyResult.success || !Array.isArray(historyResult.transactions)) {
        const historyError = historyResult?.message || 'Resposta inválida do servidor ElectrumX.';
        throw new Error(`Falha ao buscar histórico via ElectrumX: ${historyError}`);
      }
      console.log(`[WalletTab] Fetched ${historyResult.transactions.length} transaction history items.`);

      // --- Process Each Transaction Detail (using ElectrumX + Local Decoding via processTxDetails) ---
      console.log('[WalletTab] Processing transaction details via ElectrumX + Local Decode...');
      const detailsPromises = historyResult.transactions.map(histTx =>
        // Pass the block height obtained from ElectrumX (or 0 if failed)
        processTxDetails(histTx.tx_hash, walletAddress, currentBlockHeight)
        // Note: processTxDetails now fetches raw tx via ElectrumX and decodes locally
      );
      const processedTransactions = (await Promise.all(detailsPromises))
        .filter((tx): tx is Transaction => tx !== null) // Filter out nulls from failed processing
        .sort((a, b) => (new Date(b.timestamp).getTime()) - (new Date(a.timestamp).getTime()));

      console.log(`[WalletTab] Successfully processed ${processedTransactions.length} transactions.`);
      setTransactions(processedTransactions);
      console.log("[WalletTab] Transactions state updated.");

      setError(null); // Clear error only on full success
      console.log("[WalletTab] fetchWalletData (ElectrumX ONLY) completed successfully.");

    } catch (err: any) {
      // Catch errors from ElectrumX calls (balance, history, block header) or Promise.all
      console.error('[WalletTab] Error in fetchWalletData (ElectrumX ONLY):', err);
      let message = 'Erro ao buscar dados da carteira via ElectrumX.';
       if (err.message?.includes('Network Error') || err.message?.includes('timeout') || err.message?.includes('socket hang up')) {
           message = 'Erro de rede ao conectar aos servidores ElectrumX. Verifique sua conexão ou a lista de servidores.';
       } else if (err.message?.includes('ElectrumX')) {
          message = err.message; // Use specific error from ElectrumX calls
       } else if (err.message) {
         message = `Erro: ${err.message}`;
       }
      setError(prevError => prevError === message ? prevError : message);
    } finally {
      setLoading(false);
      console.log('[WalletTab] fetchWalletData (ElectrumX ONLY) finished (finally block).');
    }
  }, [walletAddress, BRL_PER_BCH, processTxDetails]); // processTxDetails is stable

  // --- Effect 1: Initialize Wallet Address (Runs ONCE - Uses Backend API) ---
  useEffect(() => {
    const initializeWallet = async () => {
        console.log('[WalletTab] Initializing wallet address (using backend API)...'); // Still uses backend
        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('Token não encontrado.');

            const addrResponse = await fetch(`${API_BASE_URL}/wallet/address`, { // Backend call
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!addrResponse.ok) {
                const errorData = await addrResponse.json().catch(() => ({}));
                throw new Error(errorData.message || 'Falha ao buscar endereço do backend.');
            }
            const addrData = await addrResponse.json();
            if (!addrData.address) throw new Error('Endereço não retornado pelo backend.');

            setWalletAddress(addrData.address);
            setIsInitialized(true);
            console.log("[WalletTab] Wallet address obtained from backend:", addrData.address);
        } catch (initError: any) {
            console.error("[WalletTab] Error initializing wallet (backend fetch):", initError);
            setError(initError.message || "Erro ao obter endereço da carteira do backend.");
            setIsInitialized(true);
            setLoading(false);
        }
    };
    initializeWallet();
  }, []); // Runs once

  // --- Effect 2: Fetch Data and Setup WebSocket (Runs on init/address change - Uses Backend WS) ---
  useEffect(() => {
    if (!isInitialized || !walletAddress) {
        console.log(`[WalletTab] Data/WS Effect: Skipping (Initialized: ${isInitialized}, Address: ${!!walletAddress})`);
        if (isInitialized && !walletAddress) setLoading(false);
        return;
    }

    console.log('[WalletTab] Data/WS Effect: Running fetchWalletData (ElectrumX ONLY)...');
    fetchWalletData(); // Fetch data using ElectrumX

    // --- Setup WebSocket (Connects to YOUR backend for real-time updates) ---
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn("[WalletTab] WebSocket: No token found, cannot connect to backend WS.");
      return;
    }

    console.log('[WalletTab] Setting up WebSocket connection to backend...'); // Still uses backend WS
    let newSocket: Socket | null = null;
    try {
        newSocket = io(WEBSOCKET_URL, { // Backend WS URL
          auth: { token },
          reconnectionAttempts: 5,
          transports: ['websocket'],
        });

        newSocket.on('connect', () => {
          console.log('[WalletTab] WebSocket connected to backend:', newSocket?.id);
          setSocket(newSocket);
          setError(prevError => prevError?.includes('conexão') || prevError?.includes('real-time') ? null : prevError);
        });

        newSocket.on('disconnect', (reason) => {
          console.log('[WalletTab] WebSocket disconnected from backend:', reason);
          setSocket(null);
          if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
            setError("Desconectado das atualizações em tempo real do backend.");
          }
        });

        newSocket.on('connect_error', (err) => {
          console.error('[WalletTab] WebSocket connection error to backend:', err.message);
          let wsErrorMsg = `Erro na conexão real-time com backend: ${err.message}.`;
          setError(wsErrorMsg);
          setSocket(null);
        });

        // Listen for backend updates
        const handleWalletUpdate = (data: any) => {
            console.log('[WalletTab] WebSocket: Received update from backend.', data);
            toast.info("Atualização na carteira detectada pelo backend. Atualizando...");
            fetchWalletData(); // Re-fetch data using ElectrumX
        };
        newSocket.on('balanceUpdate', handleWalletUpdate);
        newSocket.on('walletUpdate', handleWalletUpdate);

    } catch (socketError) {
        console.error("[WalletTab] Error initializing WebSocket to backend:", socketError);
        setError("Falha ao iniciar a conexão para atualizações em tempo real do backend.");
    }

    // --- Cleanup function ---
    return () => {
      if (newSocket) {
        console.log('[WalletTab] Data/WS Effect: Cleaning up WebSocket to backend...');
        newSocket.off('connect');
        newSocket.off('disconnect');
        newSocket.off('connect_error');
        newSocket.off('balanceUpdate');
        newSocket.off('walletUpdate');
        newSocket.disconnect();
      }
      setSocket(null);
    };
  }, [isInitialized, walletAddress, fetchWalletData]); // Dependencies


  // --- Function to handle sending BCH (handleSendSubmit - Uses Backend API) ---
  const handleSendSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      console.log('[WalletTab] handleSendSubmit started (using backend API).'); // Still uses backend
      setIsSending(true);
      setError(null);

      try {
          const token = localStorage.getItem('token');
          if (!token) throw new Error('Usuário não autenticado.');

          const amountToSend = parseFloat(sendForm.amountBCH);
          if (isNaN(amountToSend) || amountToSend <= 0) throw new Error('Quantidade inválida.');
          if (!sendForm.address.trim() || !/^(bitcoincash:|bchtest:|q|p)/.test(sendForm.address)) {
              throw new Error('Endereço de destino inválido.');
          }

          const requiredAmount = amountToSend + estimatedFee;
          if (requiredAmount > balance.availableBCH) {
              throw new Error(`Saldo disponível insuficiente. Necessário: ${formatBCH(requiredAmount)}, Disponível: ${formatBCH(balance.availableBCH)}`);
          }

          console.log('[WalletTab] Sending transaction via backend API...'); // Backend call
          const response = await fetch(`${API_BASE_URL}/wallet/send`, { // Backend URL
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                  address: sendForm.address,
                  amount: sendForm.amountBCH,
                  fee: sendForm.fee,
              }),
          });

          if (!response.ok) {
              let errorMsg = `Erro ${response.status}: Falha ao enviar via backend.`;
              try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch {}
              throw new Error(errorMsg);
          }

          const result = await response.json();
          console.log('[WalletTab] Send successful (backend response):', result);
          toast.success(`Transação enviada via backend! Hash: ${formatAddress(result.txid)}`);

          // Optimistic UI Update
          if (result.txid) {
              const newTransaction: Transaction = {
                  _id: result.txid, type: 'sent', amountBCH: amountToSend,
                  amountBRL: parseFloat(sendForm.amountBRL) || 0,
                  address: walletAddress, txid: result.txid,
                  timestamp: new Date().toISOString(), status: 'pending', confirmations: 0,
              };
              setTransactions((prev) => [newTransaction, ...prev]
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

              addNotification({
                  id: result.txid,
                  message: `Enviado ${amountToSend.toFixed(8)} BCH para ${formatAddress(sendForm.address)}`,
                  amountBCH: amountToSend, amountBRL: parseFloat(sendForm.amountBRL) || 0,
                  timestamp: new Date().toISOString(), receivedAt: new Date().toLocaleTimeString('pt-BR'),
                  onViewDetails: () => { window.open(`${BCH_EXPLORER_TX_URL}${result.txid}`, '_blank'); },
              });
          }

          console.log('[WalletTab] Scheduling data refresh after send (using ElectrumX)...');
          setTimeout(fetchWalletData, 7000); // Re-fetch using ElectrumX

          setSendModalOpen(false);
          setSendForm({ address: '', amountBCH: '', amountBRL: '', fee: 'medium' });

      } catch (err: any) {
          console.error('[WalletTab] Error in handleSendSubmit (backend):', err);
          setError(err.message || 'Ocorreu um erro inesperado ao enviar via backend.');
      } finally {
          setIsSending(false);
      }
  };


  // --- Formatting Functions (Unchanged) ---
    const formatCurrency = (value: number | undefined) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };
    const formatBCH = (value: number | undefined) => {
        const numValue = Number(value);
        return (isNaN(numValue) ? 0 : numValue).toFixed(8) + ' BCH';
    };
    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return 'Data indisponível';
        try {
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? 'Data inválida' : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch { return 'Data inválida'; }
    };
    const formatAddress = (address: string | undefined, length: number = 6): string => {
        if (!address || typeof address !== 'string' || address.length < length * 2 + 3) return address || 'N/A';
        const cleanAddress = address.includes(':') ? address.split(':')[1] : address;
        if (!cleanAddress || cleanAddress.length < length * 2 + 3) return cleanAddress || address;
        return `${cleanAddress.substring(0, length)}...${cleanAddress.substring(cleanAddress.length - length)}`;
    };

  // --- Copy to Clipboard (Unchanged) ---
    const copyToClipboard = () => {
        if (!walletAddress) return;
        navigator.clipboard.writeText(walletAddress)
        .then(() => { setIsCopied(true); toast.success('Endereço copiado!'); setTimeout(() => setIsCopied(false), 2000); })
        .catch(err => { console.error('Erro ao copiar:', err); toast.error('Falha ao copiar.'); });
    };

  // --- Handle Amount Change (Unchanged) ---
    const handleAmountChange = (value: string, type: 'BCH' | 'BRL') => {
        const cleanValue = value.replace(',', '.');
        if (cleanValue === '') { setSendForm({ ...sendForm, amountBCH: '', amountBRL: '' }); return; }
        const numericValue = parseFloat(cleanValue);
        if (isNaN(numericValue) && cleanValue !== '.' && !/^\d+\.$/.test(cleanValue) && !/^\d*\.\d+$/.test(cleanValue) && !/^\d+$/.test(cleanValue)) {
             if (type === 'BCH') setSendForm({ ...sendForm, amountBCH: value, amountBRL: '' });
             else setSendForm({ ...sendForm, amountBRL: value, amountBCH: '' });
             return;
         }
        if (type === 'BCH') {
            const bchAmount = value;
            const brlAmount = !isNaN(numericValue) ? (numericValue * BRL_PER_BCH).toFixed(2) : '';
            setSendForm({ ...sendForm, amountBCH: bchAmount, amountBRL: brlAmount });
        } else {
            const brlAmount = value;
            const bchAmount = !isNaN(numericValue) && BRL_PER_BCH > 0 ? (numericValue / BRL_PER_BCH).toFixed(8) : '';
            setSendForm({ ...sendForm, amountBRL: brlAmount, amountBCH: bchAmount });
        }
    };


  // --- Component Rendering (Largely Unchanged UI) ---
  return (
    <div className="p-6 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold">Minha Carteira Bitcoin Cash</h2>
        <div className="flex items-center gap-4">
          {/* WebSocket Status (to Backend) */}
          <div className="flex items-center gap-2 text-sm">
            {socket?.connected ? (
                <span className="flex items-center gap-1 text-green-400" title="Conectado ao backend">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Backend ON
                </span>
            ) : error?.includes('conexão') || error?.includes('real-time') ? (
                <span className="flex items-center gap-1 text-red-400" title={error || "Desconectado do backend"}>
                    <span className="w-2 h-2 rounded-full bg-red-500"></span> Backend OFF
                </span>
            ) : (
                <span className="flex items-center gap-1 text-yellow-400" title="Conectando ao backend...">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 animate-spin"></span> Conectando...
                </span>
            )}
          </div>
          {/* Refresh Button (Uses ElectrumX) */}
          <button
            onClick={fetchWalletData}
            disabled={loading || !walletAddress}
            className="p-2 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Atualizar dados da carteira (via ElectrumX)"
          >
            <FiRefreshCw className={` ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Error Display */}
      {error && !sendModalOpen && (
        <div className="bg-red-800 border border-red-600 text-white px-4 py-3 rounded relative mb-6 shadow-md" role="alert">
          <strong className="font-bold">Erro: </strong>
          <span className="block sm:inline">{error}</span>
          <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-300 hover:text-white focus:outline-none">✕</button>
        </div>
      )}

      {/* Balance Cards */}
      {loading && !isInitialized ? (
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
                {loading && isInitialized ? (
                    <div className="mt-2 space-y-2 animate-pulse"> <div className="h-6 bg-blue-700 rounded w-3/4"></div> <div className="h-4 bg-blue-700 rounded w-1/2"></div> </div>
                ) : ( <> <p className="text-2xl font-bold mt-2">{formatBCH(balance.totalBCH)}</p> <p className="text-blue-200 mt-1">{formatCurrency(balance.totalBRL)}</p> </> )}
              </div>
              <div className="bg-blue-700 p-3 rounded-full"> <FiDollarSign size={24} /> </div>
            </div>
          </div>
          {/* Available Balance */}
          <div className="bg-gradient-to-br from-green-800 to-green-900 rounded-lg p-6 shadow-lg text-white">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-green-200 text-sm font-medium">Disponível (Confirmado)</h3>
                {loading && isInitialized ? (
                    <div className="mt-2 space-y-2 animate-pulse"> <div className="h-6 bg-green-700 rounded w-3/4"></div> <div className="h-4 bg-green-700 rounded w-1/2"></div> </div>
                ) : ( <> <p className="text-2xl font-bold mt-2">{formatBCH(balance.availableBCH)}</p> <p className="text-green-200 mt-1">{formatCurrency(balance.availableBCH * BRL_PER_BCH)}</p> </> )}
              </div>
              <div className="bg-green-700 p-3 rounded-full"> <FiCheckCircle size={24} /> </div>
            </div>
          </div>
          {/* Pending Balance */}
          {(balance.pendingBCH > 0 || (loading && isInitialized)) && (
            <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-lg p-6 shadow-lg text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-yellow-200 text-sm font-medium">Pendente (Não Confirmado)</h3>
                  {loading && isInitialized ? (
                      <div className="mt-2 space-y-2 animate-pulse"> <div className="h-6 bg-yellow-500 rounded w-3/4"></div> <div className="h-4 bg-yellow-500 rounded w-1/2"></div> </div>
                  ) : ( <> <p className="text-2xl font-bold mt-2">{formatBCH(balance.pendingBCH)}</p> <p className="text-yellow-200 mt-1">{formatCurrency(balance.pendingBCH * BRL_PER_BCH)}</p> </> )}
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
          onClick={() => { setSendModalOpen(true); setError(null); }}
          disabled={loading || !walletAddress || balance.availableBCH <= estimatedFee}
          className="flex items-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
        > <FiArrowUp /> Enviar BCH </button>
        <button
          onClick={() => setReceiveModalOpen(true)}
          disabled={!walletAddress}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
        > <FiArrowDown /> Receber BCH </button>
        <button disabled title="Funcionalidade em desenvolvimento" className="flex items-center gap-2 bg-gray-600 text-gray-400 px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
          <FiDollarSign /> Converter (Em breve) </button>
      </div>

      {/* Recent Transactions */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 shadow-lg">
        <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)]">Transações Recentes</h3>
        {loading && transactions.length === 0 ? (
          <div className="space-y-4 animate-pulse">
             {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between items-center p-4 rounded-lg bg-[var(--color-bg-tertiary)]"> <div className="flex items-center gap-4"> <div className="p-3 rounded-full bg-gray-700 h-12 w-12"></div> <div> <div className="h-4 bg-gray-700 rounded w-48 mb-2"></div> <div className="h-3 bg-gray-700 rounded w-32"></div> </div> </div> <div className="text-right"> <div className="h-4 bg-gray-700 rounded w-24 mb-2"></div> <div className="h-3 bg-gray-700 rounded w-20"></div> </div> </div>
            ))}
          </div>
        ) : !loading && transactions.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-text-secondary)]"> Nenhuma transação encontrada. <br /> Clique em "Receber BCH". </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div key={tx._id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors border-b border-[var(--color-border)] last:border-b-0">
                <div className="flex items-center gap-4 mb-2 sm:mb-0 w-full sm:w-auto">
                  <div className={`flex-shrink-0 p-3 rounded-full ${ tx.type === 'received' ? 'bg-green-900 text-green-400' : tx.type === 'sent' ? 'bg-red-900 text-red-400' : 'bg-gray-700 text-gray-400' }`}>
                    {tx.type === 'received' ? <FiArrowDown size={20} /> : tx.type === 'sent' ? <FiArrowUp size={20} /> : <FiClock size={20} />}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-medium text-sm sm:text-base truncate text-[var(--color-text-primary)]"> {tx.type === 'received' ? 'Recebido' : tx.type === 'sent' ? 'Enviado' : 'Desconhecido'} </p>
                    <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">{formatDate(tx.timestamp)}</p>
                    <a href={`${BCH_EXPLORER_TX_URL}${tx.txid}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 break-all block mt-1" title={tx.txid}> Hash: {formatAddress(tx.txid, 8)} </a>
                  </div>
                </div>
                <div className="flex flex-col items-end ml-auto sm:ml-0 pl-16 sm:pl-0 flex-shrink-0">
                   <p className={`font-bold text-sm sm:text-base whitespace-nowrap ${ tx.type === 'received' ? 'text-green-400' : tx.type === 'sent' ? 'text-red-400' : 'text-gray-400' }`}> {tx.type === 'received' ? '+' : tx.type === 'sent' ? '-' : ''} {formatBCH(tx.amountBCH)} </p>
                   <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] whitespace-nowrap">{formatCurrency(tx.amountBRL)}</p>
                   <div className="mt-1">
                    {tx.status === 'confirmed' ? ( <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"> Confirmado ({tx.confirmations > 99 ? '99+' : tx.confirmations} conf.) </span>
                    ) : tx.status === 'pending' ? ( <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"> Pendente ({tx.confirmations} conf.) </span>
                    ) : ( <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"> Desconhecido </span> )}
                  </div>
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
             <div className="flex justify-between items-center mb-6"> <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Enviar Bitcoin Cash</h3> <button onClick={() => !isSending && setSendModalOpen(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50" disabled={isSending}> ✕ </button> </div>
             {error && ( <div className="bg-red-800 border border-red-600 text-white px-4 py-2 rounded relative mb-4 text-sm" role="alert"> {error} <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-3 py-2 text-red-300 hover:text-white">✕</button> </div> )}
             <form onSubmit={handleSendSubmit}>
               <div className="space-y-4">
                 <div> <label htmlFor="send-address" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Endereço de destino</label> <div className="relative"> <input id="send-address" type="text" value={sendForm.address} onChange={(e) => setSendForm({...sendForm, address: e.target.value})} placeholder="bitcoincash:q..." className="w-full px-3 py-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] font-mono text-sm" required disabled={isSending} /> <button type="button" disabled title="Digitalizar QR Code (Em breve)" className="absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-500 hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"> <FiCode /> </button> </div> </div>
                 <div className="grid grid-cols-2 gap-4"> <div> <label htmlFor="send-amount-bch" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Quantidade (BCH)</label> <input id="send-amount-bch" type="text" inputMode="decimal" value={sendForm.amountBCH} onChange={(e) => handleAmountChange(e.target.value, 'BCH')} className="w-full px-3 py-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] text-sm" required disabled={isSending} placeholder="0.00000000" /> </div> <div> <label htmlFor="send-amount-brl" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Valor (BRL)</label> <input id="send-amount-brl" type="text" inputMode="decimal" value={sendForm.amountBRL} onChange={(e) => handleAmountChange(e.target.value, 'BRL')} className="w-full px-3 py-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] text-sm" required disabled={isSending} placeholder="0,00" /> </div> </div>
                 <button type="button" onClick={() => { const available = balance.availableBCH; const maxSpendable = available - estimatedFee; if (maxSpendable > 0) { handleAmountChange(maxSpendable.toFixed(8), 'BCH'); } else { handleAmountChange('0', 'BCH'); toast.warn("Saldo insuficiente para cobrir a taxa estimada."); } }} disabled={isSending || balance.availableBCH <= estimatedFee} className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"> Usar saldo disponível (descontando taxa) </button>
                 <div> <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Taxa de rede</label> <div className="grid grid-cols-3 gap-2"> {(['low', 'medium', 'high'] as const).map((feeLevel) => ( <button key={feeLevel} type="button" onClick={() => !isSending && setSendForm({...sendForm, fee: feeLevel})} disabled={isSending} className={`py-2 rounded border-2 text-sm transition-colors disabled:opacity-50 ${ sendForm.fee === feeLevel ? 'border-[var(--color-accent)] bg-[var(--color-accent-hover)] text-white font-semibold' : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:border-gray-500 hover:text-[var(--color-text-primary)]' }`}> {feeLevel === 'low' ? 'Lenta' : feeLevel === 'medium' ? 'Normal' : 'Rápida'} </button> ))} </div> <p className="text-xs text-[var(--color-text-secondary)] mt-1"> Taxa estimada: {formatBCH(estimatedFee)} </p> </div>
               </div>
               <div className="mt-8 flex justify-end gap-3"> <button type="button" onClick={() => setSendModalOpen(false)} disabled={isSending} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"> Cancelar </button> <button type="submit" disabled={isSending || !sendForm.address || !sendForm.amountBCH || parseFloat(sendForm.amountBCH) <= 0 || (parseFloat(sendForm.amountBCH) + estimatedFee > balance.availableBCH)} className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"> {isSending ? ( <FiRefreshCw className="animate-spin mr-2" /> ) : ( <FiArrowUp className="mr-2" /> )} {isSending ? 'Enviando...' : 'Enviar'} </button> </div>
             </form>
           </div>
        </div>
      )}

      {/* --- Receive Modal (Unchanged) --- */}
      {receiveModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
           <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 w-full max-w-md shadow-xl border border-[var(--color-border)]">
             <div className="flex justify-between items-center mb-6"> <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Receber Bitcoin Cash</h3> <button onClick={() => setReceiveModalOpen(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"> ✕ </button> </div>
             <div className="text-center">
               <div className="bg-white p-4 rounded-lg inline-block mb-6 shadow-md"> {walletAddress ? ( <QRCode value={walletAddress} size={192} level="M" bgColor="#FFFFFF" fgColor="#000000"/> ) : ( <div className="w-48 h-48 bg-gray-200 flex items-center justify-center text-gray-500 animate-pulse"> Carregando... </div> )} </div>
               <div className="mb-6"> <p className="text-sm text-[var(--color-text-secondary)] mb-2">Seu endereço para recebimento</p> <div className="flex items-center justify-between bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] p-3 rounded-lg"> <span className="font-mono text-blue-400 overflow-x-auto text-sm break-all mr-2"> {walletAddress || 'Carregando...'} </span> <button onClick={copyToClipboard} disabled={!walletAddress || isCopied} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex-shrink-0 disabled:opacity-50" title={isCopied ? "Copiado!" : "Copiar endereço"}> {isCopied ? <FiCheckCircle className="text-green-500" /> : <FiCopy />} </button> </div> </div>
               <div className="grid grid-cols-2 gap-3"> <button disabled title="Funcionalidade em desenvolvimento" className="py-2 border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"> Compartilhar (Em breve) </button> <button onClick={copyToClipboard} disabled={!walletAddress || isCopied} className="py-2 bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] rounded-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50"> {isCopied ? <FiCheckCircle /> : <FiCopy />} {isCopied ? 'Copiado!' : 'Copiar Endereço'} </button> </div>
             </div>
           </div>
        </div>
      )}

    </div>
  );
}
