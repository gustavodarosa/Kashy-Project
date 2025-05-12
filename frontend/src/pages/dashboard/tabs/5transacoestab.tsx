import { useState, useEffect } from 'react';
import { FiSearch, FiChevronLeft, FiChevronRight, FiDownload, FiFilter } from 'react-icons/fi';

type Transaction = {
  _id: string;
  txid: string; // <-- MUDOU de txHash
  address: string; // <-- MUDOU de from/toAddress (representa o endereço relevante)
  amount: number; // <-- MUDOU de amountBCH (valor em BCH)
  convertedBRL: number; // <-- MUDOU de amountBRL (valor em BRL)
  // status: 'pending' | 'confirmed' | 'failed' | 'expired'; // Status vem de 'confirmed' boolean
  confirmed: boolean; // <-- Adicionado para status
  type: 'sent' | 'received' | 'unknown'; // Tipo da transação vindo do backend
  timestamp: string; // <-- MUDOU de createdAt
  confirmations: number;
  blockHeight?: number;
  fee?: number; // <-- MUDOU de feeBCH (valor da taxa em BCH)
  order?: {
    _id: string;
    totalBRL: number;
  };
  user?: {
    _id: string;
    email: string;
  };
  merchant?: {
    _id: string;
    businessName: string;
  };
};

