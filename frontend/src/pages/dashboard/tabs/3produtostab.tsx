import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Tags, Bitcoin, Tag, Edit, Baby, Zap, Glasses, Drill, Printer, MonitorSmartphone, GlassWater, Ham, Beer, BeerOff, Barcode, Trash2, Plus, Search, DollarSign, ChevronLeft, ChevronRight, Mars, CircleX, Package, ChartNoAxesCombined, AlignJustify, CheckCircle, AlertTriangle, Info, Utensils, Coffee, Smartphone, Shirt, Wrench, CupSoda, Settings, Apple, Snowflake, Truck, Monitor, Tv, Venus, Candy, Store } from 'lucide-react';
import { useNotification } from '../../../context/NotificationContext';
import { Listbox } from '@headlessui/react';

export type Product = {
  _id: string;
  name: string;
  priceBRL: number;
  priceBCH: number;
  quantity: number;
  sku: string;
  category: string;
  subcategory: string;
  store: string;
  createdAt: string;
};

export function ProdutosTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [totalFilteredProductsCount, setTotalFilteredProductsCount] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState<boolean>(false);
  const [modalContent, setModalContent] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info'; icon?: React.ReactNode }>({ title: '', message: '', type: 'info' });
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState<boolean>(false);
  const [productToDeleteId, setProductToDeleteId] = useState<string | null>(null);
  const [isUpdateConfirmModalOpen, setIsUpdateConfirmModalOpen] = useState<boolean>(false);
  const { addNotification } = useNotification();
  const itemsPerPage = 8;
  const [formData, setFormData] = useState({
    name: '',
    priceBRL: 0,
    priceBCH: 0,
    quantity: 0,
    sku: '',
    category: '',
    subcategory: '',
    store: '',
    minimum: 1,
  });
  const categories = [
    { value: 'alimentos', label: 'Alimentos', icon: <Utensils size={14} className="inline mr-1 text-gray-300" /> },
    { value: 'bebidas', label: 'Bebidas', icon: <Coffee size={16} className="inline mr-1 text-gray-300" /> },
    { value: 'eletronicos', label: 'Eletrônicos', icon: <MonitorSmartphone size={16} className="inline mr-1 text-gray-300" /> },
    { value: 'vestuario', label: 'Vestuário', icon: <Shirt size={16} className="inline mr-1 text-gray-300" /> },
    { value: 'servicos', label: 'Serviços', icon: <Wrench size={16} className="inline mr-1 text-gray-300" /> },
  ];
  const stores = [
    { value: 'all', label: 'Todas as Lojas', icon: <AlignJustify size={16} className="inline mr-1 text-gray-300" /> },
    { value: 'Loja A', label: 'Loja A', icon: <Store size={16} className="inline mr-1 text-gray-300" /> },
    { value: 'Loja B', label: 'Loja B', icon: <Store size={16} className="inline mr-1 text-gray-300" /> },
    { value: 'Loja C', label: 'Loja C', icon: <Store size={16} className="inline mr-1 text-gray-300" /> },
  ];
  // Ícones para subcategorias
