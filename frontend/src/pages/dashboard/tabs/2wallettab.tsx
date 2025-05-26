// src/pages/dashboard/tabs/2wallettab.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-toastify';
import bitcore from 'bitcore-lib-cash';
import { FiArrowUp, FiArrowDown, FiRepeat, FiRefreshCw } from 'react-icons/fi';

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

// --- WalletTab Component ---
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

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Usuário não autenticado.');
      if (amountToSendNum <= 0) throw new Error('Quantidade inválida.');

      const response = await fetch(`${API_BASE_URL}/wallet/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address: sendForm.address.trim(), amount: sendForm.amountBCH, fee: sendForm.fee })
      });

      if (!response.ok) throw new Error('Erro ao enviar.');

      const result = await response.json();
      toast.success(`Transação enviada! Hash: ${result.txid}`);

      setTimeout(fetchWalletData, 8000);
      setSendModalOpen(false);
      setSendForm({ address: '', amountBCH: '', amountBRL: '', fee: 'medium' });

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-[#24292D] min-h-screen flex flex-col items-center">
      <div className="bg-amber-400 p-20 w-full text-white text-center mb-8">
        <p className="text-md">Your available balance</p>
        <p className="text-2xl font-bold">0.1827 ETH</p>
        <p className="text-lg">$ 215.45 USD</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-6">
        <div className="flex flex-col items-center">
          <button
            className="flex items-center justify-center w-16 h-16 bg-[#1E1E1E] rounded-full text-white hover:bg-[#333333] transition border border-green-500"
            onClick={() => console.log('Send clicked')}
          >
            <FiArrowUp size={24} />
          </button>
          <span className="text-xs mt-2 text-white">Send</span>
        </div>
        <div className="flex flex-col items-center">
          <button
            className="flex items-center justify-center w-16 h-16 bg-[#1E1E1E] rounded-full text-white hover:bg-[#333333] transition border border-green-500"
            onClick={() => console.log('Receive clicked')}
          >
            <FiArrowDown size={24} />
          </button>
          <span className="text-xs mt-2 text-white">Receive</span>
        </div>
        <div className="flex flex-col items-center">
          <button
            className="flex items-center justify-center w-16 h-16 bg-[#1E1E1E] rounded-full text-white hover:bg-[#333333] transition border border-green-500"
            onClick={() => console.log('Swap clicked')}
          >
            <FiRepeat size={24} />
          </button>
          <span className="text-xs mt-2 text-white">Swap</span>
        </div>
        <div className="flex flex-col items-center">
          <button
            className="flex items-center justify-center w-16 h-16 bg-[#1E1E1E] rounded-full text-white hover:bg-[#333333] transition border border-green-500"
            onClick={() => console.log('Bridge clicked')}
          >
            <FiRefreshCw size={24} />
          </button>
          <span className="text-xs mt-2 text-white">Bridge</span>
        </div>
      </div>
    </div>
  );
}
