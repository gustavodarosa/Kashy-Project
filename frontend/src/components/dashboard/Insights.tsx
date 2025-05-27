// z:/slaaa/Kashy-Project/frontend/src/components/dashboard/Insights.tsx
import { TrendingUp, TrendingDown, AlarmClock, PackageSearch } from "lucide-react";

const insights = [
  {
    icon: <TrendingUp className="text-green-400 w-5 h-5" />,
    titulo: "Mais vendido do mês",
    texto: "Camiseta Kashy teve 32 vendas em maio.",
  },
  {
    icon: <TrendingDown className="text-yellow-400 w-5 h-5" />,
    titulo: "Ticket médio caiu",
    texto: "Redução de 12% em relação à semana anterior.",
  },
  {
    icon: <AlarmClock className="text-blue-400 w-5 h-5" />,
    titulo: "Melhor horário de vendas",
    texto: "Entre 11h e 14h você vendeu 40% mais.",
  },
  {
    icon: <PackageSearch className="text-red-400 w-5 h-5" />,
    titulo: "Estoque baixo no mais vendido",
    texto: "Camiseta Kashy tem apenas 3 unidades restantes.",
  },
];

export default function Insights() {
  return (
    <div className="h-full p-5 text-white flex flex-col">
      <h2 className="text-xl font-semibold mb-4">📊 Insights</h2>
      <div className="flex-1 space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent pr-2">
        {insights.map((insight, i) => (
          <div
            key={i}
            className="flex items-start gap-3 bg-white/5 rounded-xl p-3 hover:bg-white/10 transition"
          >
            <div className="p-1">{insight.icon}</div>
            <div>
              <div className="font-medium">{insight.titulo}</div>
              <div className="text-white/70 text-sm">{insight.texto}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
