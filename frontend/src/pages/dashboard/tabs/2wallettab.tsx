// src/pages/dashboard/tabs/2wallettab.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-toastify';
import bitcore from 'bitcore-lib-cash';
import { Bitcoin, SearchIcon } from 'lucide-react';
import { FiArrowUp, FiArrowDown, FiRepeat, FiRefreshCw} from 'react-icons/fi';
import { SiEthereum } from 'react-icons/si'; // This import is not used, consider removing if not needed elsewhere
import QRCode from 'react-qr-code';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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

// Simulação de dados para o gráfico de atividade
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSent, setLastSent] = useState<{ amount: string; amountBRL: string } | null>(null);

  // Novo estado para controlar a aba ativa
  const [activeTab, setActiveTab] = useState<'tokens' | 'nft' | 'activity'>('tokens');
  // Estados para os novos filtros (apenas UI por enquanto)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activityPeriod, setActivityPeriod] = useState<'today' | 'week' | 'month'>('week');

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

    // Simulação apenas frontend
    if (amountToSendNum <= 0) {
      setError('Quantidade inválida.');
      setIsSending(false);
      return;
    }

    setTimeout(() => {
      setLastSent({ amount: sendForm.amountBCH, amountBRL: sendForm.amountBRL });
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
    <div className="bg-[#24292D] min-h-screen flex flex-col items-center">
      <div
  className="p-10 w-full text-white text-center mb-8 rounded-2xl shadow-2xl relative"
  style={{
    backgroundImage: `url('/src/assets/bchsvg.svg'), radial-gradient(ellipse at center, rgba(26, 194, 166, 0.25) 0%, transparent 70%), linear-gradient(to bottom, rgba(36, 41, 45, 0) 70%, #24292D), linear-gradient(to bottom right, #1ac2a6, #065546)`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center right, center right, center, center',
    backgroundSize: '300px, 350px, cover, cover',
  }}
>

        <p className="text-md text-2xl">Seu Saldo Total Disponível</p>
         <div className="flex items-center justify-center gap-2 mt-4 mb-2">
        <Bitcoin size={40} />
        <p className="text-4xl font-bold">0.1827 <span className='text-teal-'>BCH</span></p>
        
      </div>
        <p className="text-2xl">$ 215.45 BRL</p>


      {/* Action Buttons */}
      <div className="flex justify-center gap-6 mt-10">
        <div className="flex flex-col items-center">
          <button
            className="ease-in-out hover:-translate-y-1 hover:scale-110 flex items-center justify-center w-14 h-14 bg-[#1E1E1E] rounded-full text-white transition border-2 border-[#14B498] shadow-[0_0_20px_#14B498] hover:shadow-[0_0_15px_#14B498]"
            onClick={() => setSendModalOpen(true)}
          >
            <FiArrowUp size={24} />
          </button>
          <span className="text-xs mt-2 text-white">Enviar</span>
        </div>
        <div className="flex flex-col items-center">
          <button
            className="ease-in-out hover:-translate-y-1 hover:scale-110 flex items-center justify-center w-14 h-14 bg-[#1E1E1E] rounded-full text-white  transition border-2 border-[#14B498] shadow-[0_0_20px_#14B498] hover:shadow-[0_0_15px_#14B498]"
            onClick={() => setReceiveModalOpen(true)}
          >
            <FiArrowDown size={24} />
          </button>
          <span className="text-xs mt-2 text-white">Receber</span>
        </div>
        <div className="flex flex-col items-center">
          <button
            className="ease-in-out hover:-translate-y-1 hover:scale-110 flex items-center justify-center w-14 h-14 bg-[#1E1E1E] rounded-full text-white transition border-2 border-[#14B498] shadow-[0_0_20px_#14B498] hover:shadow-[0_0_15px_#14B498]"

          >
            <FiRepeat size={24} />
          </button>
          <span className="text-xs mt-2 text-white">Trocar</span>
        </div>
        <div className="flex flex-col items-center">
          <button
            className="ease-in-out hover:-translate-y-1 hover:scale-110 flex items-center justify-center w-14 h-14 bg-[#1E1E1E] rounded-full text-white transition border-2 border-[#14B498] shadow-[0_0_20px_#14B498] hover:shadow-[0_0_15px_#14B498]"

          >
            <FiRefreshCw size={24} />
          </button>
          <span className="text-xs mt-2 text-white">Converter</span>
        </div>
      </div>
      </div>
      <h3 className="text-xl font-semibold text-white mb-6">Atividade da Carteira</h3>
      {/* Gráfico de Atividade - fora do container de histórico de transação */}
      <div className="bg-[#2f3741] p-6 rounded-2xl w-full max-w-7xl mx-auto mb-8">
        <div className="w-full bg-[#363f4b] max-w-7xl rounded-4xl p-4 mb-6 shadow-2xl ">
  <div className="flex justify-between items-center">
    <div className="flex gap-4">
      <button className="ease-in-out hover:-translate-y-1 hover:scale-110 px-4 py-2 bg-[#2b3035] text-white rounded-lg font-medium hover:bg-[#3d4855] transition">
        Recebidas
      </button>
      <button className="ease-in-out hover:-translate-y-1 hover:scale-110 px-4 py-2 bg-[#2b3035] text-white rounded-lg font-medium hover:bg-[#3d4855] transition">
        Enviadas
      </button>
    </div>
    <div className="flex gap-4">
      <button
        className={`px-4 py-2 rounded-lg font-medium transition ${
          activityPeriod === 'today'
            ? 'bg-teal-600 text-white'
            : 'text-gray-400 hover:bg-[#3d4855]'
        }`}
        onClick={() => setActivityPeriod('today')}
      >
        Hoje
      </button>
      <button
        className={`px-4 py-2 rounded-lg font-medium transition ${
          activityPeriod === 'week'
            ? 'bg-teal-600 text-white'
            : 'text-gray-400 hover:bg-[#3d4855]'
        }`}
        onClick={() => setActivityPeriod('week')}
      >
        Semanal
      </button>
      <button
        className={`px-4 py-2 rounded-lg font-medium transition ${
          activityPeriod === 'month'
            ? 'bg-teal-600 text-white'
            : 'text-gray-400 hover:bg-[#3d4855]'
        }`}
        onClick={() => setActivityPeriod('month')}
      >
        Mensal
      </button>
    </div>
  </div>
</div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={chartData}>
            <XAxis dataKey={xKey} stroke="#aaa" />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: "#23272B", border: "none", color: "#fff" }}
              labelStyle={{ color: "#14B498" }}
              formatter={(value: number, name: string) =>
                [`${value} BCH`, name === "received" ? "Recebido" : "Enviado"]
              }
            />
            <Line type="monotone" dataKey="received" stroke="#14B498" strokeWidth={2} dot={{ r: 4 }} name="Recebido" />
            <Line type="monotone" dataKey="sent" stroke="#F87171" strokeWidth={2} dot={{ r: 4 }} name="Enviado" />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>
            +{chartData.reduce((acc, d) => acc + (d.received > 0 ? 1 : 0), 0)} recebimentos
          </span>
          <span>
            -{chartData.reduce((acc, d) => acc + (d.sent > 0 ? 1 : 0), 0)} envios
          </span>
        </div>
      </div>
