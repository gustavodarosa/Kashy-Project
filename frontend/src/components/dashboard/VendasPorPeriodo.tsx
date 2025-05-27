// z:/slaaa/Kashy-Project/frontend/src/components/dashboard/VendasPorPeriodo.tsx
"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const dados = {
  Hoje: [
    { hora: "08h", vendas: 120 },
    { hora: "10h", vendas: 200 },
    { hora: "12h", vendas: 150 },
    { hora: "14h", vendas: 300 },
    { hora: "16h", vendas: 180 },
  ],
  Semana: [
    { dia: "Seg", vendas: 900 },
    { dia: "Ter", vendas: 1200 },
    { dia: "Qua", vendas: 1100 },
    { dia: "Qui", vendas: 1350 },
    { dia: "Sex", vendas: 1500 },
    { dia: "Sáb", vendas: 800 },
    { dia: "Dom", vendas: 400 },
  ],
  Mês: [
    { semana: "01-07", vendas: 3200 },
    { semana: "08-14", vendas: 4500 },
    { semana: "15-21", vendas: 3800 },
    { semana: "22-28", vendas: 5000 },
  ],
};

export default function VendasPorPeriodo() {
  const [periodo, setPeriodo] = useState<"Hoje" | "Semana" | "Mês">("Semana");

  const data = dados[periodo];

  return (
    <div className="h-full p-5 text-white flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Vendas por Período</h2>
        <div className="flex gap-2">
          {(["Hoje", "Semana", "Mês"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setPeriodo(tab)}
              className={`px-3 py-1 rounded-full text-sm ${
                periodo === tab
                  ? "bg-white text-black font-semibold"
                  : "bg-[#1F2937] text-white/70"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden"> {/* Alterado de flex-grow para flex-1 e adicionado overflow-hidden */}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
          >
            <XAxis
              dataKey={periodo === "Hoje" ? "hora" : periodo === "Semana" ? "dia" : "semana"}
              stroke="#ccc"
              tick={{ fontSize: 12 }}
            />
            <YAxis stroke="#ccc" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1F2937", borderRadius: 8, border: "none" }}
              labelStyle={{ color: "#fff" }}
              cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
            />
            <Bar dataKey="vendas" fill="#14B498" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
