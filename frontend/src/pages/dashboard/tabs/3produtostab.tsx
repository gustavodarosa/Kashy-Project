
import { useState, useEffect } from 'react';
import { Edit, Trash2, Plus, Search, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
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
  const [totalPages, setTotalPages] = useState<number>(1);
  const itemsPerPage = 8;
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

        setProducts(filteredProducts);
        setTotalPages(Math.ceil(filteredProducts.length / itemsPerPage));
        setError(null);
      } catch (err) {
        console.error('[ERROR] Erro ao carregar produtos:', err);
        setError('Erro ao carregar produtos');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [currentPage, searchTerm, selectedCategory, selectedStore, addNotification]);

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
      } else {
        setProducts(prev => [savedProduct, ...prev]);
      }

      resetForm();
    } catch (err) {
      console.error('Erro ao salvar produto:', err);
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
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      try {
        const response = await fetch(`http://localhost:3000/api/products/${productId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Erro ao excluir produto no servidor:', errorData);
          throw new Error('Erro ao excluir produto no servidor.');
        }

        setProducts(prev => prev.filter(p => p._id !== productId));
        console.log('Produto excluído com sucesso.');
      } catch (err) {
        console.error('Erro ao excluir produto:', err);
        alert('Erro ao excluir produto. Tente novamente.');
      }
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
    <div className="bg-[#24292D] min-h-screen flex flex-col items-center">
      {/* Hero Section with Statistics */}
      <div
        className="p-10 w-full text-white text-center mb-8 rounded-2xl shadow-2xl relative"
        style={{
          backgroundImage: `radial-gradient(ellipse at center, rgba(26, 194, 166, 0.25) 0%, transparent 70%), linear-gradient(to bottom right, #1ac2a6, #065546)`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center right, center right, center, center',
          backgroundSize: '350px, cover, cover',
        }}
      >
        <div className="flex items-center justify-center gap-2 mb-4">
          <ShoppingCart size={40} className="text-teal-300" />
          <h2 className="text-3xl font-bold">Dashboard de Produtos</h2>
        </div>
        
        <p className="text-lg text-teal-100 mb-6">Gerencie seu inventário com facilidade</p>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4">
            <div className="text-2xl font-bold text-green-300">
              {products.filter(p => p.quantity >= 30).length}
            </div>
            <div className="text-xs text-green-200">Alto Estoque</div>
          </div>
          <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4">
            <div className="text-2xl font-bold text-blue-300">
              {products.filter(p => p.quantity >= 16 && p.quantity <= 29).length}
            </div>
            <div className="text-xs text-blue-200">Médio Estoque</div>
          </div>
          <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4">
            <div className="text-2xl font-bold text-yellow-300">
              {products.filter(p => p.quantity > 0 && p.quantity <= 15).length}
            </div>
            <div className="text-xs text-yellow-200">Baixo Estoque</div>
          </div>
          <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4">
            <div className="text-2xl font-bold text-red-300">
              {products.filter(p => p.quantity === 0).length}
            </div>
            <div className="text-xs text-red-200">Esgotados</div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-center mt-8">
          <button
            onClick={() => setIsFormOpen(true)}
            className="ease-in-out hover:-translate-y-1 hover:scale-110 flex items-center justify-center gap-2 bg-[#1E1E1E] px-6 py-3 rounded-full text-white transition border-2 border-[#14B498] font-semibold"
          >
            <Plus size={20} />
            Novo Produto
          </button>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="bg-[#2F363E] rounded-full p-6 mb-6 shadow-2xl">
        <div className="flex justify-center items-center">
          <div className="flex gap-4">
            <button
              onClick={() => setViewMode('table')}
              className={`ease-in-out hover:-translate-y-1 hover:scale-110 px-6 py-3 rounded-lg font-medium transition text-white
                ${viewMode === 'table' ? 'bg-teal-600 shadow-md' : 'bg-[#24292D] hover:bg-[#333c46]'}`}
            >
              Tabela
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`ease-in-out hover:-translate-y-1 hover:scale-110 px-6 py-3 rounded-lg font-medium transition text-white
                ${viewMode === 'grid' ? 'bg-teal-600 shadow-md' : 'bg-[#24292D] hover:bg-[#333c46]'}`}
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="w-full max-w-7xl bg-[#2F363E] rounded-2xl p-6 mb-8 shadow-2xl">
        <div className="flex flex-col bg-[#3a424c] p-4 rounded-xl md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-1/2 lg:w-2/5">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por produto, SKU..."
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#24292D] border border-[#333c46] text-white focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder-gray-500"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-3 rounded-lg bg-[#24292D] border border-[#333c46] text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
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
              className="px-4 py-3 rounded-lg bg-[#24292D] border border-[#333c46] text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Todas as lojas</option>
              <option value="Loja A">Loja A</option>
              <option value="Loja B">Loja B</option>
              <option value="Loja C">Loja C</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Content */}
      {viewMode === 'table' && (
        <div className="w-full max-w-7xl bg-[#2F363E] rounded-2xl p-6 mb-8 shadow-2xl">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mx-auto"></div>
              <p className="mt-4 text-white">Carregando produtos...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-400">
              <p>{error}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p>Nenhum produto encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-[#24292D] border-2 border-[#333c46] text-xs uppercase text-gray-500">
                  <tr>
                    <th scope="col" className="px-6 py-3">Produto</th>
                    <th scope="col" className="px-6 py-3">Preço</th>
                    <th scope="col" className="px-6 py-3">Estoque</th>
                    <th scope="col" className="px-6 py-3">Status</th>
                    <th scope="col" className="px-6 py-3">Categoria</th>
                    <th scope="col" className="px-6 py-3">Loja</th>
                    <th scope="col" className="px-6 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    let estoqueClass = '';
                    let estoqueLabel = '';
                    if (product.quantity >= 30) {
                      estoqueLabel = 'Alto';
                      estoqueClass = 'bg-green-500 text-green-100';
                    } else if (product.quantity >= 16) {
                      estoqueLabel = 'Médio';
                      estoqueClass = 'bg-blue-600 text-blue-100';
                    } else if (product.quantity > 0) {
                      estoqueLabel = 'Baixo';
                      estoqueClass = 'bg-yellow-600 text-yellow-100';
                    } else {
                      estoqueLabel = 'Esgotado';
                      estoqueClass = 'bg-red-600 text-red-100';
                    }

                    return (
                      <tr
                        key={product._id}
                        className="border-b border-[#333c46] hover:bg-[#333c46] transition"
                      >
                        <td className="px-6 py-4">
                          <div className="text-white font-medium">{product.name}</div>
                          <div className="text-xs text-gray-400">SKU: {product.sku}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-white font-medium">
                            R$ {product.priceBRL.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-400">
                            {product.priceBCH.toFixed(6)} BCH
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${estoqueClass}`}>
                            {product.quantity} un. - {estoqueLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            product.isActive
                              ? 'bg-green-500 text-green-100'
                              : 'bg-red-600 text-red-100'
                          }`}>
                            {product.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-300">
                            {categories.find(c => c.value === product.category)?.label || 'Outros'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-300">{product.store}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(product)}
                              className="ease-in-out hover:-translate-y-1 hover:scale-110 bg-teal-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-teal-700 transition"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(product._id)}
                              className="ease-in-out hover:-translate-y-1 hover:scale-110 bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-red-700 transition"
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
      )}

      {viewMode === 'grid' && (
        <div className="w-full max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {products.map((product) => {
              let estoqueClass = '';
              let estoqueLabel = '';
              if (product.quantity >= 30) {
                estoqueLabel = 'Alto';
                estoqueClass = 'bg-green-500 text-green-100';
              } else if (product.quantity >= 16) {
                estoqueLabel = 'Médio';
                estoqueClass = 'bg-blue-600 text-blue-100';
              } else if (product.quantity > 0) {
                estoqueLabel = 'Baixo';
                estoqueClass = 'bg-yellow-600 text-yellow-100';
              } else {
                estoqueLabel = 'Esgotado';
                estoqueClass = 'bg-red-600 text-red-100';
              }

              return (
                <div
                  key={product._id}
                  className="bg-[#2F363E] rounded-2xl p-6 shadow-2xl border border-[#333c46] hover:bg-[#3a424c] transition-colors"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-white truncate">{product.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      product.isActive ? 'bg-green-500 text-green-100' : 'bg-red-600 text-red-100'
                    }`}>
                      {product.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  
                  <div className="mb-4">
                    <div className="text-xl font-bold text-white">R$ {product.priceBRL.toFixed(2)}</div>
                    <div className="text-sm text-gray-400">{product.priceBCH.toFixed(6)} BCH</div>
                  </div>

                  <div className="mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${estoqueClass}`}>
                      {product.quantity} un. - {estoqueLabel}
                    </span>
                  </div>

                  <div className="text-sm text-gray-400 mb-4">
                    <div>SKU: {product.sku}</div>
                    <div>Categoria: {categories.find(c => c.value === product.category)?.label || 'Outros'}</div>
                    <div>Loja: {product.store}</div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="flex-1 ease-in-out hover:-translate-y-1 hover:scale-105 bg-teal-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition flex items-center justify-center gap-1"
                    >
                      <Edit size={14} /> Editar
                    </button>
                    <button
                      onClick={() => handleDelete(product._id)}
                      className="ease-in-out hover:-translate-y-1 hover:scale-105 bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Product Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#24292D] rounded-2xl p-0 w-full max-w-4xl shadow-2xl relative border border-[#333c46]">
            <button
              className="absolute top-4 right-6 text-gray-400 hover:text-white text-2xl z-10"
              onClick={resetForm}
              aria-label="Fechar"
            >
              ×
            </button>
            
            <div className="border-b border-[#3a424c] px-8 pt-8 pb-4">
              <h2 className="text-2xl font-semibold text-white">
                {currentProduct ? 'Editar Produto' : 'Novo Produto'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="px-8 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nome do Produto */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nome *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg bg-[#2F363E] border border-[#333c46] text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                {/* Descrição */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Descrição</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg bg-[#2F363E] border border-[#333c46] text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* Preço em BRL */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Preço (BRL) *</label>
                  <input
                    type="number"
                    name="priceBRL"
                    value={formData.priceBRL}
                    onChange={handleInputChange}
                    min="0.01"
                    step="0.01"
                    className="w-full px-4 py-3 rounded-lg bg-[#2F363E] border border-[#333c46] text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                {/* Preço em BCH */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Preço (BCH)</label>
                  <input
                    type="number"
                    name="priceBCH"
                    value={formData.priceBCH}
                    onChange={handleInputChange}
                    min="0.000001"
                    step="0.000001"
                    className="w-full px-4 py-3 rounded-lg bg-[#2F363E] border border-[#333c46] text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    disabled
                  />
                </div>

                {/* Quantidade */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Quantidade *</label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-4 py-3 rounded-lg bg-[#2F363E] border border-[#333c46] text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                {/* SKU */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">SKU *</label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg bg-[#2F363E] border border-[#333c46] text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                {/* Categoria */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Categoria *</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg bg-[#2F363E] border border-[#333c46] text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Loja */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Loja *</label>
                  <select
                    name="store"
                    value={formData.store}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg bg-[#2F363E] border border-[#333c46] text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  >
                    <option value="">Selecione uma loja</option>
                    <option value="Loja A">Loja A</option>
                    <option value="Loja B">Loja B</option>
                    <option value="Loja C">Loja C</option>
                  </select>
                </div>

                {/* Status Ativo/Inativo */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-teal-600 rounded bg-[#2F363E] border-[#333c46] focus:ring-teal-500"
                  />
                  <label htmlFor="isActive" className="ml-2 text-sm text-gray-300">
                    Produto Ativo
                  </label>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex justify-end gap-4 mt-8">
                <button
                  type="button"
                  onClick={resetForm}
                  className="ease-in-out hover:-translate-y-1 hover:scale-110 px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="ease-in-out hover:-translate-y-1 hover:scale-110 px-6 py-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition"
                >
                  {currentProduct ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