export function TransacoesTab() {
  // Estado para as transações
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para paginação
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const itemsPerPage = 10;
  
  // Estado para filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);

  // Simulação de fetch de dados
  useEffect(() => { // <-- HOOK PRINCIPAL PARA BUSCAR DADOS
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        // Simulando uma chamada API
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Dados mockados
        // --- INÍCIO DA LÓGICA REAL ---
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Usuário não autenticado.');
        }

        // Construir URL com parâmetros de query
        const params = new URLSearchParams();
        params.append('page', currentPage.toString());
        params.append('limit', itemsPerPage.toString());
        if (searchTerm) params.append('search', searchTerm);
        if (statusFilter !== 'all') params.append('status', statusFilter);

        // Lógica para converter dateFilter em startDate/endDate (Exemplo)
        // Você precisará ajustar isso conforme a necessidade da sua API
        const now = new Date();
        let startDate: string | null = null;
        let endDate: string | null = null;
        if (dateFilter === 'today') {
            startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
            endDate = new Date(now.setHours(23, 59, 59, 999)).toISOString();
        } else if (dateFilter === 'week') {
            startDate = new Date(now.getTime() - 7 * 86400000).toISOString();
            endDate = new Date().toISOString();
        } else if (dateFilter === 'month') {
            startDate = new Date(now.getTime() - 30 * 86400000).toISOString();
            endDate = new Date().toISOString();
        }
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const response = await fetch(`http://localhost:3000/api/wallet/transactions?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido ao buscar transações.' }));
          throw new Error(errorData.message || `Erro ${response.status}`);
        }

        const data = await response.json();

        // Assumindo que a API retorna { transactions: Transaction[], totalPages: number, currentPage: number }
        setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
        setTotalPages(data.totalPages || 1);
        // Opcional: Ajustar currentPage se a API retornar um valor diferente (ex: se a página pedida não existir)
        // if (data.currentPage !== currentPage) setCurrentPage(data.currentPage);
        // --- FIM DA LÓGICA REAL ---

        setError(null);
      } catch (err) {
        setError('Erro ao carregar transações');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTransactions(); // Chama a função para buscar os dados
  }, [currentPage, searchTerm, statusFilter, dateFilter]);

  // Formatação de dados
  const formatCurrency = (value: number | undefined | null): string => {
    if (typeof value !== 'number' || isNaN(value)) {
      return 'R$ --,--'; // Retorna um placeholder se o valor for inválido
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value); // Formata o valor válido
  };

  const formatBCH = (value: number | undefined | null): string => {
    // Verifica se 'value' é um número válido antes de chamar toFixed
    if (typeof value === 'number' && !isNaN(value)) {
      return value.toFixed(6) + ' BCH';
    }
    return '0.000000 BCH'; // Ou 'N/A', dependendo do que fizer mais sentido
  };

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return 'Data inválida';
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? 'Data inválida' : date.toLocaleString('pt-BR');
    } catch { return 'Data inválida'; }
  };

  const formatAddress = (address: string | undefined | null): string => {
    // Verifica se 'address' é uma string e tem comprimento suficiente
    if (typeof address === 'string' && address.length >= 10) {
      return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
    return address || 'N/A'; // Retorna o próprio endereço se for curto, ou 'N/A' se for nulo/undefined
  };

  const getStatusColor = (status: string) => {
    // Ajustado para usar o booleano 'confirmed' e o 'type'
    if (status === 'confirmed') { // Usando string 'confirmed' como exemplo, ajuste se necessário
        return 'bg-green-100 text-green-800';
    } else if (status === 'pending') {
        return 'bg-yellow-100 text-yellow-800';
    } else if (status === 'failed') { // Assumindo que 'failed' pode vir de algum lugar
        return 'bg-red-100 text-red-800';
    } else if (status === 'expired') { // Assumindo que 'expired' pode vir de algum lugar
        return 'bg-gray-100 text-gray-800';
    } else {
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusLabel = (status: string) => {
    // Ajustado para usar o booleano 'confirmed' e o 'type'
    if (status === 'confirmed') {
        return 'Confirmada';
    } else if (status === 'pending') {
        return 'Pendente';
    } else if (status === 'failed') {
        return 'Falhou';
    } else if (status === 'expired') {
        return 'Expirada';
    } else { // Use 'else' instead of 'default'
        return status; // Return the original status if none match
    }
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h2 className="text-2xl font-bold mb-6">Histórico de Transações</h2>
      
      {/* Barra de ações */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="relative w-full md:w-96">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por hash, endereço, email..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center gap-2 border border-gray-700 hover:bg-gray-800 px-4 py-2 rounded-lg transition-colors"
          >
            <FiFilter /> Filtrar
          </button>
          
          <button className="flex items-center gap-2 border border-gray-700 hover:bg-gray-800 px-4 py-2 rounded-lg transition-colors">
            <FiDownload /> Exportar
          </button>
        </div>
      </div>
      
      {/* Filtros avançados */}
      {isFilterOpen && (
        <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos os status</option>
                <option value="confirmed">Confirmadas</option>
                <option value="pending">Pendentes</option>
                <option value="failed">Falhas</option>
                <option value="expired">Expiradas</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Período</label>
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todo período</option>
                <option value="today">Hoje</option>
                <option value="week">Últimos 7 dias</option>
                <option value="month">Últimos 30 dias</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setDateFilter('all');
                  setCurrentPage(1);
                }}
                className="px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-700 transition-colors w-full"
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Tabela de transações */}
      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4">Carregando transações...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400">
            <p>{error}</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>Nenhuma transação encontrada</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-750">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Hash/ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">De/Para</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Valor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Origem/Destino</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Data</th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {transactions.map((tx) => (
                    <tr key={tx._id} className="hover:bg-gray-750 transition-colors">
                      <td className="px-6 py-4">
                        {/* Usar tx.txid */}
                        <div className="text-sm font-mono text-blue-400">
                          {formatAddress(tx.txid)}
                        </div>
                        {tx.order && (
                          <div className="text-xs text-gray-400">
                            Pedido: {formatCurrency(tx.order.totalBRL)}
                          </div>
                        )}
                      </td>
                      {/* Ajustar De/Para baseado em tx.type e tx.address */}
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <span className="text-gray-400">{tx.type === 'sent' ? 'Para:' : 'De:'}</span>
                          {' '}{formatAddress(tx.address)} {/* Mostra o endereço relevante */}
                        </div>
                        {/* Remover a segunda linha ou ajustar se tiver mais info */}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {/* Usar tx.convertedBRL e tx.amount */}
                        <div className="text-sm font-medium">{formatCurrency(tx.convertedBRL)}</div>
                        <div className="text-xs text-gray-400">{formatBCH(tx.amount)}</div>
                        {/* Usar tx.fee */}
                        {tx.fee !== undefined && (
                          <div className="text-xs text-gray-400"> Taxa: {formatBCH(tx.fee)}
                          </div>
                        )}
                      </td>
                      {/* Manter Origem/Destino como está por enquanto */}
                      <td className="px-6 py-4">
                        {tx.user && (
                          <div className="text-sm">
                            <span className="text-gray-400">Cliente:</span> {tx.user.email}
                          </div>
                        )}
                        {tx.merchant && (
                          <div className="text-sm mt-1">
                            <span className="text-gray-400">Comerciante:</span> {tx.merchant.businessName}
                          </div>
                        )}
                      </td>
                      {/* Ajustar Status para usar tx.confirmed */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(tx.confirmed ? 'confirmed' : 'pending')}`}>
                          {getStatusLabel(tx.confirmed ? 'confirmed' : 'pending')}
                        </span>
                        {tx.confirmed && tx.confirmations !== undefined && (
                          <div className="text-xs text-gray-400 mt-1">
                            {tx.confirmations} confirmações
                          </div>
                        )}
                        {tx.blockHeight && (
                          <div className="text-xs text-gray-400">
                            Bloco #{tx.blockHeight}
                          </div>
                        )}
                      </td>
                      {/* Usar tx.timestamp */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {formatDate(tx.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Paginação */}
            <div className="px-6 py-4 flex items-center justify-between border-t border-gray-700">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-700 text-sm font-medium rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-700 text-sm font-medium rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
              
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-400">
                    Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a{' '}
                    <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + transactions.length, totalPages * itemsPerPage)}</span> de{' '} {/* Ajustado para refletir o total real */}
                    <span className="font-medium">{totalPages * itemsPerPage}</span> resultados
                  </p>
                </div>
                
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-700 bg-gray-800 text-sm font-medium text-gray-400 hover:bg-gray-700 disabled:opacity-50"
                    >
                      <span className="sr-only">Anterior</span>
                      <FiChevronLeft size={20} />
                    </button>
                    
                    {totalPages > 1 && Array.from({ length: Math.min(5, totalPages) }, (_, i) => { // Adicionado totalPages > 1
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === pageNum
                              ? 'z-10 bg-blue-600 border-blue-600 text-white'
                              : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-700 bg-gray-800 text-sm font-medium text-gray-400 hover:bg-gray-700 disabled:opacity-50"
                    >
                      <span className="sr-only">Próxima</span>
                      <FiChevronRight size={20} />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}