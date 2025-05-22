import { useState, useEffect } from 'react';
import { FiSearch, FiChevronLeft, FiChevronRight, FiShoppingCart, FiEdit, FiTrash2, FiCopy, FiPrinter, FiClock, FiCheckCircle, FiXCircle, FiPlus, FiCreditCard } from 'react-icons/fi';
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
  merchantAddress?: string;
  exchangeRateUsed?: number; // Changed from exchangeRate to exchangeRateUsed
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

  const [isLoadingQr, setIsLoadingQr] = useState<boolean>(false); // Novo estado para loading do QR
  // Adicione um novo estado para armazenar as alterações no pedido
  const [editedOrder, setEditedOrder] = useState<Partial<Order> | null>(null);

  // Estado para o modal de QR Code
  const [qrOrder, setQrOrder] = useState<Order | null>(null);

  // Atualize o estado `editedOrder` quando o modal for aberto
  useEffect(() => {
    console.log('[PedidosTab] useEffect - selectedOrder mudou:', selectedOrder);
    if (selectedOrder) {
      console.log("[PedidosTab] Definindo editedOrder com base em selectedOrder:", selectedOrder);
      setEditedOrder({ ...selectedOrder });
    }
  }, [selectedOrder]);

  useEffect(() => {
    console.log("[PedidosTab] useEffect - editedOrder mudou:", editedOrder);
  }, [editedOrder]);

  console.log('[PedidosTab] Componente renderizado/atualizado. Estado atual de selectedOrder:', selectedOrder, 'qrOrder:', qrOrder, 'isOrderModalOpen:', isOrderModalOpen);

  // Função para buscar produtos com base na loja
  const fetchProductsByStore = async (store: string) => {
    try {
      setLoadingProducts(true);
      const response = await fetch(`http://localhost:3000/api/products?store=${encodeURIComponent(store)}`);
      if (!response.ok) {
        console.error('[PedidosTab] Erro ao buscar produtos para a loja:', store, response.status);
        throw new Error('Erro ao buscar produtos');
      }
      const data = await response.json();
      console.log('[PedidosTab] Produtos buscados para a loja', store, ':', data);
      setProducts(data); // Define os produtos da loja selecionada
    } catch (error) {
      console.error('[PedidosTab] Erro em fetchProductsByStore:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  // useEffect para buscar produtos quando a loja for selecionada
  useEffect(() => {
    console.log('[PedidosTab] useEffect - selectedStore mudou:', selectedStore);
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
        console.log("[PedidosTab] Iniciando fetch de pedidos. currentPage:", currentPage, "searchTerm:", searchTerm, "statusFilter:", statusFilter, "paymentFilter:", paymentFilter);
        setLoading(true);
        const token = localStorage.getItem('token'); // Get token

        const response = await fetch('http://localhost:3000/api/orders', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!response.ok) {
          throw new Error('Erro ao buscar pedidos');
        }

        const data: Order[] = await response.json();

        // Aplicar filtros
        console.log("[PedidosTab] Aplicando filtros nos pedidos recebidos:", data.length, "pedidos");
        const filteredOrders = data.filter((order) => {
          const matchesSearch =
            order._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.store.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

          const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
          const matchesPayment = paymentFilter === 'all' || order.paymentMethod === paymentFilter;

          return matchesSearch && matchesStatus && matchesPayment;
        });

        console.log("[PedidosTab] Pedidos filtrados:", filteredOrders.length, "pedidos");

        // Ordenar por data mais recente
        filteredOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        console.log("[PedidosTab] Pedidos ordenados por data.");

        // Paginação
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);
        console.log(`[PedidosTab] Pedidos paginados (Página ${currentPage}):`, paginatedOrders.length, "pedidos");

        setOrders(paginatedOrders);
        setTotalPages(Math.ceil(filteredOrders.length / itemsPerPage));
        setError(null);
      } catch (err) {
        console.error("[PedidosTab] Erro ao carregar pedidos:", err);
        setError("Erro ao carregar pedidos");
      } finally {
        setLoading(false);
        console.log("[PedidosTab] Fetch de pedidos concluído.");
      }
    };

    console.log('[PedidosTab] useEffect - disparando fetchOrders. Dependências:', currentPage, searchTerm, statusFilter, paymentFilter);
    fetchOrders();
  }, [currentPage, searchTerm, statusFilter, paymentFilter]);

  // Função para buscar os detalhes do pedido do backend
  const fetchOrderDetails = async (orderId: string) => {
    console.log(`[PedidosTab] fetchOrderDetails chamado para orderId: ${orderId}`);
    try {
      console.log(`[fetchOrderDetails] Buscando detalhes para o pedido ID: ${orderId}`);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/orders/${orderId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        throw new Error('Erro ao buscar detalhes do pedido');
      }
      const order = await response.json();
      console.log("[PedidosTab] Detalhes do pedido recebidos:", order);
      setSelectedOrder(order);
      setEditedOrder(order);
    } catch (error) {
      console.error('[PedidosTab] Erro ao buscar detalhes do pedido:', error);
      alert('Erro ao buscar detalhes do pedido.');
    }
  };

  // Função para abrir o modal de QR Code buscando detalhes primeiro
  const openQrModal = async (orderId: string) => {
    console.log(`[PedidosTab] openQrModal chamado para orderId: ${orderId}`);
    setIsLoadingQr(true);
    setQrOrder(null);
    setError(null);
    try {
      console.log(`[PedidosTab] openQrModal: Buscando detalhes para QR Code do pedido ID: ${orderId}`);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/orders/${orderId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error('Erro ao buscar detalhes para QR Code.');
      const order = await response.json();
      console.log('[PedidosTab] openQrModal: Detalhes para QR Code recebidos:', order);
      setQrOrder(order);
    } catch (err: any) {
      console.error('[PedidosTab] Erro em openQrModal:', err);
      setError(err.message || 'Falha ao carregar detalhes do pedido para QR Code.');
    } finally { setIsLoadingQr(false); console.log('[PedidosTab] openQrModal finalizado.'); }
  };

  // Formatação de dados
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
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
    const total = selectedProducts.reduce((sum, product) => {
      const quantity = product.quantity || 1;
      return sum + (product.priceBRL || 0) * quantity;
    }, 0);
    console.log('[PedidosTab] calculateTotal - Produtos selecionados:', selectedProducts, 'Total calculado:', total);
    return total;
  };

  const handleCreateOrder = async () => {
    console.log("Iniciando criação de pedido...");
    if (!selectedStore || !paymentMethod || selectedProducts.length === 0) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      console.warn("Criação de pedido cancelada: campos obrigatórios não preenchidos.");
      return;
    }

    const totalAmount = calculateTotal();
    console.log("[PedidosTab] Total calculado para novo pedido:", totalAmount);

    const orderData = {
      store: selectedStore,
      customerEmail: customerEmail || "Não identificado",
      totalAmount,
      paymentMethod,
      items: selectedProducts.map(p => ({
        product: p._id,
        name: p.name, // <-- ADDED THIS LINE
        quantity: p.quantity || 1,
        priceBRL: p.priceBRL,
        priceBCH: p.priceBCH
      }))
    };

    console.log("Dados do pedido:", orderData);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert("Erro de autenticação. Por favor, faça login novamente.");
        console.warn("[PedidosTab] Token não encontrado para criar pedido.");
        return;
      }

      const response = await fetch("http://localhost:3000/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Erro ao criar pedido" }));
        throw new Error(errorData.message || "Erro ao criar pedido");
      }
      const savedOrder = await response.json();
      console.log("[PedidosTab] Pedido salvo com sucesso:", savedOrder);
      alert("Pedido criado com sucesso!");

      setSelectedStore("");
      setCustomerEmail("");
      setSelectedProducts([]);
      setPaymentMethod("");
      setIsOrderModalOpen(false);
      setCurrentPage(1);

      // Se o pagamento for BCH, abra o modal de QR Code imediatamente
      if (savedOrder.paymentMethod === 'bch' && savedOrder._id) {
        console.log("[PedidosTab] Pedido BCH criado. Abrindo modal de QR Code para ID:", savedOrder._id);
        openQrModal(savedOrder._id);
      } else {
        // Se não for BCH, apenas atualize a lista de pedidos
        // Refetch para garantir que a lista e paginação estejam corretas
        // fetchOrders não está disponível aqui, então forçamos atualização manual
        setOrders(prev => [savedOrder, ...prev].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, itemsPerPage));
        setTotalPages(prev => Math.ceil((orders.length + 1) / itemsPerPage));
      }

    } catch (error: any) {
      console.error("[PedidosTab] Erro ao criar pedido:", error);
      alert(error.message || "Erro ao criar pedido.");
    }
  };

  // Função para atualizar um pedido (Comentada pois não está sendo usada - TS6133)
  /*
  const handleUpdateOrder = async (updatedOrder: Partial<Order>) => {
    console.log('[PedidosTab] handleUpdateOrder chamado com:', updatedOrder);
    if (!selectedOrder) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/orders/${selectedOrder._id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && {'Authorization': `Bearer ${token}`})
        },
        body: JSON.stringify(updatedOrder),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar pedido.');
      }

      const updatedData = await response.json();
      console.log('[PedidosTab] Pedido atualizado no backend:', updatedData);
      setOrders((prev) =>
        prev.map((order) => (order._id === updatedData._id ? updatedData : order))
      );
      alert('Pedido atualizado com sucesso!');
      setSelectedOrder(null);
    } catch (error) {
      console.error('[PedidosTab] Erro ao atualizar pedido:', error);
      alert('Erro ao atualizar pedido.');
    }
  };
  */

  // Função para deletar um pedido
  const handleDeleteOrder = async (orderId: string) => {
    console.log(`[PedidosTab] handleDeleteOrder chamado para orderId: ${orderId}`);
    if (!window.confirm('Tem certeza que deseja excluir este pedido?')) return;

    try {
      console.log(`[PedidosTab] Enviando requisição DELETE para /api/orders/${orderId}`);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        console.error(`[PedidosTab] Erro ao deletar pedido ${orderId}:`, response.status);
        throw new Error('Erro ao deletar pedido.');
      }
      console.log(`[PedidosTab] Pedido ${orderId} deletado com sucesso.`);
      setOrders((prev) => prev.filter((order) => order._id !== orderId));
      alert('Pedido deletado com sucesso!');
    } catch (error) {
      console.error('[PedidosTab] Erro ao deletar pedido:', error);
      alert('Erro ao deletar pedido.');
    }
  };

  const handlePrint = (order: Order) => {
    console.log("[PedidosTab] Imprimindo pedido:", order);
    // Lógica de impressão aqui (ex: abrir uma nova janela com conteúdo formatado para impressão)
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Pedido Kashy</title>');
      // Add styles if needed
      printWindow.document.write('<style> body { font-family: sans-serif; margin: 20px; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left;} </style>');
      printWindow.document.write('</head><body>');
      printWindow.document.write(`<h1>Detalhes do Pedido #${order._id.substring(order._id.length - 6)}</h1>`);
      printWindow.document.write(`<p><strong>Loja:</strong> ${order.store}</p>`);
      printWindow.document.write(`<p><strong>Cliente:</strong> ${order.customerEmail || 'Anônimo'}</p>`);
      printWindow.document.write(`<p><strong>Total:</strong> ${formatCurrency(order.totalAmount)}</p>`);
      printWindow.document.write(`<p><strong>Método:</strong> ${getPaymentMethodLabel(order.paymentMethod)}</p>`);
      printWindow.document.write(`<p><strong>Data:</strong> ${formatDate(order.createdAt)}</p>`);
      if (order.items && order.items.length > 0) {
        printWindow.document.write('<h3>Itens:</h3><table><thead><tr><th>Produto</th><th>Qtd</th><th>Preço Unit.</th><th>Subtotal</th></tr></thead><tbody>');
        order.items.forEach(item => {
          printWindow.document.write(`<tr><td>${item.product.name}</td><td>${item.quantity}</td><td>${formatCurrency(item.priceBRL)}</td><td>${formatCurrency(item.priceBRL * item.quantity)}</td></tr>`);
        });
        printWindow.document.write('</tbody></table>');
      }
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.print();
    }
  };

  const getStatusIconComponent = (status: Order['status']) => {
    switch (status) {
      case 'paid':
        return <FiCheckCircle className="text-green-500" />;
      case 'pending':
        return <FiClock className="text-yellow-500" />;
      case 'cancelled':
      case 'refunded':
      case 'expired':
        return <FiXCircle className="text-red-500" />;
      default:
        return <FiClock className="text-gray-500" />;
    }
  };
  
  const getStatusLabelText = (status: Order['status']): string => {
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
        return (status as string).charAt(0).toUpperCase() + (status as string).slice(1);
    }
  };


  // Função para obter a cor e o rótulo do status da transação (se houver)
  // const getTransactionStatusVisuals = (status?: Order['transaction']['status']) => {
    // Similar a getOrderStatusVisuals, mas para status de transação
    // return status ? { label: status, color: 'bg-blue-200 text-blue-800' } : null;
  // };
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
            id="btn-novo-pedido"
            onClick={() => setIsOrderModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white rounded-lg transition-colors font-semibold shadow"
          >
            <FiPlus className="inline mr-1" /> Novo Pedido
          </button>
        </div>
      </div>

      {/* Resumo rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-900/80 to-green-800/60 p-4 rounded-xl shadow flex flex-col items-center">
          <span className="text-xs text-green-300">Pagos</span>
          <span className="text-xl font-bold text-green-200">{orders.filter(o => o.status === 'paid').length}</span>
        </div>
        <div className="bg-gradient-to-br from-yellow-900/80 to-yellow-800/60 p-4 rounded-xl shadow flex flex-col items-center">
          <span className="text-xs text-yellow-300">Pendentes</span>
          <span className="text-xl font-bold text-yellow-200">{orders.filter(o => o.status === 'pending').length}</span>
        </div>
        <div className="bg-gradient-to-br from-red-900/80 to-red-800/60 p-4 rounded-xl shadow flex flex-col items-center">
          <span className="text-xs text-red-300">Cancelados/Expirados</span>
          <span className="text-xl font-bold text-red-200">{orders.filter(o => o.status === 'cancelled' || o.status === 'expired').length}</span>
        </div>
        <div className="bg-gradient-to-br from-blue-900/80 to-blue-800/60 p-4 rounded-xl shadow flex flex-col items-center">
          <span className="text-xs text-blue-300">Total</span>
          <span className="text-xl font-bold text-blue-200">{orders.length}</span>
        </div>
      </div>

      {/* Tabela de pedidos */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg overflow-hidden border border-[var(--color-border)]">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4">Carregando pedidos...</p>
          </div>
        ) : error && !qrOrder ? ( // Modificado para não mostrar erro global se qrOrder estiver ativo (modal de detalhes)
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
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
                              #{order._id.substring(order._id.length - 6)}
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
                          <div className="text-sm flex items-center gap-2">
                            {order.paymentMethod === 'bch' && <img src="/bch-logo.svg" alt="BCH" className="w-5 h-5" />}
                            {order.paymentMethod === 'pix' && <img src="/pix-logo.svg" alt="PIX" className="w-5 h-5" />}
                            {order.paymentMethod === 'card' && <FiCreditCard className="text-blue-400" />}
                            {getPaymentMethodLabel(order.paymentMethod)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm">
                            {getStatusIconComponent(order.status)}
                            <span>{getStatusLabelText(order.status)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded-lg text-white text-xs"
                            onClick={() => openQrModal(order._id)}
                          >
                            Detalhes
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => fetchOrderDetails(order._id)} // This could open an edit modal
                              className="text-blue-400 hover:text-blue-300 transition-colors"
                              title="Editar Pedido"
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
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="text-center py-4 text-gray-400">
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
                  className="relative inline-flex items-center px-4 py-2 border border-[var(--color-border)] text-sm font-medium rounded-md bg-[var(--color-bg-tertiary)] text-gray-300 hover:bg-[var(--color-bg-terciary)] disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-[var(--color-border)] text-sm font-medium rounded-md bg-[var(--color-bg-tertiary)] text-gray-300 hover:bg-[var(--color-bg-terciary)] disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>

              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-400">
                    Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + (orders.length > 0 ? 1 : 0)}</span> a{' '}
                    <span className="font-medium">{Math.min(currentPage * itemsPerPage, (currentPage - 1) * itemsPerPage + orders.length)}</span> de{' '}
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

      {/* Modal Detalhes do Pedido (antigo Modal QR Code) */}
      {qrOrder && (
        <div className="fixed inset-0 bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 w-full max-w-3xl shadow-xl border border-[var(--color-border)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <FiShoppingCart /> Detalhes do Pedido #{qrOrder._id.substring(qrOrder._id.length - 6)}
              </h3>
              <button
                onClick={() => setQrOrder(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {isLoadingQr && (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            )}

            {!isLoadingQr && error && (
              <div className="text-red-500 text-center p-4">{error}</div>
            )}

            {!isLoadingQr && !error && qrOrder && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6"> {/* Main grid for details and QR */}
                {/* Coluna da Esquerda: Detalhes do Pedido */}
                <div className="md:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-lg font-semibold mb-2 text-gray-200">Informações do Pedido</h4>
                      <div className="space-y-2 text-sm">
                        <p><span className="text-gray-400">Status:</span>
                          <span className="ml-2 inline-flex items-center">
                            {getStatusIconComponent(qrOrder.status)}
                            <span className="ml-1">{getStatusLabelText(qrOrder.status)}</span>
                          </span>
                        </p>
                        <p><span className="text-gray-400">Data:</span> <span className="text-gray-300">{formatDate(qrOrder.createdAt)}</span></p>
                        <p><span className="text-gray-400">Método de Pagamento:</span> <span className="text-gray-300">{getPaymentMethodLabel(qrOrder.paymentMethod)}</span></p>
                        {qrOrder.transaction?.txHash && (
                          <p><span className="text-gray-400">Hash Transação:</span>
                            <a href={`https://explorer.bitcoinabc.org/tx/${qrOrder.transaction.txHash}`} target="_blank" rel="noopener noreferrer" className="ml-2 font-mono text-blue-400 hover:text-blue-300 break-all">
                              {qrOrder.transaction.txHash.substring(0, 10)}...
                            </a>
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold mb-2 text-gray-200">Partes Envolvidas</h4>
                      <div className="space-y-2 text-sm">
                        <p><span className="text-gray-400">Loja:</span> <span className="text-gray-300">{qrOrder.store}</span></p>
                        <p><span className="text-gray-400">Cliente:</span> <span className="text-gray-300">{qrOrder.customerEmail || 'Não identificado'}</span></p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold mb-2 text-gray-200">Itens do Pedido</h4>
                    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-[var(--color-divide)]">
                        <thead className="bg-gray-750">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Produto</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Qtd</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Preço Unit.</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="bg-[var(--color-bg-secondary)] divide-y divide-[var(--color-divide)]">
                          {qrOrder.items.map((item, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm text-gray-300">{item.product.name}</td>
                              <td className="px-4 py-2 text-sm text-gray-300">{item.quantity}</td>
                              <td className="px-4 py-2 text-sm text-gray-300">{formatCurrency(item.priceBRL)}</td>
                              <td className="px-4 py-2 text-sm text-gray-300">{formatCurrency(item.priceBRL * item.quantity)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex flex-col items-start"> {/* Alinhado à esquerda */}
                    <p className="text-gray-400 text-sm">Total do Pedido:</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(qrOrder.totalAmount)}</p>
                    {qrOrder.paymentMethod === 'bch' && qrOrder.exchangeRateUsed && (
                      <p className="text-sm text-yellow-400">
                        ({(qrOrder.totalAmount / qrOrder.exchangeRateUsed).toFixed(8)} BCH)
                      </p>
                    )}
                  </div>
                </div>

                {/* QR Code Section - Conditionally Displayed */}
                <div className="md:col-span-1">
                  {qrOrder.paymentMethod === 'bch' && qrOrder.status === 'pending' && qrOrder.merchantAddress && qrOrder.exchangeRateUsed && (
                    <div className="flex flex-col items-center p-4 bg-[var(--color-bg-tertiary)] rounded-lg sticky top-6"> {/* sticky e top-6 para fixar ao rolar */}
                      <h4 className="text-md font-semibold mb-3 text-gray-200">Pagar com Bitcoin Cash</h4>
                      <div className="bg-white p-2 rounded-md inline-block">
                        <QRCode value={`${qrOrder.merchantAddress.startsWith('bitcoincash:') ? qrOrder.merchantAddress : `bitcoincash:${qrOrder.merchantAddress}`}?amount=${(qrOrder.totalAmount / qrOrder.exchangeRateUsed).toFixed(8)}&label=Kashy&message=Pedido%20#${qrOrder._id}`} size={180} level="M" />
                      </div>
                      <p className="mt-2 text-xs text-gray-400 text-center break-all">Endereço: {qrOrder.merchantAddress}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6 border-t border-[var(--color-border)] pt-4">
              <button
                onClick={() => handlePrint(qrOrder!)} // Assuming qrOrder is not null here
                disabled={!qrOrder || isLoadingQr}
                className="px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-700 transition-colors text-sm text-gray-300 flex items-center gap-2 disabled:opacity-50"
              >
                <FiPrinter /> Imprimir
              </button>
              <button
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white"
                onClick={() => setQrOrder(null)}
                disabled={isLoadingQr}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Pedido */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 w-full max-w-3xl shadow-xl border border-[var(--color-border)] max-h-[90vh] flex flex-col">
            <h3 className="text-lg font-bold mb-4 flex-shrink-0">Novo Pedido</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateOrder();
              }}
              className="flex-grow overflow-y-auto pr-2 space-y-4" // Added space-y-4 for consistent spacing
            >
              {/* Selecionar Loja */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Loja</label>
                <select
                  value={selectedStore}
                  onChange={(e) => {
                    console.log('[PedidosTab] Loja selecionada no modal:', e.target.value);
                    setSelectedStore(e.target.value);
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Selecione uma loja</option>
                  <option value="Loja A">Loja A</option>
                  <option value="Loja B">Loja B</option>
                  <option value="Loja C">Loja C</option>
                </select>
              </div>

              {/* Adicionar Produtos */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Produtos</label>
                <input
                  type="text"
                  placeholder="Buscar produtos..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                />
                <div className="max-h-40 overflow-y-auto border border-[var(--color-border)] rounded-md">
                  {loadingProducts && <p className="text-gray-400 p-2 text-center">Carregando produtos...</p>}
                  {!loadingProducts && products.length === 0 && selectedStore && <p className="text-gray-400 p-2">Nenhum produto encontrado para esta loja.</p>}
                  {!loadingProducts && !selectedStore && <p className="text-gray-400 p-2">Selecione uma loja para ver os produtos.</p>}
                  {products
                    .filter((product) =>
                      product.name.toLowerCase().includes(modalSearchTerm.toLowerCase())
                    )
                    .map((product) => (
                      <div
                        key={product._id}
                        className="flex justify-between items-center px-3 py-2 hover:bg-[var(--color-bg-terciary)] cursor-pointer border-b border-[var(--color-border)] last:border-b-0"
                        onClick={() => {
                          setSelectedProducts((prev) => [...prev, { ...product, quantity: 1 }]);
                          console.log('[PedidosTab] Produto adicionado ao carrinho:', product);
                        }}
                      >
                        <span>{product.name}</span>
                        <span>{formatCurrency(product.priceBRL)}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Lista de Produtos Selecionados */}
              {selectedProducts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-1">Produtos Selecionados</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-[var(--color-border)] rounded-md p-2">
                    {selectedProducts.map((product, index) => (
                      <div
                        key={`${product._id}-${index}`} // Ensure unique key if same product added multiple times
                        className="flex justify-between items-center px-3 py-2 bg-[var(--color-bg-terciary)] rounded-lg"
                      >
                        <span className="truncate max-w-[60%]">{product.name}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={product.quantity || 1}
                            onChange={(e) => {
                              const newQuantity = parseInt(e.target.value, 10);
                              console.log(`[PedidosTab] Atualizando quantidade do produto ${product.name} para ${newQuantity}`);
                              updateProductQuantity(index, newQuantity > 0 ? newQuantity : 1);
                            }}
                            className="w-16 px-2 py-1 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:outline-none text-center"
                          />
                          <button
                            type="button"
                            onClick={() => removeProductFromCart(index)}
                            className="text-red-400 hover:text-red-300"
                            title="Remover Produto"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-right font-bold mt-2">Total: {formatCurrency(calculateTotal())}</p>
                </div>
              )}

              {/* E-mail do Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">E-mail do Cliente (Opcional)</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Digite o e-mail do cliente..."
                />
              </div>

              {/* Método de Pagamento */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Método de Pagamento</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Selecione um método</option>
                  <option value="bch">Bitcoin Cash</option>
                  <option value="pix">PIX</option>
                  <option value="card">Cartão</option>
                </select>
              </div>

              {/* Botões de Ação */}
              <div className="flex justify-end gap-4 pt-4 flex-shrink-0 border-t border-[var(--color-border)] mt-auto">
                <button
                  type="button"
                  onClick={() => {
                    console.log("[PedidosTab] Botão Cancelar (Novo Pedido) clicado.");
                    setIsOrderModalOpen(false);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  disabled={selectedProducts.length === 0 || !selectedStore || !paymentMethod}
                >
                  Criar Pedido
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
