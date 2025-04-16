import { useState, useEffect } from 'react';
import { FiArrowUp, FiArrowDown, FiCopy, FiDollarSign, FiCode, FiClock, FiRefreshCw } from 'react-icons/fi';
// Se você for usar QR Code real, precisará de uma biblioteca como qrcode.react
// import QRCode from 'qrcode.react';

// --- Tipos (mantidos do seu código original) ---
type Transaction = {
  _id: string;
  type: 'received' | 'sent';
  amountBCH: number;
  amountBRL: number; // Assumindo que o backend retorna isso também
  address: string; // Endereço da contraparte
  txHash?: string; // Adicionado: Hash da transação na blockchain
  timestamp: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations?: number;
};

type WalletBalance = {
  totalBCH: number;
  availableBCH: number;
  pendingBCH: number;
  totalBRL: number; // Valor total estimado em BRL
};

// --- Constante para a URL da API (Melhor prática: usar variáveis de ambiente) ---
const API_BASE_URL = 'http://localhost:3000/api';

export function WalletTab() {
  // --- Estados (mantidos e ajustados) ---
  const [balance, setBalance] = useState<WalletBalance>({
    totalBCH: 0,
    availableBCH: 0,
    pendingBCH: 0,
    totalBRL: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>(''); // Será preenchido pela API
  const [sendModalOpen, setSendModalOpen] = useState<boolean>(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState<boolean>(false);
  const [sendForm, setSendForm] = useState({
    address: '',
    amountBCH: '',
    amountBRL: '', // Mantido para UI, mas não enviado diretamente
    fee: 'medium' as 'low' | 'medium' | 'high',
  });
  const [isSending, setIsSending] = useState<boolean>(false); // Estado para feedback de envio

  // --- Função para buscar dados da carteira ---
  const fetchWalletData = async () => {
    try {
      setLoading(true);
      setError(null);
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
      setBalance(data.balance);
      setTransactions(data.transactions);
      setWalletAddress(data.address);
    } catch (err: any) {
      console.error('Erro em fetchWalletData:', err);
      setError(err.message || 'Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  // --- Efeito para buscar dados iniciais ---
  useEffect(() => {
    fetchWalletData();
    // Configura um intervalo para atualizar os dados periodicamente (opcional)
    // const intervalId = setInterval(fetchWalletData, 60000); // Atualiza a cada 60 segundos
    // return () => clearInterval(intervalId); // Limpa o intervalo ao desmontar
  }, []); // Array vazio garante que rode apenas na montagem inicial

  // --- Função para lidar com o envio de BCH ---
  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true); // Ativa o estado de envio
    setError(null); // Limpa erros anteriores

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      // Validação básica do formulário
      const amountToSend = parseFloat(sendForm.amountBCH);
      if (isNaN(amountToSend) || amountToSend <= 0) {
        throw new Error('Quantidade inválida.');
      }
      if (!sendForm.address.trim()) {
        throw new Error('Endereço de destino é obrigatório.');
      }
      // Adicione mais validações se necessário (ex: formato do endereço BCH)

      const response = await fetch(`${API_BASE_URL}/wallet/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          address: sendForm.address,
          amount: sendForm.amountBCH, // Envia a quantidade em BCH
          fee: sendForm.fee,
        }),
      });

      if (!response.ok) {
        let errorMsg = 'Erro ao enviar BCH';
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorMsg; // Usa a mensagem do backend se disponível
        } catch (parseError) {
          // Mantém a mensagem genérica
        }
        throw new Error(errorMsg);
      }

      // Sucesso!
      alert('Transação enviada com sucesso!'); // Considere usar Toasts/Notificações
      setSendModalOpen(false);
      setSendForm({ address: '', amountBCH: '', amountBRL: '', fee: 'medium' }); // Limpa o formulário
      fetchWalletData(); // Atualiza os dados da carteira após o envio

    } catch (err: any) {
      console.error("Erro em handleSendSubmit:", err);
      setError(err.message || 'Ocorreu um erro inesperado ao enviar.'); // Mostra o erro no estado
      alert(err.message || 'Erro ao enviar BCH'); // Mantém o alert por enquanto
    } finally {
      setIsSending(false); // Desativa o estado de envio
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

  // --- Funções de formatação (mantidas) ---
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatBCH = (value: number) => {
    // Evita NaN e formata com 8 casas decimais para BCH
    return (value || 0).toFixed(8) + ' BCH';
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('pt-BR');
    } catch {
      return 'Data inválida';
    }
  };

  const formatAddress = (address: string) => {
    if (!address || address.length < 10) return address || 'N/A';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // --- Simulação de Cotação (Idealmente viria do backend ou API externa) ---
  const BRL_PER_BCH = balance.totalBCH > 0 ? balance.totalBRL / balance.totalBCH : 7000; // Cotação estimada

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
        <button
          onClick={fetchWalletData}
          disabled={loading}
          className="p-2 rounded-full hover:bg-[var(--color-bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
          title="Atualizar dados"
        >
          <FiRefreshCw className={` ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Exibição de Erro Global */}
      {error && !sendModalOpen && ( // Não mostra erro global se o modal de envio estiver aberto (ele terá seu próprio feedback)
        <div className="bg-red-800 border border-red-600 text-white px-4 py-3 rounded relative mb-6" role="alert">
          <strong className="font-bold">Erro: </strong>
          <span className="block sm:inline">{error}</span>
          <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError(null)}>
            <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Fechar</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
          </span>
        </div>
      )}

      {/* Cards de Saldo */}
      {loading && !balance.totalBCH ? ( // Mostra skeleton apenas no carregamento inicial
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
          {/* Disponível */}
          <div className="bg-green-900 rounded-lg p-6 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-gray-300 text-sm font-medium">Disponível</h3>
                <p className="text-2xl font-bold mt-2">{formatBCH(balance.availableBCH)}</p>
              </div>
              <div className="bg-green-800 p-3 rounded-full">
                {/* Ícone pode ser melhorado, talvez um check? */}
                <FiArrowDown size={24} />
              </div>
            </div>
          </div>
          {/* Pendente */}
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
        </div>
      )}

      {/* Ações Rápidas */}
      <div className="flex flex-wrap gap-4 mb-8">
        <button
          onClick={() => setSendModalOpen(true)}
          disabled={loading || balance.availableBCH <= 0}
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
      </div>

      {/* Histórico Recente */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4">Transações Recentes</h3>

        {loading && transactions.length === 0 ? ( // Skeleton apenas no carregamento inicial sem dados
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
            {transactions.map((tx) => (
              <div key={tx._id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors">
                <div className="flex items-center gap-4 mb-2 sm:mb-0">
                  <div className={`flex-shrink-0 p-3 rounded-full ${
                    tx.type === 'received' ? 'bg-green-900 text-green-400' : 'bg-blue-900 text-blue-400'
                  }`}>
                    {tx.type === 'received' ? <FiArrowDown size={20} /> : <FiArrowUp size={20} />}
                  </div>
                  <div>
                    <p className="font-medium text-sm sm:text-base">
                      {tx.type === 'received' ? 'Recebido de' : 'Enviado para'}
                      <span className="ml-1 font-mono text-blue-400">{formatAddress(tx.address)}</span>
                    </p>
                    <p className="text-xs sm:text-sm text-gray-400">{formatDate(tx.timestamp)}</p>
                    {tx.txHash && (
                       <a
                         href={`https://explorer.bitcoinabc.org/tx/${tx.txHash}`} // Exemplo de link para explorador
                         target="_blank"
                         rel="noopener noreferrer"
                         className="text-xs text-gray-500 hover:text-blue-400 break-all"
                         title={tx.txHash}
                       >
                         Hash: {formatAddress(tx.txHash)}
                       </a>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end ml-auto sm:ml-0 pl-16 sm:pl-0">
                   <p className={`font-bold text-sm sm:text-base ${
                      tx.type === 'received' ? 'text-green-400' : 'text-blue-400'
                    }`}>
                      {tx.type === 'received' ? '+' : ''}{formatBCH(tx.amountBCH)}
                   </p>
                   <p className="text-xs sm:text-sm text-gray-400">
                      {formatCurrency(tx.amountBRL)}
                   </p>
                   <div className="mt-1">
                      {tx.status === 'confirmed' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Confirmado ({tx.confirmations || '✓'})
                        </span>
                      )}
                      {tx.status === 'pending' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          Pendente ({tx.confirmations || 0} conf.)
                        </span>
                      )}
                      {tx.status === 'failed' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          Falhou
                        </span>
                      )}
                   </div>
                </div>
              </div>
            ))}

            {/* Link para histórico completo (se houver uma página dedicada) */}
            {/* <button className="w-full mt-4 bg-[var(--color-bg-tertiary)] py-2 hover:bg-zinc-700 rounded-lg transition-colors">
              Ver histórico completo
            </button> */}
          </div>
        )}
      </div>

      {/* --- Modal de Envio --- */}
      {sendModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Enviar Bitcoin Cash</h3>
              <button
                onClick={() => !isSending && setSendModalOpen(false)} // Não permite fechar enquanto envia
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
                    {/* Botão QR Code (funcionalidade a implementar) */}
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
                      step="0.00000001" // 8 casas decimais
                      min="0.000001" // Valor mínimo razoável
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
                 {/* Botão Usar Saldo Máximo */}
                 <button
                    type="button"
                    onClick={() => handleAmountChange(balance.availableBCH.toString(), 'BCH')}
                    disabled={isSending || balance.availableBCH <= 0}
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
                  {/* Estimativa de taxa/tempo (simplificada) */}
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
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]" // min-width para evitar mudança de tamanho
                >
                  {isSending ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    'Enviar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal de Recebimento --- */}
      {receiveModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
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
              {/* QR Code */}
              <div className="bg-white p-4 rounded-lg inline-block mb-6 shadow-md">
                {walletAddress ? (
                  // <QRCode
                  //   value={walletAddress} // Usa o endereço real
                  //   size={192} // Tamanho do QR Code
                  //   level={"H"} // Nível de correção de erro
                  //   includeMargin={true}
                  // />
                   <div className="w-48 h-48 bg-gray-200 flex items-center justify-center text-gray-500">
                     <FiCode size={64} /> <span className="ml-2 text-xs">QR Code aqui</span>
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
