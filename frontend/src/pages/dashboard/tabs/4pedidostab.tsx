import { useState, useEffect } from 'react';
import { FiSearch, FiChevronLeft, FiChevronRight, FiShoppingCart, FiClock, FiCheckCircle, FiXCircle, FiEdit, FiTrash2, FiCopy, FiPrinter } from 'react-icons/fi';
import QRCode from 'react-qr-code';

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

  // Adicione um novo estado para armazenar as alterações no pedido
  const [editedOrder, setEditedOrder] = useState<Partial<Order> | null>(null);

  // Estado para o modal de QR Code
  const [qrOrder, setQrOrder] = useState<Order | null>(null);

  // Atualize o estado `editedOrder` quando o modal for aberto
  useEffect(() => {
    if (selectedOrder) {
      console.log("Pedido selecionado:", selectedOrder);
      setEditedOrder({ ...selectedOrder });
    }
  }, [selectedOrder]);

  useEffect(() => {
    console.log("Estado do pedido editado:", editedOrder);
  }, [editedOrder]);

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

  // Função para buscar os detalhes do pedido do backend
  const fetchOrderDetails = async (orderId: string) => {
    try {
      const response = await fetch(`http://localhost:3000/api/orders/${orderId}`);
      if (!response.ok) {
        throw new Error('Erro ao buscar detalhes do pedido');
      }
      const order = await response.json();
      setSelectedOrder(order);
      setEditedOrder(order); // Inicializa o estado de edição com os dados do pedido
    } catch (error) {
      console.error('Erro ao buscar detalhes do pedido:', error);
      alert('Erro ao buscar detalhes do pedido.');
    }
  };

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

  // Função para atualizar um pedido
  const handleUpdateOrder = async (updatedOrder: Partial<Order>) => {
    if (!selectedOrder) return;

    try {
      const response = await fetch(`http://localhost:3000/api/orders/${selectedOrder._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrder),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar pedido.');
      }

      const updatedData = await response.json();
      setOrders((prev) =>
        prev.map((order) => (order._id === updatedData._id ? updatedData : order))
      );
      alert('Pedido atualizado com sucesso!');
      setSelectedOrder(null);
    } catch (error) {
      console.error('Erro ao atualizar pedido:', error);
      alert('Erro ao atualizar pedido.');
    }
  };

  // Função para deletar um pedido
  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este pedido?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/orders/${orderId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar pedido.');
      }

      setOrders((prev) => prev.filter((order) => order._id !== orderId));
      alert('Pedido deletado com sucesso!');
    } catch (error) {
      console.error('Erro ao deletar pedido:', error);
      alert('Erro ao deletar pedido.');
    }
  };

  const handlePrint = (order: Order) => {
    console.log("Imprimindo pedido:", order);
    // Lógica de impressão aqui
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Fatura</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--color-bg-secondary)] divide-y divide-[var(--color-divide)]">
                  {orders && orders.length > 0 ? (
                    orders.map((order) => (
                      <tr key={order._id} className="hover:bg-gray-750 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-blue-400">
                              #{order._id.substring(6)}
                            </span>
                            <button
                              onClick={() => navigator.clipboard.writeText(order._id)}
                              className="text-gray-400 hover:text-blue-400"
                              title="Copiar ID"
                            >
                              <FiCopy size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium">{order.store}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            {order.customerEmail || 'Anônimo'}
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
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => fetchOrderDetails(order._id)}
                              className="text-blue-400 hover:text-blue-300 transition-colors"
                              title="Ver Detalhes"
                            >
                              <FiEdit size={18} />
                            </button>
                            <button
                              onClick={() => handlePrint(order)}
                              className="text-green-400 hover:text-green-300 transition-colors"
                              title="Imprimir"
                            >
                              <FiPrinter size={18} />
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(order._id)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                              title="Excluir"
                            >
                              <FiTrash2 size={18} />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded-lg text-white text-xs"
                            onClick={() => setQrOrder(order)}
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center text-gray-400">
                        Nenhum pedido encontrado.
                      </td>
                    </tr>
                  )}
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
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === pageNum
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

      {/* Modal QR Code */}
      {qrOrder && (
        <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 w-full max-w-md shadow-xl border border-[var(--color-border)] flex flex-col items-center">
            <h3 className="text-lg font-bold mb-4">Pagamento do Pedido #{qrOrder._id.substring(6)}</h3>
            <QRCode
              value={`bitcoincash:${qrOrder.transaction?.txHash}?amount=${qrOrder.items.reduce((sum, item) => sum + item.priceBCH * item.quantity, 0)}&label=Kashy&message=Pedido%20#${qrOrder._id}`}
              size={200}
            />
            <p className="mt-4 text-center text-gray-300">
              Escaneie o QR Code para efetuar o pagamento.<br />
              Valor: <span className="font-bold">{formatCurrency(qrOrder.totalAmount)}</span>
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(qrOrder.transaction?.txHash || '')}>Copiar Endereço</button>
              <button onClick={() => navigator.clipboard.writeText(qrOrder.items.reduce((sum, item) => sum + item.priceBCH * item.quantity, 0).toFixed(6))}>Copiar Valor</button>
            </div>
            <button
              className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
              onClick={() => setQrOrder(null)}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}