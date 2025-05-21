import { useEffect, useState } from 'react';
import { FiActivity, FiShoppingCart, FiClock, FiTrendingUp, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CryptoChart } from '../../../components/CryptoChart';

const recentTransactions = [
  { id: 'tx1', amountBRL: 350.00, amountBCH: 0.012, status: 'confirmed', date: '2024-06-10T14:30:00', customer: 'Cliente A' },
  { id: 'tx2', amountBRL: 420.50, amountBCH: 0.014, status: 'pending', date: '2024-06-10T12:15:00', customer: 'Cliente B' },
  { id: 'tx3', amountBRL: 189.90, amountBCH: 0.006, status: 'confirmed', date: '2024-06-09T09:45:00', customer: 'Cliente C' },
  { id: 'tx4', amountBRL: 750.00, amountBCH: 0.025, status: 'confirmed', date: '2024-06-09T18:20:00', customer: 'Cliente D' },
  { id: 'tx5', amountBRL: 230.40, amountBCH: 0.008, status: 'failed', date: '2024-06-08T16:10:00', customer: 'Cliente E' },
];

export function DashboardTab() {
  const [timeRange, setTimeRange] = useState('week');
  const [blockchainStatus, setBlockchainStatus] = useState('online');
  const [userCount, setUserCount] = useState<number>(0);
  const [salesToday, setSalesToday] = useState<number>(0);
  const [totalSales, setTotalSales] = useState<number>(0);
  const [totalBCH, setTotalBCH] = useState<number>(0);
  const [salesData, setSalesData] = useState<{ date: string; total: number }[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<{ id: string; name: string; current: number; minimum: number }[]>([]);

  useEffect(() => {
    const fetchUserCount = async () => {
      try {
        const token = localStorage.getItem('token');

        const response = await fetch('http://localhost:3000/api/users/count', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Erro ao buscar contagem de usuários');
        }

        const data = await response.json();
        setUserCount(data.count);
      } catch (error) {
        console.error('[ERROR] Erro ao carregar contagem de usuários:', error);
      }
    };

    fetchUserCount();
  }, []);

  useEffect(() => {
    const fetchSalesToday = async () => {
      try {
        const token = localStorage.getItem('token');

        const response = await fetch('http://localhost:3000/api/wallet/sales/today', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Erro ao buscar vendas de hoje');
        }

        const data = await response.json();
        setSalesToday(data.total);
      } catch (error) {
        console.error('[ERROR] Erro ao carregar vendas de hoje:', error);
      }
    };

    fetchSalesToday();
  }, []);

  useEffect(() => {
    const fetchTotalSales = async () => {
      try {
        const token = localStorage.getItem('token');

        const response = await fetch('http://localhost:3000/api/wallet/sales/total', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Erro ao buscar total de vendas');
        }

        const data = await response.json();
        setTotalSales(data.total);
      } catch (error) {
        console.error('[ERROR] Erro ao carregar total de vendas:', error);
      }
    };

    fetchTotalSales();
  }, []);

  useEffect(() => {
    const fetchTotalBCH = async () => {
      try {
        const token = localStorage.getItem('token');

        const response = await fetch('http://localhost:3000/api/wallet/sales/total-bch', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Erro ao buscar total de BCH recebido');
        }

        const data = await response.json();
        setTotalBCH(data.total);
      } catch (error) {
        console.error('[ERROR] Erro ao carregar total de BCH recebido:', error);
      }
    };

    fetchTotalBCH();
  }, []);

  useEffect(() => {
    const fetchLowStockProducts = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/products/low-stock');
        if (!response.ok) {
          throw new Error('Erro ao buscar produtos com estoque baixo');
        }
        const data = await response.json();
        setLowStockProducts(data);
      } catch (error) {
        console.error('Erro ao carregar produtos com estoque baixo:', error);
      }
    };

    fetchLowStockProducts();
  }, []);

  const checkBlockchainStatus = () => {
    setBlockchainStatus('checking');
    setTimeout(() => {
      const newStatus = Math.random() > 0.1 ? 'online' : 'offline';
      setBlockchainStatus(newStatus);
    }, 1000);
  };

  useEffect(() => {
    // Processar transações para agrupar por data
    const groupedData = recentTransactions.reduce((acc, transaction) => {
      if (transaction.status === 'confirmed') {
        const date = new Date(transaction.date).toLocaleDateString('pt-BR');
        acc[date] = (acc[date] || 0) + transaction.amountBRL;
      }
      return acc;
    }, {} as Record<string, number>);

    // Converter para o formato necessário para o gráfico
    const formattedData = Object.entries(groupedData).map(([date, total]) => ({
      date,
      total,
    }));

    // Ordenar por data
    formattedData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    setSalesData(formattedData);
  }, []);

  return (
    <div className="p-6 min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">Minha Loja Digital</h1>
      </div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
         
          <p className="text-white">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex text-white items-center gap-2">
            <span>Status Blockchain:</span>
            {blockchainStatus === 'online' ? (
              <span className="flex items-center gap-1 text-green-500">
                <span className="w-2 h-2 rounded-full bg-green-500"></span> Online
              </span>
            ) : blockchainStatus === 'offline' ? (
              <span className="flex items-center gap-1 text-red-500">
                <span className="w-2 h-2 rounded-full bg-red-500"></span> Offline
              </span>
            ) : (
              <span className="flex items-center gap-1 text-yellow-500">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Verificando...
              </span>
            )}
            <button 
              onClick={checkBlockchainStatus}
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              title="Verificar status"
            >
              <FiRefreshCw size={14} />
            </button>
          </div>
          
          <div className="bg-white dark:bg-[var(--color-bg-secondary)] p-3 rounded-lg shadow">
            <div className="flex items-center gap-4">
              <span className="font-medium text-white">Saldo:</span>
              <span className="text-green-600 dark:text-green-400">R$ 0,00</span>
              <span className="text-gray-400">|</span>
              <span className="text-yellow-600 dark:text-yellow-400">₿ 0 BCH</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <div className="bg-[linear-gradient(to_top_left,transparent,rgba(0,0,0,0.7)_60%)] p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-[var(--color-text-secondary)]">Total de Vendas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
                R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
           <div 
  className="p-3 rounded-full dark:bg-blue-700 text-blue-400"
  style={{ filter: 'drop-shadow(0 0 8px #5298f2)' }}
>
  <FiActivity size={24} />
</div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600 dark:text-green-400">
            <FiTrendingUp className="mr-1" /> Total acumulado de vendas
          </div>
        </div>
        
        <div className="bg-[linear-gradient(to_top_left,transparent,rgba(0,0,0,0.7)_60%)] p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-[var(--color-text-secondary)]">Recebido em BCH</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
                ₿ {totalBCH.toFixed(8)}
              </p>
            </div>
            <div className="p-3 rounded-full dark:bg-green-900 text-green-600 dark:text-green-400"
              style={{ filter: 'drop-shadow(0 0 8px #3dd445)' }}
>
              <FiShoppingCart size={24} />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
            Total acumulado em Bitcoin Cash
          </div>
        </div>
        
        <div className="bg-[linear-gradient(to_top_left,transparent,rgba(0,0,0,0.7)_60%)] p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-[var(--color-text-secondary)]">Produtos com Estoque Baixo</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">0 produtos</p>
            </div>
            <div className="p-3 rounded-full dark:bg-yellow-700 dark:text-yellow-500"
            style={{ filter: 'drop-shadow(0 0 8px #c4791d)' }}
>
              <FiAlertTriangle size={24} />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
            0 produtos esgotados
          </div>
        </div>
        
        <div className="bg-[linear-gradient(to_top_left,transparent,rgba(0,0,0,0.7)_60%)] p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-[var(--color-text-secondary)]">Pedidos Pendentes</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">0 pendentes</p>
            </div>
            <div className="p-3 rounded-full dark:bg-purple-900 text-purple-600 dark:text-purple-500"
            style={{ filter: 'drop-shadow(0 0 8px #8c20c7)' }}
>
              <FiClock size={24} />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
            0 aguardando pagamento
          </div>
        </div>
        
        <div className="bg-[linear-gradient(to_top_left,transparent,rgba(0,0,0,0.7)_60%)] p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-[var(--color-text-secondary)]">Transações Recentes</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">0 hoje</p>
            </div>
            <div className="p-3 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400"
            style={{ filter: 'drop-shadow(0 0 8px #ab1111)' }}
>
              <FiRefreshCw size={24} />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
            0 confirmadas, 0 pendente
          </div>
        </div>
        
        <div className="bg-[linear-gradient(to_top_left,transparent,rgba(0,0,0,0.7)_60%)] p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-[var(--color-text-secondary)]">Usuários Cadastrados</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">{userCount}</p>
            </div>
            <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400"
            style={{ filter: 'drop-shadow(0 0 8px #4018c4)' }}
>
              <FiTrendingUp size={24} />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
            Em relação à semana passada
          </div>
        </div>

        
      </div>

      {/* Seções de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Gráfico de Criptomoedas */}
        <div className="bg-[linear-gradient(to_top_left,transparent,rgba(0,0,0,0.7)_60%)] p-6 rounded-lg shadow-lg  ">
          <CryptoChart />
        </div>
        {/* Gráfico de Faturamento */}
        <div className="bg-[linear-gradient(to_top_left,transparent,rgba(0,0,0,0.7)_60%)] p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">Faturamento</h2>
          </div>
          
          <div className="h-64">
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={salesData}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
      <XAxis 
        dataKey="date" 
        axisLine={false} 
        tickLine={false} 
        tick={{ fill: '#6b7280' }} 
      />
      <YAxis 
        axisLine={false} 
        tickLine={false} 
        tick={{ fill: '#6b7280' }} 
        width={40}
      />
      <Tooltip 
        contentStyle={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: 'none'
        }}
      />
      <Line 
        type="monotone" 
        dataKey="total" 
        stroke="#3b82f6" 
        strokeWidth={2} 
        dot={{ r: 4 }} 
        activeDot={{ r: 6, strokeWidth: 0 }} 
        style={{
          filter: "drop-shadow(0 0 6px rgba(59, 130, 246, 0.8))",
        }}
      />
    </LineChart>
  </ResponsiveContainer>
