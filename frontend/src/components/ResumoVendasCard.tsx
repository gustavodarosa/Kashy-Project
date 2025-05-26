import {
  ComposedChart,
  Line,
  ResponsiveContainer,
  YAxis,
  XAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendingUp } from "lucide-react";
import * as Progress from "@radix-ui/react-progress";

const dataHoje = [
  { valor: 15 },
  { valor: 20 },
  { valor: 25 },
  { valor: 15 },
  { valor: 18 },
  { valor: 20 },
  { valor: 24 }, // vendas de hoje
];

const gerarFaturamento = (dias: number) => {
  return Array.from({ length: dias }, (_, i) => {
    return {
      dia: `Dia ${i + 1}`,
      valor: Math.floor(Math.random() * 700 + 200), // entre 200 e 900 reais
    };
  });
};

const faturamento14Dias = gerarFaturamento(14);
const faturamento30Dias = gerarFaturamento(30);

const meta = 300;

export default function ResumoVendasCard() {
  const hoje = dataHoje[dataHoje.length - 1].valor;
  const ontem = dataHoje[dataHoje.length - 2].valor;
  const media = Math.round(
    dataHoje.reduce((acc, cur) => acc + cur.valor, 0) / dataHoje.length
  );
  const diferenca = hoje - ontem;
  const percentual = ((diferenca / ontem) * 100).toFixed(1);
  const cor = diferenca >= 0 ? "#00ffcc" : "#ff5e5e";
  const prefixo = diferenca >= 0 ? "+" : "";
  const valorHojeReais = hoje * 10;

  const statusBadge =
    hoje > media ? (
      <span className="text-xs bg-[#00ffcc]/20 text-[#00ffcc] px-2 py-0.5 rounded-full font-medium">
        🔥 Em alta
      </span>
    ) : (
      <span className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full font-medium">
        💤 Abaixo da média
      </span>
    );

  return (
    <div className="w-full rounded-3xl p-6 text-white bg-[#121212] flex flex-col gap-6">
      {/* Faturamento do dia em destaque */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="text-[#00ffcc]" size={20} />
          <p className="text-sm text-white/60 tracking-widest uppercase truncate">
            Faturamento de Hoje
          </p>
        </div>

        <div className="text-5xl font-bold text-white mb-1 truncate">
          R$ {valorHojeReais},00
        </div>

        <div className="text-lg font-medium truncate" style={{ color: cor }}>
          {prefixo}
          {diferenca} vendas ({prefixo}
          {percentual}% em relação a ontem)
        </div>

        {/* Comparativo e badge */}
        <div className="flex items-center gap-3 mt-2">
          <p className="text-sm text-white/60">Média da semana: {media} vendas</p>
          {statusBadge}
        </div>

        {/* Barra de progresso */}
        <div className="w-full mt-4">
          <Progress.Root
            className="relative overflow-hidden bg-white/10 rounded-full w-full h-3"
            value={(valorHojeReais / meta) * 100}
          >
            <Progress.Indicator
              className="bg-[#00ffcc] h-full transition-transform duration-300"
              style={{
                transform: `translateX(-${100 - (valorHojeReais / meta) * 100}%)`,
              }}
            />
          </Progress.Root>
          <p className="text-xs text-white/40 mt-1">Meta diária: R$ {meta},00</p>
        </div>

        {/* Botão de ação */}
        <button className="text-xs text-white/70 hover:text-white underline mt-4">
          Ver detalhes
        </button>
      </div>

      {/* Gráfico de Faturamento Diário (Últimos 14 dias) */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gráfico de 14 dias */}
        <div className="bg-[#1f1f1f]/50 p-4 rounded-xl">
          <p className="text-xs text-white/60 mb-1 uppercase tracking-wide font-semibold">
            📈 Faturamento Diário (Últimos 14 dias)
          </p>
          <div className="w-full h-48"> {/* Altura ajustada */}
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart 
                data={faturamento14Dias}
                margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="salesChartGradient14" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00ffcc" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#00cfff" stopOpacity={1} />
                  </linearGradient>
                  <filter id="salesBloomEffect" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"></feGaussianBlur>
                    <feComponentTransfer in="blur" result="bloom">
                      <feFuncA type="linear" slope="0.5" intercept="0"></feFuncA>
                    </feComponentTransfer>
                    <feMerge>
                      <feMergeNode in="bloom"></feMergeNode>
                      <feMergeNode in="SourceGraphic"></feMergeNode>
                    </feMerge>
                  </filter>
                </defs>
                <XAxis dataKey="dia" hide />
                <YAxis hide domain={[0, "auto"]} /> {/* Garante que o eixo Y comece em 0 */}
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <Tooltip
                  formatter={(value: number) => `R$ ${value}`}
                  contentStyle={{ backgroundColor: "#2a2a40", border: "none", borderRadius: "6px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
                  labelStyle={{ color: "#ccc" }}
                  itemStyle={{ color: "#00ffcc" }}
                />
                <Line
                  type="natural" // Linha reta
                  dataKey="valor"
                  stroke="url(#salesChartGradient14)"
                  strokeWidth={2}
                  dot={false}
                  filter="url(#salesBloomEffect)"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de 30 dias */}
        <div className="bg-[#1f1f1f]/50 p-4 rounded-xl">
          <p className="text-xs text-white/60 mb-1 uppercase tracking-wide font-semibold">
            📅 Faturamento Diário (Últimos 30 dias)
          </p>
          <div className="w-full h-48"> {/* Altura ajustada */}
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart 
                data={faturamento30Dias}
                margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="salesChartGradient30" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00cfff" stopOpacity={0.7}/> 
                    <stop offset="100%" stopColor="#A020F0" stopOpacity={1}/> {/* Roxo para o gradiente do gráfico de 30 dias */}
                  </linearGradient>
                  {/* Reutilizando o mesmo bloomEffect, ou pode criar um salesBloomEffect30 se precisar de variação */}
                </defs>
                <XAxis dataKey="dia" hide />
                <YAxis hide domain={[0, "auto"]} />
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <Tooltip
                  formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                  contentStyle={{ backgroundColor: "#2a2a40", border: "none", borderRadius: "6px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
                  labelStyle={{ color: "#ccc" }}
                  itemStyle={{ color: "#00cfff" }}
                />
                <Line
                  type="linear" // Linha reta
                  dataKey="valor"
                  stroke="url(#salesChartGradient30)"
                  strokeWidth={2}
                  dot={false}
                  filter="url(#salesBloomEffect)" 
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
