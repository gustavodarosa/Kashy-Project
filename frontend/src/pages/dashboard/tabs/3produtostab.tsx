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
};

import { useState, useEffect } from 'react';
import { FiEdit, FiTrash2, FiPlus, FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useNotification } from '../../../context/NotificationContext'; // Importe o contexto de notificações

export function ProdutosTab() {
  // Estado para os produtos
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para paginação
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const itemsPerPage = 8;
  
  // Estado para busca/filtro
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Estado para o formulário
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
    isActive: true
  });

  // Contexto de notificações
  const { addNotification } = useNotification();

  // Categorias de produtos
  const categories = [
    { value: 'alimentos', label: 'Alimentos' },
    { value: 'bebidas', label: 'Bebidas' },
    { value: 'eletronicos', label: 'Eletrônicos' },
    { value: 'vestuario', label: 'Vestuário' },
    { value: 'servicos', label: 'Serviços' },
    
  ];

  // Simulação de fetch de dados
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        console.log('[DEBUG] Iniciando fetch de produtos...');
        setLoading(true);
        const response = await fetch('http://localhost:3000/api/products');
        console.log('[DEBUG] Resposta da API de produtos:', response);

        if (!response.ok) {
          throw new Error('Erro ao buscar produtos');
        }

        const data = await response.json();
        console.log('[DEBUG] Dados recebidos da API de produtos:', data);

        // Verificar produtos com estoque baixo e enviar notificações exclusivas
        
        // Aplicar filtros de busca e categoria
        const filteredProducts = data.filter((product: Product) => {
          const matchesCategory =
            selectedCategory === 'all' || product.category === selectedCategory;
          const matchesSearch =
            searchTerm === '' ||
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.sku.toLowerCase().includes(searchTerm.toLowerCase());
          return matchesCategory && matchesSearch;
        });

        setProducts(filteredProducts);
        setTotalPages(Math.ceil(filteredProducts.length / itemsPerPage));
        setError(null);
      } catch (err) {
        console.error('[ERROR] Erro ao carregar produtos:', err);
        setError('Erro ao carregar produtos');
      } finally {
        setLoading(false);
        console.log('[DEBUG] Finalizado fetch de produtos.');
      }
    };

    fetchProducts();
  }, [currentPage, searchTerm, selectedCategory, addNotification]);

  // Manipuladores de formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : 
              type === 'number' ? parseFloat(value) || 0 : 
              value
    }));

    // Calcular automaticamente o preço em BCH quando BRL é alterado
    if (name === 'priceBRL') {
      const brlValue = parseFloat(value) || 0;
      setFormData(prev => ({
        ...prev,
        priceBCH: brlValue * 0.0001 // Simulação de conversão
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        throw new Error('Erro ao salvar produto');
      }

      const savedProduct = await response.json();
      if (currentProduct) {
        // Atualizar produto existente na lista
        setProducts(prev =>
          prev.map(p => (p._id === savedProduct._id ? savedProduct : p))
        );
      } else {
        // Adicionar novo produto à lista
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
      isActive: true
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
      isActive: product.isActive
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (productId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      try {
        // Simulando chamada API
        await new Promise(resolve => setTimeout(resolve, 300));
        setProducts(prev => prev.filter(p => p._id !== productId));
      } catch (err) {
        console.error('Erro ao excluir produto:', err);
      }
    }
  };

  // Formatação de valores monetários
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
    <div className="p-6 bg-[var(--color-bg-primary)] text-white min-h-screen">
      <h2 className="text-2xl font-bold mb-6">Dashboard de Produtos</h2>
      
      {/* Barra de ações */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar produtos..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full md:w-48 px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas categorias</option>
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
        
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] px-4 py-2 rounded-lg transition-colors w-full md:w-auto justify-center"
        >
          <FiPlus /> Novo Produto
        </button>
      </div>
      
      {/* Formulário modal */}
      {isFormOpen && (
        <div className="fixed inset-0  bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-8 w-full max-w-3xl shadow-lg">
            <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">
              {currentProduct ? 'Editar Produto' : 'Adicionar Produto'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nome do Produto */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    Nome*
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Descrição */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    Descrição
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Preço em BRL */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    Preço (BRL)*
                  </label>
                  <input
                    type="number"
                    name="priceBRL"
                    value={formData.priceBRL}
                    onChange={handleInputChange}
                    min="0.01"
                    step="0.01"
                    className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Preço em BCH */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    Preço (BCH)
                  </label>
                  <input
                    type="number"
                    name="priceBCH"
                    value={formData.priceBCH}
                    onChange={handleInputChange}
                    min="0.000001"
                    step="0.000001"
                    className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled
                  />
                </div>

                {/* Quantidade */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    Quantidade*
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* SKU */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    SKU*
                  </label>
                  <input
                    type="number"
                    name="sku"
                    value={formData.sku}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Categoria */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    Categoria*
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
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
                    className="h-4 w-4 text-blue-600 rounded bg-[var(--color-bg-primary)] border-[var(--color-border)] focus:ring-blue-500"
                  />
                  <label htmlFor="isActive" className="ml-2 text-sm text-[var(--color-text-secondary)]">
                    Ativo
                  </label>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex justify-end gap-4 mt-8">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
                >
                  {currentProduct ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Tabela de produtos */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg overflow-hidden border border-[var(--color-border)]">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4">Carregando produtos...</p>
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
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--color-divide)]">
                <thead className="bg-gray-750">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Preço (BRL/BCH)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Estoque</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Categoria</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--color-bg-secondary)] divide-y divide-[var(--color-divide)]">
                  {products.map((product) => {
                    console.log('[DEBUG] Renderizando produto:', product);
                    return (
                      <tr key={product._id} className="hover:bg-gray-750 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium">{product.name}</div>
                          <div className="text-xs text-gray-400">{product.sku}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">{formatCurrency(product.priceBRL)}</div>
                          <div className="text-xs text-gray-400">{formatBCH(product.priceBCH)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            product.quantity > 10 
                              ? 'bg-green-100 text-green-800' 
                              : product.quantity > 0 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : 'bg-red-100 text-red-800'
                          }`}>
                            {product.quantity} unidades
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {categories.find(c => c.value === product.category)?.label || 'Outros'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            product.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {product.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => handleEdit(product)}
                              className="text-blue-400 hover:text-blue-300 transition-colors"
                              title="Editar"
                            >
                              <FiEdit size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(product._id)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                              title="Excluir"
                            >
                              <FiTrash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Paginação */}
            <div className="px-6 py-4 flex items-center justify-between border-t border-[var(--color-border)]">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-[var(--color-border)] text-sm font-medium rounded-md bg-[var(--color-bg-primary)] text-gray-300 hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-[var(--color-border)] text-sm font-medium rounded-md bg-[var(--color-bg-primary)] text-gray-300 hover:bg-[var(--color-bg-secondary) disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
              
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-400">
                    Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a{' '}
                    <span className="font-medium">{Math.min(currentPage * itemsPerPage, products.length)}</span> de{' '}
                    <span className="font-medium">{totalPages * itemsPerPage}</span> resultados
                  </p>
                </div>
                
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-sm font-medium text-gray-400 hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50"
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
                              : 'bg-[var(--color-bg-primary)] border-[var(--color-border)] text-gray-400 hover:bg-[var(--color-bg-secondary)]'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-sm font-medium text-gray-400 hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50"
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
    </div>
  );
}