function getSubcategoryIcon(category: string, subcategory: string) {
  if (category === 'alimentos') {
    if (subcategory === 'Doces') return <Candy size={14} className="text-gray-300" />;
    if (subcategory === 'Salgados') return <Ham size={14} className="text-gray-300" />;
    if (subcategory === 'Orgânicos') return <Apple size={14} className="text-gray-300" />;
    if (subcategory === 'Congelados') return <Snowflake size={14} className="text-gray-300" />;
  }
  if (category === 'bebidas') {
    if (subcategory === 'Alcoólica') return <Beer size={14} className="text-gray-300" />;
    if (subcategory === 'Não alcoólica') return <BeerOff size={14} className="text-gray-300" />;
    if (subcategory === 'Refrigerante') return <CupSoda size={14} className="text-gray-300" />;
    if (subcategory === 'Suco') return <GlassWater size={14} className="text-gray-300" />;
    if (subcategory === 'Energético') return <Zap size={14} className="text-gray-300" />;
  }
  if (category === 'eletronicos') {
    if (subcategory === 'Celular') return <Smartphone size={14} className="text-gray-300" />;
    if (subcategory === 'Notebook') return <Monitor size={14} className="text-gray-300" />;
    if (subcategory === 'Impressora') return <Printer size={14} className="text-gray-300" />;
    if (subcategory === 'TV') return <Tv size={14} className="text-gray-300" />;
  }
  if (category === 'vestuario') {
    if (subcategory === 'Masculino') return <Mars size={14} className="text-gray-300" />;
    if (subcategory === 'Feminino') return <Venus size={14} className="text-gray-300" />;
    if (subcategory === 'Infantil') return <Baby size={14} className="text-gray-300" />;
    if (subcategory === 'Acessórios') return <Glasses size={14} className="text-gray-300" />;
  }
  if (category === 'servicos') {
    if (subcategory === 'Entrega') return <Truck size={14} className="text-gray-300" />;
    if (subcategory === 'Montagem') return <Drill size={14} className="text-gray-300" />;
    if (subcategory === 'Instalação') return <Wrench size={14} className="text-gray-300" />;
  }
  return <Tag size={14} className="text-gray-400" />;
}

