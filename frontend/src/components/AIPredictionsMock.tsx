// src/components/AIPredictionsMock.tsx
import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, AlertTriangle, Lightbulb, TrendingDown, Minus } from 'lucide-react'; // Adicionado TrendingDown e Minus
import clsx from 'clsx';
 
// --- Interfaces (mantidas) ---
interface SalesForecast {
    period: string;
    predictedValue: number;
    trend: 'up' | 'down' | 'stable';
}
interface CustomerBehaviorInsight {
    segment: string;
    insight: string;
    actionableTip?: string;
}
interface ChurnPrediction {
    customerId: string;
    customerName: string;
    churnProbability: number;
}
 
// --- Função Mock (mantida) ---
const fetchMockAIPredictions = async (): Promise<{
    salesForecast: SalesForecast[];
    behaviorInsights: CustomerBehaviorInsight[];
    churnRisk: ChurnPrediction[];
}> => {
    console.log("Simulando chamada à API de IA...");
    await new Promise(resolve => setTimeout(resolve, 1500));
    const trends: Array<'up' | 'down' | 'stable'> = ['up', 'down', 'stable'];
    const mockData = {
        salesForecast: [
            { period: 'Próxima Semana', predictedValue: Math.random() * 5000 + 10000, trend: trends[Math.floor(Math.random() * trends.length)] },
            { period: 'Próximo Mês', predictedValue: Math.random() * 20000 + 45000, trend: trends[Math.floor(Math.random() * trends.length)] },
            { period: 'Próximo Trimestre', predictedValue: Math.random() * 50000 + 100000, trend: trends[Math.floor(Math.random() * trends.length)] },
        ],
        behaviorInsights: [
            { segment: 'Compradores Recentes', insight: 'Aumento expressivo no interesse por produtos da categoria Y após a última campanha.', actionableTip: 'Intensificar promoções cruzadas entre categorias X e Y.' },
            { segment: 'Clientes Inativos (90+ dias)', insight: 'Taxa de abertura de e-mails de reengajamento abaixo da média.', actionableTip: 'Experimentar canais alternativos como SMS ou notificações push com ofertas exclusivas.' },
            { segment: 'Carrinhos Abandonados', insight: 'Pico de abandonos na etapa de cálculo de frete.', actionableTip: 'Revisar política de frete ou oferecer opções mais claras e competitivas.' },
        ],
        churnRisk: [
            { customerId: 'USR1023', customerName: 'Cliente VIP Alfa', churnProbability: 0.85 },
            { customerId: 'USR8745', customerName: 'Cliente Beta Frequente', churnProbability: 0.62 },
            { customerId: 'USR5432', customerName: 'Cliente Gama Ocasional', churnProbability: 0.45 },
            { customerId: 'USR3210', customerName: 'Cliente Delta Recente', churnProbability: 0.15 },
            { customerId: 'USR9901', customerName: 'Cliente Épsilon Antigo', churnProbability: 0.70 },
        ].sort((a, b) => b.churnProbability - a.churnProbability),
    };
    console.log("Dados mock de IA gerados:", mockData);
    return mockData;
};
 
 
export const AIPredictionsMock: React.FC = () => {
    const [predictions, setPredictions] = useState<Awaited<ReturnType<typeof fetchMockAIPredictions>> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
 
    useEffect(() => {
        const loadPredictions = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchMockAIPredictions();
                setPredictions(data);
            } catch (err) {
                console.error("Erro ao buscar previsões mock:", err);
                setError("Falha ao carregar previsões da IA. Tente novamente mais tarde.");
            } finally {
                setLoading(false);
            }
        };
        loadPredictions();
    }, []);
 
    // --- Estados de Loading e Erro ---
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-6 bg-[var(--color-bg-tertiary)] rounded-2xl shadow-lg animate-pulse space-y-4 border border-[var(--color-border)]">
                        <div className="h-6 bg-gray-600/50 rounded w-1/2"></div>
                        <div className="h-10 bg-gray-600/50 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-600/50 rounded w-full"></div>
                        <div className="h-4 bg-gray-600/50 rounded w-5/6"></div>
                    </div>
                ))}
            </div>
        );
    }
 
    if (error) {
        return (
            <div className="p-6 bg-red-900/60 border border-red-700/80 text-red-200 rounded-2xl shadow-xl flex items-center gap-4">
                <AlertTriangle size={32} className="text-red-400 flex-shrink-0" />
                <div>
                    <h2 className="text-xl font-semibold mb-1">Erro ao Carregar Insights</h2>
                    <p className="text-red-300 text-sm">{error}</p>
                </div>
            </div>
        );
    }
 
    if (!predictions) {
        return <div className="text-center text-gray-500 py-10">Nenhuma previsão disponível no momento.</div>;
    }
 
    // --- Funções Auxiliares de Estilo ---
    const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
        const size = 20;
        switch (trend) {
            case 'up': return <TrendingUp size={size} className="text-green-400 ml-2" />;
            case 'down': return <TrendingDown size={size} className="text-red-400 ml-2" />;
            case 'stable': return <Minus size={size} className="text-yellow-400 ml-2" />;
            default: return null;
        }
    };
 
    const getChurnRiskClasses = (probability: number): { text: string; bg: string; border: string } => {
        if (probability > 0.7) return { text: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/60' };
        if (probability > 0.5) return { text: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/60' };
        return { text: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/60' };
    };
 
    // --- Estilo Base do Card ---
    const cardBaseClass = "p-6 bg-[var(--color-bg-tertiary)] rounded-2xl shadow-lg border border-[var(--color-border)] transition-all duration-300 hover:shadow-xl hover:border-[var(--color-border-hover)]";
 
    return (
        <div className="space-y-8">
             <h2 className="text-3xl font-bold text-white mb-6 pb-3 border-b-2 border-[var(--color-accent)]/30">
                Insights & Previsões IA
            </h2>
 
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 
                {/* Previsão de Vendas */}
                <div className={cardBaseClass}>
                    <h3 className="text-xl font-semibold mb-5 text-amber-400 flex items-center gap-2">
                        <TrendingUp size={22} /> Previsão de Vendas
                    </h3>
                    <ul className="space-y-5">
                        {predictions.salesForecast.map((forecast) => (
                            <li key={forecast.period} className="border-b border-gray-700/50 pb-4 last:border-b-0 last:pb-0">
                                <span className="text-sm text-gray-400 block mb-1">{forecast.period}</span>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-2xl text-gray-100">
                                        R$ {forecast.predictedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    {getTrendIcon(forecast.trend)}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
 
                {/* Comportamento do Consumidor */}
                <div className={clsx(cardBaseClass, "md:col-span-2")}> {/* Ocupa 2 colunas em telas médias+ */}
                    <h3 className="text-xl font-semibold mb-5 text-amber-400 flex items-center gap-2">
                        <Users size={22} /> Comportamento do Consumidor
                    </h3>
                    <ul className="space-y-5">
                        {predictions.behaviorInsights.map((insight, index) => (
                            <li key={index} className="border-b border-gray-700/50 pb-4 last:border-b-0 last:pb-0">
                                <p className="text-gray-200 mb-2">
                                    <strong className='text-gray-100 font-semibold'>{insight.segment}:</strong>
                                    {' '}{insight.insight}
                                </p>
                                {insight.actionableTip && (
                                     <div className="mt-3 p-3 bg-amber-900/30 border-l-4 border-amber-500 rounded-r-lg">
                                        <p className="text-sm text-amber-200 flex items-start gap-2">
                                            <Lightbulb size={18} className="flex-shrink-0 mt-0.5 text-amber-400" />
                                            <span><strong className="font-medium">Sugestão:</strong> {insight.actionableTip}</span>
                                        </p>
                                     </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
 
                 {/* Risco de Churn */}
                 <div className={cardBaseClass}>
                    <h3 className="text-xl font-semibold mb-2 text-amber-400 flex items-center gap-2">
                        <AlertTriangle size={22} /> Risco de Churn
                    </h3>
                     <p className="text-sm text-gray-500 mb-5">Clientes com maior propensão a abandonar.</p>
                    <ul className="space-y-3">
                        {predictions.churnRisk.slice(0, 5).map((churn) => {
                            const riskClasses = getChurnRiskClasses(churn.churnProbability);
                            return (
                                <li key={churn.customerId} className={clsx(
                                    "flex justify-between items-center p-3 rounded-lg border-l-4",
                                    riskClasses.border, // Borda lateral colorida
                                    riskClasses.bg.replace('/20', '/10') // Fundo muito sutil
                                )}>
                                    <div>
                                        <span className="text-gray-200 font-medium block text-sm truncate pr-2">{churn.customerName}</span>
                                        <span className="text-gray-500 text-xs">({churn.customerId})</span>
                                    </div>
                                    <span className={clsx(
                                        "font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs whitespace-nowrap",
                                        riskClasses.text,
                                        riskClasses.bg // Fundo do badge
                                    )}>
                                        <span className={clsx("w-2 h-2 rounded-full", riskClasses.bg.replace('/20', '/50'))}></span>
                                        {(churn.churnProbability * 100).toFixed(0)}% Risco
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        </div>
    );
};