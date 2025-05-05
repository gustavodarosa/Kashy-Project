import { useEffect, useState, useCallback } from 'react'; // Added useCallback
import { FiActivity, FiShoppingCart, FiClock, FiTrendingUp, FiRefreshCw, FiAlertTriangle, FiBarChart2, FiDollarSign } from 'react-icons/fi'; // Added FiBarChart2, FiDollarSign
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'; // Added Legend
import { CryptoChart } from '../../../components/CryptoChart';
import { toast } from 'react-toastify'; // Added toast

// --- Configuration ---
const API_BASE_URL = 'http://localhost:3000/api';

// --- Types (Copied/Adapted from 10statstab.tsx) ---
type SalesPeriodStats = {
  totalBRL: number;
  totalBCH: number;
  count: number;
  averageTicketBRL: number;
};

type SalesSummary = {
  today: SalesPeriodStats;
  last30Days: SalesPeriodStats;
  allTime: SalesPeriodStats;
};

type SalesOverTimePoint = {
  period: string; // e.g., "2023-10-27" or "2023-43" (week) or "2023-10" (month)
  totalBRL: number;
  totalBCH: number;
  count: number;
};

// --- Helper Functions (Copied/Adapted from 10statstab.tsx) ---
const formatCurrency = (value: number | undefined) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatBCH = (value: number | undefined) => (Number(value) || 0).toFixed(6) + ' BCH';

// --- Mock Data (Keep or Remove as needed) ---
// const recentTransactions = [ ... ]; // Removed for brevity, use API data

