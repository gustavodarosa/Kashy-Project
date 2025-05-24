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
    <div className="bg-[#141414] min-h-screen">
      <div className="bg-[#26a4a0] py-40">

      </div>
          </div>
      
  
     

    
     
        
    
        


   
  );
}
