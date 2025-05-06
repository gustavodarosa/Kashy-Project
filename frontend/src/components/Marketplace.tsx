import { useState, useEffect } from 'react';
import { FiShoppingBag, FiClock, FiTag, FiStar } from 'react-icons/fi';

type Product = {
  _id: string;
  name: string;
  description: string;
  priceBRL: number;
  priceBCH: number;
  quantity: number;
  category: string;
  store: string;
  isActive: boolean;
};

export function Marketplace() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:3000/api/products/marketplace');
        if (!response.ok) {
          throw new Error('Erro ao carregar produtos do marketplace');
        }
        const data = await response.json();
        setProducts(data);
      } catch (err) {
        setError('Erro ao carregar produtos');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <FiShoppingBag /> Marketplace
      </h2>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="text-center text-red-400">{error}</div>
      ) : products.length === 0 ? (
        <div className="text-center text-gray-400">Nenhum produto disponível</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product._id}
              className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-blue-500 transition-colors relative"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 rounded-full bg-blue-900 text-blue-400">
                  <FiTag size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{product.name}</h3>
                  <p className="text-sm text-gray-400">{product.store}</p>
                </div>
              </div>
              <p className="text-gray-300 mb-4">{product.description}</p>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-gray-400 flex items-center gap-2">
                  <FiClock /> Estoque: {product.quantity}
                </div>
                <div className="text-xl font-bold text-green-400">
                  R$ {product.priceBRL.toFixed(2)}
                </div>
              </div>
              <button
                className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 transition-colors"
              >
                <FiStar /> Comprar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}