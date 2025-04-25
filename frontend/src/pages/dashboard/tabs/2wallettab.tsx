import { useState, useEffect } from 'react';
import { FiArrowUp, FiArrowDown, FiCopy, FiDollarSign, FiCode, FiClock, FiRefreshCw } from 'react-icons/fi';
import { io, Socket } from 'socket.io-client'; 
import { toast } from 'react-toastify'; 
import QRCode from 'react-qr-code'; 
import { useNotification } from '../../../context/NotificationContext';

// --- Tipos ---
type Transaction = {
  _id: string;
  // Adjusted type based on backend model (may include 'internal', 'unknown')
  type: 'received' | 'sent' | 'incoming' | 'outgoing' | 'internal' | 'unknown';
  amountBCH: number;
  amountBRL: number;
  address: string;
  fromAddress?: string; // Adicione o campo fromAddress

  txid?: string; // Changed from txHash to match backend model
  timestamp: string;
  // Adjusted status based on backend model (may not exist directly on tx, inferred?)
  // Let's assume status comes from somewhere or we derive it
  status: 'pending' | 'confirmed' | 'failed';
  confirmations?: number;
  blockHeight?: number; // Added from backend model
};

type WalletBalance = {
  totalBCH: number;
  availableBCH?: number; // Make optional if not always present
  pendingBCH?: number;  // Make optional if not always present
  totalBRL: number;
  totalSatoshis?: number; // Added from backend response
};

// --- Constantes ---
const API_BASE_URL = 'http://localhost:3000/api';
const WEBSOCKET_URL = 'http://localhost:3000'; // Your backend URL

