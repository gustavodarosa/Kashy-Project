import { useState, useEffect } from 'react';
import { FiSearch, FiChevronLeft, FiChevronRight, FiDownload, FiFilter } from 'react-icons/fi';

type Transaction = {
  _id: string;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amountBCH: number;
  amountBRL: number;
  status: 'pending' | 'confirmed' | 'failed' | 'expired';
  createdAt: string;
  confirmations: number;
  blockHeight?: number;
  feeBCH?: number;
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
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        // Simulando uma chamada API
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Dados mockados
        const mockTransactions: Transaction[] = Array.from({ length: 50 }, (_, i) => {
          const statuses: ('pending' | 'confirmed' | 'failed' | 'expired')[] = 
            ['pending', 'confirmed', 'confirmed', 'confirmed', 'failed', 'expired'];
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          
          return {
            _id: `tx-${i}`,
            txHash: `abc123xyz${Math.random().toString(16).substring(2, 10)}`,
            fromAddress: `qprueba${Math.random().toString(16).substring(2, 10)}`,
            toAddress: `qprueba${Math.random().toString(16).substring(2, 12)}`,
            amountBCH: Math.random() * 10,
            amountBRL: Math.random() * 5000 + 10,
            status,
            createdAt: new Date(Date.now() - i * 3600000).toISOString(),
            confirmations: status === 'confirmed' ? Math.floor(Math.random() * 100) + 1 : 0,
            blockHeight: status === 'confirmed' ? 800000 + i : undefined,
            feeBCH: status === 'confirmed' ? Math.random() * 0.01 : undefined,
            order: i % 3 === 0 ? {
              _id: `order-${i}`,
              totalBRL: Math.random() * 5000 + 10
            } : undefined,
            user: {
              _id: `user-${i}`,
              email: `user${i}@example.com`
            },
            merchant: i % 2 === 0 ? {
              _id: `merchant-${i}`,
              businessName: `Loja ${i}`
            } : undefined
          };
        });
        
        // Aplicar filtros
        const filteredTransactions = mockTransactions.filter(tx => {
          const matchesSearch = 
            tx.txHash.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tx.fromAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tx.toAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tx.user?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tx.merchant?.businessName.toLowerCase().includes(searchTerm.toLowerCase());
          
          const matchesStatus = 
            statusFilter === 'all' || tx.status === statusFilter;
          
          const matchesDate = 
            dateFilter === 'all' || 
            (dateFilter === 'today' && new Date(tx.createdAt).toDateString() === new Date().toDateString()) ||
            (dateFilter === 'week' && (new Date().getTime() - new Date(tx.createdAt).getTime()) < 7 * 86400000) ||
            (dateFilter === 'month' && (new Date().getTime() - new Date(tx.createdAt).getTime()) < 30 * 86400000);
          
          return matchesSearch && matchesStatus && matchesDate;
        });
        
        // Ordenar por data mais recente
        filteredTransactions.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        // Paginação
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);
        
        setTransactions(paginatedTransactions);
        setTotalPages(Math.ceil(filteredTransactions.length / itemsPerPage));
        setError(null);
      } catch (err) {
        setError('Erro ao carregar transações');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTransactions();
  }, [currentPage, searchTerm, statusFilter, dateFilter]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Confirmada';
      case 'pending':
        return 'Pendente';
      case 'failed':
        return 'Falhou';
      case 'expired':
        return 'Expirada';
      default:
        return status;
    }
  };

  return (
    <div className="p-6 min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
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
                        <div className="text-sm font-mono text-blue-400">
                          {formatAddress(tx.txHash)}
                        </div>
                        {tx.order && (
                          <div className="text-xs text-gray-400">
                            Pedido: {formatCurrency(tx.order.totalBRL)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <span className="text-gray-400">De:</span> {formatAddress(tx.fromAddress)}
                        </div>
                        <div className="text-sm mt-1">
                          <span className="text-gray-400">Para:</span> {formatAddress(tx.toAddress)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium">{formatCurrency(tx.amountBRL)}</div>
                        <div className="text-xs text-gray-400">{formatBCH(tx.amountBCH)}</div>
                        {tx.feeBCH && (
                          <div className="text-xs text-gray-400">
                            Taxa: {tx.feeBCH.toFixed(6)} BCH
                          </div>
                        )}
                      </td>
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(tx.status)}`}>
                          {getStatusLabel(tx.status)}
                        </span>
                        {tx.status === 'confirmed' && tx.confirmations && (
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {formatDate(tx.createdAt)}
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
                    <span className="font-medium">{Math.min(currentPage * itemsPerPage, transactions.length)}</span> de{' '}
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
                    
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
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