export function DashboardTab() {
  const [timeRange, setTimeRange] = useState('week');
  const [blockchainStatus, setBlockchainStatus] = useState('online');
  const [userCount, setUserCount] = useState<number>(0);
  // const [salesToday, setSalesToday] = useState<number>(0); // REMOVED - Replaced by statsSummary
  // const [totalSales, setTotalSales] = useState<number>(0); // REMOVED - Replaced by statsSummary
  // const [totalBCH, setTotalBCH] = useState<number>(0); // REMOVED - Replaced by statsSummary
  // const [salesData, setSalesData] = useState<{ date: string; total: number }[]>([]); // Replaced by salesOverTimeData
  const [lowStockProducts, setLowStockProducts] = useState<{ id: string; name: string; current: number; minimum: number }[]>([]);

  // --- ADDED: State for Statistics Section ---
  const [statsSummary, setStatsSummary] = useState<SalesSummary | null>(null);
  const [salesOverTimeData, setSalesOverTimeData] = useState<SalesOverTimePoint[]>([]);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [chartParams, setChartParams] = useState({ groupBy: 'day', days: 30 });
  // Placeholder for user role - replace with actual logic (context, fetch, etc.)
  const [isMerchant, setIsMerchant] = useState<boolean>(true); // Assume merchant for now

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

  /* useEffect(() => { // REMOVED - Data now comes from statsSummary
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
  }, []); */ // END REMOVED useEffect

  /* useEffect(() => { // REMOVED - Data now comes from statsSummary
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
  }, []); */ // END REMOVED useEffect

  /* useEffect(() => { // REMOVED - Data now comes from statsSummary
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
  }, []); */ // END REMOVED useEffect

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

  // --- ADDED: Fetch Statistics Data ---
  const fetchDashboardStats = useCallback(async () => {
    if (!isMerchant) { // Don't fetch if not a merchant
      setLoadingStats(false);
      return;
    }
    setLoadingStats(true);
    setStatsError(null);
    const token = localStorage.getItem('token');
    if (!token) {
      setStatsError("Usuário não autenticado.");
      setLoadingStats(false);
      return;
    }

    try {
      // Fetch Summary and Chart data concurrently
      const [summaryRes, chartRes] = await Promise.all([
        fetch(`${API_BASE_URL}/stats/sales-summary`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/stats/sales-over-time?groupBy=${chartParams.groupBy}&days=${chartParams.days}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      // Process Summary
      if (!summaryRes.ok) {
        const errData = await summaryRes.json().catch(() => ({}));
        throw new Error(`Erro ao buscar resumo de estatísticas: ${errData.message || summaryRes.statusText}`);
      }
      const summaryData: SalesSummary = await summaryRes.json();
      setStatsSummary(summaryData);

      // Process Chart Data
      if (!chartRes.ok) {
        const errData = await chartRes.json().catch(() => ({}));
        throw new Error(`Erro ao buscar dados do gráfico de vendas: ${errData.message || chartRes.statusText}`);
      }
      const chartData: SalesOverTimePoint[] = await chartRes.json();
      setSalesOverTimeData(chartData);

    } catch (err: any) {
      console.error('[DashboardTab] Error fetching stats:', err);
      setStatsError(err.message || 'Falha ao carregar estatísticas.');
      toast.error(err.message || 'Falha ao carregar estatísticas.');
    } finally {
      setLoadingStats(false);
    }
  }, [chartParams, isMerchant]); // Refetch when chartParams or isMerchant change

  useEffect(() => { fetchDashboardStats(); }, [fetchDashboardStats]); // Fetch stats on load/param change

  const checkBlockchainStatus = () => {
    setBlockchainStatus('checking');
    setTimeout(() => {
      const newStatus = Math.random() > 0.1 ? 'online' : 'offline';
      setBlockchainStatus(newStatus);
    }, 1000);
  };

  // useEffect(() => { // Removed - using salesOverTimeData now
  //   // Processar transações para agrupar por data
  //   const groupedData = recentTransactions.reduce((acc, transaction) => {
  //     if (transaction.status === 'confirmed') {
  //       const date = new Date(transaction.date).toLocaleDateString('pt-BR');
  //       acc[date] = (acc[date] || 0) + transaction.amountBRL;
  //     }
  //     return acc;
  //   }, {} as Record<string, number>);

  //   // Converter para o formato necessário para o gráfico
  //   const formattedData = Object.entries(groupedData).map(([date, total]) => ({
  //     date,
  //     total,
  //   }));

  //   // Ordenar por data
  //   formattedData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  //   setSalesData(formattedData);
  // }, []);

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
            {/* UPDATED: Use statsSummary for total sales */}
            <div>
              <p className="text-gray-500 dark:text-[var(--color-text-secondary)]">Total de Vendas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
                {loadingStats ? '...' : formatCurrency(statsSummary?.allTime?.totalBRL)}
              </p>
            </div>
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400">
              <FiActivity size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600 dark:text-green-400">
            <FiTrendingUp className="mr-1" /> Total acumulado de vendas
          </div>
        </div>

        <div className="bg-white dark:bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            {/* UPDATED: Use statsSummary for total BCH */}
            <div>
              <p className="text-gray-500 dark:text-[var(--color-text-secondary)]">Recebido em BCH</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
                {loadingStats ? '...' : formatBCH(statsSummary?.allTime?.totalBCH)}
              </p>
            </div>
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400">
              <FiShoppingCart size={24} />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
            Total acumulado em Bitcoin Cash
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
              <p className="text-gray-500 dark:text-[var(--color-text-secondary)]">Usuários Cadastrados</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">{userCount}</p>
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

      {/* --- ADDED: Statistics Section (Conditional) --- */}
      {isMerchant && (
        <div className="mt-8 p-6 bg-white dark:bg-[var(--color-bg-secondary)] rounded-lg shadow">
          <h2 className="text-xl font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-6 flex items-center gap-2">
            <FiBarChart2 /> Estatísticas de Vendas
          </h2>

          {/* Stats Error Display */}
          {statsError && (
            <div className="bg-red-800 border border-red-600 text-white px-4 py-3 rounded relative mb-6 shadow-md" role="alert">
              <strong>Erro nas Estatísticas: </strong> <span className="block sm:inline">{statsError}</span>
              <button onClick={() => setStatsError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-300 hover:text-white">✕</button>
            </div>
          )}

          {/* Stats Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {loadingStats || !statsSummary ? (
              // ADDED: Unique key prop for loading skeletons
              [...Array(3)].map((_, i) => (
                <div key={i} className="bg-gray-100 dark:bg-[var(--color-bg-tertiary)] p-4 rounded-lg shadow animate-pulse">
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/3 mb-3"></div>
                  <div className="h-6 bg-gray-400 dark:bg-gray-600 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
                </div>
              ))
            ) : (
              <>
                {/* Total Vendido (30 dias) */}
                <div className="bg-gray-100 dark:bg-[var(--color-bg-tertiary)] p-4 rounded-lg shadow">
                  <p className="text-sm font-medium text-gray-500 dark:text-[var(--color-text-secondary)] mb-1">Vendas (30d)</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">{formatCurrency(statsSummary.last30Days.totalBRL)}</p>
                  <p className="text-xs text-gray-400 mt-1">{statsSummary.last30Days.count} transações</p>
                </div>
                {/* Nº Transações (30 dias) */}
                <div className="bg-gray-100 dark:bg-[var(--color-bg-tertiary)] p-4 rounded-lg shadow">
                  <p className="text-sm font-medium text-gray-500 dark:text-[var(--color-text-secondary)] mb-1">Nº Transações (30d)</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">{statsSummary.last30Days.count}</p>
                  <p className="text-xs text-gray-400 mt-1">&nbsp;</p> {/* Placeholder for alignment */}
                </div>
                {/* Ticket Médio (30 dias) */}
                <div className="bg-gray-100 dark:bg-[var(--color-bg-tertiary)] p-4 rounded-lg shadow">
                  <p className="text-sm font-medium text-gray-500 dark:text-[var(--color-text-secondary)] mb-1">Ticket Médio (30d)</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">{formatCurrency(statsSummary.last30Days.averageTicketBRL)}</p>
                  <p className="text-xs text-gray-400 mt-1">&nbsp;</p> {/* Placeholder for alignment */}
                </div>
              </>
            )}
          </div>

          {/* Sales Over Time Chart */}
          <div className="bg-gray-100 dark:bg-[var(--color-bg-tertiary)] p-4 rounded-lg shadow">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--color-text-primary)]">Vendas ao Longo do Tempo ({chartParams.days} dias)</h3>
              {/* Add controls for groupBy and days later if needed */}
            </div>

            {loadingStats ? (
              <div className="h-64 flex items-center justify-center text-gray-500 animate-pulse"> Carregando gráfico... </div>
            ) : salesOverTimeData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500"> Nenhum dado de vendas para exibir no período. </div>
            ) : (
              <div className="h-64"> {/* Fixed height container */}
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesOverTimeData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}> {/* Adjusted margins */}
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="period" stroke="var(--color-text-secondary)" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--color-text-secondary)" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} width={55} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '12px' }}
                      formatter={(value: number, name: string) => {
                        if (name === 'Vendas (BRL)') return formatCurrency(value);
                        if (name === 'Transações') return value;
                        return value;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="totalBRL" name="Vendas (BRL)" stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="count" name="Transações" stroke="var(--color-text-secondary)" strokeWidth={1} strokeDasharray="5 5" dot={false} activeDot={false} yAxisId="right" /> {/* Assign to potential right axis */}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Placeholder for Top Selling Products */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--color-text-primary)] mb-4">Produtos Mais Vendidos</h3>
            <div className="p-4 bg-gray-100 dark:bg-[var(--color-bg-tertiary)] rounded-lg text-center text-gray-500">
              (Em breve: Lista dos produtos mais vendidos no período)
            </div>
          </div>

        </div>
      )}
      {/* --- END Statistics Section --- */}

      {/* Seções de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Gráfico de Criptomoedas */}
        <div className="bg-white dark:bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow">
          <CryptoChart />
        </div>
        {/* Gráfico de Faturamento */}
        {/* <div className="bg-white dark:bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow"> // Commented out - Replaced by stats chart
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
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div> */}
      </div>

      {/* Segunda Linha de Seções Detalhadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Transações Recentes */}
        <div className="bg-white dark:bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-6">Transações Recentes</h2>

          <div className="space-y-4">
            {/* {recentTransactions.map((tx) => ( // Removed mock data display
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
            ))} */}
            <div className="text-center py-4 text-gray-500 dark:text-[var(--color-text-secondary)]">
              (Transações recentes agora na aba 'Carteira')
            </div>
          </div>
        </div>

        {/* Alerta de Estoque */}
        <div className="bg-white dark:bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow">
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