// Ícones para lojas
function getStoreIcon(store: string) {
  switch (store) {
    case 'Loja A': return <Store size={16} className="text-teal-400" />;
    case 'Loja B': return <Store size={16} className="text-blue-400" />;
    case 'Loja C': return <Store size={16} className="text-pink-400" />;
    default: return <Store size={16} className="text-gray-400" />;
  }
}
  const subcategoriesMap: Record<string, string[]> = {
    alimentos: ['Doces', 'Salgados', 'Orgânicos', 'Congelados'],
    bebidas: ['Alcoólica', 'Não alcoólica', 'Refrigerante', 'Suco', 'Energético'],
    eletronicos: ['Celular', 'Notebook', 'Impressora', 'TV'],
    vestuario: ['Masculino', 'Feminino', 'Infantil', 'Acessórios'],
    servicos: ['Entrega', 'Montagem', 'Instalação'],
    outros: ['Outro'],
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:3000/api/products');
        if (!response.ok) {
          throw new Error('Erro ao buscar produtos');
        }
        const data = await response.json();
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

        setTotalFilteredProductsCount(filteredProducts.length);
        setTotalPages(Math.ceil(filteredProducts.length / itemsPerPage));

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));

    if (name === 'category') {
      setFormData(prev => ({
        ...prev,
        category: value,
        subcategory: '',
      }));
    }
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
      toast.error(`Erro ao salvar produto: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      priceBRL: 0,
      priceBCH: 0,
      quantity: 0,
      sku: '',
      category: '',
      subcategory: '',
      store: '',
      minimum: 1,
    });
    setCurrentProduct(null);
    setIsFormOpen(false);
  };

  const handleOpenUpdateConfirmModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentProduct) {
      setIsUpdateConfirmModalOpen(true);
    } else {

      toast.error("Nenhum produto selecionado para atualização.");
    }
  };

  const handleEdit = (product: Product) => {
    setCurrentProduct(product);
    setFormData({
      name: product.name,
      priceBRL: product.priceBRL,
      priceBCH: product.priceBCH,
      quantity: product.quantity,
      sku: product.sku,
      category: product.category,
      subcategory: product.subcategory,
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
      toast.error(`Erro ao excluir produto: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setIsDeleteConfirmModalOpen(false);
      setProductToDeleteId(null);
    }
  };

  const handleConfirmUpdate = async (e: React.FormEvent) => {

    setIsUpdateConfirmModalOpen(false);
    await handleSubmit(e);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    // Main Container
    <div className="bg-gradient-to-br from-[#1E2328] via-[#24292D] to-[#2B3036] min-h-screen">
      <div className="container mx-auto px-2 py-2">
        <div className="relative overflow-hidden mb-4">
          <div className="relative p-3 text-white text-center rounded-2xl shadow-xl backdrop-blur-xl border border-white/10"
            style={{
              background: `
                radial-gradient(circle at 20% 50%, rgba(26, 194, 166, 0.3) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(6, 85, 70, 0.4) 0%, transparent 50%),
                linear-gradient(135deg, rgba(26, 194, 166, 0.1) 0%, rgba(6, 85, 70, 0.2) 100%)
              `,
            }}>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-teal-400/20 to-teal-600/20 rounded-xl backdrop-blur-sm border border-teal-400/30">
                  <Package size={36} className="text-teal-300" />
                </div>
                <div className="text-left">
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-teal-200 bg-clip-text text-transparent">
                    Estoque de Produtos
                  </h1>
                  <p className="text-base text-teal-100/80">Gestão inteligente do seu inventário</p>
                </div>
              </div>
              <div className="mt-6 flex justify-center">
                <button
                  id="btn-novo-produto"
                  onClick={() => setIsFormOpen(true)}
                  className="cursor-pointer group relative px-8 py-3 bg-gradient-to-r from-teal-500 via-teal-600 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold rounded-2xl shadow-xl transition-all duration-300 hover:scale-105 border border-teal-400/40 text-base overflow-hidden"
                >
                  <span className="flex items-center gap-2 relative z-10">
                    <Plus size={20} />
                    <span>Novo Produto</span>
                  </span>
                  <span className="absolute left-0 top-0 w-full h-full rounded-2xl bg-gradient-to-r from-white/10 via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none animate-shine" />
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* Estatísticas de Estoque*/}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Alto Estoque */}
          <div className="group relative overflow-hidden p-5 bg-gradient-to-br from-emerald-700/20 via-emerald-500/10 to-emerald-400/5 rounded-2xl border border-emerald-400/30 shadow-xl hover:shadow-2xl hover:border-emerald-400/60 transition-all duration-300 hover:scale-[1.03]">
            <div className="absolute -top-4 -right-4 opacity-20 group-hover:opacity-30 transition">
              <ChartNoAxesCombined size={64} className="text-emerald-400" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl font-bold text-emerald-300 drop-shadow">{products.filter(p => p.quantity >= 30).length}</span>
              <span className="text-lg text-emerald-200 font-semibold">Produtos</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-200 font-medium">
              <ChartNoAxesCombined size={18} className="inline" /> Alto Estoque
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-emerald-300">
              🟢 30+ unidades
            </div>
          </div>
          {/* Médio Estoque */}
          <div className="group relative overflow-hidden p-5 bg-gradient-to-br from-blue-700/20 via-blue-500/10 to-blue-400/5 rounded-2xl border border-blue-400/30 shadow-xl hover:shadow-2xl hover:border-blue-400/60 transition-all duration-300 hover:scale-[1.03]">
            <div className="absolute -top-4 -right-4 opacity-20 group-hover:opacity-30 transition">
              <AlignJustify size={64} className="text-blue-400" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl font-bold text-blue-300 drop-shadow">{products.filter(p => p.quantity >= 16 && p.quantity <= 29).length}</span>
              <span className="text-lg text-blue-200 font-semibold">Produtos</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-blue-200 font-medium">
              <AlignJustify size={18} className="inline" /> Médio Estoque
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-blue-300">
              🔵 16-29 unidades
            </div>
          </div>
          {/* Baixo Estoque */}
          <div className="group relative overflow-hidden p-5 bg-gradient-to-br from-amber-700/20 via-amber-500/10 to-amber-400/5 rounded-2xl border border-amber-400/30 shadow-xl hover:shadow-2xl hover:border-amber-400/60 transition-all duration-300 hover:scale-[1.03]">
            <div className="absolute -top-4 -right-4 opacity-20 group-hover:opacity-30 transition">
              <AlertTriangle size={64} className="text-amber-400" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl font-bold text-amber-300 drop-shadow">{products.filter(p => p.quantity > 0 && p.quantity <= 15).length}</span>
              <span className="text-lg text-amber-200 font-semibold">Produtos</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-amber-200 font-medium">
              <AlertTriangle size={18} className="inline" /> Baixo Estoque
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-amber-300">
              🟡 1-15 unidades
            </div>
          </div>
          {/* Esgotados */}
          <div className="group relative overflow-hidden p-5 bg-gradient-to-br from-red-700/20 via-red-500/10 to-red-400/5 rounded-2xl border border-red-400/30 shadow-xl hover:shadow-2xl hover:border-red-400/60 transition-all duration-300 hover:scale-[1.03]">
            <div className="absolute -top-4 -right-4 opacity-20 group-hover:opacity-30 transition">
              <CircleX size={64} className="text-red-400" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl font-bold text-red-300 drop-shadow">{products.filter(p => p.quantity === 0).length}</span>
              <span className="text-lg text-red-200 font-semibold">Produtos</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-red-200 font-medium">
              <CircleX size={18} className="inline" /> Esgotados
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-red-300">
              🔴 0 unidades
            </div>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex justify-center mb-4.5">
          <div className="p-1.5  bg-[#2F363E]/80 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl">
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('table')}
                className={`cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-300 text-base ${viewMode === 'table'
                  ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
              >
                Tabelas
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-300 text-base ${viewMode === 'grid'
                  ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
              >
                Cards
              </button>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="mb-3">
          <div className="p-3 bg-[#2F363E]/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl relative z-10">
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <div className="relative flex-1 max-w-md">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Buscar produtos..."
                  className="w-full pl-10 pr-3 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-all text-base"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <div className="flex gap-4">
                {/* Categoria Listbox */}
                <Listbox value={selectedCategory} onChange={(value) => { setSelectedCategory(value); setCurrentPage(1); }}>
                  <div className="relative min-w-[180px]">
                    <Listbox.Button className="cursor-pointer flex items-center gap-2 px-4 py-3 bg-[#24292D]/80 backdrop-blur-sm border hover:bg-[#2d3338] border-white/10 rounded-xl text-white transition-all text-base w-full text-left whitespace-nowrap truncate">
                      {selectedCategory === 'all'
                        ? <AlignJustify size={16} className="text-gray-400" />
                        : categories.find(c => c.value === selectedCategory)?.icon}
                      {selectedCategory === 'all'
                        ? 'Todas Categorias'
                        : categories.find(c => c.value === selectedCategory)?.label || 'Outros'}
                    </Listbox.Button>
                    <Listbox.Options className="text-white absolute w-full bg-[#24292D] border border-white/10 rounded-xl shadow-lg z-20">
                      <Listbox.Option
                        value="all"
                        className="px-4 py-2 bg-[#24292D] hover:bg-[#2d3338] rounded-t-xl cursor-pointer whitespace-nowrap text-base"
                      >
                        <AlignJustify size={16} className="text-gray-400 inline mr-1" /> Todas Categorias
                      </Listbox.Option>
                      {categories.map((cat, idx) => (
                        <Listbox.Option
                          key={cat.value}
                          value={cat.value}
                          className={`px-4 py-2 bg-[#24292D] hover:bg-[#2d3338] cursor-pointer whitespace-nowrap text-base
                            ${idx === categories.length - 1 ? 'rounded-b-xl' : ''}
                          `}
                        >
                          {cat.icon} {cat.label}
                        </Listbox.Option>
                      ))}
                    </Listbox.Options>
                  </div>
                </Listbox>

                {/* Loja Listbox */}
                <Listbox value={selectedStore} onChange={(value) => { setSelectedStore(value); setCurrentPage(1); }}>
                  <div className="relative min-w-[180px]">
                    <Listbox.Button className="cursor-pointer flex items-center gap-2 px-4 py-3 bg-[#24292D]/80 backdrop-blur-sm border hover:bg-[#2d3338] border-white/10 rounded-xl text-white  transition-all text-base w-full text-left whitespace-nowrap truncate">
                      {stores.find(s => s.value === selectedStore)?.icon}
                      {stores.find(s => s.value === selectedStore)?.label || 'Todas Lojas'}
                    </Listbox.Button>
                    <Listbox.Options className="text-white absolute w-full bg-[#24292D] border border-white/10 rounded-xl shadow-lg z-20">
                      {stores.map((store, idx) => (
                        <Listbox.Option
                          key={store.value}
                          value={store.value}
                          className={`px-4 py-2 hover:bg-[#2d3338] cursor-pointer whitespace-nowrap text-base
                            ${idx === 0 ? 'rounded-t-xl' : ''} ${idx === stores.length - 1 ? 'rounded-b-xl' : ''}
                          `}
                        >
                          {store.icon} {store.label}
                        </Listbox.Option>
                      ))}
                    </Listbox.Options>
                  </div>
                </Listbox>
              </div>
            </div>
          </div>
        </div>


        {/* Products Content */}
        {viewMode === 'table' ? (
          <div
            className="bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
            {loading ? (
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
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                        <Package size={14} className="inline mr-1 text-gray-300" /> Produto
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                        <Barcode size={14} className="inline mr-1 text-gray-300 " /> SKU
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                        <DollarSign size={14} className="inline mr-1 text-gray-300" /> Preço
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                        <AlertTriangle size={14} className="inline mr-1 text-gray-300" /> Estoque
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                        <Tag size={14} className="inline mr-1 text-gray-300" /> Categoria
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                        <Tags size={14} className="inline mr-1 text-gray-300" /> Subcategoria
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">
                        <Store size={14} className="inline mr-1 text-gray-300" /> Loja
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-300 uppercase tracking-wider">
                        <Settings size={15} className="inline mr-1 text-gray-300" /> Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {products.map((product) => {
                      let estoqueClass = '';
                      let estoqueLabel = '';
                      let estoqueEmoji = '';
                      if (product.quantity >= 30) {

                        estoqueClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
                        estoqueEmoji = '🟢';
                      } else if (product.quantity >= 16) {

                        estoqueClass = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
                        estoqueEmoji = '🔵';
                      } else if (product.quantity > 0) {

                        estoqueClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                        estoqueEmoji = '🟡';
                      } else {

                        estoqueClass = 'bg-red-500/20 text-red-300 border-red-500/30';
                        estoqueEmoji = '🔴';
                      }

                      return (
                        <tr key={product._id} className="hover:bg-white/5 transition-colors group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Package size={18} className="text-gray-300" />
                              <span className="text-xs text-white">{product.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-white flex items-center gap-1">
                              <Barcode size={18} className="text-gray-300" /> {product.sku}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-xs text-white ">
                              <DollarSign size={18} className="text-green-500" /> {product.priceBRL.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-400 flex items-center gap-1">
                              <Bitcoin size={18} className="text-yellow-400" />{product.priceBCH.toFixed(6)} BCH
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${estoqueClass}`}>
                              <span>{estoqueEmoji}</span>
                              {product.quantity} unidades
                              <span className="ml-1">{estoqueLabel}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1 text-xs text-gray-300">
                              {categories.find(c => c.value === product.category)?.icon}
                              {categories.find(c => c.value === product.category)?.label || 'Outros'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1 text-xs text-gray-300">
                              {getSubcategoryIcon(product.category, product.subcategory)}
                              {product.subcategory}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1 text-xs text-gray-300">
                              {getStoreIcon(product.store)} {product.store}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleEdit(product)}
                                className="p-1.5 cursor-pointer bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-md border border-teal-500/30 hover:border-teal-500/50 transition-all duration-200 hover:scale-110 flex items-center gap-1 "
                                title="Editar"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(product._id)}
                                className="p-1.5 cursor-pointer bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-md border border-red-500/30 hover:border-red-500/50 transition-all duration-200 hover:scale-110 flex items-center gap-1 "
                                title="Excluir"
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
                estoqueLabel = '- Alto';
                estoqueClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
              } else if (product.quantity >= 16) {
                estoqueLabel = '- Médio';
                estoqueClass = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
              } else if (product.quantity > 0) {
                estoqueLabel = '- Baixo';
                estoqueClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
              } else {
                estoqueLabel = '- Esgotado';
                estoqueClass = 'bg-red-500/20 text-red-300 border-red-500/30';
              }

              return (
                <div
                  key={product._id}
                  className="group relative p-5 bg-[#2F363E]/60 rounded-2xl border border-white/10 hover:border-teal-400/40 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.04] overflow-hidden"
                >         
                  <div className="absolute top-4 right-4 opacity-50 group-hover:opacity-70 transition-all pointer-events-none select-none">
                    {categories.find(c => c.value === product.category)?.icon}
                  </div>

                  {/* Nome e SKU */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="p-2 bg-teal-500/20 rounded-lg border border-teal-400/20">
                      <Package size={20} className="text-teal-300" />
                    </span>
                    <h3 className="text-lg font-bold text-white truncate flex-1">{product.name}</h3>
                  </div>

                  {/* Preço */}
                  <div className="mb-3">
                    <div className="text-xl text-white flex items-center gap-1">
                      <DollarSign size={20} className="text-green-400" /> {product.priceBRL.toFixed(2)} BRL
                    </div>
                    <div className="text-xl text-white flex items-center gap-1">
                      <Bitcoin size={20} className="text-amber-400" /> {product.priceBCH.toFixed(6)} BCH
                    </div>
                    <div className="text-sm text-white flex items-center gap-1">
                      <Barcode size={20} className="text-gray-300" /> {product.sku} SKU
                    </div>
                  </div>

                  {/* Estoque */}
                  <div className="mb-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${estoqueClass}`}>
                      {estoqueLabel === 'Alto' && <ChartNoAxesCombined size={14} className="text-emerald-300" />}
                      {estoqueLabel === 'Médio' && <AlignJustify size={14} className="text-blue-300" />}
                      {estoqueLabel === 'Baixo' && <AlertTriangle size={14} className="text-amber-300" />}
                      {estoqueLabel === 'Esgotado' && <CircleX size={14} className="text-red-300" />}
                      {product.quantity} Unidades
                      <span>{estoqueLabel}</span>
                    </span>
                  </div>

                  {/* Categoria, Subcategoria e Loja */}
                  <div className="flex flex-col gap-1 text-xs text-gray-400 mb-4">
                    <div className="flex items-center gap-1">
                      {categories.find(c => c.value === product.category)?.icon}
                      <span>{categories.find(c => c.value === product.category)?.label || 'Outros'}</span>
                      {product.subcategory && (
                        <>
                          <span className="mx-1 text-gray-500">|</span>
                          {getSubcategoryIcon(product.category, product.subcategory)}
                          <span>{product.subcategory}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {getStoreIcon(product.store)}
                      <span>{product.store}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Info size={12} className="text-gray-500" />
                      <span className="text-gray-500">Criado em {formatDate(product.createdAt)}</span>
                    </div>
                  </div>

                  {/* Botões de ação */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="cursor-pointer flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-teal-600/30 to-teal-400/20 hover:from-teal-500 hover:to-teal-400 text-teal-200 rounded-lg border border-teal-400/30 hover:border-teal-400/60 font-medium transition-all duration-200 hover:scale-105 text-xs shadow"
                    >
                      <Edit size={14} />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(product._id)}
                      className="cursor-pointer flex items-center justify-center p-2 bg-gradient-to-r from-red-600/30 to-red-400/20 hover:from-red-500 hover:to-red-400 text-red-300 rounded-lg border border-red-400/30 hover:border-red-400/60 transition-all duration-200 hover:scale-105 shadow"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
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
                className="flex cursor-pointer items-center gap-1 px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 rounded-md border border-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                <ChevronLeft size={16} />
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="flex cursor-pointer items-center gap-1 px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 rounded-md border border-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                Próximo
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Form Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl bg-gradient-to-br from-[#23272F] via-[#24292D]/95 to-[#1EC2A6]/10 rounded-2xl border border-teal-400/30 shadow-2xl overflow-hidden">
              <div className="flex items-center gap-3 p-6 border-b border-white/10 bg-gradient-to-r from-teal-600/10 to-transparent">
                <div className="p-2 bg-teal-500/20 rounded-xl border border-teal-400/30">
                  <Package size={28} className="text-teal-300" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {currentProduct ? 'Editar Produto' : 'Novo Produto'}
                  </h2>
                  <p className="text-gray-400 mt-1 text-sm">
                    {currentProduct
                      ? 'Atualize as informações do produto'
                      : 'Adicione um novo produto ao inventário'}
                  </p>
                </div>
                <button
                  className="absolute cursor-pointer top-6 right-6 p-2 text-gray-400 hover:text-white transition-colors z-10 bg-white/5 hover:bg-white/10 rounded-xl"
                  onClick={resetForm}
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="relative p-6 pt-2 max-h-[70vh] overflow-y-auto">
                {/* Grupo: Identificação */}
                <div className="mb-6">
                  <div className="mb-2 text-teal-300 font-semibold text-xs tracking-wider flex items-center gap-2">
                    <Package size={16} /> Identificação
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-300 mb-1.5">
                        Nome <span className="text-teal-400">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-[#2F363E]/80 border border-teal-400/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400/40 transition-all text-sm placeholder:text-gray-500"
                        placeholder="Ex: Coca-Cola Lata 350ml"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1.5">
                        SKU <span className="text-teal-400">*</span>
                        <span className="ml-1 text-gray-500" title="Código único do produto">(?)</span>
                      </label>
                      <input
                        type="text"
                        name="sku"
                        value={formData.sku}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-[#2F363E]/80 border border-teal-400/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400/40 transition-all text-sm placeholder:text-gray-500"
                        placeholder="Ex: BEB-COCA-350"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1.5">
                        Loja <span className="text-teal-400">*</span>
                      </label>
                      <select
                        name="store"
                        value={formData.store}
                        onChange={handleInputChange}
                        className="cursor-pointer w-full px-3 py-2 bg-[#2F363E]/80 border border-teal-400/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400/40 transition-all text-sm"
                        required
                      >
                        <option value="">Selecione uma Loja</option>
                        <option value="Loja A">Loja A</option>
                        <option value="Loja B">Loja B</option>
                        <option value="Loja C">Loja C</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Grupo: Estoque e Preço */}
                <div className="mb-6">
                  <div className="mb-2 text-teal-300 font-semibold text-xs tracking-wider flex items-center gap-2">
                    <Package size={16} /> Estoque & Preço
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1.5">
                        Quantidade <span className="text-teal-400">*</span>
                      </label>
                      <input
                        type="number"
                        name="quantity"
                        value={formData.quantity}
                        onChange={handleInputChange}
                        min="0"
                        className="w-full px-3 py-2 bg-[#2F363E]/80 border border-teal-400/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400/40 transition-all text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1.5">
                        Estoque mínimo <span className="text-teal-400">*</span>
                        <span className="ml-1 text-gray-500" title="Alerta de estoque baixo">(?)</span>
                      </label>
                      <input
                        type="number"
                        name="minimum"
                        value={formData.minimum}
                        onChange={handleInputChange}
                        min="1"
                        className="w-full px-3 py-2 bg-[#2F363E]/80 border border-teal-400/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400/40 transition-all text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1.5">
                        Preço (BRL) <span className="text-teal-400">*</span>
                      </label>
                      <input
                        type="number"
                        name="priceBRL"
                        value={formData.priceBRL}
                        onChange={handleInputChange}
                        min="0.01"
                        step="0.01"
                        className="w-full px-3 py-2 bg-[#2F363E]/80 border border-teal-400/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400/40 transition-all text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1.5">
                        Preço (BCH)
                      </label>
                      <input
                        type="number"
                        name="priceBCH"
                        value={formData.priceBCH}
                        onChange={handleInputChange}
                        min="0.000001"
                        step="0.000001"
                        className="w-full px-3 py-2 bg-[#2F363E]/80 border border-teal-400/20 rounded-lg text-white opacity-60 focus:outline-none text-sm"
                        disabled
                      />
                    </div>
                  </div>
                </div>

                {/* Grupo: Categoria */}
                <div>
                  <div className="mb-2 text-teal-300 font-semibold text-xs tracking-wider flex items-center gap-2">
                    <Package size={16} /> Categoria
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1.5">
                        Categoria <span className="text-teal-400">*</span>
                      </label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="cursor-pointer w-full px-3 py-2 bg-[#2F363E]/80 border border-teal-400/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400/40 transition-all text-sm"
                        required
                      >
                        <option value="">Selecione uma Categoria</option>
                        {categories.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1.5">
                        Subcategoria <span className="text-teal-400">*</span>
                      </label>
                      <select
                        name="subcategory"
                        value={formData.subcategory}
                        onChange={handleInputChange}
                        className={`cursor-pointer w-full px-3 py-2 bg-[#2F363E]/80 border border-teal-400/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400/40 transition-all text-sm ${!formData.category ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                        required
                        disabled={!formData.category || formData.category === ''}
                      >
                        <option value="">Selecione uma Subcategoria</option>
                        {(formData.category && subcategoriesMap[formData.category])
                          ? subcategoriesMap[formData.category].map((subcat) => (
                            <option key={subcat} value={subcat}>{subcat}</option>
                          ))
                          : null}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Rodapé fixo para ações */}
                <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-[#23272F] via-[#24292D]/90 to-transparent pt-4 mt-8 -mx-6 px-6 border-t border-white/10 flex justify-end gap-3 z-20">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-5 py-2 cursor-pointer bg-gradient-to-r from-red-700 to-red-500 hover:from-red-600 hover:to-red-400 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    onClick={currentProduct ? handleOpenUpdateConfirmModal : handleSubmit}
                    className={`cursor-pointer px-5 py-2 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg text-sm ${currentProduct
                      ? 'bg-gradient-to-r from-teal-700 to-teal-500 hover:from-teal-600 hover:to-teal-400 text-white'
                      : 'bg-gradient-to-r from-teal-700 to-teal-500 hover:from-teal-600 hover:to-teal-400 text-white'
                      }`}
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
            <div className="bg-[#2F363E] rounded-xl w-full max-w-sm shadow-2xl relative border border-white/10 animate-modal-in">
              <div className="p-6 text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-2 ${modalContent.type === 'success' ? 'bg-teal-500/20 border-teal-500/50' :
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
                  className={`cursor-pointer w-full rounded-lg py-2 font-semibold transition-colors text-sm ${modalContent.type === 'success' ? 'bg-teal-600 hover:bg-teal-700 text-white' :
                    modalContent.type === 'error' ? 'bg-red-600 hover:bg-red-700 text-white' :
                      'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  onClick={() => setIsActionModalOpen(false)}
                >
                  Ok, Entendi!
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
                    className="cursor-pointer flex-1 rounded-lg py-2 font-semibold transition-colors bg-gradient-to-r from-teal-700 to-teal-500 hover:from-teal-600 hover:to-teal-400 text-white text-sm"
                    onClick={() => {
                      setIsDeleteConfirmModalOpen(false);
                      setProductToDeleteId(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="cursor-pointer flex-1 rounded-lg py-2 font-semibold transition-colors bg-gradient-to-r from-red-700 to-red-500 hover:from-red-600 hover:to-red-400 text-white text-sm"
                    onClick={confirmDelete}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Update Confirmation Modal */}
        {isUpdateConfirmModalOpen && currentProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#2F363E] rounded-xl w-full max-w-sm shadow-2xl relative border border-white/10">
              <div className="p-6 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-orange-500/50 bg-orange-500/20">
                  <AlertTriangle size={36} className="text-orange-400" />
                </div>

                <h3 className="text-xl font-bold  text-white mb-2">Confirmar Atualização</h3>
                <p className="text-gray-300 mb-6 text-sm">
                  Tem certeza que deseja salvar as alterações para o produto "{currentProduct.name}"?
                </p>

                <div className="flex gap-3">
                  <button
                    className="cursor-pointer flex-1 rounded-lg py-2 font-semibold transition-colors bg-gradient-to-r from-red-700 to-red-500 hover:from-red-600 hover:to-red-400 text-white text-sm"
                    onClick={() => setIsUpdateConfirmModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="cursor-pointer flex-1 rounded-lg py-2 font-semibold transition-colors bg-gradient-to-r from-orange-700 to-orange-500 hover:from-orange-600 hover:to-orange-400 text-white text-sm"
                    onClick={handleConfirmUpdate} 
                  >
                    Confirmar
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





