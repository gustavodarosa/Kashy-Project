import { useEffect, useState } from 'react';
import { FiActivity, FiShoppingCart, FiClock, FiTrendingUp, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { CryptoChart } from '../../../components/CryptoChart';

// Mock de transações recentes (use este array para o histórico e gráficos)
const recentTransactions = [
  { id: 'tx1', amountBRL: 350.00, amountBCH: 0.012, status: 'confirmed', date: '2024-06-10T14:30:00', customer: 'Cliente A' },
  { id: 'tx2', amountBRL: 420.50, amountBCH: 0.014, status: 'pending', date: '2024-06-10T12:15:00', customer: 'Cliente B' },
  { id: 'tx3', amountBRL: 189.90, amountBCH: 0.006, status: 'confirmed', date: '2024-06-09T09:45:00', customer: 'Cliente C' },
  { id: 'tx4', amountBRL: 750.00, amountBCH: 0.025, status: 'confirmed', date: '2024-06-09T18:20:00', customer: 'Cliente D' },
  { id: 'tx5', amountBRL: 230.40, amountBCH: 0.008, status: 'failed', date: '2024-06-08T16:10:00', customer: 'Cliente E' },
];

// Adicione este mock ou use seu fetch real de pedidos recentes
const recentOrders = [
  { id: 'order1', totalAmount: 350.00, status: 'confirmed', date: '2024-06-10T14:30:00', customer: 'Cliente A', paymentMethod: 'bch' },
  { id: 'order2', totalAmount: 420.50, status: 'pending', date: '2024-06-10T12:15:00', customer: 'Cliente B', paymentMethod: 'pix' },
  { id: 'order3', totalAmount: 189.90, status: 'confirmed', date: '2024-06-09T09:45:00', customer: 'Cliente C', paymentMethod: 'card' },
  { id: 'order4', totalAmount: 750.00, status: 'confirmed', date: '2024-06-09T18:20:00', customer: 'Cliente D', paymentMethod: 'bch' },
  { id: 'order5', totalAmount: 230.40, status: 'failed', date: '2024-06-08T16:10:00', customer: 'Cliente E', paymentMethod: 'pix' },
];

// Mock: Produtos mais vendidos
const bestSellingProducts = [
  { id: 'p1', name: 'Camiseta Kashy', sold: 120 },
  { id: 'p2', name: 'Caneca Kashy', sold: 95 },
  { id: 'p3', name: 'Boné Exclusivo', sold: 80 },
  { id: 'p4', name: 'Chaveiro BCH', sold: 60 },
  { id: 'p5', name: 'Adesivo Kashy', sold: 30 },
  { id: 'p6', name: 'Calça Kashy', sold: 25 },
  { id: 'p7', name: 'Moletom Kashy', sold: 155 },

];

// Mock: Dias da semana com mais vendas
const salesByWeekday = [
  { day: 'Segunda', total: 15 },
  { day: 'Terça', total: 22 },
  { day: 'Quarta', total: 18 },
  { day: 'Quinta', total: 30 },
  { day: 'Sexta', total: 27 },
  { day: 'Sábado', total: 35 },
  { day: 'Domingo', total: 12 },
];

// Cores para o gráfico de pizza
const pieColors = ['#10b981', '#f59e42', '#a855f7', '#ef4444', '#d3c015', '#640303', '#960596'];

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
    <div className="p-4 bg-[var(--color-bg-primary)]">
      {/* Cabeçalho */}
      <div
        className="rounded-lg shadow mb-4 flex items-center justify-between px-4 py-2"
        style={{
          background: "linear-gradient(to right, #05a826, #37ed73)",
        }}
      >
        <img
          src="/logokashy.svg"
          alt="Kashy Logo Header"
          className="h-40 w-auto"
           
        />
        <div className="flex flex-col items-end">
          <p className="text-2xl text-white">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-2">
        <div>
          <div className="bg-[var(--color-bg-secondary)] p-2 rounded flex text-white items-center gap-2">
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
              className="text-green-500 hover:text-green-300"
              title="Verificar status"
            >
              <FiRefreshCw size={12} />
            </button>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
          <div className="bg-[var(--color-bg-secondary)] p-2 rounded">
            <div className="flex items-center gap-2">
              <span className="text-white">Saldo:</span>
              <span className=" text-green-400">R$ 0,00</span>
              <span className="text-white">|</span>
              <span className=" text-yellow-400">₿ 0 BCH</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
        <div className="bg-gradient-to-br from-blue-900/80 to-blue-800/60 p-5 rounded-2xl shadow flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-300 text-xs font-medium">Total de vendas em BRL</p>
              <p className="text-2xl font-bold text-blue-200">
                R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 rounded-full bg-blue-700 text-blue-200 shadow-lg">
              <FiActivity size={22} />
            </div>
          </div>
          <div className="flex items-center text-xs text-blue-300 mt-1">
            <FiTrendingUp className="mr-1" /> Total acumulado de vendas
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-900/80 to-green-800/60 p-5 rounded-2xl shadow flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-300 text-xs font-medium">Total de vendas em BCH</p>
              <p className="text-2xl font-bold text-green-200">
                ₿ {totalBCH.toFixed(8)}
              </p>
            </div>
            <div className="p-3 rounded-full bg-green-700 text-green-200 shadow-lg">
              <FiShoppingCart size={22} />
            </div>
          </div>
          <div className="flex items-center text-xs text-green-300 mt-1">
            <FiTrendingUp className="mr-1" /> Total acumulado em BCH
          </div>
        </div>
        <div className="bg-gradient-to-br from-yellow-900/80 to-yellow-800/60 p-5 rounded-2xl shadow flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-300 text-xs font-medium">Total de produtos em estoque</p>
              <p className="text-2xl font-bold text-yellow-200">0 produtos</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-600 text-yellow-200 shadow-lg">
              <FiAlertTriangle size={22} />
            </div>
          </div>
          <div className="text-xs text-yellow-300 mt-1">
            0 Alto Estoque, 0 Médio Estoque, 0 Baixo Estoque, 0 Esgotados
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-900/80 to-purple-800/60 p-5 rounded-2xl shadow flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-300 text-xs font-medium">Pedidos Recentes</p>
              <p className="text-2xl font-bold text-purple-200">0 Hoje</p>
            </div>
            <div className="p-3 rounded-full bg-purple-800 text-purple-200 shadow-lg">
              <FiClock size={22} />
            </div>
          </div>
          <div className="text-xs text-purple-300 mt-1">
            0 Confirmados, 0 Pendentes, 0 Cancelados, 0 Reembolsados
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-900/80 to-red-800/60 p-5 rounded-2xl shadow flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-300 text-xs font-medium">Transações Recentes</p>
              <p className="text-2xl font-bold text-red-200">0 hoje</p>
            </div>
            <div className="p-3 rounded-full bg-red-800 text-red-200 shadow-lg">
              <FiRefreshCw size={22} />
            </div>
          </div>
          <div className="text-xs text-red-300 mt-1">
            0 Confirmadas, 0 Pendentes, 0 Canceladas
          </div>
        </div>
        <div className="bg-gradient-to-br from-indigo-900/80 to-indigo-800/60 p-5 rounded-2xl shadow flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-300 text-xs font-medium">Clientes Cadastrados</p>
              <p className="text-2xl font-bold text-indigo-200">{userCount} Clientes</p>
            </div>
            <div className="p-3 rounded-full bg-indigo-700 text-indigo-200 shadow-lg">
              <FiTrendingUp size={22} />
            </div>
          </div>
          <div className="flex items-center text-xs text-indigo-300 mt-1">
            <FiTrendingUp className="mr-1" /> 0 Em relação à semana passada
          </div>
        </div>
      </div>

      {/* Gráficos principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Gráfico de Criptomoedas */}
        <div className="bg-[var(--color-bg-tertiary)] p-4 rounded shadow-lg">
          <CryptoChart />
        </div>
        {/* Gráfico de Faturamento */}
        <div className="bg-[var(--color-bg-tertiary)] p-4 rounded shadow">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Faturamento</h2>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="108%">
              <LineChart data={salesData}>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} width={32} />
                <Tooltip contentStyle={{
                  backgroundColor: 'white',
                  borderRadius: '0.5rem',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  border: 'none',
                  fontSize: '12px'
                }} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  style={{
                    filter: "drop-shadow(0 0 6px rgba(59, 130, 246, 0.8))",
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Linha de Mocks: Produtos mais vendidos e Dias da semana com mais vendas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Produtos mais vendidos com gráfico de Pizza */}
        <div className="bg-[var(--color-bg-tertiary)] p-4 rounded shadow flex flex-col">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">Produtos Mais Vendidos</h2>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <PieChart width={480} height={250}>
              <Pie
                data={bestSellingProducts}
                dataKey="sold"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={120}

              >
                {bestSellingProducts.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={pieColors[idx % pieColors.length]} />
                ))}
              </Pie>
            </PieChart>
            <ul className="flex-1 divide-y divide-gray-700 text-xs">
              {bestSellingProducts.map((prod, idx) => (
                <li key={prod.id} className="flex justify-between items-center py-2">
                  <span className="font-medium text-gray-100 flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: pieColors[idx % pieColors.length] }}></span>
                    {prod.name}
                  </span>
                  <span className="text-green-400 font-bold">{prod.sold} vendas</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {/* Dias da semana com mais vendas com gráfico de barras */}
        <div className="bg-[var(--color-bg-tertiary)] p-4 rounded shadow flex flex-col">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">Dias da Semana com Mais Vendas</h2>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <BarChart width={500} height={250} data={salesByWeekday}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  color: "#fff",
                  borderRadius: "0.5rem",
                  border: "none",
                  boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)",
                  fontSize: "12px"
                }}
              />
              <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
            <ul className="flex-1 divide-y divide-gray-700 text-xs">
              {salesByWeekday
                .sort((a, b) => b.total - a.total)
                .map((day, idx) => (
                  <li key={day.day} className="flex justify-between items-center py-2">
                    <span className="font-medium text-gray-100">{idx + 1}. {day.day}</span>
                    <span className="text-blue-400 font-bold">{day.total} vendas</span>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Linha de históricos: Transações, Pedidos, Estoque */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Transações Recentes */}
        <div className="bg-[var(--color-bg-tertiary)] p-4 rounded shadow">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">Transações Recentes</h2>
          <div className="space-y-2">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-2 hover:bg-gray-700 rounded transition-colors text-xs">
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{tx.customer}</p>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">
                    {new Date(tx.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-green-500">
                    R$ {tx.amountBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">
                    ₿ {tx.amountBCH.toFixed(4)}
                  </p>
                  <div className="mt-1">
                    {tx.status === 'confirmed' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-900 text-green-200">
                        Confirmado
                      </span>
                    ) : tx.status === 'pending' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-yellow-900 text-yellow-200">
                        Pendente
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-900 text-red-200">
                        Falhou
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Pedidos Recentes */}
        <div className="bg-[var(--color-bg-tertiary)] p-4 rounded shadow">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">Pedidos Recentes</h2>
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-2 hover:bg-gray-700 rounded transition-colors text-xs">
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{order.customer}</p>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">
                    {new Date(order.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                  <p className="text-[10px] text-gray-400">Método: {order.paymentMethod.toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-blue-500">
                    R$ {order.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="mt-1">
                    {order.status === 'confirmed' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-900 text-green-200">
                        Confirmado
                      </span>
                    ) : order.status === 'pending' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-yellow-900 text-yellow-200">
                        Pendente
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-900 text-red-200">
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
        <div className="bg-[var(--color-bg-tertiary)] p-4 rounded shadow">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Alerta de Estoque</h2>
            <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs">
              Conferir
            </button>
          </div>
          <div className="space-y-2">
            {lowStockProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-2 bg-red-900/20 rounded">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-red-900/30 rounded-full flex items-center justify-center">
                    <FiAlertTriangle className="text-red-400" size={14} />
                  </div>
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)] text-xs">{product.name}</p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">
                      Estoque: {product.current} (mínimo: {product.minimum})
                    </p>
                  </div>
                </div>
                {product.current === 0 ? (
                  <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-900 text-red-200">
                    ESGOTADO
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-yellow-900 text-yellow-200">
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
