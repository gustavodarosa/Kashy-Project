import { useState } from 'react';
import { FiActivity, FiShoppingCart, FiClock, FiTrendingUp, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CryptoChart } from '../../../components/CryptoChart';

const salesData = [
  { name: 'Seg', value: 400 },
  { name: 'Ter', value: 600 },
  { name: 'Qua', value: 800 },
  { name: 'Qui', value: 1200 },
  { name: 'Sex', value: 1800 },
  { name: 'Sáb', value: 1000 },
  { name: 'Dom', value: 500 },
];


const recentTransactions = [
  { id: 'tx1', amountBRL: 350.00, amountBCH: 0.012, status: 'confirmed', date: '10/06/2024 14:30', customer: 'Cliente A' },
  { id: 'tx2', amountBRL: 420.50, amountBCH: 0.014, status: 'pending', date: '10/06/2024 12:15', customer: 'Cliente B' },
  { id: 'tx3', amountBRL: 189.90, amountBCH: 0.006, status: 'confirmed', date: '10/06/2024 09:45', customer: 'Cliente C' },
  { id: 'tx4', amountBRL: 750.00, amountBCH: 0.025, status: 'confirmed', date: '09/06/2024 18:20', customer: 'Cliente D' },
  { id: 'tx5', amountBRL: 230.40, amountBCH: 0.008, status: 'failed', date: '09/06/2024 16:10', customer: 'Cliente E' },
];

const lowStockProducts = [
  { id: 101, name: 'Carregador Rápido', current: 2, minimum: 5 },
  { id: 102, name: 'Película de Vidro', current: 3, minimum: 10 },
  { id: 103, name: 'Cabo USB-C', current: 1, minimum: 5 },
  { id: 104, name: 'Suporte para Notebook', current: 0, minimum: 3 },
];

export function DashboardTab() {
  const [timeRange, setTimeRange] = useState('week');
  const [blockchainStatus, setBlockchainStatus] = useState('online');
  
  const checkBlockchainStatus = () => {
    setBlockchainStatus('checking');
    setTimeout(() => {
      setBlockchainStatus(Math.random() > 0.1 ? 'online' : 'offline');
    }, 1000);
  };

  return (
    <div className="p-6 bg-gray-100 dark:bg-[var(--color-bg-primary)]">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">Minha Loja Digital</h1>
          <p className="text-gray-600 dark:text-[var(--color-text-secondary)]">
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
        <div className="bg-white dark:bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-[var(--color-text-secondary)]">Vendas Hoje</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">R$ 0,00</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400">
              <FiActivity size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600 dark:text-green-400">
            <FiTrendingUp className="mr-1" /> +0% em relação a ontem
          </div>
        </div>
        
        <div className="bg-white dark:bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-[var(--color-text-secondary)]">Recebido em BCH</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">₿ 0</p>
            </div>
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400">
              <FiShoppingCart size={24} />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
            ≈ R$ 0,00
          </div>
        </div>
        
        <div className="bg-white dark:bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-[var(--color-text-secondary)]">Produtos com Estoque Baixo</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">0 produtos</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400">
              <FiAlertTriangle size={24} />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
            0 produtos esgotados
          </div>
        </div>
        
        <div className="bg-white dark:bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-[var(--color-text-secondary)]">Pedidos Pendentes</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">0 pendentes</p>
            </div>
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400">
              <FiClock size={24} />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
            0 aguardando pagamento
          </div>
        </div>
        
        <div className="bg-white dark:bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-[var(--color-text-secondary)]">Transações Recentes</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">0 hoje</p>
            </div>
            <div className="p-3 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400">
              <FiRefreshCw size={24} />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
            0 confirmadas, 0 pendente
          </div>
        </div>
        
        <div className="bg-white dark:bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-[var(--color-text-secondary)]">Crescimento da Semana</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">0%</p>
            </div>
            <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400">
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
        <div className="bg-white dark:bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow">
          <CryptoChart />
        </div>
        {/* Gráfico de Faturamento */}
        <div className="bg-white dark:bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">Faturamento</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setTimeRange('day')}
                className={`px-3 py-1 text-sm rounded-full ${
                  timeRange === 'day' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Hoje
              </button>
              <button
                onClick={() => setTimeRange('week')}
                className={`px-3 py-1 text-sm rounded-full ${
                  timeRange === 'week' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setTimeRange('month')}
                className={`px-3 py-1 text-sm rounded-full ${
                  timeRange === 'month' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Mês
              </button>
            </div>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis 
                  dataKey="name" 
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
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={2} 
                  dot={{ r: 4 }} 
                  activeDot={{ r: 6, strokeWidth: 0 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Segunda Linha de Seções Detalhadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Transações Recentes */}
        <div className="bg-white dark:bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-6">Transações Recentes</h2>
          
          <div className="space-y-4">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <div>
                  <p className="font-medium text-gray-900 dark:text-[var(--color-text-primary)]">{tx.customer}</p>
                  <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">{tx.date}</p>
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
        <div className="bg-white dark:bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">Alerta de Estoque</h2>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
              Reabastecer
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
