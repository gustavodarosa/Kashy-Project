import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Star, TrendingUp, Target, DollarSign, Package } from 'lucide-react';

const dadosItensMaisVendidos = [
  { nome: "Bolo de Cenoura", vendas: 120, ticket: 12.5, estoque: 14 },
  { nome: "Torta de Frango", vendas: 90, ticket: 18.0, estoque: 6 },
  { nome: "Brownie", vendas: 75, ticket: 10.0, estoque: 22 },
  { nome: "Coxinha", vendas: 65, ticket: 8.0, estoque: 11 },
  { nome: "Pão de Queijo", vendas: 55, ticket: 5.5, estoque: 4 },
];

// Paleta de tons de verde, começando com o tom principal e variando
// Reordenada do mais claro para o mais escuro
const CORES_GRAFICO_VERDE = [
  "#66FFEA", // Mais claro
  "#33FFDA", // Claro
  "#00FFCC", // Principal / Médio-claro
  "#00E6B8", // Médio-escuro
  "#00C29B", // Mais escuro
];

const totalVendas = dadosItensMaisVendidos.reduce(
  (acc, item) => acc + item.vendas,
  0
);

const destaque = dadosItensMaisVendidos[0];

// Preparar dados para o gráfico: Top 4 + Outros
const NUM_TOP_ITEMS_IN_CHART = 4;
const chartData = dadosItensMaisVendidos.slice(0, NUM_TOP_ITEMS_IN_CHART);

if (dadosItensMaisVendidos.length > NUM_TOP_ITEMS_IN_CHART) {
  const outrosVendas = dadosItensMaisVendidos.slice(NUM_TOP_ITEMS_IN_CHART).reduce((acc, item) => acc + item.vendas, 0);
  // Para manter o "Outros" como uma fatia menor, vamos usar o valor do 5º item se for apenas um,
  // ou a soma se for para representar múltiplos itens menos vendidos.
  // No caso atual, "Outros" será o "Pão de Queijo".
  if (outrosVendas > 0) {
    chartData.push({ nome: "Outros", vendas: outrosVendas, ticket: 0, estoque: 0 }); // ticket e estoque não são usados no gráfico para "Outros"
  }
}

export default function ItensMaisVendidos() {
  return (
    <div className="w-full rounded-3xl p-6 text-white bg-[#121212] flex flex-col gap-6">
      <div className="flex items-center gap-2 mb-1">
        <Star className="text-emerald-400" size={20} /> {/* Ajustado para um verde Tailwind similar */}
        <p className="text-sm text-white/60 tracking-widest uppercase">
          Itens Mais Vendidos
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* Gráfico de Pizza */}
        <div className="w-full md:w-1/2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData} // Usar os dados preparados para o gráfico
                dataKey="vendas"
                nameKey="nome"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={40}
                paddingAngle={3} // Reduzido o espaçamento entre as fatias
                labelLine={false} // Opcional: remover linhas de chamada para os rótulos
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} // Mostrar nome do produto e %
                // Se quiser apenas o nome: label={({ name }) => name}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CORES_GRAFICO_VERDE[index % CORES_GRAFICO_VERDE.length]}
                    stroke="#121212" // Cor de fundo do card para uma borda sutil
                    strokeWidth={1}   // Largura da borda
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#222",
                  border: "none",
                  color: "white",
                }}
                formatter={(value, name) => [`${value} vendas`, name]} // Tooltip mostra "X vendas"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Detalhes e insights */}
        <div className="flex flex-col gap-3 text-sm w-full md:w-1/2">
          <div className="text-white text-lg font-semibold flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-400" /> {/* Ajustado */}
            Item em destaque:
            <span className="bg-emerald-400/20 text-emerald-400 px-2 py-0.5 rounded-full text-sm"> {/* Ajustado */}
              {destaque.nome}
            </span>
          </div>

          <p className="text-white/60 flex items-center">
            <Target size={16} className="mr-2 text-emerald-400" /> {/* Ajustado */}
            Ticket médio:{" "}
            <span className="text-white font-medium">
              R$ {destaque.ticket.toFixed(2)}
            </span>
          </p>

          <p className="text-white/60 flex items-center">
            <DollarSign size={16} className="mr-2 text-emerald-400" /> {/* Ajustado */}
            Total arrecadado:{" "}
            <span className="text-white font-medium">
              R$ {(destaque.vendas * destaque.ticket).toFixed(2)}
            </span>
          </p>

          <p className="text-white/60 flex items-center">
            <Package size={16} className="mr-2 text-emerald-400" /> {/* Ajustado */}
            Estoque restante:{" "}
            <span
              className={`font-medium ${
                destaque.estoque < 10 ? 'text-emerald-600' : 'text-white' // Verde mais escuro para alerta
              }`}
            >
              {destaque.estoque} unidades
            </span>
          </p>
        </div>
      </div>

      {/* Botão de ação */}
      <button className="text-xs text-white/70 hover:text-white underline mt-2 self-start">
        Ver todos os produtos
      </button>
    </div>
  );
}
