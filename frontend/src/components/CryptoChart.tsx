import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CryptoDataPoint {
  time: string;
  price: number;
}

export function CryptoChart() {
  const [cryptoData, setCryptoData] = useState<CryptoDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('day'); // Added state for time range control

  // Busca dados iniciais
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      // --- FIX: Use backend proxy endpoint ---
      const url = `/api/crypto-proxy/market_chart?coin=bitcoin-cash&currency=usd&days=${timeRange === 'day' ? '1' : timeRange === 'week' ? '7' : '30'}`;

      try {
        // --- ADD AUTHENTICATION DETAILS ---
        // Option 1: If using Tokens (e.g., JWT) - UNCOMMENTED
        const token = localStorage.getItem('token'); // Or wherever you store the token
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });

        // Option 2: If using Cookies/Sessions
        // const response = await fetch(url, { credentials: 'include' }); // COMMENTED OUT

        // --- Improved Error Handling ---
        if (!response.ok) {
          // Check for specific user-facing errors
          if (response.status === 429) {
            throw new Error("Muitas requisições. Por favor, aguarde um momento e tente novamente."); // User-friendly 429
          }
          if (response.status >= 500) {
            throw new Error("O servidor encontrou um erro. Por favor, tente novamente mais tarde."); // User-friendly 5xx
          }
          const errorData = await response.json().catch(() => ({})); // Try to parse error
          // Fallback to original error message if not 429 or 5xx
          throw new Error(errorData.message || `Erro ${response.status} ao buscar dados do gráfico.`);
        }

        const historicalData = await response.json();

        if (!historicalData || !Array.isArray(historicalData.prices)) {
          throw new Error("Formato de dados inválido recebido do servidor.");
        }

        // Formatando os dados para o gráfico
        const formattedData = historicalData.prices.map((item: [number, number]) => ({
          // Use full timestamp for potential better sorting/filtering later
          time: new Date(item[0]).toISOString(),
          price: item[1]
        }));

        setCryptoData(formattedData);

      } catch (err: any) {
        // Set the potentially more user-friendly error message from the checks above
        setError(err.message || 'Falha ao carregar dados do gráfico.');
        console.error("Erro ao buscar dados do gráfico:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // Removed the setInterval for real-time updates via direct CoinGecko call
    // Real-time updates would ideally come via WebSocket or periodic proxy calls
  }, [timeRange]); // Re-fetch when timeRange changes

  // --- Helper to format time for XAxis ---
  const formatXAxis = (isoString: string) => {
    try {
      const date = new Date(isoString);
      // Adjust formatting based on timeRange if needed
      if (timeRange === 'day') {
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      } else {
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      }
    } catch (e) {
      return isoString; // Fallback
    }
  };

  return (
    <div className="h-full w-full">
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
        <h2 className="text-lg md:text-xl font-bold text-white dark:text-[var(--color-text-primary)]">
          Bitcoin Cash (BCH/USD)
        </h2>
        {/* Time Range Selector */}
        <div className="flex gap-1 p-1 bg-gray-700 rounded-md">
          {(['day', 'week', 'month'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                timeRange === range
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-300 hover:bg-gray-600'
              }`}
            >
              {range === 'day' ? '1D' : range === 'week' ? '7D' : '30D'}
            </button>
          ))}
        </div>
        {/* Current Price (Optional - could be fetched separately or from last data point) */}
        {!isLoading && cryptoData.length > 0 && (
          <div className="text-lg text-green-500 font-semibold hidden sm:block">
            ${cryptoData[cryptoData.length - 1].price.toFixed(2)}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="h-64 flex items-center justify-center text-red-500 text-center px-4">
          {error}
        </div>
      ) : cryptoData.length === 0 ? (
         <div className="h-64 flex items-center justify-center text-gray-500">
            Nenhum dado para exibir.
         </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={cryptoData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}> {/* Adjusted margins */}
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="time"
              tickFormatter={formatXAxis}
              stroke="var(--color-text-secondary)"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd" // Adjust interval as needed
              minTickGap={30} // Space out ticks
            />
            <YAxis
              domain={['auto', 'auto']}
              tickFormatter={(value) => `$${value.toFixed(0)}`} // Simpler formatting
              stroke="var(--color-text-secondary)"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={55} // Adjusted width
            />
            <Tooltip
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Preço']}
              labelFormatter={(label) => `Data: ${new Date(label).toLocaleString('pt-BR')}`} // Show full date/time
              contentStyle={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border)',
                borderRadius: '0.5rem',
                color: 'var(--color-text-primary)',
                fontSize: '12px'
              }}
              itemStyle={{ color: 'var(--color-text-primary)' }}
              labelStyle={{ color: 'var(--color-text-secondary)', marginBottom: '4px' }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--color-accent-hover)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
