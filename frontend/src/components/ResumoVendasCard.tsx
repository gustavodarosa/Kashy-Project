import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { TrendingUp, ArrowUpRight } from "lucide-react";
import * as Progress from "@radix-ui/react-progress";

const data = [
  { valor: 15 },
  { valor: 20 },
  { valor: 25 },
  { valor: 15 },
  { valor: 18 },
  { valor: 20 },
  { valor: 24 }, // vendas de hoje
];

// CustomDot agora é uma função que retorna um componente
const CustomDot = (data: typeof data) => (props: any) => {
  // const { cx, cy, index } = props; // Variáveis não mais necessárias aqui
  // const isLast = index === data.length - 1; // Não mais necessário

  return null;
};

const ResumoVendasCard = () => {
  const hoje = data[data.length - 1].valor;
  const ontem = data[data.length - 2].valor;
  const media = Math.round(
    data.reduce((acc, cur) => acc + cur.valor, 0) / data.length
  );
  const diferenca = hoje - ontem;
  const percentual = ((diferenca / ontem) * 100).toFixed(1);
  const cor = diferenca >= 0 ? "#00ffcc" : "#ff5e5e";
  const prefixo = diferenca >= 0 ? "+" : "";
  const meta = 300;
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
    <div className="w-full rounded-3xl p-6 text-white flex flex-row items-center justify-between gap-6 ">
      {/* Esquerda */}
      <div className="flex flex-col justify-center items-start flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="text-[#00ffcc]" size={20} />
          <p className="text-sm text-white/60 tracking-widest uppercase truncate">
            Total de Vendas Hoje
          </p>
        </div>
        <div className="text-4xl font-bold text-white mb-1 truncate">
          R$ {valorHojeReais},00
        </div>

        <div className="text-sm font-medium truncate" style={{ color: cor }}>
          {prefixo}
          {diferenca} vendas ({prefixo}
          {percentual}% em relação a ontem)
        </div>

        {/* Comparativo e badge */}
        <div className="flex items-center gap-3 mt-2">
          <p className="text-xs text-white/60">
            Média da semana: {media} vendas
          </p>
          {statusBadge}
        </div>

        {/* Barra de progresso */}
        <div className="w-full mt-3">
          <Progress.Root
            className="relative overflow-hidden bg-white/10 rounded-full w-full h-2"
            value={(valorHojeReais / meta) * 100}
          >
            <Progress.Indicator
              className="bg-[#00ffcc] h-full transition-transform duration-300"
              style={{ transform: `translateX(-${100 - (valorHojeReais / meta) * 100}%)` }}
            />
          </Progress.Root>
          <p className="text-xs text-white/40 mt-1">
            Meta diária: R$ {meta},00
          </p>
        </div>

        {/* Botão de ação */}
        <button className="text-xs text-white/70 hover:text-white underline mt-3">
          Ver detalhes
        </button>
      </div>

      {/* Gráfico */}
      {/* O gráfico foi removido daqui */}
    </div>
  );
};

export default ResumoVendasCard;
