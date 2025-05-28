import { useState, useEffect } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Edit2, // Or Edit, depending on preference
  Trash2,
  Copy,
  Printer,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  CreditCard,
  ListFilter,
} from 'lucide-react';
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
        return <CheckCircle size={14} />;
      case 'pending':
        return <Clock size={14} />;
      case 'cancelled':
      case 'refunded':
      case 'expired':
        return <XCircle size={14} />;
      default:
        return <Clock size={14} className="text-gray-500" />;
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

  return (
    <div className="bg-gradient-to-br from-[#1E2328] via-[#24292D] to-[#2B3036] min-h-screen text-white">
      <div className="container mx-auto px-4 py-6">
        {/* Enhanced Hero Section */}
        <div className="relative overflow-hidden mb-10">
          <div
            className="relative p-6 text-white text-center rounded-3xl shadow-2xl backdrop-blur-xl border border-white/10"
            style={{
              background: `
                radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.2) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(37, 99, 235, 0.3) 0%, transparent 50%),
                linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.15) 100%)
              `,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-blue-500/20 to-blue-700/20 rounded-xl backdrop-blur-sm border border-blue-400/30">
                  <ShoppingCart size={36} className="text-blue-300" />
                </div>
                <div className="text-left">
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                    Gestão de Pedidos
                  </h1>
                  <p className="text-base text-blue-100/80">Acompanhe e gerencie todos os seus pedidos</p>
                </div>
              </div>
              {/* Action Button - Novo Pedido */}
              <div className="mt-8">
                <button
                  id="btn-novo-pedido"
                  onClick={() => setIsOrderModalOpen(true)}
                  className="group relative px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold rounded-xl shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl border border-blue-400/30 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Plus size={18} />
                    <span>Novo Pedido</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Filters Section */}
        <div className="mb-6">
          <div className="p-6 bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full lg:max-w-md">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Buscar por ID, loja ou cliente..."
                  className="w-full pl-10 pr-3 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              
              <div className="flex gap-3 w-full lg:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all min-w-[150px] text-sm"
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
                  className="px-4 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all min-w-[150px] text-sm"
                >
                  <option value="all">Todos métodos</option>
                  <option value="bch">Bitcoin Cash</option>
                  <option value="pix">PIX</option>
                  <option value="card">Cartão</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats - Styled like ProdutosTab hero stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="group p-4 bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-xl backdrop-blur-sm border border-green-400/20 hover:border-green-400/40 transition-all duration-300 hover:scale-105">
            <div className="text-2xl font-bold text-green-300 mb-1">{orders.filter(o => o.status === 'paid').length}</div>
            <div className="text-xs text-green-200/80 font-medium">Pagos</div>
          </div>
          <div className="group p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 rounded-xl backdrop-blur-sm border border-yellow-400/20 hover:border-yellow-400/40 transition-all duration-300 hover:scale-105">
            <div className="text-2xl font-bold text-yellow-300 mb-1">{orders.filter(o => o.status === 'pending').length}</div>
            <div className="text-xs text-yellow-200/80 font-medium">Pendentes</div>
          </div>
          <div className="group p-4 bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl backdrop-blur-sm border border-red-400/20 hover:border-red-400/40 transition-all duration-300 hover:scale-105">
            <div className="text-2xl font-bold text-red-300 mb-1">{orders.filter(o => o.status === 'cancelled' || o.status === 'expired' || o.status === 'refunded').length}</div>
            <div className="text-xs text-red-200/80 font-medium">Cancelados/Expirados</div>
          </div>
          <div className="group p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl backdrop-blur-sm border border-blue-400/20 hover:border-blue-400/40 transition-all duration-300 hover:scale-105">
            <div className="text-2xl font-bold text-blue-300 mb-1">{orders.length}</div>
            <div className="text-xs text-blue-200/80 font-medium">Total de Pedidos</div>
          </div>
        </div>

        {/* Tabela de pedidos */}
        <div className="bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-flex items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                <span className="text-white font-medium">Carregando pedidos...</span>
              </div>
            </div>
          ) : error && !qrOrder ? (
            <div className="p-8 text-center">
              <div className="text-red-400 font-medium">{error}</div>
            </div>
          ) : orders.length === 0 && !loading ? (
            <div className="p-8 text-center">
              <div className="text-gray-400">Nenhum pedido encontrado.</div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#24292D]/80 backdrop-blur-sm border-b border-white/10">
                    <tr className="text-xs">
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">ID</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Loja</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Cliente</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Pagamento</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Data</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-300 uppercase tracking-wider">Fatura</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-300 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {orders.map((order) => (
                      <tr key={order._id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-mono text-blue-400">
                              #{order._id.substring(order._id.length - 6)}
                            </span>
                            <button
                              onClick={() => navigator.clipboard.writeText(order._id)}
                              className="text-gray-400 hover:text-blue-300 transition-colors"
                              title="Copiar ID"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-white font-medium">{order.store}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-300">
                            {order.customerEmail || 'Anônimo'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-white font-medium">{formatCurrency(order.totalAmount)}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-300 flex items-center gap-2">
                            {order.paymentMethod === 'bch' && (
                              <span className="w-5 h-5 inline-block align-middle" title="Bitcoin Cash">
                                <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                                  <rect width="32" height="32" rx="8" fill="#0AC18E"/>
                                  <g>
                                    <circle cx="16" cy="16" r="10" fill="#fff"/>
                                    <path d="M18.7 13.2c.3-2-1.2-3.1-3.3-3.1l.3-1.3-1.2-.3-.3 1.3c-.3-.1-.6-.1-.9-.2l.3-1.3-1.2-.3-.3 1.3c-.2 0-.4-.1-.6-.1l-1.6-.4-.3 1.3s.9.2.9.2c.5.1.6.5.6.8l-1.5 6.1c-.1.2-.2.5-.6.4 0 0-.9-.2-.9-.2l-.3 1.4 1.5.4c.3.1.6.1.9.2l-.3 1.3 1.2.3.3-1.3c.3.1.6.1.9.2l-.3 1.3 1.2.3.3-1.3c2.1.4 3.7.2 4.4-1.7.5-1.3 0-2.1-1-2.6.7-.2 1.2-.8 1.3-1.9zm-2.3 4.1c-.3 1.3-2.6.6-3.3.4l.6-2.3c.7.2 3 .7 2.7 1.9zm.3-4.2c-.3 1.1-2.1.6-2.7.5l.5-2c.6.1 2.5.4 2.2 1.5z" fill="#0AC18E"/>
                                  </g>
                                </svg>
                              </span>
                            )}
                            {order.paymentMethod === 'pix' && (
                              <span className="w-5 h-5 inline-block align-middle" title="PIX">
                                <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                                  <rect width="32" height="32" rx="8" fill="#00E1CC"/>
                                  <path d="M16 8.5c.5 0 1 .2 1.4.6l5.5 5.5c.8.8.8 2 0 2.8l-5.5 5.5c-.8.8-2 .8-2.8 0l-5.5-5.5c-.8-.8-.8-2 0-2.8l5.5-5.5c.4-.4.9-.6 1.4-.6z" fill="#fff"/>
                                </svg>
                              </span>
                            )}
                            {order.paymentMethod === 'card' && <CreditCard size={18} className="text-blue-400" />}
                            {getPaymentMethodLabel(order.paymentMethod)}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${
                            order.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                            order.status === 'pending' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                            'bg-red-500/20 text-red-300 border-red-500/30'
                          }`}>
                            {getStatusIconComponent(order.status)}
                            {getStatusLabelText(order.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-md border border-blue-500/30 text-xs font-medium transition-colors"
                            onClick={() => openQrModal(order._id)}
                          >
                            Detalhes
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => fetchOrderDetails(order._id)}
                              className="p-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-md border border-teal-500/30 hover:border-teal-500/50 transition-all duration-200 hover:scale-110"
                              title="Editar Pedido (funcionalidade futura)"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handlePrint(order)}
                              className="p-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded-md border border-sky-500/30 hover:border-sky-500/50 transition-all duration-200 hover:scale-110"
                              title="Imprimir"
                            >
                              <Printer size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(order._id)}
                              className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-md border border-red-500/30 hover:border-red-500/50 transition-all duration-200 hover:scale-110"
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls - Styled like ProdutosTab */}
              {!loading && !error && orders.length > 0 && (
                <div className="mt-0 flex items-center justify-between px-4 py-3 border-t border-white/10">
                  <div>
                    <p className="text-xs text-gray-300">
                      Página <span className="font-semibold text-white">{currentPage}</span> de <span className="font-semibold text-white">{totalPages}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-md border border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      <ChevronLeft size={16} />
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-md border border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      Próximo
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Detalhes do Pedido (antigo Modal QR Code) - Styled like ProdutosTab modals */}
        {qrOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-3xl bg-[#24292D]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-white/10 flex-shrink-0">
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <ShoppingCart size={22} /> Detalhes do Pedido #{qrOrder._id.substring(qrOrder._id.length - 6)}
                  </h2>
                  <button
                    className="p-2 text-gray-400 hover:text-white transition-colors z-10 bg-white/5 hover:bg-white/10 rounded-xl"
                    onClick={() => setQrOrder(null)}
                    aria-label="Fechar"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6 flex-grow overflow-y-auto">
                {isLoadingQr && (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                )}

                {!isLoadingQr && error && (
                  <div className="text-red-400 text-center p-4">{error}</div>
                )}

                {!isLoadingQr && !error && qrOrder && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-md font-semibold mb-2 text-gray-200">Informações do Pedido</h4>
                          <div className="space-y-1.5 text-sm">
                            <p><span className="text-gray-400">Status:</span>
                              <span className={`ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${
                                qrOrder.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                qrOrder.status === 'pending' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                                'bg-red-500/20 text-red-300 border-red-500/30'
                              }`}>
                                {getStatusIconComponent(qrOrder.status)}
                                {getStatusLabelText(qrOrder.status)}
                              </span>
                            </p>
                            <p><span className="text-gray-400">Data:</span> <span className="text-gray-300">{formatDate(qrOrder.createdAt)}</span></p>
                            <p><span className="text-gray-400">Método:</span> <span className="text-gray-300">{getPaymentMethodLabel(qrOrder.paymentMethod)}</span></p>
                            {qrOrder.transaction?.txHash && (
                              <p><span className="text-gray-400">Tx Hash:</span>
                                <a href={`https://explorer.bitcoinabc.org/tx/${qrOrder.transaction.txHash}`} target="_blank" rel="noopener noreferrer" className="ml-2 font-mono text-blue-400 hover:text-blue-300 break-all text-xs">
                                  {qrOrder.transaction.txHash.substring(0, 10)}...{qrOrder.transaction.txHash.substring(qrOrder.transaction.txHash.length - 5)}
                                </a>
                              </p>
                            )}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-md font-semibold mb-2 text-gray-200">Partes Envolvidas</h4>
                          <div className="space-y-1.5 text-sm">
                            <p><span className="text-gray-400">Loja:</span> <span className="text-gray-300">{qrOrder.store}</span></p>
                            <p><span className="text-gray-400">Cliente:</span> <span className="text-gray-300">{qrOrder.customerEmail || 'Não identificado'}</span></p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-md font-semibold mb-2 text-gray-200">Itens do Pedido</h4>
                        <div className="border border-white/10 rounded-lg overflow-hidden bg-[#2F363E]/70">
                          <table className="min-w-full divide-y divide-white/10">
                            <thead className="bg-white/5">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Produto</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Qtd</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Preço Unit.</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                              {qrOrder.items.map((item, index) => (
                                <tr key={index}>
                                  <td className="px-4 py-2 text-sm text-gray-200">{item.product.name}</td>
                                  <td className="px-4 py-2 text-sm text-gray-300 text-center">{item.quantity}</td>
                                  <td className="px-4 py-2 text-sm text-gray-300">{formatCurrency(item.priceBRL)}</td>
                                  <td className="px-4 py-2 text-sm text-gray-200 font-medium">{formatCurrency(item.priceBRL * item.quantity)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="flex flex-col items-start pt-2">
                        <p className="text-gray-400 text-sm">Total do Pedido:</p>
                        <p className="text-2xl font-bold text-white">{formatCurrency(qrOrder.totalAmount)}</p>
                        {qrOrder.paymentMethod === 'bch' && qrOrder.exchangeRateUsed && (
                          <p className="text-sm text-yellow-400">
                            ({(qrOrder.totalAmount / qrOrder.exchangeRateUsed).toFixed(8)} BCH)
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-1">
                      {qrOrder.paymentMethod === 'bch' && qrOrder.status === 'pending' && qrOrder.merchantAddress && qrOrder.exchangeRateUsed && (
                        <div className="flex flex-col items-center p-4 bg-[#2F363E]/70 rounded-lg sticky top-6 border border-white/10">
                          <h4 className="text-md font-semibold mb-3 text-gray-200">Pagar com Bitcoin Cash</h4>
                          <div className="bg-white p-2 rounded-md inline-block shadow-lg">
                            <QRCode value={`${qrOrder.merchantAddress.startsWith('bitcoincash:') ? qrOrder.merchantAddress : `bitcoincash:${qrOrder.merchantAddress}`}?amount=${(qrOrder.totalAmount / qrOrder.exchangeRateUsed).toFixed(8)}&label=Kashy&message=Pedido%20#${qrOrder._id}`} size={180} level="M" />
                          </div>
                          <p className="mt-3 text-xs text-gray-400 text-center break-all">Endereço: {qrOrder.merchantAddress}</p>
                          <p className="mt-1 text-sm font-semibold text-yellow-300">Valor: {(qrOrder.totalAmount / qrOrder.exchangeRateUsed).toFixed(8)} BCH</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-auto p-6 border-t border-white/10 flex-shrink-0">
                <button
                  onClick={() => handlePrint(qrOrder!)}
                  disabled={!qrOrder || isLoadingQr}
                  className="px-4 py-2 rounded-lg border border-gray-500 hover:bg-gray-700/50 transition-colors text-sm text-gray-300 flex items-center gap-2 disabled:opacity-50"
                >
                  <Printer size={16} /> Imprimir
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-medium transition-colors"
                  onClick={() => setQrOrder(null)}
                  disabled={isLoadingQr}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Novo Pedido - Styled like ProdutosTab modals */}
        {isOrderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-3xl bg-[#24292D]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl flex flex-col">
               <button
                className="absolute top-6 right-6 p-2 text-gray-400 hover:text-white transition-colors z-10 bg-white/5 hover:bg-white/10 rounded-xl"
                onClick={() => {
                  console.log("[PedidosTab] Botão Cancelar (Novo Pedido) clicado.");
                  setIsOrderModalOpen(false);
                  // Reset form states if needed
                  setSelectedStore("");
                  setCustomerEmail("");
                  setSelectedProducts([]);
                  setPaymentMethod("");
                  setModalSearchTerm("");
                }}
                aria-label="Fechar"
              >
                ×
              </button>
              <div className="p-6 border-b border-white/10 flex-shrink-0">
                <h2 className="text-xl font-bold text-white">Novo Pedido</h2>
                <p className="text-gray-400 mt-1 text-sm">Crie um novo pedido para um cliente.</p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateOrder();
                }}
                className="p-6 flex-grow overflow-y-auto space-y-4 max-h-[70vh]"
              >
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Loja *</label>
                  <select
                    value={selectedStore}
                    onChange={(e) => {
                      console.log('[PedidosTab] Loja selecionada no modal:', e.target.value);
                      setSelectedStore(e.target.value);
                    }}
                    className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                    required
                  >
                    <option value="">Selecione uma loja</option>
                    <option value="Loja A">Loja A</option>
                    <option value="Loja B">Loja B</option>
                    <option value="Loja C">Loja C</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Adicionar Produtos</label>
                  <input
                    type="text"
                    placeholder="Buscar produtos na loja selecionada..."
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm mb-2"
                    disabled={!selectedStore || loadingProducts}
                  />
                  <div className="max-h-40 overflow-y-auto border border-white/10 rounded-md bg-[#2F363E]/50">
                    {loadingProducts && <p className="text-gray-400 p-3 text-center text-sm">Carregando produtos...</p>}
                    {!loadingProducts && products.length === 0 && selectedStore && <p className="text-gray-400 p-3 text-sm">Nenhum produto encontrado para esta loja.</p>}
                    {!loadingProducts && !selectedStore && <p className="text-gray-400 p-3 text-sm">Selecione uma loja para ver os produtos.</p>}
                    {products
                      .filter((product) =>
                        product.name.toLowerCase().includes(modalSearchTerm.toLowerCase())
                      )
                      .map((product) => (
                        <div
                          key={product._id}
                          className="flex justify-between items-center px-3 py-2 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-b-0 text-sm"
                          onClick={() => {
                            setSelectedProducts((prev) => [...prev, { ...product, quantity: 1 }]);
                            console.log('[PedidosTab] Produto adicionado ao carrinho:', product);
                          }}
                        >
                          <span className="text-gray-200">{product.name}</span>
                          <span className="text-gray-300">{formatCurrency(product.priceBRL)}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {selectedProducts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-300 mb-1.5">Produtos no Pedido</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-white/10 rounded-md p-2 bg-[#2F363E]/50">
                      {selectedProducts.map((product, index) => (
                        <div
                          key={`${product._id}-${index}`}
                          className="flex justify-between items-center px-3 py-2 bg-[#24292D]/70 rounded-lg text-sm"
                        >
                          <span className="truncate max-w-[50%] text-gray-200">{product.name}</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              value={product.quantity || 1}
                              onChange={(e) => {
                                const newQuantity = parseInt(e.target.value, 10);
                                updateProductQuantity(index, newQuantity > 0 ? newQuantity : 1);
                              }}
                              className="w-16 px-2 py-1 rounded-md bg-[#2F363E]/80 border border-white/10 focus:outline-none text-center text-white text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => removeProductFromCart(index)}
                              className="text-red-400 hover:text-red-300"
                              title="Remover Produto"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-right font-semibold mt-2 text-lg text-white">Total: {formatCurrency(calculateTotal())}</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">E-mail do Cliente (Opcional)</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                    placeholder="cliente@email.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Método de Pagamento *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                    required
                  >
                    <option value="">Selecione um método</option>
                    <option value="bch">Bitcoin Cash</option>
                    <option value="pix">PIX</option>
                    <option value="card">Cartão</option>
                  </select>
                </div>
              </form>

              <div className="flex justify-end gap-3 p-6 border-t border-white/10 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsOrderModalOpen(false);
                    setSelectedStore("");
                    setCustomerEmail("");
                    setSelectedProducts([]);
                    setPaymentMethod("");
                    setModalSearchTerm("");
                  }}
                  className="px-5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30 hover:border-red-500/50 font-medium transition-all duration-200 hover:scale-105 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  onClick={handleCreateOrder} // Attach submit handler here as form is outside
                  className="px-5 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg text-sm"
                  disabled={selectedProducts.length === 0 || !selectedStore || !paymentMethod}
                >
                  Criar Pedido
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
