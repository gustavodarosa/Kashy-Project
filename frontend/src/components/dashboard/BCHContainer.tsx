import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

interface PriceData {
  valor: number;
  timestamp?: string;
}

interface ApiPriceData {
  currentPrice: number;
  priceHistory: { timestamp: string; price: number }[];
}

const tooltipValueFormatter = (value: number) => [`US$${value.toFixed(2)}`, "Preço"];

const BitcoinCashCard = () => {
  const [chartData, setChartData] = useState<PriceData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [dailyVariation, setDailyVariation] = useState<number>(0);
  const [dailyPercentage, setDailyDailyPercentage] = useState<string>("0.00");
  const [priceColor, setPriceColor] = useState<string>("#7FFF00");
  const [bchToBrlRate, setBchToBrlRate] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [intervalo, setIntervalo] = useState<string>("7");
  // dataGranularity state is removed as it's now fixed per intervalo

  const wsRef = useRef<WebSocket | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const lastGranularUpdateTimeRef = useRef<number>(0); // Para agregação baseada em tempo

  // Removed useEffect that adjusted dataGranularity based on intervalo

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      setBchToBrlRate(null);

      let actualIntervalParam: string;
      if (intervalo === '1') {
        actualIntervalParam = '15m';
      } else if (intervalo === '7') {
        actualIntervalParam = '1h';
      } else if (intervalo === '15') {
        actualIntervalParam = '4h';
      } else if (intervalo === '30') { // Para 30 dias
        actualIntervalParam = '4h'; // Usar granularidade de 4 horas para mais detalhes
      } else { // Fallback, caso algum outro intervalo seja adicionado futuramente
        actualIntervalParam = '1d';
      }

      try {
        const [priceApiResponse, rateApiResponse] = await Promise.all([
          fetch(`http://localhost:3000/api/crypto-proxy/bch-price-data?days=${intervalo}&interval=${actualIntervalParam}`),
          fetch("http://localhost:3000/api/rates/bch-brl")
        ]);

        if (!priceApiResponse.ok) {
          const errorText = await priceApiResponse.text();
          throw new Error(`Erro ao buscar dados de preço BCH: ${priceApiResponse.statusText} - ${errorText}`);
        }
        const apiData: ApiPriceData = await priceApiResponse.json();

        if (!rateApiResponse.ok) {
          const errorText = await rateApiResponse.text();
          throw new Error(`Erro ao buscar taxa de câmbio BCH/BRL: ${rateApiResponse.statusText} - ${errorText}`);
        }
        const rateData: { rate: number } = await rateApiResponse.json();
        setBchToBrlRate(rateData.rate);

        if (apiData.priceHistory && apiData.priceHistory.length > 0) {
          const formattedChartData = apiData.priceHistory.map(item => ({
            valor: item.price,
            timestamp: item.timestamp
          }));
          setChartData(formattedChartData);

          // Inicializa lastGranularUpdateTimeRef com base no último ponto histórico
          // se estivermos em uma visualização de 1 dia com granularidade específica.
          if (intervalo === '1') { // For 1D view (which is 15m granularity)
            if (formattedChartData.length > 0 && formattedChartData[formattedChartData.length - 1].timestamp) {
              lastGranularUpdateTimeRef.current = new Date(formattedChartData[formattedChartData.length - 1].timestamp!).getTime();
            } else {
              lastGranularUpdateTimeRef.current = Date.now(); // Fallback
            }
          }

          setCurrentPrice(apiData.currentPrice);

          const history = apiData.priceHistory;
          const lastPrice = history[history.length - 1].price;
          const previousPrice = history.length > 1 ? history[history.length - 2].price : lastPrice;

          const varValue = lastPrice - previousPrice;
          setDailyVariation(varValue);
          const percValue = previousPrice !== 0 ? ((varValue / previousPrice) * 100).toFixed(2) : "0.00";
          setDailyDailyPercentage(percValue);
          setPriceColor(varValue >= 0 ? "#7FFF00" : "#ff5e5e");

        } else if (apiData.currentPrice !== undefined) {
          setCurrentPrice(apiData.currentPrice);
          setChartData([{ valor: apiData.currentPrice, timestamp: new Date().toISOString() }]);
          setDailyVariation(0);
          // Se for visualização de 1 dia (15m) e sem histórico, comece a agregação agora.
          if (intervalo === '1') {
            lastGranularUpdateTimeRef.current = Date.now();
          }
          setDailyDailyPercentage("0.00");
          setPriceColor("#7FFF00");
        } else {
          throw new Error("Dados de histórico insuficientes ou formato inválido.");
        }
      } catch (err: any) {
        setError(err.message || "Falha ao carregar dados da cotação.");
        console.error("Erro em fetchData:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [intervalo]); // Dependency is now only 'intervalo'

  const getIntervalMs = (granularity: string): number => {
    switch (granularity) {
      case '15m': return 15 * 60 * 1000;
      default: return 0; // Retorna 0 se não for uma granularidade de agregação conhecida
    }
  };


  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("WebSocket já está conectado.");
      return;
    }

    // Limpar tentativas de reconexão anteriores
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    console.log(`Tentando conectar WebSocket (tentativa ${retryCountRef.current + 1})...`);
    const newWs = new WebSocket("wss://stream.binance.com:9443/ws/bchusdt@miniTicker");
    wsRef.current = newWs;

    newWs.onopen = () => {
      console.log("Conexão WebSocket com Binance aberta.");
      // Clear only WebSocket-related errors
      if (error === "Erro na conexão em tempo real. Tente novamente mais tarde." || 
          error?.startsWith("Não foi possível conectar") || 
          error?.startsWith("Não foi possível manter a conexão")) {
        setError(null);
      }
      retryCountRef.current = 0; // Resetar contador de tentativas
    };

    newWs.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.c && message.o) {
        const newPrice = parseFloat(message.c);
        const openPrice24hr = parseFloat(message.o);

        setCurrentPrice(newPrice); // Atualiza o preço em tempo real
        const varValue = newPrice - openPrice24hr;
        setDailyVariation(varValue);
        const percValue = openPrice24hr !== 0 ? ((varValue / openPrice24hr) * 100).toFixed(2) : "0.00";
        setDailyDailyPercentage(percValue);
        setPriceColor(varValue >= 0 ? "#7FFF00" : "#ff5e5e");

        if (intervalo === '1') {
          const intervalMs = getIntervalMs('15m'); // For 1D view, granularity is always 15m
          const now = Date.now();
          if (intervalMs > 0) { // Ensure we have a valid interval for aggregation
            // Verifica se tempo suficiente passou desde a última atualização granular
            if (now >= lastGranularUpdateTimeRef.current + intervalMs) {
              setChartData(prevData => {
                const newDataPoint = { valor: newPrice, timestamp: new Date(now).toISOString() };
                const currentData = Array.isArray(prevData) ? prevData : [];
                const updatedData = [...currentData, newDataPoint];
                lastGranularUpdateTimeRef.current = now; // Atualiza o tempo da última agregação
                return updatedData.slice(-200);
              });
            }
            // Se não passou tempo suficiente, não atualiza o chartData (mas o preço no card é atualizado)
          }
          // For 7D, 15D, 30D (intervalo !== '1'), chartData is not updated by WebSocket
          // to keep the historical view clean.
        }
      }
    };

    newWs.onerror = (event) => {
      console.error("Erro no WebSocket (onerror):", event);
      // Não defina o erro genérico aqui imediatamente; onclose lidará com as tentativas.
      // Se onclose não for acionado após um onerror, pode ser necessário definir um erro aqui.
    };

    newWs.onclose = (event) => { // event is CloseEvent
      console.log("Conexão WebSocket com Binance fechada. Código:", event.code, "Motivo:", event.reason, "Limpa:", event.wasClean);
      // Apenas tentar reconectar se o fechamento não foi limpo (ex: erro de rede, servidor caiu)
      // e não excedemos o limite de tentativas.
      if (!event.wasClean && event.code !== 1000 && retryCountRef.current < 5) { // Tentar reconectar no máximo 5 vezes
        const delay = Math.pow(2, retryCountRef.current) * 1000; // Backoff exponencial (1s, 2s, 4s, 8s, 16s)
        console.log(`WebSocket fechado inesperadamente. Tentando reconectar em ${delay / 1000}s...`);
        retryTimeoutRef.current = setTimeout(() => {
          retryCountRef.current++;
          connectWebSocket();
        }, delay);
      } else if (!event.wasClean && event.code !== 1000) {
        console.error("Máximo de tentativas de reconexão do WebSocket atingido ou fechamento não limpo não tratado.");
        setError("Não foi possível manter a conexão de cotação em tempo real após várias tentativas.");
      }
    };
  }, [error, intervalo]); // Dependency array updated

  useEffect(() => {
    connectWebSocket(); // Conectar na montagem do componente

    return () => {
      console.log("Limpando WebSocket no desmonte do componente.");
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Componente desmontando"); // Fechamento normal
        wsRef.current = null;
      }
      retryCountRef.current = 0; // Resetar ao desmontar
    };
  }, [connectWebSocket]); // Adicionar connectWebSocket como dependência

  const intervalosDisponiveis = ["1", "7", "15", "30"]; // Updated timeframes

  return (
    <div className="w-full h-full flex flex-col text-white">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold">Bitcoin Cash</p>
          <p className="text-xs text-white/40">BCH</p>
        </div>

        <div className="text-right">
          <motion.p
            key={currentPrice}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="font-bold text-lg"
          >
            US${currentPrice?.toFixed(2)}
          </motion.p>
          {currentPrice !== null && bchToBrlRate !== null && (
            <motion.p
              key={(currentPrice * bchToBrlRate).toString()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="text-xs text-gray-400"
            >
              BRL {(currentPrice * bchToBrlRate).toFixed(2)}
            </motion.p>
          )}
          <p className="text-xs" style={{ color: priceColor }}>
            {dailyVariation >= 0 ? '+' : ''}${dailyVariation.toFixed(2)} ({dailyPercentage}%)
          </p>
        </div>
      </div>

      <div className="mt-4 mb-2 flex justify-end gap-2">
        {intervalosDisponiveis.map(d => (
          <button
            key={d}
            className={`px-2 py-0.5 text-xs rounded-md border transition-colors duration-200
              ${intervalo === d
                ? 'bg-lime-400 text-black border-lime-400'
                : 'border-gray-600 text-gray-300 hover:border-white'}`}
            onClick={() => setIntervalo(d)}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Granularity selection buttons removed */}

      {isLoading && (
        <div className="mt-3 flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lime-300"></div>
        </div>
      )}

      {error && !isLoading && (
        <div className="mt-3 flex-1 flex items-center justify-center text-red-500 text-sm p-4 text-center">
          {error}
        </div>
      )}

      {!isLoading && !error && chartData.length > 0 && (
        <div className="mt-2 flex-1"> {/* Alterado para flex-1 e removido bg, rounded, mx */}
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="chartLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#166534" />
                  <stop offset="100%" stopColor="#86efac" />
                </linearGradient>
                <filter id="bloomEffect" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"></feGaussianBlur>
                  <feComponentTransfer in="blur" result="bloom">
                    <feFuncA type="linear" slope="0.5" intercept="0"></feFuncA>
                  </feComponentTransfer>
                  <feMerge>
                    <feMergeNode in="bloom"></feMergeNode>
                    <feMergeNode in="SourceGraphic"></feMergeNode>
                  </feMerge>
                </filter>
              </defs>
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#2a2a40",
                  border: "none",
                  borderRadius: "6px",
                }}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0 && payload[0].payload.timestamp) {
                    return `Data: ${new Date(payload[0].payload.timestamp).toLocaleDateString('pt-BR')}`;
                  }
                  return `Ponto ${label + 1}`;
                }}
                formatter={tooltipValueFormatter}
              />
              <Line
                type="linear"
                dataKey="valor"
                stroke="url(#chartLineGradient)"
                strokeWidth={2}
                dot={false}
                filter="url(#bloomEffect)"
                isAnimationActive={false}

              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {!isLoading && !error && chartData.length === 0 && (
        <div className="mt-3 flex-1 flex items-center justify-center text-gray-500 text-sm">
          Sem dados de gráfico para exibir.
        </div>
      )}
    </div>
  );
};

export default BitcoinCashCard;
