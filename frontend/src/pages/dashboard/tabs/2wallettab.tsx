import { useState, useEffect } from 'react';
import { FiArrowUp, FiArrowDown, FiCopy, FiDollarSign, FiCode, FiClock } from 'react-icons/fi';

type Transaction = {
  _id: string;
  type: 'received' | 'sent';
  amountBCH: number;
  amountBRL: number;
  address: string;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations?: number;
};

type WalletBalance = {
  totalBCH: number;
  availableBCH: number;
  pendingBCH: number;
  totalBRL: number;
};

export function WalletTab() {
  // Estado do saldo
  const [balance, setBalance] = useState<WalletBalance>({
    totalBCH: 0,
    availableBCH: 0,
    pendingBCH: 0,
    totalBRL: 0
  });
  
  // Estado das transações
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para o modal de envio
  const [sendModalOpen, setSendModalOpen] = useState<boolean>(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState<boolean>(false);
  const [sendForm, setSendForm] = useState({
    address: '',
    amountBCH: '',
    amountBRL: '',
    fee: 'medium' as 'low' | 'medium' | 'high'
  });
  
  // Endereço da carteira
  const [walletAddress, setWalletAddress] = useState('qprueba1234567890abcdefghijkmnopqrstuvwxyz');
  
  // Simulação de fetch de dados
  useEffect(() => {
    const fetchWalletData = async () => {
      try {
        setLoading(true);
        // Simulando uma chamada API
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Dados mockados do saldo
        setBalance({
          totalBCH: 3.456789,
          availableBCH: 3.123456,
          pendingBCH: 0.333333,
          totalBRL: 25000.50
        });
        
        // Dados mockados de transações
        const mockTransactions: Transaction[] = Array.from({ length: 5 }, (_, i) => ({
          _id: `tx-${i}`,
          type: i % 2 === 0 ? 'received' : 'sent',
          amountBCH: i % 2 === 0 ? 
            Math.random() * 2 + 0.1 : 
            -(Math.random() * 1 + 0.01),
          amountBRL: i % 2 === 0 ? 
            (Math.random() * 1000 + 50) : 
            -(Math.random() * 500 + 10),
          address: i % 2 === 0 ? 
            `qpsender${Math.random().toString(16).substring(2, 10)}` : 
            `qprecipient${Math.random().toString(16).substring(2, 12)}`,
          timestamp: new Date(Date.now() - i * 86400000).toISOString(),
          status: i % 3 === 0 ? 'pending' : 'confirmed',
          confirmations: i % 3 === 0 ? 0 : Math.floor(Math.random() * 100) + 1
        }));
        
        setTransactions(mockTransactions);
        setError(null);
      } catch (err) {
        setError('Erro ao carregar dados da carteira');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWalletData();
  }, []);

  // Formatação de dados
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatBCH = (value: number) => {
    return value.toFixed(6) + ' BCH';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const handleSendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Implementar lógica de envio
    alert(`Enviando ${sendForm.amountBCH} BCH para ${sendForm.address}`);
    setSendModalOpen(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(walletAddress);
    alert('Endereço copiado!');
  };

  return (
    <div className="p-6 bg-[var(--color-bg-primary)] text-white min-h-screen">
      <h2 className="text-2xl font-bold mb-6">Minha Carteira Bitcoin Cash</h2>
      
      {/* Cards de Saldo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
      
      {/* Ações Rápidas */}
      <div className="flex flex-wrap gap-4 mb-8">
        <button
          onClick={() => setSendModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-800 px-6 py-3 rounded-lg transition-colors"
        >
          <FiArrowUp /> Enviar BCH
        </button>
        
        <button
          onClick={() => setReceiveModalOpen(true)}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-800 px-6 py-3 rounded-lg transition-colors"
        >
          <FiArrowDown /> Receber BCH
        </button>
        
        <button className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 px-6 py-3 rounded-lg transition-colors">
          <FiDollarSign /> Converter para BRL
        </button>
      </div>
      
      {/* Histórico Recente */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4">Transações Recentes</h3>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-red-400 text-center py-8">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="text-white text-center py-8">Nenhuma transação recente</div>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div key={tx._id} className="flex justify-between items-center p-4 hover:bg-gray-750 rounded-lg transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${
                    tx.type === 'received' ? 'bg-green-900 text-green-400' : 'bg-blue-900 text-blue-400'
                  }`}>
                    {tx.type === 'received' ? <FiArrowDown size={20} /> : <FiArrowUp size={20} />}
                  </div>
                  <div>
                    <p className="font-medium">
                      {tx.type === 'received' ? 'Recebido de' : 'Enviado para'} {formatAddress(tx.address)}
                    </p>
                    <p className="text-sm text-gray-400">{formatDate(tx.timestamp)}</p>
                    {tx.status === 'pending' && (
                      <span className="inline-block mt-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        Pendente
                      </span>
                    )}
                  </div>
                </div>
                <div className={`text-right ${
                  tx.type === 'received' ? 'text-green-400' : 'text-blue-400'
                }`}>
                  <p className="font-bold">
                    {tx.type === 'received' ? '+' : ''}{formatBCH(tx.amountBCH)}
                  </p>
                  <p className="text-sm text-gray-400">
                    {formatCurrency(tx.amountBRL)}
                  </p>
                </div>
              </div>
            ))}
            
            <button className="w-full mt-4 bg-[var(--color-bg-tertiary)] py-2 hover:bg-zinc-700 rounded-lg transition-colors">
              Ver histórico completo
            </button>
          </div>
        )}
      </div>
      
      {/* Modal de Envio */}
      {sendModalOpen && (
        <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Enviar Bitcoin Cash</h3>
              <button
                onClick={() => setSendModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSendSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Endereço de destino</label>
                  <input
                    type="text"
                    value={sendForm.address}
                    onChange={(e) => setSendForm({...sendForm, address: e.target.value})}
                    placeholder="Digite o endereço BCH"
                    className="w-full px-3 py-2 rounded bg-[var(--color-bg-secondary)] focus:outline-none focus:ring-2 focus:ring-zinc-800 font-mono"
                    required
                  />
                  <button
                    type="button"
                    className="mt-1 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400"
                  >
                    <FiCode /> Digitalizar QR Code
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Quantidade (BCH)</label>
                    <input
                      type="number"
                      step="0.000001"
                      min="0.000001"
                      value={sendForm.amountBCH}
                      onChange={(e) => setSendForm({
                        ...sendForm, 
                        amountBCH: e.target.value,
                        amountBRL: (parseFloat(e.target.value) * 1500).toString() // Simulação de cotação
                      })}
                      className="w-full px-3 py-2 rounded bg-[var(--color-bg-secondary)] focus:outline-none focus:ring-2 focus:ring-zinc-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Valor (BRL)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={sendForm.amountBRL}
                      onChange={(e) => setSendForm({
                        ...sendForm, 
                        amountBRL: e.target.value,
                        amountBCH: (parseFloat(e.target.value) / 1500).toString() // Simulação de cotação
                      })}
                      className="w-full px-3 py-2 rounded bg-[var(--color-bg-secondary)] focus:outline-none focus:ring-2 focus:ring-zinc-800"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Taxa de rede</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSendForm({...sendForm, fee: 'low'})}
                      className={`py-2 rounded border ${
                        sendForm.fee === 'low' ? 
                          'bg-red-800 border-red-600 border-2' : 
                          'bg-[var(--color-bg-secondary)] border-2 border-zinc-800 hover:bg-red-800 hover:border-red-600'
                      }`}
                    >
                      Baixa
                    </button>
                    <button
                      type="button"
                      onClick={() => setSendForm({...sendForm, fee: 'medium'})}
                      className={`py-2 rounded border ${
                        sendForm.fee === 'medium' ? 
                          'bg-yellow-700 border-yellow-600 border-2' : 
                          'bg-[var(--color-bg-secondary)] border-2 border-zinc-800 hover:bg-yellow-700 hover:border-yellow-600'
                      }`}
                    >
                      Média
                    </button>
                    <button
                      type="button"
                      onClick={() => setSendForm({...sendForm, fee: 'high'})}
                      className={`py-2 rounded border ${
                        sendForm.fee === 'high' ? 
                          'bg-green-800 border-green-600 border-2' : 
                          'bg-[var(--color-bg-secondary)] border-2 border-zinc-800 hover:bg-green-800 hover:border-green-600'
                      }`}
                    >
                      Alta
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {sendForm.fee === 'low' && '~10-30 minutos (1 sat/byte)'}
                    {sendForm.fee === 'medium' && '~5-10 minutos (5 sat/byte)'}
                    {sendForm.fee === 'high' && '~1-2 minutos (10 sat/byte)'}
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSendModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-red-800 border-2 border-red-600 hover:bg-red-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg border-2 border-green-600  bg-green-800 hover:bg-green-600 transition-colors"
                >
                  Enviar Bitcoin Cash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal de Recebimento */}
      {receiveModalOpen && (
        <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Receber Bitcoin Cash</h3>
              <button
                onClick={() => setReceiveModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="text-center">
              <div className="bg-white p-4 rounded-lg inline-block mb-4">
                {/* QR Code Placeholder */}
                <div className="w-48 h-48 bg-gray-200 flex items-center justify-center text-gray-500">
                  <FiCode size={64} />
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-gray-400 mb-2">Seu endereço para recebimento</p>
                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                  <span className="font-mono text-blue-400 overflow-x-auto max-w-xs">
                    {walletAddress}
                  </span>
                  <button
                    onClick={copyToClipboard}
                    className="text-gray-400 hover:text-white ml-2"
                    title="Copiar endereço"
                  >
                    <FiCopy />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <button className="py-2 border border-white-600 hover:bg-gray-700 rounded-lg">
                  Compartilhar
                </button>
                <button 
                  onClick={copyToClipboard}
                  className="py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center gap-2"
                >
                  <FiCopy /> Copiar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}