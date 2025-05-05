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
  store: string; 
  customerEmail?: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded' | 'expired';
  paymentMethod: 'bch' | 'pix' | 'card';
  createdAt: string;
  transaction?: {
    txHash: string;
    status: 'pending' | 'confirmed' | 'failed';
  };
};

type Product = {
  _id: string;
  name: string;
  priceBRL: number;
  priceBCH: number;
  quantity?: number;
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

  // Estado para o modal de novo pedido
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  // Estados para armazenar produtos e controlar o carregamento
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false);

  // Função para buscar produtos com base na loja
  const fetchProductsByStore = async (store: string) => {
    try {
      setLoadingProducts(true);
      const response = await fetch(`http://localhost:3000/api/products?store=${encodeURIComponent(store)}`);
      if (!response.ok) {
        throw new Error('Erro ao buscar produtos');
      }
      const data = await response.json();
      setProducts(data); // Define os produtos da loja selecionada
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  // useEffect para buscar produtos quando a loja for selecionada
  useEffect(() => {
    if (selectedStore) {
      fetchProductsByStore(selectedStore); // Busca produtos da loja selecionada
    } else {
      setProducts([]); // Limpa os produtos se nenhuma loja for selecionada
    }
  }, [selectedStore]);

  // useEffect para buscar pedidos
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        console.log("Iniciando fetch de pedidos...");
        setLoading(true);

        const response = await fetch('http://localhost:3000/api/orders'); // Substitua pela URL correta do backend

        if (!response.ok) {
          throw new Error('Erro ao buscar pedidos');
        }

        const data: Order[] = await response.json();

        // Aplicar filtros
        console.log("Aplicando filtros...");
        const filteredOrders = data.filter((order) => {
          const matchesSearch =
            order._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.store.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

          const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
          const matchesPayment = paymentFilter === 'all' || order.paymentMethod === paymentFilter;

          return matchesSearch && matchesStatus && matchesPayment;
        });

        console.log("Pedidos filtrados:", filteredOrders);

        // Ordenar por data mais recente
        filteredOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        console.log("Pedidos ordenados por data:", filteredOrders);

        // Paginação
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);
        console.log(`Pedidos paginados (Página ${currentPage}):`, paginatedOrders);

        setOrders(paginatedOrders);
        setTotalPages(Math.ceil(filteredOrders.length / itemsPerPage));
        setError(null);
      } catch (err) {
        console.error("Erro ao carregar pedidos:", err);
        setError("Erro ao carregar pedidos");
      } finally {
        setLoading(false);
        console.log("Fetch de pedidos concluído.");
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

  // Atualiza a quantidade de um produto no carrinho
  const updateProductQuantity = (index: number, quantity: number) => {
    setSelectedProducts((prev) => {
      const updated = [...prev];
      updated[index].quantity = quantity;
      return updated;
    });
  };

  // Remove um produto do carrinho
  const removeProductFromCart = (index: number) => {
    setSelectedProducts((prev) => prev.filter((_, i) => i !== index));
  };

  // Calcula o total do pedido
  const calculateTotal = () => {
    return selectedProducts.reduce((sum, product) => {
      const quantity = product.quantity || 1;
      return sum + (product.priceBRL || 0) * quantity;
    }, 0);
  };

  const handleCreateOrder = async () => {
    console.log("Iniciando criação de pedido...");
    if (!selectedStore || !paymentMethod || selectedProducts.length === 0) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      console.warn("Criação de pedido cancelada: campos obrigatórios não preenchidos.");
      return;
    }
  
    const totalAmount = calculateTotal();
    console.log("Total calculado:", totalAmount);
  
    const orderData = {
      store: selectedStore,
      customerEmail: customerEmail || "Não identificado",
      totalAmount,
      paymentMethod,
    };
  
    console.log("Dados do pedido:", orderData);
  
    try {
      const response = await fetch("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });
  
      if (!response.ok) {
        throw new Error("Erro ao criar pedido");
      }
  
      const savedOrder = await response.json();
      console.log("Pedido salvo com sucesso:", savedOrder);
      alert("Pedido criado com sucesso!");
  
      // Limpar o formulário
      setSelectedStore("");
      setCustomerEmail("");
      setSelectedProducts([]);
      setPaymentMethod("");
      setIsOrderModalOpen(false);
    } catch (error) {
      console.error("Erro ao criar pedido:", error);
      alert("Erro ao criar pedido.");
    }
  };

  return (
    <div className="p-6 bg-[var(--color-bg-primary)] text-white min-h-screen">
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
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos métodos</option>
            <option value="bch">Bitcoin Cash</option>
            <option value="pix">PIX</option>
            <option value="card">Cartão</option>
          </select>

          {/* Botão de Novo Pedido */}
          <button
            onClick={() => setIsOrderModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Novo Pedido
          </button>
        </div>
      </div>
      
      {/* Tabela de pedidos */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg overflow-hidden border border-[var(--color-border)]">
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
              <table className="min-w-full divide-y divide-[var(--color-divide)]">
                <thead className="bg-gray-750">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Loja</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Pagamento</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--color-bg-secondary)] divide-y divide-[var(--color-divide)]">
                  {orders.map((order) => (
                    <tr key={order._id} className="hover:bg-gray-750 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-blue-400">
                          #{order._id.substring(6)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium">{order.store}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          {order.customerEmail || 'Não identificado'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium">{formatCurrency(order.totalAmount)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          {getPaymentMethodLabel(order.paymentMethod)}
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
            <div className="px-6 py-4 flex items-center justify-between border-t border-[var(--color-border)]">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-[var(--color-border)] text-sm font-medium rounded-md bg-[var(--color-bg-tertiary)] text-gray-300 hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-[var(--color-border)] text-sm font-medium rounded-md bg-[var(--color-bg-tertiary)] text-gray-300 hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50"
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
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-sm font-medium text-gray-400 hover:bg-[var(--color-bg-primary)] disabled:opacity-50"
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
                              : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-gray-400 hover:bg-[var(--color-bg-primary)]'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-sm font-medium text-gray-400 hover:bg-[var(--color-bg-primary)] disabled:opacity-50"
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
        <div className="fixed inset-0 bg-opacity-50 flex items-center justisfy-center p-4 z-50">
          <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  <p><span className="text-gray-400">Loja:</span> {selectedOrder.store}</p>
                  <p><span className="text-gray-400">Cliente:</span> {selectedOrder.customerEmail || 'Não identificado'}</p>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-2">Itens do Pedido</h4>
              <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-[var(--color-divide)]">
                  <thead className="bg-gray-750">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Produto</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Qtd</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Preço Unit.</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--color-bg-tertiary)] divide-y divide-[var(--color-divide)]">
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
            
            <div className="flex justify-between items-center border-t border-[var(--color-border)] pt-4">
              <div>
                <p className="text-gray-400">Total do Pedido:</p>
                <p className="text-xl font-bold">{formatCurrency(selectedOrder.totalAmount)}</p>
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
                <button className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-bg-primary)] rounded-lg">
                  Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Novo Pedido */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-bg-primary)] text-white rounded-lg shadow-lg p-4 w-full max-w-4xl border border-[var(--color-border)]">
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">Criar Novo Pedido</h3>

            {/* Layout horizontal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Coluna 1: Informações do cliente e loja */}
              <div>
                {/* Input para e-mail do cliente */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">E-mail do Cliente (opcional)</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="Digite o e-mail do cliente"
                    className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Select para loja */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Loja</label>
                  <select
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione uma loja</option>
                    <option value="Loja A">Loja A</option>
                    <option value="Loja B">Loja B</option>
                    <option value="Loja C">Loja C</option>
                  </select>
                </div>

                {/* Select para forma de pagamento */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Forma de Pagamento</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione uma Forma</option>
                    <option value="bch">Bitcoin Cash</option>
                  </select>
                </div>
              </div>

              {/* Coluna 2: Produtos e carrinho */}
              <div>
                {/* Buscar produtos */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Buscar Produtos</label>
                  <input
                    type="text"
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    placeholder="Digite o nome do produto"
                    className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!selectedStore}
                  />
                  <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    {selectedStore
                      ? 'Produtos relacionados à loja selecionada.'
                      : 'Selecione uma loja para buscar produtos.'}
                  </div>
                </div>

                {/* Lista de produtos */}
                {products.length > 0 && (
                  <div className="mb-3">
                    <ul className="space-y-2">
                      {products
                        .filter(product =>
                          product.name.toLowerCase().includes(modalSearchTerm.toLowerCase())
                        )
                        .slice(0, 3) // Limita a exibição a 3 produtos
                        .map(product => (
                          <li
                            key={product._id}
                            className="flex justify-between items-center p-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg"
                          >
                            <span className="text-sm">{product.name}</span>
                            <button
                              onClick={() => {
                                const existingProduct = selectedProducts.find((p) => p._id === product._id);
                                if (existingProduct) {
                                  setSelectedProducts((prev) =>
                                    prev.map((p) =>
                                      p._id === product._id ? { ...p, quantity: (p.quantity || 1) + 1 } : p
                                    )
                                  );
                                } else {
                                  setSelectedProducts((prev) => [...prev, { ...product, quantity: 1 }]);
                                }
                              }}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs"
                            >
                              Adicionar
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Carrinho de compras */}
            {selectedProducts.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Carrinho</h4>
                <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-[var(--color-divide)]">
                    <thead className="bg-gray-750">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Produto</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Preço Unit.</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Qtd</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Total</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-[var(--color-bg-tertiary)] divide-y divide-[var(--color-divide)]">
                      {selectedProducts.map((product, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2">{product.name}</td>
                          <td className="px-4 py-2">{formatCurrency(product.priceBRL)}</td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min="1"
                              value={product.quantity || 1}
                              onChange={(e) => updateProductQuantity(index, parseInt(e.target.value, 10))}
                              className="w-16 px-2 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)]"
                            />
                          </td>
                          <td className="px-4 py-2">{formatCurrency((product.priceBRL || 0) * (product.quantity || 1))}</td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => removeProductFromCart(index)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Total do pedido */}
                <div className="mt-4 text-right">
                  <p className="text-gray-400">Total do Pedido:</p>
                  <p className="text-lg font-bold">{formatCurrency(calculateTotal())}</p>
                </div>
              </div>
            )}

            {/* Botões de ação */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setIsOrderModalOpen(false)}
                className="px-3 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded-lg transition-colors border border-[var(--color-border)] text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateOrder}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
              >
                Criar Pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}