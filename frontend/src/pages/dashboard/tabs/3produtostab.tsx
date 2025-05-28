import { useState, useEffect } from 'react';
import { toast } from 'react-toastify'; // Import toast
import { Edit, Trash2, Plus, Search, ChevronLeft, ChevronRight, ShoppingCart, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { useNotification } from '../../../context/NotificationContext';

export type Product = {
  _id: string;
  name: string;
  description: string;
  priceBRL: number;
  priceBCH: number;
  quantity: number;
  sku: string;
  category: string;
  isActive: boolean;
  createdAt: string;
  store: string;
};

export function ProdutosTab() {
  // ... keep existing code (state declarations)
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0); // Initialize with 0
  const [totalFilteredProductsCount, setTotalFilteredProductsCount] = useState<number>(0);
  const itemsPerPage = 8; // Revertendo para 8 para caber mais na tela, ou manter 10 e ajustar mais
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priceBRL: 0,
    priceBCH: 0,
    quantity: 0,
    sku: '',
    category: 'outros',
    isActive: true,
    store: '',
    minimum: 1,
  });

  // State for custom modals
  const [isActionModalOpen, setIsActionModalOpen] = useState<boolean>(false);
  const [modalContent, setModalContent] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info'; icon?: React.ReactNode }>({ title: '', message: '', type: 'info' });

  // State for delete confirmation modal
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState<boolean>(false);
  const [productToDeleteId, setProductToDeleteId] = useState<string | null>(null);

  const { addNotification } = useNotification();

  const categories = [
    { value: 'alimentos', label: 'Alimentos' },
    { value: 'bebidas', label: 'Bebidas' },
    { value: 'eletronicos', label: 'Eletrônicos' },
    { value: 'vestuario', label: 'Vestuário' },
    { value: 'servicos', label: 'Serviços' },
  ];

  // ... keep existing code (useEffect for fetchProducts)
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        // 1. Fetch ALL products from the API
        const response = await fetch('http://localhost:3000/api/products'); 

        if (!response.ok) {
          throw new Error('Erro ao buscar produtos');
        }

        const data = await response.json();

        // 2. Apply filters (searchTerm, selectedCategory, selectedStore)
        const filteredProducts = data.filter((product: Product) => {
          const matchesCategory = 
            selectedCategory === 'all' || product.category === selectedCategory;
          const matchesSearch =
            searchTerm === '' ||
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.sku.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesStore =
            selectedStore === 'all' || product.store === selectedStore;

          return matchesCategory && matchesSearch && matchesStore;
        });

        // 3. Calculate total pages and count based on filtered products
        setTotalFilteredProductsCount(filteredProducts.length);
        setTotalPages(Math.ceil(filteredProducts.length / itemsPerPage));

        // 4. Paginate the filtered products
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
        setProducts(paginatedProducts);
        setError(null);
      } catch (err) {
        console.error('[ERROR] Erro ao carregar produtos:', err);
        setError('Erro ao carregar produtos');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [currentPage, searchTerm, selectedCategory, selectedStore, addNotification, itemsPerPage]);

  // ... keep existing code (form handlers)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked :
        type === 'number' ? parseFloat(value) || 0 :
          value
    }));

    if (name === 'priceBRL') {
      const brlValue = parseFloat(value) || 0;
      setFormData(prev => ({
        ...prev,
        priceBCH: brlValue * 0.0001
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Payload being sent:', formData);
    try {
      const method = currentProduct ? 'PUT' : 'POST';
      const url = currentProduct
        ? `http://localhost:3000/api/products/${currentProduct._id}`
        : 'http://localhost:3000/api/products';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        throw new Error('Erro ao salvar produto');
      }

      const savedProduct = await response.json();
      if (currentProduct) {
        setProducts(prev =>
          prev.map(p => (p._id === savedProduct._id ? savedProduct : p))
        );
        setModalContent({
          title: 'Produto Atualizado!',
          message: 'As alterações no produto foram salvas com sucesso.',
          type: 'success',
          icon: <CheckCircle size={48} className="text-teal-400" />
        });
        setIsActionModalOpen(true);
      } else {
        setProducts(prev => [savedProduct, ...prev]);
        setModalContent({
          title: 'Novo Produto Criado!',
          message: 'O produto foi adicionado com sucesso ao seu Estoque.',
          type: 'success',
          icon: <CheckCircle size={48} className="text-teal-400" />
        });
        setIsActionModalOpen(true);
      }

      resetForm();
    } catch (err) {
      // Use toast.error directly for typed error notifications
      toast.error(`Erro ao salvar produto: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      priceBRL: 0,
      priceBCH: 0,
      quantity: 0,
      sku: '',
      category: 'outros',
      isActive: true,
      store: '',
      minimum: 1,
    });
    setCurrentProduct(null);
    setIsFormOpen(false);
  };

  const handleEdit = (product: Product) => {
    setCurrentProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      priceBRL: product.priceBRL,
      priceBCH: product.priceBCH,
      quantity: product.quantity,
      sku: product.sku,
      category: product.category,
      isActive: product.isActive,
      store: product.store,
      minimum: 1,
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (productId: string) => {
    setProductToDeleteId(productId);
    setIsDeleteConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDeleteId) return;

    try {
      const response = await fetch(`http://localhost:3000/api/products/${productToDeleteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro ao excluir produto no servidor:', errorData);
        throw new Error('Erro ao excluir produto no servidor.');
      }

      setProducts(prev => prev.filter(p => p._id !== productToDeleteId));
      setModalContent({
        title: 'Produto Excluído!',
        message: 'O produto foi removido com sucesso do seu inventário.',
        type: 'success',
        icon: <Trash2 size={48} className="text-green-400" />
      });
      setIsActionModalOpen(true);
      console.log('Produto excluído com sucesso.');
    } catch (err) {
      // Use toast.error directly for typed error notifications
      toast.error(`Erro ao excluir produto: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setIsDeleteConfirmModalOpen(false);
      setProductToDeleteId(null);
    }
  };

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
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="bg-gradient-to-br from-[#1E2328] via-[#24292D] to-[#2B3036] min-h-screen">
      <div className="container mx-auto px-4 py-6">
        
        {/* Enhanced Hero Section */}
        <div className="relative overflow-hidden mb-10">
          <div
            className="relative p-6 text-white text-center rounded-3xl shadow-2xl backdrop-blur-xl border border-white/10"
            style={{
              background: `
                radial-gradient(circle at 20% 50%, rgba(26, 194, 166, 0.3) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(6, 85, 70, 0.4) 0%, transparent 50%),
                linear-gradient(135deg, rgba(26, 194, 166, 0.1) 0%, rgba(6, 85, 70, 0.2) 100%)
              `,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-teal-400/20 to-teal-600/20 rounded-xl backdrop-blur-sm border border-teal-400/30">
                  <ShoppingCart size={36} className="text-teal-300" />
                </div>
                <div className="text-left">
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-teal-200 bg-clip-text text-transparent">
                    Dashboard de Produtos
                  </h1>
                  <p className="text-base text-teal-100/80">Gestão inteligente do seu inventário</p>
                </div>
              </div>

              {/* Enhanced Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                <div className="group p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl backdrop-blur-sm border border-emerald-400/20 hover:border-emerald-400/40 transition-all duration-300 hover:scale-105">
                  <div className="text-2xl font-bold text-emerald-300 mb-1">
                    {products.filter(p => p.quantity >= 30).length}
                  </div>
                  <div className="text-xs text-emerald-200/80 font-medium">Alto Estoque</div>
                  <div className="text-[11px] text-emerald-100/60 mt-0.5">30+ unidades</div>
                </div>
                
                <div className="group p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl backdrop-blur-sm border border-blue-400/20 hover:border-blue-400/40 transition-all duration-300 hover:scale-105">
                  <div className="text-2xl font-bold text-blue-300 mb-1">
                    {products.filter(p => p.quantity >= 16 && p.quantity <= 29).length}
                  </div>
                  <div className="text-xs text-blue-200/80 font-medium">Médio Estoque</div>
                  <div className="text-[11px] text-blue-100/60 mt-0.5">16-29 unidades</div>
                </div>
                
                <div className="group p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-xl backdrop-blur-sm border border-amber-400/20 hover:border-amber-400/40 transition-all duration-300 hover:scale-105">
                  <div className="text-2xl font-bold text-amber-300 mb-1">
                    {products.filter(p => p.quantity > 0 && p.quantity <= 15).length}
                  </div>
                  <div className="text-xs text-amber-200/80 font-medium">Baixo Estoque</div>
                  <div className="text-[11px] text-amber-100/60 mt-0.5">1-15 unidades</div>
                </div>
                
                <div className="group p-4 bg-gradient-to-br from-red-500/30 to-red-600/5 rounded-xl backdrop-blur-sm border border-red-400/20 hover:border-red-400/40 transition-all duration-300 hover:scale-105">
                  <div className="text-2xl font-bold text-red-300 mb-1">
                    {products.filter(p => p.quantity === 0).length}
                  </div>
                  <div className="text-xs text-red-200/80 font-medium">Esgotados</div>
                  <div className="text-[11px] text-red-100/60 mt-0.5">0 unidades</div>
                </div>
              </div>

              {/* Enhanced Action Button */}
              <div className="mt-8">
                <button
                  onClick={() => setIsFormOpen(true)}
                  className="group relative px-6 py-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white font-semibold rounded-xl shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl border border-teal-400/30 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md">
                      <Plus size={18} />
                    </div>
                    <span>Novo Produto</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced View Mode Toggle */}
        <div className="flex justify-center mb-6">
          <div className="p-1.5 bg-[#2F363E]/80 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl">
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 text-sm ${
                  viewMode === 'table' 
                    ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg' 
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                Tabela
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 text-sm ${
                  viewMode === 'grid' 
                    ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg' 
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                Cards
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Filters Section */}
        <div className="mb-6">
          <div className="p-6 bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <div className="relative flex-1 max-w-md">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Buscar produtos, SKU..."
                  className="w-full pl-10 pr-3 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-all text-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              
              <div className="flex gap-4">
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-all min-w-[150px] text-sm"
                >
                  <option value="all">Todas categorias</option>
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
                
                <select
                  value={selectedStore}
                  onChange={(e) => {
                    setSelectedStore(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-all min-w-[150px] text-sm"
                >
                  <option value="all">Todas as lojas</option>
                  <option value="Loja A">Loja A</option>
                  <option value="Loja B">Loja B</option>
                  <option value="Loja C">Loja C</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Products Content */}
        {viewMode === 'table' ? (
          <div className="bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
            {loading ? ( // Reduced padding for loading/error/empty states
              <div className="p-8 text-center">
                <div className="inline-flex items-center gap-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent"></div>
                  <span className="text-white font-medium">Carregando produtos...</span>
                </div>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <div className="text-red-400 font-medium">{error}</div>
              </div>
            ) : products.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400">Nenhum produto encontrado</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#24292D]/80 backdrop-blur-sm border-b border-white/10">
                    <tr className="text-xs">
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Produto</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Preço</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Estoque</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Categoria</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Loja</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-300 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {products.map((product) => {
                      let estoqueClass = '';
                      let estoqueLabel = '';
                      if (product.quantity >= 30) {
                        estoqueLabel = 'Alto';
                        estoqueClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
                      } else if (product.quantity >= 16) {
                        estoqueLabel = 'Médio';
                        estoqueClass = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
                      } else if (product.quantity > 0) {
                        estoqueLabel = 'Baixo';
                        estoqueClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                      } else {
                        estoqueLabel = 'Esgotado';
                        estoqueClass = 'bg-red-500/20 text-red-300 border-red-500/30';
                      }

                      return (
                        <tr key={product._id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-sm text-white font-medium">{product.name}</div>
                            <div className="text-xs text-gray-400">SKU: {product.sku}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-white font-medium">R$ {product.priceBRL.toFixed(2)}</div>
                            <div className="text-xs text-gray-400">{product.priceBCH.toFixed(6)} BCH</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border ${estoqueClass}`}>
                              {product.quantity} un. - {estoqueLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border ${
                              product.isActive
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-red-500/20 text-red-300 border-red-500/30'
                            }`}>
                              {product.isActive ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-300">
                              {categories.find(c => c.value === product.category)?.label || 'Outros'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-300">{product.store}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleEdit(product)}
                                className="p-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-md border border-teal-500/30 hover:border-teal-500/50 transition-all duration-200 hover:scale-110"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(product._id)}
                                className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-md border border-red-500/30 hover:border-red-500/50 transition-all duration-200 hover:scale-110"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product) => {
              let estoqueClass = '';
              let estoqueLabel = '';
              if (product.quantity >= 30) {
                estoqueLabel = 'Alto';
                estoqueClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
              } else if (product.quantity >= 16) {
                estoqueLabel = 'Médio';
                estoqueClass = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
              } else if (product.quantity > 0) {
                estoqueLabel = 'Baixo';
                estoqueClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
              } else {
                estoqueLabel = 'Esgotado';
                estoqueClass = 'bg-red-500/20 text-red-300 border-red-500/30';
              }

              return (
                <div
                  key={product._id}
                  className="group p-4 bg-[#2F363E]/60 backdrop-blur-xl rounded-xl border border-white/10 hover:border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-base font-semibold text-white truncate flex-1 mr-2">{product.name}</h3>
                    <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-medium border flex-shrink-0 ${
                      product.isActive 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                        : 'bg-red-500/20 text-red-300 border-red-500/30'
                    }`}>
                      {product.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  
                  <div className="mb-3">
                    <div className="text-lg font-bold text-white">R$ {product.priceBRL.toFixed(2)}</div>
                    <div className="text-xs text-gray-400">{product.priceBCH.toFixed(6)} BCH</div>
                  </div>

                  <div className="mb-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border ${estoqueClass}`}>
                      {product.quantity} un. - {estoqueLabel}
                    </span>
                  </div>

                  <div className="text-xs text-gray-400 mb-4 space-y-0.5">
                    <div>SKU: {product.sku}</div>
                    <div>Categoria: {categories.find(c => c.value === product.category)?.label || 'Outros'}</div>
                    <div>Loja: {product.store}</div>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleEdit(product)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-lg border border-teal-500/30 hover:border-teal-500/50 font-medium transition-all duration-200 hover:scale-105 text-xs"
                    >
                      <Edit size={14} />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(product._id)}
                      className="flex items-center justify-center p-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30 hover:border-red-500/50 transition-all duration-200 hover:scale-105"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls - Placed after both view modes */}
        {!loading && !error && totalFilteredProductsCount > 0 && (
          <div className="mt-6 flex items-center justify-between px-4 py-3 bg-[#2F363E]/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl">
            <div>
              <p className="text-xs text-gray-300">
                Página <span className="font-semibold text-white">{currentPage}</span> de <span className="font-semibold text-white">{totalPages}</span>
              </p>
              <p className="text-[11px] text-gray-400">
                Mostrando{' '}
                <span className="font-medium text-gray-200">
                  {Math.min((currentPage - 1) * itemsPerPage + 1, totalFilteredProductsCount)}
                </span>
                {' - '}
                <span className="font-medium text-gray-200">
                  {Math.min(currentPage * itemsPerPage, totalFilteredProductsCount)}
                </span>
                {' de '}
                <span className="font-medium text-gray-200">{totalFilteredProductsCount}</span> produtos
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

        {/* Enhanced Form Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl bg-[#24292D]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
              <button
                className="absolute top-6 right-6 p-2 text-gray-400 hover:text-white transition-colors z-10 bg-white/5 hover:bg-white/10 rounded-xl"
                onClick={resetForm}
                aria-label="Fechar"
              >
                ×
              </button>
              
              <div className="p-6 border-b border-white/10">
                <h2 className="text-xl font-bold text-white">
                  {currentProduct ? 'Editar Produto' : 'Novo Produto'}
                </h2>
                <p className="text-gray-400 mt-1 text-sm">
                  {currentProduct ? 'Atualize as informações do produto' : 'Adicione um novo produto ao inventário'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="p-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ... keep existing code (form fields with enhanced styling) */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">Nome *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-all text-sm"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Descrição</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={2}
                      className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-all resize-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">Preço (BRL) *</label>
                    <input
                      type="number"
                      name="priceBRL"
                      value={formData.priceBRL}
                      onChange={handleInputChange}
                      min="0.01"
                      step="0.01"
                      className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-all text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Preço (BCH)</label>
                    <input
                      type="number"
                      name="priceBCH"
                      value={formData.priceBCH}
                      onChange={handleInputChange}
                      min="0.000001"
                      step="0.000001"
                      className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-all opacity-60 text-sm"
                      disabled
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">Quantidade *</label>
                    <input
                      type="number"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-all text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">SKU *</label>
                    <input
                      type="text"
                      name="sku"
                      value={formData.sku}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-all text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">Categoria *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-all text-sm"
                    >
                      {categories.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">Loja *</label>
                    <select
                      name="store"
                      value={formData.store}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-all text-sm"
                      required
                    >
                      <option value="">Selecione uma loja</option>
                      <option value="Loja A">Loja A</option>
                      <option value="Loja B">Loja B</option>
                      <option value="Loja C">Loja C</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isActive"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleInputChange}
                      className="h-3.5 w-3.5 text-teal-600 rounded bg-[#2F363E] border-white/20 focus:ring-teal-500 focus:ring-offset-0"
                    />
                    <label htmlFor="isActive" className="ml-2 text-xs text-gray-300">
                      Produto Ativo
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30 hover:border-red-500/50 font-medium transition-all duration-200 hover:scale-105 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg text-sm"
                  >
                    {currentProduct ? 'Atualizar' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Action Feedback Modal */}
        {isActionModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#2F363E] rounded-xl w-full max-w-sm shadow-2xl relative border border-white/10">
              <div className="p-6 text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-2 ${
                  modalContent.type === 'success' ? 'bg-teal-500/20 border-teal-500/50' : 
                  modalContent.type === 'error' ? 'bg-red-500/20 border-red-500/50' : 
                  'bg-blue-500/20 border-blue-500/50' 
                }`}>
                  {modalContent.icon || (modalContent.type === 'success' ? <CheckCircle size={48} className="text-teal-400" /> : <Info size={48} className="text-blue-400" />)}
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2">{modalContent.title}</h3>
                <p className="text-gray-300 mb-6 text-sm">
                  {modalContent.message}
                </p>
                
                <button
                  className={`w-full rounded-lg py-2 font-semibold transition-colors text-sm ${
                    modalContent.type === 'success' ? 'bg-teal-600 hover:bg-teal-700 text-white' :
                    modalContent.type === 'error' ? 'bg-red-600 hover:bg-red-700 text-white' :
                    'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                  onClick={() => setIsActionModalOpen(false)}
                >
                  Ok, Entendi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteConfirmModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#2F363E] rounded-xl w-full max-w-sm shadow-2xl relative border border-white/10">
              <div className="p-6 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-500/50 bg-red-500/20">
                  <AlertTriangle size={36} className="text-red-400" />
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2">Confirmar Exclusão</h3>
                <p className="text-gray-300 mb-6 text-sm">
                  Tem certeza que deseja excluir este produto? Esta ação não poderá ser desfeita.
                </p>
                
                <div className="flex gap-3">
                  <button
                    className="flex-1 rounded-lg py-2 font-semibold transition-colors bg-gray-600 hover:bg-gray-700 text-white text-sm"
                    onClick={() => {
                      setIsDeleteConfirmModalOpen(false);
                      setProductToDeleteId(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="flex-1 rounded-lg py-2 font-semibold transition-colors bg-red-600 hover:bg-red-700 text-white text-sm"
                    onClick={confirmDelete}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
