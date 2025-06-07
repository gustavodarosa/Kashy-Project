import { useState, useEffect } from 'react';
import { Search, Landmark, CircleCheckBig, Bitcoin, User, Store, Settings, DollarSign, AlignJustify, CircleX, AlertTriangle, ChevronLeft, ChevronRight, ShoppingBasket, Edit2, Trash2, Copy, Printer, Clock, CheckCircle, XCircle, Plus, CreditCard, ChartNoAxesCombined, ShoppingCart, } from 'lucide-react';
import { Listbox } from '@headlessui/react';
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

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [orderIdToDelete, setOrderIdToDelete] = useState<string | null>(null);

  const [isPrintConfirmOpen, setIsPrintConfirmOpen] = useState(false);
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);

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

      setSelectedStore("");
      setCustomerEmail("");
      setSelectedProducts([]);
      setPaymentMethod("");
      setIsOrderModalOpen(false);
      setCurrentPage(1);

      setIsOrderSuccessOpen(true); // Abre o modal de sucesso

      // Se o pagamento for BCH, abra o modal de QR Code imediatamente
      if (savedOrder.paymentMethod === 'bch' && savedOrder._id) {
        openQrModal(savedOrder._id);
      } else {
        setOrders(prev => [savedOrder, ...prev].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, itemsPerPage));
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

  // Adicione este estado para o modal de sucesso
  const [isDeleteSuccessOpen, setIsDeleteSuccessOpen] = useState(false);
  const [isOrderSuccessOpen, setIsOrderSuccessOpen] = useState(false); // Novo estado para modal de sucesso do pedido

  // Função para deletar um pedido
  const handleDeleteOrder = async (orderId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar pedido.');
      }
      setOrders((prev) => prev.filter((order) => order._id !== orderId));
      setIsDeleteSuccessOpen(true); // Abre modal de sucesso
    } catch (error) {
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

  const statusOptions = [
    { value: 'all', label: 'Todos os Status' },
    { value: 'pending', label: 'Pendentes' },
    { value: 'paid', label: 'Pagos' },
    { value: 'cancelled', label: 'Cancelados' },
    { value: 'expired', label: 'Expirados' },
    { value: 'refunded', label: 'Reembolsados' },
  ];

  const paymentOptions = [
    { value: 'all', label: 'Todos os Métodos' },
    { value: 'bch', label: 'Bitcoin Cash' },
    { value: 'pix', label: 'PIX' },
    { value: 'card', label: 'Cartão' },
  ];
  return (
    <div className="bg-gradient-to-br from-[#1E2328] via-[#24292D] to-[#2B3036] min-h-screen text-white">
      <div className="container mx-auto px-2 py-2">
        {/* Enhanced Hero Section */}
        <div className="relative overflow-hidden mb-4">
          <div
            className="relative p-3 text-white text-center rounded-2xl shadow-2xl backdrop-blur-xl border border-white/10"
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
                  <ShoppingBasket size={36} className="text-blue-300" />
                </div>
                <div className="text-left">
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                    Gestão de Pedidos
                  </h1>
                  <p className="text-base text-blue-100/80">Acompanhe e gerencie todos os seus pedidos</p>
                </div>
              </div>
              {/* Action Button - Novo Pedido */}
              <div className="mt-6 flex justify-center">
                <button
                  id="btn-novo-pedido"
                  onClick={() => setIsOrderModalOpen(true)}
                  className="group relative px-8 py-3 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold rounded-2xl shadow-xl transition-all duration-300 hover:scale-105 border border-blue-400/40 text-base overflow-hidden"
                >
                  <span className="flex items-center gap-2 relative z-10">
                    <Plus size={20} />
                    <span>Novo Pedido</span>
                  </span>
                  {/* Animated Shine Effect */}
                  <span className="absolute left-0 top-0 w-full h-full rounded-2xl bg-gradient-to-r from-white/10 via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none animate-shine" />
                </button>
              </div>
            </div>
          </div>
          {/* Custom Animations */}
          <style>
            {`
              @keyframes pulse-slow {
                0%, 100% { opacity: 0.7; transform: scale(1);}
                50% { opacity: 1; transform: scale(1.08);}
              }
              @keyframes pulse-slower {
                0%, 100% { opacity: 0.5; transform: scale(1);}
                50% { opacity: 0.8; transform: scale(1.06);}
              }
              .animate-pulse-slow { animation: pulse-slow 6s ease-in-out infinite; }
              .animate-pulse-slower { animation: pulse-slower 9s ease-in-out infinite; }
              @keyframes shine {
                0% { left: -100%; }
                60% { left: 120%; }
                100% { left: 120%; }
              }
              .group:hover .animate-shine {
                animation: shine 1.2s linear 1;
              }
              .animate-shine {
                position: absolute;
                top: 0; left: -100%;
                width: 120%;
                height: 100%;
                background: linear-gradient(120deg, transparent 0%, white 30%, transparent 60%);
                opacity: 0.25;
                pointer-events: none;
              }
            `}
          </style>
        </div>

        {/* Quick Stats - Styled like ProdutosTab hero stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Pagos */}
          <div className="group relative overflow-hidden p-5 bg-gradient-to-br from-emerald-700/20 via-emerald-500/10 to-emerald-400/5 rounded-2xl border border-emerald-400/30 shadow-xl hover:shadow-2xl hover:border-emerald-400/60 transition-all duration-300 hover:scale-[1.03]">
            <div className="absolute -top-4 -right-4 opacity-20 group-hover:opacity-30 transition">
              <CircleCheckBig size={64} className="text-emerald-400" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl font-bold text-emerald-300 drop-shadow">{orders.filter(o => o.status === 'paid').length}</span>
              <span className="text-lg text-emerald-200 font-semibold">Pedidos</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-200 font-medium">
              <CircleCheckBig size={18} className="inline" /> Pagos
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-emerald-300">
              🟢 0 BCH - 0 Cartão - 0 Pix
            </div>
          </div>
          {/* Pendentes */}

          <div className="group relative overflow-hidden p-5 bg-gradient-to-br from-amber-700/20 via-amber-500/10 to-amber-400/5 rounded-2xl border border-amber-400/30 shadow-xl hover:shadow-2xl hover:border-amber-400/60 transition-all duration-300 hover:scale-[1.03]">
            <div className="absolute -top-4 -right-4 opacity-20 group-hover:opacity-30 transition">

              <AlertTriangle size={64} className="text-amber-400" />
            </div>
            <div className="flex items-center gap-2 mb-2">

              <span className="text-3xl font-bold text-amber-300 drop-shadow">{orders.filter(o => o.status === 'pending').length}</span>
              <span className="text-lg text-amber-200 font-semibold">Pedidos</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-amber-200 font-medium">
              <AlertTriangle size={18} className="inline" /> Pendentes
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-amber-300">
              🟡 0 BCH - 0 Cartão - 0 Pix
            </div>
          </div>
          {/* Cancelados/Expirados */}
          <div className="group relative overflow-hidden p-5 bg-gradient-to-br from-red-700/20 via-red-500/10 to-red-400/5 rounded-2xl border border-red-400/30 shadow-xl hover:shadow-2xl hover:border-red-400/60 transition-all duration-300 hover:scale-[1.03]">
            <div className="absolute -top-4 -right-4 opacity-20 group-hover:opacity-30 transition">
              <CircleX size={64} className="text-red-400" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl font-bold text-red-300 drop-shadow">{orders.filter(o => o.status === 'cancelled' || o.status === 'expired' || o.status === 'refunded').length}</span>
              <span className="text-lg text-red-200 font-semibold">Pedidos</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-red-200 font-medium">
              <CircleX size={18} className="inline" /> Cancelados/Expirados
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-red-300">
              🔴 0 BCH - 0 Cartão - 0 Pix
            </div>
          </div>
          {/* Total de Pedidos */}
          <div className="group relative overflow-hidden p-5 bg-gradient-to-br from-blue-700/20 via-blue-500/10 to-blue-400/5 rounded-2xl border border-blue-400/30 shadow-xl hover:shadow-2xl hover:border-blue-400/60 transition-all duration-300 hover:scale-[1.03]">

            <div className="absolute -top-4 -right-4 opacity-20 group-hover:opacity-30 transition">

              <Landmark size={64} className="text-blue-400" />
            </div>
            <div className="flex items-center gap-2 mb-2">

              <span className="text-3xl font-bold text-blue-300 drop-shadow">{orders.length}</span>
              <span className="text-lg text-blue-200 font-semibold">Pedidos</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-blue-200 font-medium">
              <Landmark size={18} className="inline" /> Total de Pedidos
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-blue-300">
              🔵 0 BCH - 0 Cartão - 0 Pix
            </div>
          </div>
        </div>
        {/* Enhanced Filters Section */}
        <div className="mb-3">
          <div className="p-3 bg-[#2F363E]/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl relative z-10">
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full lg:max-w-md">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Buscar pedidos..."
                  className="w-full pl-10 pr-3 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <div className="flex gap-3 w-full lg:w-auto">
                {/* Status Listbox */}
                <Listbox value={statusFilter} onChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
                  <div className="relative min-w-[180px]">
                    <Listbox.Button className="flex items-center gap-2 w-full px-4 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 transition-all text-sm text-left whitespace-nowrap hover:bg-[#2d3338] truncate">
                      {statusFilter === 'all' && <AlignJustify size={16} className="text-gray-400" />}
                      {statusFilter === 'pending' && <AlertTriangle size={16} className="text-amber-400" />}
                      {statusFilter === 'paid' && <CheckCircle size={16} className="text-emerald-400" />}
                      {statusFilter === 'cancelled' && <CircleX size={16} className="text-red-400" />}
                      {statusFilter === 'expired' && <Clock size={16} className="text-blue-400" />}
                      {statusFilter === 'refunded' && <DollarSign size={16} className="text-yellow-400" />}
                      {statusOptions.find(s => s.value === statusFilter)?.label || 'Todos os Status'}
                    </Listbox.Button>
                    <Listbox.Options className="text-white absolute w-full bg-[#24292D] border border-white/10 rounded-xl shadow-lg z-20">
                      <Listbox.Option
                        value="all"
                        className="flex items-center gap-2 px-4 py-2 bg-[#24292D] hover:bg-[#2d3338] rounded-t-xl cursor-pointer whitespace-nowrap text-sm"
                      >
                        <AlignJustify size={16} className="text-gray-400" /> Todos os Status
                      </Listbox.Option>
                      {statusOptions.filter(opt => opt.value !== 'all').map((statusOpt, idx, arr) => (
                        <Listbox.Option
                          key={statusOpt.value}
                          value={statusOpt.value}
                          className={`flex items-center gap-2 px-4 py-2 bg-[#24292D] hover:bg-[#2d3338] cursor-pointer whitespace-nowrap text-sm
                            ${idx === arr.length - 1 ? 'rounded-b-xl' : ''}
                          `}
                        >
                          {statusOpt.value === 'pending' && <AlertTriangle size={16} className="text-amber-400" />}
                          {statusOpt.value === 'paid' && <CheckCircle size={16} className="text-emerald-400" />}
                          {statusOpt.value === 'cancelled' && <CircleX size={16} className="text-red-400" />}
                          {statusOpt.value === 'expired' && <Clock size={16} className="text-blue-400" />}
                          {statusOpt.value === 'refunded' && <DollarSign size={16} className="text-yellow-400" />}
                          {statusOpt.label}
                        </Listbox.Option>
                      ))}
                    </Listbox.Options>
                  </div>
                </Listbox>
                {/* Payment Method Listbox */}
                <Listbox value={paymentFilter} onChange={(value) => { setPaymentFilter(value); setCurrentPage(1); }}>
                  <div className="relative min-w-[180px]">
                    <Listbox.Button className="flex items-center gap-2 w-full px-4 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 transition-all text-sm text-left whitespace-nowrap hover:bg-[#2d3338] truncate">
                      {paymentFilter === 'all' && <AlignJustify size={16} className="text-gray-400" />}
                      {paymentFilter === 'bch' && <Bitcoin size={16} className="text-green-400" />}
                      {paymentFilter === 'pix' && <CreditCard size={16} className="text-blue-400" />}
                      {paymentFilter === 'card' && <CreditCard size={16} className="text-blue-400" />}
                      {paymentOptions.find(p => p.value === paymentFilter)?.label || 'Todos os Métodos'}
                    </Listbox.Button>
                    <Listbox.Options className="text-white absolute w-full bg-[#24292D] border border-white/10 rounded-xl shadow-lg z-20">
                      <Listbox.Option
                        value="all"
                        className="flex items-center gap-2 px-4 py-2 bg-[#24292D] hover:bg-[#2d3338] rounded-t-xl cursor-pointer whitespace-nowrap text-sm"
                      >
                        <AlignJustify size={16} className="text-gray-400" /> Todos os Métodos
                      </Listbox.Option>
                      {paymentOptions.filter(opt => opt.value !== 'all').map((paymentOpt, idx, arr) => (
                        <Listbox.Option
                          key={paymentOpt.value}
                          value={paymentOpt.value}
                          className={`flex items-center gap-2 px-4 py-2 bg-[#24292D] hover:bg-[#2d3338] cursor-pointer whitespace-nowrap text-sm
                            ${idx === arr.length - 1 ? 'rounded-b-xl' : ''}
                          `}
                        >
                          {paymentOpt.value === 'bch' && <Bitcoin size={16} className="text-green-400" />}
                          {paymentOpt.value === 'pix' && <CreditCard size={16} className="text-blue-400" />}
                          {paymentOpt.value === 'card' && <CreditCard size={16} className="text-blue-400" />}
                          {paymentOpt.label}
                        </Listbox.Option>
                      ))}
                    </Listbox.Options>
                  </div>
                </Listbox>
              </div>
            </div>
          </div>
        </div>



        {/* Tabela de pedidos */}
        <div
          className="bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#24292D]/80 backdrop-blur-sm border-b border-white/10">
                  <tr className="text-xs">
                    <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                      <span className="inline-block mr-1 text-blue-400"><Copy size={16} /></span> ID
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                      <Store size={16} className="inline mr-1 text-teal-400" /> Loja
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                      <User size={16} className="inline mr-1 text-cyan-400" /> Cliente
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                      <DollarSign size={16} className="inline mr-1 text-amber-500" /> Total
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                      <CreditCard size={16} className="inline mr-1 text-green-400" /> Pagamento
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                      <Clock size={16} className="inline mr-1 text-blue-300" /> Data
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                      <CheckCircle size={16} className="inline mr-1 text-emerald-400" /> Status
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-300 uppercase tracking-wider">
                      <Printer size={16} className="inline mr-1 text-zinc-400" /> Fatura
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-300 uppercase tracking-wider">
                      <Settings size={16} className="inline mr-1 text-zinc-400" /> Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders.map((order) => (
                    <tr key={order._id} className="hover:bg-white/5 transition-colors group">
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
                        <span className="flex items-center gap-1 text-xs text-white">
                          <Store size={16} className="text-teal-400" /> {order.store}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs text-gray-300">
                          <User size={16} className="text-cyan-400" /> {order.customerEmail || 'Anônimo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="flex items-center gap-1 text-xs text-white">
                          <DollarSign size={16} className="text-amber-500" /> {formatCurrency(order.totalAmount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="flex items-center gap-1 text-xs text-gray-300">
                          {order.paymentMethod === 'bch' && <Bitcoin size={16} className="text-green-400" />}
                          {order.paymentMethod === 'pix' && <CreditCard size={16} className="text-blue-400" />}
                          {order.paymentMethod === 'card' && <CreditCard size={16} className="text-blue-400" />}
                          {getPaymentMethodLabel(order.paymentMethod)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs flex items-center gap-1 text-gray-400">
                        <Clock size={16} className="text-blue-300" />{formatDate(order.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${order.status === 'paid'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : order.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-red-500/20 text-red-300 border-red-500/30'
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
                            title="Editar Pedido"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setOrderToPrint(order);
                              setIsPrintConfirmOpen(true);
                            }}
                            className="p-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded-md border border-sky-500/30 hover:border-sky-500/50 transition-all duration-200 hover:scale-110"
                            title="Imprimir"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setOrderIdToDelete(order._id);
                              setIsDeleteConfirmOpen(true);
                            }}
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
          )}
        </div>


        {/* Pagination Controls - fora do container da tabela */}
        {!loading && !error && orders.length > 0 && (
          <div className="mt-6 flex items-center justify-between px-4 py-3 bg-[#2F363E]/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl">
            <div>
              <p className="text-xs text-gray-300">
                Página <span className="font-semibold text-white">{currentPage}</span> de <span className="font-semibold text-white">{totalPages}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 rounded-md border border-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                <ChevronLeft size={16} />
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="flex items-center gap-1 px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 rounded-md border border-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                Próximo
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

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
                              <span className={`ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${qrOrder.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl bg-gradient-to-br from-[#23272F] via-[#24292D]/95 to-[#3B82F6]/10 rounded-2xl border border-blue-400/30 shadow-2xl overflow-hidden flex flex-col">
              {/* Header com ícone */}
              <div className="flex items-center gap-3 p-6 border-b border-white/10 bg-gradient-to-r from-blue-600/10 to-transparent">
                <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-400/30">
                  <ShoppingBasket size={28} className="text-blue-300" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Novo Pedido</h2>
                  <p className="text-gray-400 mt-1 text-sm">Crie um novo pedido para um cliente.</p>
                </div>
                <button
                  className="absolute top-6 right-6 p-2 text-gray-400 hover:text-white transition-colors z-10 bg-white/5 hover:bg-white/10 rounded-xl"
                  onClick={() => {
                    setIsOrderModalOpen(false);
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
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateOrder();
                }}
                className="p-6 flex-grow overflow-y-auto space-y-6 max-h-[70vh]"
              >
                {/* Grupo: Loja */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Loja <span className="text-blue-400">*</span></label>
                  <select
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                    className="w-full px-3 py-2 bg-[#2F363E]/80 border border-blue-400/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/40 transition-all text-sm"
                    required
                  >
                    <option value="">Selecione uma loja</option>
                    <option value="Loja A">Loja A</option>
                    <option value="Loja B">Loja B</option>
                    <option value="Loja C">Loja C</option>
                  </select>
                </div>

                {/* Grupo: Produtos */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Adicionar Produtos</label>
                  <input
                    type="text"
                    placeholder="Buscar produtos na loja selecionada..."
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 bg-[#2F363E]/80 border border-blue-400/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/40 transition-all text-sm mb-2"
                    disabled={!selectedStore || loadingProducts}
                  />
                  <div className="max-h-40 overflow-y-auto border border-blue-400/10 rounded-md bg-[#2F363E]/50">
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
                          className="flex justify-between items-center px-3 py-2 hover:bg-blue-500/10 cursor-pointer border-b border-white/5 last:border-b-0 text-sm"
                          onClick={() => setSelectedProducts((prev) => [...prev, { ...product, quantity: 1 }])}
                        >
                          <span className="text-gray-200">{product.name}</span>
                          <span className="text-gray-300">{formatCurrency(product.priceBRL)}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Grupo: Carrinho */}
                {selectedProducts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-300 mb-1.5">Produtos no Pedido</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-blue-400/10 rounded-md p-2 bg-[#2F363E]/50">
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
                              className="w-16 px-2 py-1 rounded-md bg-[#2F363E]/80 border border-blue-400/10 focus:outline-none text-center text-white text-xs"
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

                {/* Grupo: Cliente */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">E-mail do Cliente <span className="text-gray-500">(Opcional)</span></label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-[#2F363E]/80 border border-blue-400/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/40 transition-all text-sm"
                    placeholder="cliente@email.com"
                  />
                </div>

                {/* Grupo: Pagamento */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Método de Pagamento <span className="text-blue-400">*</span></label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-[#2F363E]/80 border border-blue-400/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/40 transition-all text-sm"
                    required
                  >
                    <option value="">Selecione um método</option>
                    <option value="bch">Bitcoin Cash</option>
                    <option value="pix">PIX</option>
                    <option value="card">Cartão</option>
                  </select>
                </div>
              </form>

              {/* Rodapé fixo para ações */}
              <div className="flex justify-end gap-3 p-6 border-t border-white/10 flex-shrink-0 bg-gradient-to-t from-[#23272F] via-[#24292D]/90 to-transparent">
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
                  onClick={handleCreateOrder}
                  className="px-5 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg text-sm"
                  disabled={selectedProducts.length === 0 || !selectedStore || !paymentMethod}
                >
                  Criar Pedido
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmação de exclusão */}
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#2F363E] rounded-xl w-full max-w-sm shadow-2xl relative border border-white/10">
              <div className="p-6 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-500/50 bg-red-500/20">
                  <Trash2 size={36} className="text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Confirmar Exclusão</h3>
                <p className="text-gray-300 mb-6 text-sm">
                  Tem certeza que deseja excluir este pedido? Esta ação não poderá ser desfeita.
                </p>
                <div className="flex gap-3">
                  <button
                    className="flex-1 rounded-lg py-2 font-semibold transition-colors bg-gray-600 hover:bg-gray-700 text-white text-sm"
                    onClick={() => {
                      setIsDeleteConfirmOpen(false);
                      setOrderIdToDelete(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="flex-1 rounded-lg py-2 font-semibold transition-colors bg-red-600 hover:bg-red-700 text-white text-sm"
                    onClick={() => {
                      if (orderIdToDelete) handleDeleteOrder(orderIdToDelete);
                      setIsDeleteConfirmOpen(false);
                      setOrderIdToDelete(null);
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de sucesso ao excluir */}
        {isDeleteSuccessOpen && (
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#23272F] rounded-xl w-full max-w-sm shadow-2xl relative border border-emerald-400/20">
              <div className="p-6 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-500/50 bg-emerald-500/20">
                  <CheckCircle size={36} className="text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Pedido excluído com sucesso!</h3>
                <p className="text-gray-300 mb-6 text-sm">
                  O pedido foi removido do sistema.
                </p>
                <button
                  className="w-full rounded-lg py-2 font-semibold transition-colors bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                  onClick={() => setIsDeleteSuccessOpen(false)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de sucesso ao criar pedido */}
        {isOrderSuccessOpen && (
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#23272F] rounded-xl w-full max-w-sm shadow-2xl relative border border-emerald-400/20">
              <div className="p-6 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-500/50 bg-emerald-500/20">
                  <CheckCircle size={36} className="text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Pedido criado com sucesso!</h3>
                <p className="text-gray-300 mb-6 text-sm">
                  O novo pedido foi registrado no sistema.
                </p>
                <button
                  className="w-full rounded-lg py-2 font-semibold transition-colors bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                  onClick={() => setIsOrderSuccessOpen(false)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}