<h3 className="text-xl font-semibold text-white mb-6">Histórico de Transações</h3>
      {/* Histórico de transações */}
      <div className="w-full max-w-7xl bg-[#2f3741] rounded-2xl p-10 md:p-10 mb-8 shadow-2xl">
        {/* Barra de Filtros e Pesquisa */}
        <div className="flex flex-col bg-[#3f4a57] p-4 rounded-full md:flex-row justify-between items-center gap-4 mb-6">
          <div className="relative w-full md:w-1/2 lg:w-2/5">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar por ID, endereço ou valor..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#2f3741] border border-[#313e4b] text-white focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder-gray-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-lg bg-[#2f3741] border border-[#313e4b] text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Todos Status</option>
              <option value="confirmed">Confirmadas</option>
              <option value="pending">Pendentes</option>
              <option value="cancelled">Canceladas</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 rounded-lg bg-[#2f3741] border border-[#313e4b] text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Todas Categorias</option>
              <option value="sent">Enviadas</option>
              <option value="received">Recebidas</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400  ">
            <thead className="bg-[#23272B] border-2 border-[#313e4b] text-xs uppercase text-gray-500 ">
        <tr>
          <th scope="col" className="px-6 py-3">Descrição</th>
          <th scope="col" className="px-6 py-3">Data</th>
          <th scope="col" className="px-6 py-3">Quantidade</th>
          <th scope="col" className="px-6 py-3">Status</th>
          <th scope="col" className="px-6 py-3">Ação</th>
        </tr>
      </thead>
      <tbody>
  {transactions.length === 0 ? (
    <tr>
      <td colSpan={5} className="text-center py-8 text-gray-400">
        Nenhuma transação encontrada.
      </td>
    </tr>
  ) : (
    transactions.map((tx) => (
      <tr
        key={tx.txid}
        className="border-b border-[#313e4b] hover:bg-[#272c31] transition "
      >
        <td className="px-6 py-4 flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center
              ${tx.type === 'received' ? 'bg-green-500 border-2 border-green-700' : tx.type === 'sent' ? 'bg-red-700 border-2 border-red-500' : 'bg-blue-600 border-2 border-blue-800'}`}
            title={tx.type === 'received' ? 'Recebido' : tx.type === 'sent' ? 'Enviado' : 'Para si'}
          >
            {tx.type === 'received' ? (
              <FiArrowDown size={18} className="text-white" />
            ) : tx.type === 'sent' ? (
              <FiArrowUp size={18} className="text-white" />
            ) : (
              <FiRepeat size={18} className="text-white" />
            )}
          </div>
          <span className="text-white font-medium">
            {tx.type === 'received' ? 'Recebido' : tx.type === 'sent' ? 'Enviado' : 'Para si'}
          </span>
        </td>
        <td className="px-6 py-4">
          {new Date(tx.timestamp).toLocaleDateString('pt-BR')}
        </td>
        <td className="px-6 py-4">
          <div className="text-white font-medium">
            {tx.amountBCH.toFixed(8)} BCH
          </div>
          <div className="text-xs text-gray-400">
            R$ {tx.amountBRL.toFixed(2)}
          </div>
        </td>
        <td className="px-6 py-4">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              tx.status === 'confirmed'
                ? 'bg-green-500 text-green-100'
                : tx.status === 'pending'
                ? 'bg-yellow-700 text-yellow-200'
                : 'bg-red-700 text-red-200'
            }`}
            title={
              tx.status === 'confirmed'
                ? 'Transação confirmada'
                : tx.status === 'pending'
                ? 'Transação pendente'
                : 'Erro na transação'
            }
          >
            {tx.status === 'confirmed'
              ? `Confirmado`
              : tx.status === 'pending'
              ? 'Pendente'
              : 'Erro'}
          </span>
        </td>
        <td className="px-6 py-4">
          <button
            className="ease-in-out hover:-translate-y-1 hover:scale-110 bg-teal-600 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-teal-700 transition"
            onClick={() => console.log(`Repetir transação ${tx.txid}`)}
          >
            Detalhes
          </button>
        </td>
      </tr>
    ))
  )}
