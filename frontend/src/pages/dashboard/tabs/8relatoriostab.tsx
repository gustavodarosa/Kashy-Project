import { useState, useEffect } from 'react';

interface Product {
  id: string;
  name: string;
  quantity: number;
}

export function RelatoriosTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedLine, setSelectedLine] = useState<string | null>('Produtos');
  const [selectedValue, setSelectedValue] = useState<string | null>('Quantidade');
  const [selectedFunction, setSelectedFunction] = useState<string | null>('Média');
  const [average, setAverage] = useState<number | null>(null);

  // Simulação de busca de dados do banco de dados
  useEffect(() => {
    // Substitua esta função por uma chamada real à API para buscar os produtos
    const fetchProducts = async () => {
      const mockProducts: Product[] = [
        { id: '1', name: 'Produto A', quantity: 10 },
        { id: '2', name: 'Produto B', quantity: 20 },
        { id: '3', name: 'Produto C', quantity: 30 },
      ];
      setProducts(mockProducts);
    };

    fetchProducts();
  }, []);

  const calculateAverage = () => {
    if (products.length === 0) return;

    const totalQuantity = products.reduce((sum, product) => sum + product.quantity, 0);
    const avg = totalQuantity / products.length;
    setAverage(avg);
  };

  return (
    <div className="bg-gradient-to-br from-[#1E2328] via-[#24292D] to-[#2B3036] min-h-screen text-white">
      <div className="container mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resultados */}
        <div className="lg:col-span-2 bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-6">
          <h2 className="text-2xl font-bold mb-6">Resultados</h2>
          {average !== null ? (
            <p className="text-lg font-semibold">
              A média da quantidade dos produtos é: {average.toFixed(2)}
            </p>
          ) : (
            <p className="text-gray-400 text-center">Nenhuma média calculada.</p>
          )}
        </div>

        {/* Filtros */}
        <div className="bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-6">
          <h2 className="text-2xl font-bold mb-6">Filtros</h2>

          {/* Dropdown para Linhas */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Linhas</label>
            <select
              className="w-full p-3 rounded bg-[#24292D] text-white border border-white/10 focus:ring-2 focus:ring-teal-500"
              value={selectedLine || ''}
              disabled
            >
              <option value="Produtos">Produtos</option>
            </select>
          </div>

          {/* Dropdown para Valores */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Valores</label>
            <select
              className="w-full p-3 rounded bg-[#24292D] text-white border border-white/10 focus:ring-2 focus:ring-teal-500"
              value={selectedValue || ''}
              disabled
            >
              <option value="Quantidade">Quantidade</option>
            </select>
          </div>

          {/* Dropdown para Funções */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Funções</label>
            <select
              className="w-full p-3 rounded bg-[#24292D] text-white border border-white/10 focus:ring-2 focus:ring-teal-500"
              value={selectedFunction || ''}
              disabled
            >
              <option value="Média">Média</option>
            </select>
          </div>

          {/* Botão para Calcular Média */}
          <button
            onClick={calculateAverage}
            className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 rounded-lg transition-colors"
          >
            Calcular Média
          </button>
        </div>
      </div>
    </div>
  );
}
