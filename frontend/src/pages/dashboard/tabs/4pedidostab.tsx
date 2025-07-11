import { Search, Landmark, CircleCheckBig, Bitcoin, User, Store, Settings, DollarSign, AlignJustify, CircleX, AlertTriangle, ChevronLeft, ChevronRight, ShoppingBasket, Edit2, Trash2, Copy, Printer, Clock, CheckCircle, XCircle, Plus, CreditCard, ShoppingCart, } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Listbox } from '@headlessui/react';
import QRCode from 'react-qr-code';
import { toast } from 'react-toastify';
type OrderItem = {
  product: {
    _id: string;
    name: string;
    quantity?: number
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
  exchangeRateUsed?: number;
};

type Product = {
  _id: string;
  name: string;
  priceBRL: number;
  priceBCH: number;
  quantity?: number;
  barcode?: string;
  originalQuantity?: number;
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

  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Estado para o modal de novo pedido
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [selectedStore] = useState<string>(localStorage.getItem('store') || '');
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

  // Adicione um novo estado para o modal de confirmação
  const [isOrderConfirmationOpen, setIsOrderConfirmationOpen] = useState(false);

  // Estado para o modal de confirmação de impressão
  const [isPrintConfirmOpen, setIsPrintConfirmOpen] = useState(false);
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);

  // Função para abrir o modal de confirmação de impressão
  const confirmPrint = (order: Order) => {
    setOrderToPrint(order);
    setIsPrintConfirmOpen(true);
  };

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
      console.log('[PedidosTab] Produtos buscados para a loja', store, ':', data); // Verifique se o campo quantity está presente
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

  // 1. Mova fetchOrders para fora do useEffect para poder chamá-la manualmente
  const fetchOrders = async () => {
    if (!selectedStore) {
      setOrders([]);
      setTotalPages(1);
      setError('Selecione uma loja para visualizar os pedidos.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/orders?store=${encodeURIComponent(selectedStore)}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        throw new Error('Erro ao buscar pedidos');
      }
      const data: Order[] = await response.json();

      const filteredOrders = data.filter((order) => {
        const matchesSearch =
          order._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.store.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (order.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

        const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
        const matchesPayment = paymentFilter === 'all' || order.paymentMethod === paymentFilter;

        return matchesSearch && matchesStatus && matchesPayment;
      });

      filteredOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const startIndex = (currentPage - 1) * itemsPerPage;
      const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);

      setOrders(paginatedOrders);
      setTotalPages(Math.ceil(filteredOrders.length / itemsPerPage));
      setError(null);
    } catch (err) {
      setError("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  };

  // 2. No useEffect, substitua fetchOrders() por fetchOrders
  useEffect(() => {
    fetchOrders();
  }, [currentPage, searchTerm, statusFilter, paymentFilter, selectedStore]);

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
      setSelectedProducts(order.items.map((item: OrderItem) => ({
        _id: item.product._id,
        name: item.product.name,
        priceBRL: item.priceBRL,
        priceBCH: item.priceBCH,
        quantity: item.quantity,
        originalQuantity: item.product.quantity ?? item.quantity,
      })));
      setCustomerEmail(order.customerEmail || "");
      setPaymentMethod(order.paymentMethod);
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
    setSelectedProducts((prev) => {
      const removed = prev[index];
      setProducts((productsPrev) => {
        // Só adiciona de volta se não existir já na lista de produtos disponíveis
        if (!productsPrev.some((p) => p._id === removed._id)) {
          // Restaura a quantidade original do estoque
          const { originalQuantity, ...rest } = removed;
          return [...productsPrev, { ...rest, quantity: originalQuantity }];
        }
        return productsPrev;
      });
      return prev.filter((_, i) => i !== index);
    });
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
      store: selectedStore, // já vem do localStorage/login
      customerEmail: customerEmail || "Não identificado",
      totalAmount,
      paymentMethod,
      items: selectedProducts.map(p => ({
        product: p._id,
        name: p.name,
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
        return;
      }

      let response;
      if (isEditingOrder && editingOrderId) {
        // Atualizar pedido existente
        response = await fetch(`http://localhost:3000/api/orders/${editingOrderId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(orderData),
        });
      } else {
        // Criar novo pedido
        response = await fetch("http://localhost:3000/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(orderData),
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Erro ao salvar pedido" }));
        throw new Error(errorData.message || "Erro ao salvar pedido");
      }
      const savedOrder = await response.json();

      // Atualize o estoque local dos produtos
      setProducts((prevProducts) => {
        // Atualiza o estoque dos produtos vendidos
        let updatedProducts = [...prevProducts];
        selectedProducts.forEach((cartProduct) => {
          const idx = updatedProducts.findIndex(p => p._id === cartProduct._id);
          if (idx !== -1) {
            // Atualiza o estoque se o produto já está na lista
            updatedProducts[idx] = {
              ...updatedProducts[idx],
              quantity: (updatedProducts[idx].quantity || 0) - (cartProduct.quantity || 1)
            };
          } else {
            // Se não está na lista (foi removido ao adicionar ao carrinho), adiciona de volta se ainda houver estoque
            const newQuantity = (cartProduct.originalQuantity || 0) - (cartProduct.quantity || 1);
            if (newQuantity > 0) {
              const { originalQuantity, ...rest } = cartProduct;
              updatedProducts.push({ ...rest, quantity: newQuantity });
            }
          }
        });
        // Remove produtos que ficaram com estoque <= 0
        return updatedProducts.filter(p => (p.quantity || 0) > 0);
      });

      setCustomerEmail("");
      setSelectedProducts([]);
      setPaymentMethod("");
      setIsOrderModalOpen(false);
      setCurrentPage(1);

      setIsOrderSuccessOpen(true);

      // 3. Após criar o pedido, chame fetchOrders()
      fetchOrders();

      // Se o pagamento for BCH, abra o modal de QR Code imediatamente
      if (savedOrder.paymentMethod === 'bch' && savedOrder._id) {
        openQrModal(savedOrder._id);
      }
      // Remova o else que fazia setOrders manualmente
    } catch (error: any) {
      console.error("[PedidosTab] Erro ao criar pedido:", error);
      alert(error.message || "Erro ao criar pedido.");
    }
  };

  const [isDeleteSuccessOpen, setIsDeleteSuccessOpen] = useState(false);
  const [isOrderSuccessOpen, setIsOrderSuccessOpen] = useState(false);

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
      setIsDeleteSuccessOpen(true);
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
        <div className="relative overflow-hidden mb-4">
          <div className="relative p-3 text-white text-center rounded-2xl shadow-2xl backdrop-blur-xl border border-white/10"
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
                  onClick={() => {
                    if (!selectedStore) {
                      toast.error('Você precisa estar logado em uma loja para criar pedidos.');
                      return;
                    }
                    setIsOrderModalOpen(true);
                  }}
                  className="cursor-pointer group relative px-8 py-3 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold rounded-2xl shadow-xl transition-all duration-300 hover:scale-105 border border-blue-400/40 text-base overflow-hidden"
                >
                  <span className="flex items-center gap-2 relative z-10">
                    <Plus size={20} />
                    <span>Novo Pedido</span>
                  </span>
                  <span className="absolute left-0 top-0 w-full h-full rounded-2xl bg-gradient-to-r from-white/10 via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none animate-shine" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
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
                  className="w-full pl-10 pr-3 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-white/10 transition-all text-sm"
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
                    <Listbox.Button className="flex items-center gap-2 w-full px-4 py-3 cursor-pointer bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 transition-all text-sm text-left whitespace-nowrap hover:bg-[#2d3338] truncate">
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
                    <Listbox.Button className="cursor-pointer flex items-center gap-2 w-full px-4 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 transition-all text-sm text-left whitespace-nowrap hover:bg-[#2d3338] truncate">
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
                      <span className="inline-block mr-1 text-gray-300"><Copy size={16} /></span> ID
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                      <Store size={16} className="inline mr-1 text-gray-300" /> Loja
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                      <User size={16} className="inline mr-1 text-gray-300" /> Cliente
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                      <DollarSign size={16} className="inline mr-1 text-gray-300" /> Total
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                      <CreditCard size={16} className="inline mr-1 text-gray-300" /> Pagamento
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                      <Clock size={16} className="inline mr-1 text-gray-300" /> Data
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                      <CheckCircle size={16} className="inline mr-1 text-gray-300" /> Status
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-300 uppercase tracking-wider">
                      <Printer size={16} className="inline mr-1 text-gray-300" /> Fatura
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-300 uppercase tracking-wider">
                      <Settings size={16} className="inline mr-1 text-gray-300" /> Ações
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
                          <Store size={16} className="text-gray-300" /> {order.store}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs text-gray-300">
                          <User size={16} className="text-gray-300" /> {order.customerEmail || 'Anônimo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="flex items-center gap-1 text-xs text-white">
                          <DollarSign size={16} className="text-green-500" /> {formatCurrency(order.totalAmount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="flex items-center gap-1 text-xs text-gray-300">
                          {order.paymentMethod === 'bch' && (

                            <span className="inline-block w-5 h-5 align-middle">
                              <svg viewBox="0 0 788 788" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="394" cy="394" r="394" fill="#fff" />
                                <path d="M516.9,261.7c-19.8-44.9-65.3-54.5-121-45.2L378,147.1l-42.2,10.9l17.6,69.2
                                  c-11.1,2.8-22.5,5.2-33.8,8.4L302,166.8l-42.2,10.9l17.9,69.4c-9.1,2.6-85.2,22.1-85.2,22.1l11.6,45.2c0,0,31-8.7,30.7-8
                                  c17.2-4.5,25.3,4.1,29.1,12.2l49.2,190.2c0.6,5.5-0.4,14.9-12.2,18.1c0.7,0.4-30.7,7.9-30.7,7.9l4.6,52.7c0,0,75.4-19.3,85.3-21.8
                                  l18.1,70.2l42.2-10.9l-18.1-70.7c11.6-2.7,22.9-5.5,33.9-8.4l18,70.3l42.2-10.9l-18.1-70.1c65-15.8,110.9-56.8,101.5-119.5
                                  c-6-37.8-47.3-68.8-81.6-72.3C519.3,324.7,530,297.4,516.9,261.7L516.9,261.7z M496.6,427.2c8.4,62.1-77.9,69.7-106.4,77.2
                                  l-24.8-92.9C394,404,482.4,372.5,496.6,427.2z M444.6,300.7c8.9,55.2-64.9,61.6-88.7,67.7l-22.6-84.3
                                  C357.2,278.2,426.5,249.6,444.6,300.7z"
                                  fill="#0AC18E" />
                              </svg>
                            </span>
                          )}
                          {order.paymentMethod === 'pix' && (

                            <span className="inline-block w-5 h-5 align-middle">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
                                <path fill="#4db6ac" d="M11.9,12h-0.68l8.04-8.04c2.62-2.61,6.86-2.61,9.48,0L36.78,12H36.1c-1.6,0-3.11,0.62-4.24,1.76	l-6.8,6.77c-0.59,0.59-1.53,0.59-2.12,0l-6.8-6.77C15.01,12.62,13.5,12,11.9,12z"></path>
                                <path fill="#4db6ac" d="M36.1,36h0.68l-8.04,8.04c-2.62,2.61-6.86,2.61-9.48,0L11.22,36h0.68c1.6,0,3.11-0.62,4.24-1.76	l6.8-6.77c0.59-0.59,1.53-0.59,2.12,0l6.8,6.77C32.99,35.38,34.5,36,36.1,36z"></path>
                                <path fill="#4db6ac" d="M44.04,28.74L38.78,34H36.1c-1.07,0-2.07-0.42-2.83-1.17l-6.8-6.78c-1.36-1.36-3.58-1.36-4.94,0	l-6.8,6.78C13.97,33.58,12.97,34,11.9,34H9.22l-5.26-5.26c-2.61-2.62-2.61-6.86,0-9.48L9.22,14h2.68c1.07,0,2.07,0.42,2.83,1.17	l6.8,6.78c0.68,0.68,1.58,1.02,2.47,1.02s1.79-0.34,2.47-1.02l6.8-6.78C34.03,14.42,35.03,14,36.1,14h2.68l5.26,5.26	C46.65,21.88,46.65,26.12,44.04,28.74z"></path>
                              </svg>
                            </span>
                          )}
                          {order.paymentMethod === 'card' && (

                            <span className="inline-block w-5 h-5 align-middle">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <rect x="2" y="5" width="20" height="14" rx="2" fill="#3b82f6" />
                                <rect x="2" y="8" width="20" height="2" fill="#fff" />
                                <rect x="6" y="16" width="4" height="2" fill="#fff" />
                              </svg>
                            </span>
                          )}
                          {getPaymentMethodLabel(order.paymentMethod)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs flex items-center gap-1 text-gray-400">
                        <Clock size={16} className="text-gray-300" />{formatDate(order.createdAt)}
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
                          className="cursor-pointer px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-md border border-blue-500/30 text-xs font-medium transition-colors"
                          onClick={() => openQrModal(order._id)}
                        >
                          Detalhes
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => {
                              fetchOrderDetails(order._id);
                              setIsOrderModalOpen(true);
                              setIsEditingOrder(true);
                              setEditingOrderId(order._id);
                            }}
                            className="p-1.5 cursor-pointer bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-md border border-teal-500/30 hover:border-teal-500/50 transition-all duration-200 hover:scale-110"
                            title="Editar Pedido"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => confirmPrint(order)}
                            className="p-1.5 cursor-pointer bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded-md border border-sky-500/30 hover:border-sky-500/50 transition-all duration-200 hover:scale-110"
                            title="Imprimir"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setOrderIdToDelete(order._id);
                              setIsDeleteConfirmOpen(true);
                            }}
                            className="p-1.5 cursor-pointer bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-md border border-red-500/30 hover:border-red-500/50 transition-all duration-200 hover:scale-110"
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


        {/* Pagination Controls */}
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
                className="cursor-pointer flex items-center gap-1 px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 rounded-md border border-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                <ChevronLeft size={16} />
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="cursor-pointer flex items-center gap-1 px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 rounded-md border border-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                Próximo
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Modal Detalhes do Pedido */}
        {qrOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-3xl bg-[#24292D]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-white/10 flex-shrink-0">
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <ShoppingCart size={22} /> Detalhes do Pedido #{qrOrder._id.substring(qrOrder._id.length - 6)}
                  </h2>
                  <button
                    className="p-2 cursor-pointer text-gray-400 hover:text-white transition-colors z-10 bg-white/5 hover:bg-white/10 rounded-xl"
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
                  className="px-4 py-2 cursor-pointer rounded-lg border border-gray-500 hover:bg-gray-700/50 transition-colors text-sm text-gray-300 flex items-center gap-2 disabled:opacity-50"
                >
                  <Printer size={16} /> Imprimir
                </button>
                <button
                  className="px-4 py-2 cursor-pointer bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-medium transition-colors"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-5xl bg-gradient-to-br from-[#23272F] via-[#24292D]/95 to-[#3B82F6]/10 rounded-2xl border-2 border-blue-400/40 shadow-2xl overflow-hidden flex flex-col animate-modalIn">
              {/* Header */}
              <div className="flex items-center gap-3 p-6 border-b border-blue-400/20 bg-gradient-to-r from-blue-600/20 to-transparent shadow-lg">
                <div className="p-2 bg-blue-500/30 rounded-xl border border-blue-400/40">
                  <ShoppingBasket size={32} className="text-blue-300" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white drop-shadow">Novo Pedido</h2>
                  <p className="text-gray-300 mt-1 text-sm">Crie um novo pedido para um cliente.</p>
                </div>
                <button
                  className="cursor-pointer absolute top-6 right-6 p-2 text-gray-400 hover:text-white transition-colors z-10 bg-white/5 hover:bg-white/10 rounded-xl"
                  onClick={() => {
                    setIsOrderModalOpen(false);
                    setCustomerEmail("");
                    setSelectedProducts([]);
                    setPaymentMethod("");
                    setModalSearchTerm("");
                    setIsEditingOrder(false);
                    setEditingOrderId(null);
                  }}
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
              {/* Formulário */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateOrder();
                }}
                className="p-8 flex-grow overflow-y-auto space-y-8 max-h-[70vh] flex gap-8"
              >
                {/* Coluna Esquerda */}
                <div className="flex-1 space-y-6">


                  {/* Grupo: Produtos */}
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">
                      Adicionar Produtos
                    </label>
                    <input
                      type="text"
                      placeholder="Digite ou escaneie o código de barras..."
                      value={modalSearchTerm}
                      onChange={(e) => {
                        const input = e.target.value.trim();
                        setModalSearchTerm(input);

                        // Verifica se o código de barras corresponde a algum produto
                        const product = products.find((p) => p.barcode === input);
                        if (product) {
                          // Verifica se o produto já está no carrinho
                          const alreadyInCart = selectedProducts.some((p) => p._id === product._id);
                          if (!alreadyInCart) {
                            setSelectedProducts((prev) => [...prev, { ...product, quantity: 1 }]);
                            // Remove o produto da lista de produtos disponíveis
                            setProducts((prev) => prev.filter((p) => p._id !== product._id));
                          }
                          setModalSearchTerm(""); // Limpa o campo de entrada
                        }
                      }}
                      className="w-full px-3 py-2 bg-[#2F363E]/80 border border-blue-400/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/40 transition-all text-sm mb-2"
                      disabled={!selectedStore || loadingProducts}
                    />
                    <div className="max-h-40 overflow-y-auto border border-blue-400/10 rounded-md bg-[#2F363E]/50">
                      {loadingProducts && (
                        <p className="text-gray-400 p-3 text-center text-sm">
                          Carregando produtos...
                        </p>
                      )}
                      {!loadingProducts && products.length === 0 && selectedStore && (
                        <p className="text-gray-400 p-3 text-sm">
                          Nenhum produto encontrado para esta loja.
                        </p>
                      )}
                      {!loadingProducts && !selectedStore && (
                        <p className="text-gray-400 p-3 text-sm ">
                          Selecione uma loja para ver os produtos.
                        </p>
                      )}
                      {products
                        .filter((product) => (typeof product.quantity === "number" ? product.quantity > 0 : true))
                        .map((product) => (
                          <div
                            key={product._id}
                            className="flex justify-between items-center px-3 py-2 hover:bg-blue-500/10 cursor-pointer border-b border-white/5 last:border-b-0 text-sm"
                            onClick={() => {
                              const alreadyInCart = selectedProducts.some((p) => p._id === product._id);
                              if (!alreadyInCart) {
                                setSelectedProducts((prev) => [
                                  ...prev,
                                  {
                                    ...product,
                                    quantity: 1,
                                    originalQuantity: product.quantity, // Salva o estoque original
                                  },
                                ]);
                                setProducts((prev) => prev.filter((p) => p._id !== product._id));
                              }
                            }}
                          >
                            <span className="text-gray-200">{product.name}</span>
                            <span className="text-gray-300">
                              {formatCurrency(product.priceBRL)}
                              <span className="ml-2 text-xs text-blue-400">
                                {typeof product.quantity === "number" ? `Estoque: ${product.quantity}` : ""}
                              </span>
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Coluna Direita */}
                <div className="flex-1 bg-[#2F363E]/70 rounded-lg p-4 border border-blue-400/20">
                  <h4 className="text-lg font-semibold text-white mb-4">Carrinho de Compras</h4>
                  {selectedProducts.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {selectedProducts.map((product, index) => (
                        <div key={`${product._id}-${index}`} className="flex justify-between items-center px-3 py-2 bg-[#24292D]/70 rounded-lg text-sm">
                          <span className="truncate max-w-[50%] text-gray-200">{product.name}</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max={product.originalQuantity || 1} // Corrigido: usa o estoque original
                              value={product.quantity || 1}
                              onChange={(e) => {
                                const newQuantity = Math.min(
                                  parseInt(e.target.value, 10),
                                  product.originalQuantity || 1
                                );
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
                  ) : (
                    <p className="text-gray-400 text-sm">Nenhum produto no carrinho.</p>
                  )}
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="text-right font-semibold text-lg text-white">
                      Total: {formatCurrency(calculateTotal())}
                    </p>
                  </div>
                </div>
              </form>
              {/* Footer */}
              <div className="flex justify-end gap-3 p-6 border-t border-blue-400/10 bg-gradient-to-t from-[#23272F] via-[#24292D]/90 to-transparent">
                <button
                  type="button"
                  onClick={() => {
                    if (!isEditingOrder) {
                      setProducts((prev) => [...prev, ...selectedProducts]);
                    }
                    setIsOrderModalOpen(false);
                    setCustomerEmail("");
                    setSelectedProducts([]);
                    setPaymentMethod("");
                    setModalSearchTerm("");
                    setIsEditingOrder(false);
                    setEditingOrderId(null);
                  }}
                  className="px-5 py-2 cursor-pointer bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30 hover:border-red-500/50 font-medium transition-all duration-200 hover:scale-105 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => setIsOrderConfirmationOpen(true)}
                  className="px-5 py-2 cursor-pointer bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg text-sm"
                  disabled={selectedProducts.length === 0 || !selectedStore}
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
                    className="flex-1 cursor-pointer rounded-lg py-2 font-semibold transition-colors bg-gray-600 hover:bg-gray-700 text-white text-sm"
                    onClick={() => {
                      setIsDeleteConfirmOpen(false);
                      setOrderIdToDelete(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="cursor-pointer flex-1 rounded-lg py-2 font-semibold transition-colors bg-red-600 hover:bg-red-700 text-white text-sm"
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

                  className="w-full cursor-pointer rounded-lg py-2 font-semibold transition-colors bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
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
                  className="w-full cursor-pointer rounded-lg py-2 font-semibold transition-colors bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                  onClick={() => setIsOrderSuccessOpen(false)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmação de pedido */}
        {isOrderConfirmationOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-lg bg-[#2F363E]/95 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <h2 className="text-xl font-bold text-white">Confirmar Pedido</h2>
                <p className="text-gray-400 mt-1 text-sm">Revise os detalhes do pedido antes de confirmar.</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <h4 className="text-md font-semibold text-gray-300">Loja:</h4>
                  <p className="text-white">{selectedStore}</p>
                </div>
                <div>
                  <h4 className="text-md font-semibold text-gray-300">Cliente:</h4>
                  <input
                    type="email"
                    className="w-full px-3 py-2 bg-[#2F363E]/80 border border-blue-400/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/40 transition-all text-sm"
                    value={customerEmail}
                    onChange={e => setCustomerEmail(e.target.value)}
                    placeholder="cliente@email.com"
                  />
                </div>
                <div>
                  <h4 className="text-md font-semibold text-gray-300">Método de Pagamento <span className="text-blue-400">*</span></h4>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-[#2F363E]/80 border border-blue-400/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/40 transition-all text-sm"
                    required
                  >
                    <option value="">Selecione um método</option>
                    <option value="bch">Bitcoin Cash</option>
                    <option value="pix">PIX</option>
                    <option value="card">Cartão</option>
                  </select>
                </div>
                <div>
                  <h4 className="text-md font-semibold text-gray-300">Itens do Pedido:</h4>
                  <ul className="space-y-2">
                    {selectedProducts.map((product, index) => (
                      <li key={index} className="text-white">
                        {product.name} - {product.quantity}x ({formatCurrency(product.priceBRL)})
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-md font-semibold text-gray-300">Total:</h4>
                  <p className="text-white">{formatCurrency(calculateTotal())}</p>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-white/10 flex-shrink-0 bg-gradient-to-t from-[#23272F] via-[#24292D]/90 to-transparent">
                <button
                  type="button"
                  onClick={() => setIsOrderConfirmationOpen(false)} // Fecha o modal de confirmação
                  className="px-5 py-2 cursor-pointer bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30 hover:border-red-500/50 font-medium transition-all duration-200 hover:scale-105 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!paymentMethod) {
                      alert("Selecione o método de pagamento.");
                      return;
                    }
                    handleCreateOrder(); // Executa a lógica de criação do pedido
                    setIsOrderConfirmationOpen(false); // Fecha o modal de confirmação
                  }}
                  className="px-5 py-2 cursor-pointer bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg text-sm"
                  disabled={selectedProducts.length === 0 || !selectedStore || !paymentMethod}
                >
                  Confirmar Pedido
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmação de impressão */}
        {isPrintConfirmOpen && orderToPrint && (
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#2F363E] rounded-xl w-full max-w-sm shadow-2xl relative border border-white/10">
              <div className="p-6 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-blue-500/50 bg-blue-500/20">
                  <Printer size={36} className="text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Deseja imprimir este pedido?</h3>
                <p className="text-gray-300 mb-6 text-sm">
                  Pedido #{orderToPrint._id.substring(orderToPrint._id.length - 6)}
                </p>
                <div className="flex gap-3">
                  <button
                    className="flex-1 cursor-pointer rounded-lg py-2 font-semibold transition-colors bg-gray-600 hover:bg-gray-700 text-white text-sm"
                    onClick={() => setIsPrintConfirmOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="cursor-pointer flex-1 rounded-lg py-2 font-semibold transition-colors bg-blue-600 hover:bg-blue-700 text-white text-sm"
                    onClick={() => {
                      handlePrint(orderToPrint);
                      setIsPrintConfirmOpen(false);
                    }}
                  >
                    Imprimir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div >
  );
}