</tbody>
    </table>
  </div>
</div>

{/* Modal de envio de transação */}
{sendModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm bg-opacity-60">
    <div className="bg-[#24292D] rounded-xl p-0 w-full max-w-md shadow-2xl relative">
      <button
        className="absolute top-4 right-6 text-gray-400 hover:text-white text-2xl"
        onClick={() => setSendModalOpen(false)}
        aria-label="Fechar"
      >
        ×
      </button>
      <div className="border-b border-[#333a41] px-8 pt-8 pb-2">
        <h2 className="text-xl font-semibold text-white mb-1">Send BCH</h2>
        <div className="flex border-b border-[#333a41] mb-2">
          <button className="px-2 pb-2 border-b-2 border-teal-400 text-teal-300 font-medium focus:outline-none bg-transparent">
            Wallet Address
          </button>
        </div>
      </div>
      <form onSubmit={handleSendSubmit} className="flex flex-col gap-4 px-8 py-6">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Recipient</label>
          <input
            type="text"
            placeholder="Enter a BCH address"
            className="w-full border border-[#333a41] rounded-lg px-3 py-2 text-white bg-[#23272B] focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder-white"
            value={sendForm.address}
            onChange={e => setSendForm(f => ({ ...f, address: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Withdraw From</label>
          <div className="flex items-center border border-[#333a41] rounded-lg px-3 py-2 bg-[#23272B]">
            <span className="bg-[#F7931A] rounded-full w-7 h-7 flex items-center justify-center mr-2">
              <Bitcoin size={18} color="white" />
            </span>
            <span className="font-medium text-white mr-2">BCH Wallet</span>
            <span className="ml-auto text-xs text-gray-400">
              {balance.totalBCH?.toFixed(8) ?? '0.00000000'} BCH
              <span className="ml-2 text-gray-500">
                ≈ R$ {balance.totalBRL?.toFixed(2) ?? '0.00'}
              </span>
            </span>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Amount</label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="0.00"
              className="w-1/2 border border-[#333a41] rounded-lg px-3 py-2 text-white bg-[#23272B] focus:outline-none placeholder-white"
              value={sendForm.amountBRL}
              onChange={e => setSendForm(f => ({ ...f, amountBRL: e.target.value }))}
              min="0"
              step="any"
            />
            <span className="flex items-center text-gray-500 font-bold text-lg">⇄</span>
            <input
              type="number"
              placeholder="0.00"
              className="w-1/2 border border-[#333a41] rounded-lg px-3 py-2 text-white bg-[#23272B] focus:outline-none placeholder-white"
              value={sendForm.amountBCH}
              onChange={e => setSendForm(f => ({ ...f, amountBCH: e.target.value }))}
              min="0"
              step="any"
              required
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>BRL</span>
            <span>BCH</span>
          </div>
        </div>
        {/* Fee select */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Fee</label>
          <select
            className="w-full border border-[#333a41] rounded-lg px-3 py-2 text-white bg-[#23272B] focus:outline-none"
            value={sendForm.fee}
            onChange={e => setSendForm(f => ({ ...f, fee: e.target.value as 'low' | 'medium' | 'high' }))}
            required
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 text-xs text-gray-400 mt-2">
          <div className="flex justify-between">
            <span>Network Fee</span>
            <span>
              0.00000220 BCH (R$ {(0.00000220 * (balance.currentRateBRL ?? 0)).toFixed(4)})
            </span>
          </div>
          <div className="flex justify-between">
            <span>Total</span>
            <span>
              {(parseFloat(sendForm.amountBCH || '0') + 0.00000220).toFixed(8)} BCH (R$ {(((parseFloat(sendForm.amountBCH || '0') + 0.00000220) * (balance.currentRateBRL ?? 0)).toFixed(2))})
            </span>
          </div>
        </div>
        <button
          type="submit"
          className="w-full ease-in-out hover:-translate-y-1 hover:scale-110 bg-teal-600 text-white rounded-lg py-2 font-semibold mt-2 hover:bg-teal-700 transition"
          disabled={isSending}
        >
          {isSending ? 'Enviando...' : 'Continue'}
        </button>

      </form>
    </div>
  </div>
)}

{/* Modal de sucesso */}
{showSuccessModal && lastSent && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm bg-opacity-60">
    <div className="bg-[#24292D] border-2 border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl relative flex flex-col items-center px-0 py-0">
      {/* Header */}
      <div className="w-full flex items-center justify-center px-8 pt-8 pb-2">
        <h2 className="text-lg font-semibold text-gray-200">Complete</h2>
      </div>
      <button
        className="absolute top-4 right-6 text-gray-400 hover:text-white text-2xl"
        onClick={() => setShowSuccessModal(false)}
        aria-label="Fechar"
      >
        ×
      </button>
      {/* Check icon */}
      <div className="flex flex-col items-center w-full px-8">
        <div className="rounded-full border-8 border-teal-600 flex items-center justify-center mb-6 mt-4" style={{ width: 180, height: 180 }}>
  <svg width="130" height="130" viewBox="0 0 100 100" fill="none">

    <path d="M32 54l15 15 25-25" stroke="#14B498" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
</div>
        <p className="text-xl font-semibold text-white mb-2 text-center">
          You sent {parseFloat(lastSent.amount).toFixed(4)} BCH
          {lastSent.amountBRL && ` (R$ ${parseFloat(lastSent.amountBRL).toFixed(2)})`}!
        </p>
        <p className="text-gray-400 mb-6 text-center">
          Transaction sent to external address.
        </p>
        <button
          className="bg-teal-600 hover:bg-teal-700 ease-in-out hover:-translate-y-1 hover:scale-110 text-white font-semibold px-8 py-3 rounded-2xl mb-4 transition"
          onClick={() => setShowSuccessModal(false)}
        >
          Back to home
        </button>
        <div className="flex gap-6 mb-6">
          <a
            href="#"
            className="text-teal-600 hover:underline text-sm flex items-center gap-1"
            target="_blank"
            rel="noopener noreferrer"
          >
            Bitcoin transaction <span>↗</span>
          </a>

        </div>
      </div>
      {/* Details */}
      <div className="w-full bg-[#23272B] rounded-b-2xl px-8 py-6 mt-2">
        <div className="flex flex-col gap-2 text-sm text-gray-300">
          <div className="flex justify-between">
            <span>Network Fee <span className="text-gray-500 ml-1" title="Taxa da rede">ⓘ</span></span>
            <span>0.00000220 BCH (R$ {(0.00000220 * (balance.currentRateBRL ?? 0)).toFixed(4)})</span>
          </div>
          <div className="flex justify-between">
            <span>Total <span className="text-gray-500 ml-1" title="Total com taxa">ⓘ</span></span>
            <span>
              {(parseFloat(lastSent.amount || '0') + 0.00000220).toFixed(8)} BCH (R$ {(((parseFloat(lastSent.amount || '0') + 0.00000220) * (balance.currentRateBRL ?? 0)).toFixed(2))})
            </span>
          </div>
          <div className="flex justify-between">
            <span>Recipient Address <span className="text-gray-500 ml-1" title="Endereço de destino">ⓘ</span></span>
            <span className="truncate max-w-[180px] text-right">{sendForm.address || '0.00000220 BCH'}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
)}

{/* Modal de recebimento */}
{receiveModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm bg-opacity-60">
    <div className="bg-[#24292D] rounded-xl p-0 w-full max-w-md shadow-2xl relative">
      <button
        className="absolute top-4 right-6 text-gray-400 hover:text-white text-2xl"
        onClick={() => setReceiveModalOpen(false)}
        aria-label="Fechar"
      >
        ×
      </button>
      <div className="border-b border-[#333a41] px-8 pt-8 pb-2">
        <div className="flex items-center justify-center w-full">
          <h2 className="text-xl font-semibold text-white mb-1 text-center w-full">Receive BCH</h2>
        </div>
      </div>
      <div className="flex flex-col items-center gap-4 px-8 py-6">
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <QRCode value={walletAddress || ''} size={160} />
        </div>
        <span className="text-base font-semibold text-white">BCH-Bitcoin Cash</span>
        <div className="flex items-center w-full justify-between bg-[#23272B] rounded-lg px-3 py-2 mt-2">
          <span className="text-xs text-gray-400 truncate max-w-[180px]">
            {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
          </span>
          <button
            className="ml-2 px-3 py-1 bg-[#1E1E1E] rounded-full text-xs font-medium text-white border border-[#333a41] hover:bg-[#333333]"
            onClick={() => {
              navigator.clipboard.writeText(walletAddress);
              setIsCopied(true);
              setTimeout(() => setIsCopied(false), 1200);
            }}
          >
            {isCopied ? "Copied!" : "Copy"}
          </button>
        </div>
        <button
          className="w-full mt-4 bg-teal-600 text-white rounded-lg py-3 font-semibold text-base hover:bg-teal-700 transition"
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: 'My BCH Address', text: walletAddress });
            } else {
              navigator.clipboard.writeText(walletAddress);
              setIsCopied(true);
              setTimeout(() => setIsCopied(false), 1200);
            }
          }}
        >
          Share address
        </button>
      </div>
    </div>
  </div>
)}



      </div>

  );
}