export function WalletTab() {
  const { addNotification } = useNotification();
  // --- Estados ---
  const [balance, setBalance] = useState<WalletBalance>({
    totalBCH: 0,
    totalBRL: 0,
    totalSatoshis: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [sendModalOpen, setSendModalOpen] = useState<boolean>(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState<boolean>(false);
  const [sendForm, setSendForm] = useState({
    address: '',
    amountBCH: '',
    amountBRL: '',
    fee: 'medium' as 'low' | 'medium' | 'high',
  });
  const [isSending, setIsSending] = useState<boolean>(false);
  const [socket, setSocket] = useState<Socket | null>(null); // State for the socket instance
  const [notifications, setNotifications] = useState<
    { id: string; message: string; timestamp: string }[]
  >([]);

  // --- Função para buscar dados da carteira ---
  const fetchWalletData = async () => {
    // Only set loading if not already loading to avoid flicker on WebSocket update
    if (!loading) setLoading(true);
    // Don't clear error immediately, let new fetch overwrite or succeed
    // setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      const response = await fetch(`${API_BASE_URL}/wallet`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let errorMsg = 'Erro ao carregar dados da carteira';
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorMsg;
        } catch (parseError) {}
        throw new Error(errorMsg);
      }

      const data = await response.json();

      // --- Adapt parsing based on actual backend response ---
      const fetchedBalance: WalletBalance = {
        totalBCH: data.balance?.totalBCH || 0,
        totalBRL: data.balance?.totalBRL || 0,
        totalSatoshis: data.balance?.totalSatoshis || 0,
        // Add available/pending if your backend provides them
        availableBCH: data.balance?.availableBCH, // Example
        pendingBCH: data.balance?.pendingBCH,   // Example
      };

      // Map backend transaction type ('incoming'/'outgoing') to frontend ('received'/'sent')
      const fetchedTransactions: Transaction[] = (data.transactions || []).map((tx: any) => ({
        ...tx,
        type: tx.type === 'incoming' ? 'received' : tx.type === 'outgoing' ? 'sent' : tx.type,
        status: tx.blockHeight && tx.blockHeight > 0 ? 'confirmed' : 'pending',
        txid: tx.txid, // Use txid from backend
        fromAddress: tx.fromAddress, // Include fromAddress
      }));
      // --- End Adaptation ---

      setBalance(fetchedBalance);
      setTransactions(fetchedTransactions);
      setWalletAddress(data.address);
      setError(null); // Clear error on successful fetch

    } catch (err: any) {
      console.error('Erro em fetchWalletData:', err);
      setError(err.message || 'Ocorreu um erro inesperado.');
      // Don't clear data on error, keep showing old data if available
    } finally {
      setLoading(false);
    }
  };

  // --- Efeito para buscar dados iniciais E configurar WebSocket ---
  useEffect(() => {
    // 1. Fetch initial data
    fetchWalletData();

    // 2. Setup WebSocket
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn("WebSocket: No token found, cannot connect.");
      setError("Autenticação necessária para atualizações em tempo real."); // Inform user
      return; // Don't try to connect without token
    }

    // Connect to the WebSocket server, passing the token for authentication
    // Use { transports: ['websocket'] } if you want to force WebSocket only
    const newSocket = io(WEBSOCKET_URL, {
      auth: { token }, // Send token for backend authentication
      reconnectionAttempts: 5, // Limit reconnection attempts
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected:', newSocket.id);
      setSocket(newSocket); // Store the socket instance in state
      setError(null); // Clear potential connection errors on successful connect
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setSocket(null); // Clear socket instance
      // Optionally inform the user or attempt manual reconnect later
      if (reason !== 'io client disconnect') { // Don't show error if disconnected manually
         setError("Desconectado das atualizações em tempo real. Tentando reconectar...");
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err.message);
      setError(`Erro na conexão real-time: ${err.message}`);
      setSocket(null);
    });

    // --- Listen for the 'walletUpdate' event from the backend ---
   

    // --- Cleanup function ---
    return () => {
      console.log('Disconnecting WebSocket...');
      newSocket.disconnect(); // Disconnect when component unmounts
      setSocket(null);
    };

  }, []); // Empty array: Run only on mount and clean up on unmount



  // --- Função para lidar com o envio de BCH ---
  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setError(null);
  
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Usuário não autenticado.');
  
      const amountToSend = parseFloat(sendForm.amountBCH);
      if (isNaN(amountToSend) || amountToSend <= 0) throw new Error('Quantidade inválida.');
      if (!sendForm.address.trim()) throw new Error('Endereço de destino é obrigatório.');
  
      console.log('Enviando dados para o backend:', {
        address: sendForm.address,
        amount: sendForm.amountBCH,
        fee: sendForm.fee,
      });
  
      const response = await fetch(`${API_BASE_URL}/wallet/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          address: sendForm.address,
          amount: sendForm.amountBCH,
          fee: sendForm.fee,
        }),
      });
  
      if (!response.ok) {
        let errorMsg = 'Erro ao enviar BCH';
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorMsg;
        } catch (parseError) {}
        throw new Error(errorMsg);
      }
  
      const result = await response.json();
      alert(`Transação enviada com sucesso! TXID: ${result.txid || 'N/A'}`);
      setSendModalOpen(false);
      setSendForm({ address: '', amountBCH: '', amountBRL: '', fee: 'medium' });
    } catch (err: any) {
      console.error("Erro em handleSendSubmit:", err);
      setError(err.message || 'Ocorreu um erro inesperado ao enviar.');
    } finally {
      setIsSending(false);
    }
  };
  

  // --- Função para copiar endereço ---
  const copyToClipboard = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress)
      .then(() => {
        alert('Endereço copiado para a área de transferência!'); // Considere usar Toasts
      })
      .catch(err => {
        console.error('Erro ao copiar endereço:', err);
        alert('Falha ao copiar o endereço.');
      });
  };

  // --- Funções de formatação ---
  const formatCurrency = (value: number | undefined) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const formatBCH = (value: number | undefined) => {
    return (value || 0).toFixed(8) + ' BCH';
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('pt-BR');
    } catch {
      return 'Data inválida';
    }
  };

  const formatAddress = (address: string | undefined) => {
    if (!address || address.length < 10) return address || 'N/A';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // --- Simulação de Cotação ---
  // Use state value if available, otherwise estimate
  const BRL_PER_BCH = balance.totalBCH && balance.totalBRL ? balance.totalBRL / balance.totalBCH : 7000;

  const handleAmountChange = (value: string, type: 'BCH' | 'BRL') => {
    const numericValue = parseFloat(value) || 0;
    if (type === 'BCH') {
      setSendForm({
        ...sendForm,
        amountBCH: value,
        amountBRL: (numericValue * BRL_PER_BCH).toFixed(2),
      });
    } else {
      setSendForm({
        ...sendForm,
        amountBRL: value,
        amountBCH: BRL_PER_BCH > 0 ? (numericValue / BRL_PER_BCH).toFixed(8) : '0',
      });
    }
  };

  // --- Renderização do Componente ---
  return (
    <div className="p-6 bg-[var(--color-bg-primary)] text-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Minha Carteira Bitcoin Cash</h2>
        {/* Display WebSocket connection status */}
        <div className="flex items-center gap-2 text-sm">
           {socket?.connected ? (
              <span className="flex items-center gap-1 text-green-400">
                 <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Real-time ON
              </span>
           ) : error && error.includes("conexão") ? (
              <span className="flex items-center gap-1 text-red-400">
                 <span className="w-2 h-2 rounded-full bg-red-500"></span> Real-time OFF
              </span>
           ) : (
              <span className="flex items-center gap-1 text-yellow-400">
                 <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Conectando...
              </span>
           )}
           <button
             onClick={fetchWalletData} // Keep manual refresh
             disabled={loading}
             className="p-2 rounded-full hover:bg-[var(--color-bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
             title="Atualizar dados"
           >
             <FiRefreshCw className={` ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </div>

      {/* Exibição de Erro Global (excluding connection errors shown above) */}
      {error && !error.includes("conexão") && !sendModalOpen && (
        <div className="bg-red-800 border border-red-600 text-white px-4 py-3 rounded relative mb-6" role="alert">
          <strong className="font-bold">Erro: </strong>
          <span className="block sm:inline">{error}</span>
          <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-300 hover:text-white">✕</button>
        </div>
      )}

      {/* Cards de Saldo */}
       {loading && !balance.totalSatoshis ? ( // Show skeleton only on initial load
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-pulse">
            <div className="bg-[var(--color-bg-secondary)] h-32 rounded-lg p-6"></div>
            <div className="bg-[var(--color-bg-secondary)] h-32 rounded-lg p-6"></div>
            <div className="bg-[var(--color-bg-secondary)] h-32 rounded-lg p-6"></div>
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Saldo Total */}
          <div className="bg-blue-900 rounded-lg p-6 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-gray-300 text-sm font-medium">Saldo Total</h3>
                <p className="text-2xl font-bold mt-2">{formatBCH(balance.totalBCH)}</p>
                <p className="text-gray-300 mt-1">{formatCurrency(balance.totalBRL)}</p>
              </div>
              <div className="bg-blue-800 p-3 rounded-full">
                <FiDollarSign size={24} />
              </div>
            </div>
          </div>
          {/* Disponível (Show if available) */}
          {balance.availableBCH !== undefined && (
            <div className="bg-green-900 rounded-lg p-6 shadow-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-gray-300 text-sm font-medium">Disponível</h3>
                  <p className="text-2xl font-bold mt-2">{formatBCH(balance.availableBCH)}</p>
                </div>
                <div className="bg-green-800 p-3 rounded-full">
                  <FiArrowDown size={24} />
                </div>
              </div>
            </div>
          )}
          {/* Pendente (Show if available and > 0) */}
          {balance.pendingBCH !== undefined && balance.pendingBCH > 0 && (
            <div className="bg-yellow-600 rounded-lg p-6 shadow-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-gray-300 text-sm font-medium">Pendente</h3>
                  <p className="text-2xl font-bold mt-2">{formatBCH(balance.pendingBCH)}</p>
                </div>
                <div className="bg-yellow-500 p-3 rounded-full">
                  <FiClock size={24} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {/* Ações Rápidas */}
       <div className="flex flex-wrap gap-4 mb-8">
        <button
          onClick={() => setSendModalOpen(true)}
          disabled={loading || !walletAddress} 
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-800 px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiArrowUp /> Enviar BCH
        </button>

        <button
          onClick={() => setReceiveModalOpen(true)}
          disabled={loading || !walletAddress}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-800 px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiArrowDown /> Receber BCH
        </button>

        {/* Botão de Conversão (funcionalidade a implementar) */}
        <button disabled className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <FiDollarSign /> Converter para BRL (Em breve)
        </button>

        <button
          onClick={() => {
            const newNotification = {
              id: Math.random().toString(36).substr(2, 9), // Gera um ID único
              message: 'Pagamento detectado para o endereço X!',
              timestamp: new Date().toLocaleString('pt-BR'),
              amountBCH: 0.01, // Exemplo de valor
              amountBRL: 50.0, // Exemplo de valor
              receivedAt: new Date().toLocaleTimeString('pt-BR'),
              onViewDetails: () => {
                console.log('Detalhes da notificação visualizados.');
              },
            };
            addNotification(newNotification); // Adiciona ao contexto global
            toast.success(newNotification.message, {
              position: 'top-right',
              autoClose: 5000,
            });
          }}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-800 px-6 py-3 rounded-lg transition-colors"
        >
          Testar Notificação
        </button>
      </div>


      {/* Histórico Recente */}
       <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4">Transações Recentes</h3>

        {loading && transactions.length === 0 ? ( // Skeleton only on initial load
          <div className="space-y-4 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between items-center p-4 rounded-lg bg-[var(--color-bg-tertiary)]">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-gray-700 h-12 w-12"></div>
                  <div>
                    <div className="h-4 bg-gray-700 rounded w-48 mb-2"></div>
                    <div className="h-3 bg-gray-700 rounded w-32"></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-4 bg-gray-700 rounded w-24 mb-2"></div>
                  <div className="h-3 bg-gray-700 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        ) : !loading && transactions.length === 0 ? (
          <div className="text-gray-400 text-center py-8">Nenhuma transação encontrada.</div>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx, index) => (
              <div
                key={tx._id || `tx-fallback-${index}`} // Use _id se disponível, senão use o índice
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
              >
                <div className="flex items-center gap-4 mb-2 sm:mb-0">
                  <div
                    className={`flex-shrink-0 p-3 rounded-full ${
                      tx.type === 'received' ? 'bg-green-900 text-green-400' : 'bg-blue-900 text-blue-400'
                    }`}
                  >
                    {tx.type === 'received' ? <FiArrowDown size={20} /> : <FiArrowUp size={20} />}
                  </div>
                  <div>
                    <p className="font-medium text-sm sm:text-base">
                      {tx.type === 'received' ? 'Recebido de' : 'Enviado para'}
                      <span className="ml-1 font-mono text-blue-400">
                        {tx.type === 'received'
                          ? (tx.fromAddress ? formatAddress(tx.fromAddress) : 'Origem Desconhecida')
                          : formatAddress(tx.address)}
                      </span>
                    </p>
                    <p className="text-xs sm:text-sm text-gray-400">{formatDate(tx.timestamp)}</p>
                    {tx.txid && (
                      <a
                        href={`https://explorer.bitcoinabc.org/tx/${tx.txid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-blue-400 break-all"
                        title={tx.txid}
                      >
                        Hash: {formatAddress(tx.txid)}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end ml-auto sm:ml-0 pl-16 sm:pl-0">
                  <p
                    className={`font-bold text-sm sm:text-base ${
                      tx.type === 'received' ? 'text-green-400' : 'text-blue-400'
                    }`}
                  >
                    {tx.type === 'received' ? '+' : '-'}
                    {formatBCH(tx.amountBCH)}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-400">{formatCurrency(tx.amountBRL)}</p>
                  <div className="mt-1">
                    {tx.blockHeight && tx.blockHeight > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Confirmado ({tx.confirmations || '✓'})
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        Pendente ({tx.confirmations || 0} conf.)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* --- Modal de Envio --- */}
       {sendModalOpen && (
        <div className="fixed inset-0 bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Enviar Bitcoin Cash</h3>
              <button
                onClick={() => !isSending && setSendModalOpen(false)}
                className="text-gray-400 hover:text-white disabled:opacity-50"
                disabled={isSending}
              >
                ✕
              </button>
            </div>

            {/* Exibição de Erro no Modal */}
            {error && (
              <div className="bg-red-800 border border-red-600 text-white px-4 py-2 rounded relative mb-4 text-sm" role="alert">
                {error}
                <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-3 py-2 text-red-300 hover:text-white">✕</button>
              </div>
            )}

            <form onSubmit={handleSendSubmit}>
              <div className="space-y-4">
                {/* Endereço */}
                <div>
                  <label className="block text-sm font-medium mb-1">Endereço de destino</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={sendForm.address}
                      onChange={(e) => setSendForm({...sendForm, address: e.target.value})}
                      placeholder="bitcoincash:q..."
                      className="w-full px-3 py-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] font-mono text-sm"
                      required
                      disabled={isSending}
                    />
                    <button
                      type="button"
                      disabled
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-500 hover:text-blue-400 disabled:opacity-50"
                      title="Digitalizar QR Code (Em breve)"
                    >
                      <FiCode />
                    </button>
                  </div>
                </div>

                {/* Quantidade */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Quantidade (BCH)</label>
                    <input
                      type="number"
                      step="0.00000001"
                      min="0.000001"
                      value={sendForm.amountBCH}
                      onChange={(e) => handleAmountChange(e.target.value, 'BCH')}
                      className="w-full px-3 py-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] text-sm"
                      required
                      disabled={isSending}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Valor (BRL)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={sendForm.amountBRL}
                      onChange={(e) => handleAmountChange(e.target.value, 'BRL')}
                      className="w-full px-3 py-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] text-sm"
                      required
                      disabled={isSending}
                    />
                  </div>
                </div>
                 <button
                    type="button"
                    onClick={() => handleAmountChange((balance.availableBCH ?? balance.totalBCH).toString(), 'BCH')} // Use available if present
                    disabled={isSending || (balance.availableBCH ?? balance.totalBCH) <= 0}
                    className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Usar saldo disponível (descontando taxa estimada)
                  </button>

                {/* Taxa */}
                <div>
                  <label className="block text-sm font-medium mb-1">Taxa de rede</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['low', 'medium', 'high'] as const).map((feeLevel) => (
                      <button
                        key={feeLevel}
                        type="button"
                        onClick={() => setSendForm({...sendForm, fee: feeLevel})}
                        disabled={isSending}
                        className={`py-2 rounded border-2 text-sm transition-colors disabled:opacity-50 ${
                          sendForm.fee === feeLevel
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent-hover)] text-white font-semibold'
                            : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-gray-500'
                        }`}
                      >
                        {feeLevel === 'low' ? 'Baixa' : feeLevel === 'medium' ? 'Média' : 'Alta'}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {sendForm.fee === 'low' && 'Confirmação mais lenta, menor custo.'}
                    {sendForm.fee === 'medium' && 'Confirmação balanceada.'}
                    {sendForm.fee === 'high' && 'Confirmação mais rápida, maior custo.'}
                  </p>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSendModalOpen(false)}
                  disabled={isSending}
                  className="px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSending || !sendForm.address || !sendForm.amountBCH || parseFloat(sendForm.amountBCH) <= 0}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
                >
                  {isSending ? <FiArrowUp /> : 'Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* --- Modal de Recebimento --- */}
       {receiveModalOpen && (
        <div className="fixed inset-0 bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Receber Bitcoin Cash</h3>
              <button
                onClick={() => setReceiveModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-center">
              {/* QR Code Placeholder */}
              <div className="bg-white p-4 rounded-lg inline-block mb-6 shadow-md">
                {walletAddress ? (
                   <div className="w-48 h-48 bg-gray-200 flex items-center justify-center text-gray-500">
                     <QRCode value={walletAddress} size={400} /> 
                   </div>
                ) : (
                  <div className="w-48 h-48 bg-gray-200 flex items-center justify-center text-gray-500">
                    Carregando endereço...
                  </div>
                )}
              </div>

              {/* Endereço */}
              <div className="mb-6">
                <p className="text-sm text-gray-400 mb-2">Seu endereço para recebimento</p>
                <div className="flex items-center justify-between bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] p-3 rounded-lg">
                  <span className="font-mono text-blue-400 overflow-x-auto text-sm break-all mr-2">
                    {walletAddress || 'Carregando...'}
                  </span>
                  <button
                    onClick={copyToClipboard}
                    disabled={!walletAddress}
                    className="text-gray-400 hover:text-white flex-shrink-0 disabled:opacity-50"
                    title="Copiar endereço"
                  >
                    <FiCopy />
                  </button>
                </div>
              </div>

              {/* Ações */}
              <div className="grid grid-cols-2 gap-3">
                <button disabled className="py-2 border border-gray-600 hover:bg-gray-700 rounded-lg text-sm disabled:opacity-50">
                  Compartilhar (Em breve)
                </button>
                <button
                  onClick={copyToClipboard}
                  disabled={!walletAddress}
                  className="py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <FiCopy /> Copiar Endereço
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