</div>
        </div>
      </div>

      {/* Segunda Linha de Seções Detalhadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Transações Recentes */}
        <div className="bg-[linear-gradient(to_top_left,transparent,rgba(0,0,0,0.7)_60%)] p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-6">Transações Recentes</h2>
          
          <div className="space-y-4">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <div>
                  <p className="font-medium text-gray-900 dark:text-[var(--color-text-primary)]">{tx.customer}</p>
                  <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
                    {new Date(tx.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-green-500">
                    R$ {tx.amountBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
                    ₿ {tx.amountBCH.toFixed(4)}
                  </p>
                  <div className="mt-1">
                    {tx.status === 'confirmed' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Confirmado
                      </span>
                    ) : tx.status === 'pending' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        Pendente
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        Falhou
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerta de Estoque */}
        <div className="bg-[linear-gradient(to_top_left,transparent,rgba(0,0,0,0.7)_60%)] p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">Alerta de Estoque</h2>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
              Conferir
            </button>
          </div>
          
          <div className="space-y-3">
            {lowStockProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <FiAlertTriangle className="text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-[var(--color-text-primary)]">{product.name}</p>
                    <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
                      Estoque: {product.current} (mínimo: {product.minimum})
                    </p>
                  </div>
                </div>
                {product.current === 0 ? (
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    ESGOTADO
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    BAIXO
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
