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

  // Busca dados iniciais e configura atualização em tempo real
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("[CryptoChart] Fetching data via backend proxy..."); // Log
        setIsLoading(true);
        setError(null); // Clear previous errors
        
        // --- ADDED: Get token ---
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Usuário não autenticado.');
        // --- END ADDED ---

        // 1. Buscar dados históricos (últimas 24h) VIA BACKEND
        const historicalResponse = await fetch(
          'http://localhost:3000/api/chart/bitcoin-cash/usd?days=1', // <-- URL already changed
          { headers: { Authorization: `Bearer ${token}` } } // <-- ADDED HEADERS
        );
        if (!historicalResponse.ok) throw new Error(`Backend proxy error: ${historicalResponse.statusText}`); // Check backend response
        const historicalData = await historicalResponse.json();
        
        // Formatando os dados para o gráfico
        const formattedData = historicalData.prices.map((item: [number, number]) => ({
          time: new Date(item[0]).toLocaleTimeString(),
          price: item[1]
        }));
        
        console.log("[CryptoChart] Historical data fetched and formatted."); // Log
        setCryptoData(formattedData);
        setIsLoading(false);
        
        // 2. Configurar atualização em tempo real (a cada 30 segundos)
        // NOTE: Real-time update via backend proxy might be complex.
        // For now, let's comment out the interval fetching simple price directly.
        // A better approach would be a WebSocket connection or periodic re-fetch of the chart data via proxy.
        /*
        const intervalId = setInterval(async () => {
          const currentResponse = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin-cash&vs_currencies=usd'
          );
          const currentData = await currentResponse.json();
          
          setCryptoData(prev => {
            const newData = [...prev];
            newData.push({
              time: new Date().toLocaleTimeString(),
              price: currentData['bitcoin-cash'].usd
            });
            
            // Manter apenas os últimos 100 pontos
            return newData.slice(-100);
          });
        }, 30000);
        */
        
        return () => { /* clearInterval(intervalId); */ }; // Cleanup placeholder
      } catch (err: any) { // Catch any error
        console.error("[CryptoChart] Error fetching data:", err); // Log the error
        setError('Erro ao carregar dados da criptomoeda');
        setIsLoading(false);
        // console.error(err); // Already logged above
      }
    };
    
    fetchData();
  }, []);

  return (
    <div className="h-full w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white dark:text-[var(--color-text-primary)]">
          Bitcoin Cash (BCH/USD)
        </h2>
        {cryptoData.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-lg text-green-500 font-semibold">
              ${cryptoData[cryptoData.length - 1].price.toFixed(2)}
            </span>
          
          </div>
        )}
      </div>
      
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="h-64 flex items-center justify-center text-red-500">
          {error}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={cryptoData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date();
                const [hours, minutes] = value.split(':');
                date.setHours(parseInt(hours), parseInt(minutes));
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }}
            />
            <YAxis 
              domain={['auto', 'auto']}
              tickFormatter={(value) => `$${value}`}
              width={80}
            />
            <Tooltip 
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Preço']}
              labelFormatter={(label) => `Hora: ${label}`}
              contentStyle={{
                backgroundColor: 'white',
                borderRadius: '0.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                border: 'none'
              }}
            />
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="#3b82f6" 
              strokeWidth={2} 
              dot={false}
              activeDot={{ r: 6, strokeWidth: 0 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
