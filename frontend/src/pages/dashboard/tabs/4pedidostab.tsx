import { useState, useEffect } from 'react';
import { FiSearch, FiChevronLeft, FiChevronRight, FiShoppingCart, FiClock, FiCheckCircle, FiXCircle } from 'react-icons/fi';

type OrderItem = {
  product: {
    _id: string;
    name: string;
  };
  quantity: number;
  priceBRL: number;
  priceBCH: number;
};

type Order = {
  _id: string;
  merchant: {
    _id: string;
    businessName: string;
  };
  customer?: {
    _id: string;
    email: string;
  };
  items: OrderItem[];
  totalBRL: number;
  totalBCH: number;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded' | 'expired';
  paymentMethod: 'bch' | 'pix' | 'card';
  createdAt: string;
  transaction?: {
    txHash: string;
    status: 'pending' | 'confirmed' | 'failed';
  };
};

export function PedidosTab() {
  // Estado para os pedidos
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para paginação
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const itemsPerPage = 8;
  
  // Estado para filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Simulação de fetch de dados
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        // Simulando uma chamada API
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Dados mockados
        const mockOrders: Order[] = Array.from({ length: 25 }, (_, i) => {
          const statuses: ('pending' | 'paid' | 'cancelled' | 'refunded' | 'expired')[] = 
            ['pending', 'paid', 'paid', 'paid', 'cancelled', 'expired'];
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          
          const paymentMethods: ('bch' | 'pix' | 'card')[] = ['bch', 'pix', 'card'];
          const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
          
          const itemsCount = Math.floor(Math.random() * 5) + 1;
          const items: OrderItem[] = Array.from({ length: itemsCount }, (_, itemIdx) => ({
            product: {
              _id: `prod-${i}-${itemIdx}`,
              name: `Produto ${i}-${itemIdx}`
            },
            quantity: Math.floor(Math.random() * 5) + 1,
            priceBRL: Math.random() * 100 + 10,
            priceBCH: (Math.random() * 100 + 10) * 0.0001
          }));
          
          const totalBRL = items.reduce((sum, item) => sum + (item.priceBRL * item.quantity), 0);
          const totalBCH = items.reduce((sum, item) => sum + (item.priceBCH * item.quantity), 0);
          
          return {
            _id: `order-${i}`,
            merchant: {
              _id: `merchant-${i}`,
              businessName: `Loja ${i}`
            },
            customer: i % 3 !== 0 ? {
              _id: `customer-${i}`,
              email: `cliente${i}@exemplo.com`
            } : undefined,
            items,
            totalBRL,
            totalBCH,
            status,
            paymentMethod,
            createdAt: new Date(Date.now() - i * 3600000).toISOString(),
            transaction: status === 'paid' && paymentMethod === 'bch' ? {
              txHash: `abc123xyz${Math.random().toString(16).substring(2, 10)}`,
              status: Math.random() > 0.3 ? 'confirmed' : 'pending'
            } : undefined
          };
        });
        
        // Aplicar filtros
        const filteredOrders = mockOrders.filter(order => {
          const matchesSearch = 
            order._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.merchant.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.customer?.email.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
          
          const matchesStatus = 
            statusFilter === 'all' || order.status === statusFilter;
          
          const matchesPayment = 
            paymentFilter === 'all' || order.paymentMethod === paymentFilter;
          
          return matchesSearch && matchesStatus && matchesPayment;
        });
        
        // Ordenar por data mais recente
        filteredOrders.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        // Paginação
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);
        
        setOrders(paginatedOrders);
        setTotalPages(Math.ceil(filteredOrders.length / itemsPerPage));
        setError(null);
      } catch (err) {
        setError('Erro ao carregar pedidos');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, [currentPage, searchTerm, statusFilter, paymentFilter]);

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <FiCheckCircle className="text-green-500" />;
      case 'pending':
        return <FiClock className="text-yellow-500" />;
      case 'cancelled':
      case 'expired':
      case 'refunded':
        return <FiXCircle className="text-red-500" />;
      default:
        return <FiClock className="text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Pago';
      case 'pending':
        return 'Pendente';
      case 'cancelled':
        return 'Cancelado';
      case 'expired':
        return 'Expirado';
      case 'refunded':
        return 'Reembolsado';
      default:
        return status;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'bch':
        return 'Bitcoin Cash';
      case 'pix':
        return 'PIX';
      case 'card':
        return 'Cartão';
      default:
        return method;
    }
  };

  return (
    <div className="p-6 min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <FiShoppingCart /> Gestão de Pedidos
      </h2>
      
      {/* Barra de ações */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="relative w-full md:w-96">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por ID, loja ou cliente..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos status</option>
            <option value="pending">Pendentes</option>
            <option value="paid">Pagos</option>
            <option value="cancelled">Cancelados</option>
            <option value="expired">Expirados</option>
            <option value="refunded">Reembolsados</option>
          </select>
          
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos métodos</option>
            <option value="bch">Bitcoin Cash</option>
            <option value="pix">PIX</option>
            <option value="card">Cartão</option>
          </select>
        </div>
      </div>
      
      {/* Tabela de pedidos */}
      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4">Carregando pedidos...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400">
            <p>{error}</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>Nenhum pedido encontrado</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-750">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Loja</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Pagamento</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {orders.map((order) => (
                    <tr key={order._id} className="hover:bg-gray-750 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-blue-400">
                          #{order._id.substring(6)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium">{order.merchant.businessName}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          {order.customer?.email || 'Não identificado'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium">{formatCurrency(order.totalBRL)}</div>
                        <div className="text-xs text-gray-400">{formatBCH(order.totalBCH)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          {getPaymentMethodLabel(order.paymentMethod)}
                        </div>
                        {order.transaction && (
                          <div className="text-xs text-gray-400">
                            {order.transaction.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(order.status)}
                          <span>{getStatusLabel(order.status)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-blue-400 hover:text-blue-300 transition-colors px-3 py-1 border border-blue-400 rounded hover:bg-blue-900"
                        >
                          Detalhes
                        </button>
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
                    <span className="font-medium">{Math.min(currentPage * itemsPerPage, orders.length)}</span> de{' '}
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
      
      {/* Modal de detalhes do pedido */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <FiShoppingCart /> Pedido #{selectedOrder._id.substring(7)}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="text-lg font-semibold mb-2">Informações do Pedido</h4>
                <div className="space-y-2">
                  <p><span className="text-gray-400">Status:</span> 
                    <span className="ml-2 inline-flex items-center">
                      {getStatusIcon(selectedOrder.status)}
                      <span className="ml-1">{getStatusLabel(selectedOrder.status)}</span>
                    </span>
                  </p>
                  <p><span className="text-gray-400">Data:</span> {formatDate(selectedOrder.createdAt)}</p>
                  <p><span className="text-gray-400">Método de Pagamento:</span> {getPaymentMethodLabel(selectedOrder.paymentMethod)}</p>
                  {selectedOrder.transaction && (
                    <p>
                      <span className="text-gray-400">Transação BCH:</span> 
                      <span className="ml-2 font-mono text-blue-400">
                        {selectedOrder.transaction.txHash.substring(0, 10)}...
                      </span>
                    </p>
                  )}
                </div>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold mb-2">Partes Envolvidas</h4>
                <div className="space-y-2">
                  <p><span className="text-gray-400">Comerciante:</span> {selectedOrder.merchant.businessName}</p>
                  <p><span className="text-gray-400">Cliente:</span> {selectedOrder.customer?.email || 'Não identificado'}</p>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-2">Itens do Pedido</h4>
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-750">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Produto</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Qtd</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Preço Unit.</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {selectedOrder.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2">{item.product.name}</td>
                        <td className="px-4 py-2">{item.quantity}</td>
                        <td className="px-4 py-2">
                          <div>{formatCurrency(item.priceBRL)}</div>
                          <div className="text-xs text-gray-400">{formatBCH(item.priceBCH)}</div>
                        </td>
                        <td className="px-4 py-2">
                          <div>{formatCurrency(item.priceBRL * item.quantity)}</div>
                          <div className="text-xs text-gray-400">{formatBCH(item.priceBCH * item.quantity)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="flex justify-between items-center border-t border-gray-700 pt-4">
              <div>
                <p className="text-gray-400">Total do Pedido:</p>
                <p className="text-xl font-bold">{formatCurrency(selectedOrder.totalBRL)}</p>
                <p className="text-sm text-gray-400">{formatBCH(selectedOrder.totalBCH)}</p>
              </div>
              
              <div className="flex gap-3">
                {selectedOrder.status === 'pending' && (
                  <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg">
                    Marcar como Pago
                  </button>
                )}
                {selectedOrder.status === 'paid' && (
                  <button className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg">
                    Reembolsar
                  </button>
                )}
                <button className="px-4 py-2 border border-gray-600 hover:bg-gray-700 rounded-lg">
                  Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}