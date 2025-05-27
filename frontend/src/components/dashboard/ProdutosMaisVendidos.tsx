// z:/slaaa/Kashy-Project/frontend/src/components/dashboard/ProdutosMaisVendidos.tsx
"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { name: "Café", value: 38 },
  { name: "Água", value: 33 },
  { name: "Refrigerante", value: 19 },
  { name: "Outros", value: 10 },
];

const COLORS = ["#14B8A6", "#0EA5E9", "#F59E0B", "#EF4444"];

export default function ProdutosMaisVendidos() {
  return (
    <div className="h-full p-5 text-white flex flex-col">
      <h2 className="text-xl font-semibold mb-4">Produtos Mais Vendidos</h2>

      {/* Área do Gráfico com altura fixa */}
      <div className="w-full h-[130px]"> {/* Altura ajustada para o gráfico */}
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              // Raio ajustado para caber na nova altura
              innerRadius={35}
              // Raio ajustado para caber na nova altura
              outerRadius={55}
              dataKey="value"
              stroke="none"
              paddingAngle={3}
            >
              {data.map((_, index) => ( // Replaced 'entry' with '_' as it's not used
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "none",
                borderRadius: 8,
                color: "white",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Área da Legenda com scroll se necessário */}
      <div className="flex-1 mt-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent pr-2">
        <ul className="space-y-1 text-sm w-full">
          {data.map((item, index) => (
            <li key={item.name} className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index] }}
                />
                <span>{item.name}</span>
              </div>
              <span className="text-gray-300">{item.value}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
