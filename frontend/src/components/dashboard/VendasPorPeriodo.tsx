"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { TrendingUp, TrendingDown, BarChart3, Minus } from "lucide-react"

interface DadosVenda {
  [key: string]: string | number
  vendas: number
  vendasAnterior?: number
}

const dados = {
  Hoje: [
    { hora: "08h", vendas: 120, vendasAnterior: 100 },
    { hora: "10h", vendas: 200, vendasAnterior: 180 },
    { hora: "12h", vendas: 150, vendasAnterior: 170 },
    { hora: "14h", vendas: 300, vendasAnterior: 250 },
    { hora: "16h", vendas: 180, vendasAnterior: 160 },
    { hora: "18h", vendas: 220, vendasAnterior: 200 },
  ],
  Semana: [
    { dia: "Seg", vendas: 900, vendasAnterior: 850 },
    { dia: "Ter", vendas: 1200, vendasAnterior: 1100 },
    { dia: "Qua", vendas: 1100, vendasAnterior: 1150 },
    { dia: "Qui", vendas: 1350, vendasAnterior: 1200 },
    { dia: "Sex", vendas: 1500, vendasAnterior: 1400 },
    { dia: "Sáb", vendas: 800, vendasAnterior: 750 },
    { dia: "Dom", vendas: 400, vendasAnterior: 380 },
  ],
  Mês: [
    { semana: "01-07", vendas: 3200, vendasAnterior: 3000 },
    { semana: "08-14", vendas: 4500, vendasAnterior: 4200 },
    { semana: "15-21", vendas: 3800, vendasAnterior: 4000 },
    { semana: "22-28", vendas: 5000, vendasAnterior: 4800 },
  ],
}

// Tooltip customizado para o gráfico
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const atual = payload[0].value
    const anterior = data.vendasAnterior || 0
    const diferenca = atual - anterior
    const percentual = anterior > 0 ? ((diferenca / anterior) * 100).toFixed(1) : 0

    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl">
        <p className="text-gray-300 text-xs mb-2">{label}</p>
        <div className="space-y-1">
          <p className="text-white font-semibold text-sm">R$ {atual.toLocaleString("pt-BR")}</p>
          {anterior > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">vs anterior:</span>
              <div className="flex items-center gap-1">
                {diferenca > 0 ? (
                  <TrendingUp className="w-3 h-3 text-[#14B498]" />
                ) : diferenca < 0 ? (
                  <TrendingDown className="w-3 h-3 text-red-400" />
                ) : (
                  <Minus className="w-3 h-3 text-gray-400" />
                )}
                <span
                  className={`font-medium ${
                    diferenca > 0 ? "text-[#14B498]" : diferenca < 0 ? "text-red-400" : "text-gray-400"
                  }`}
                >
                  {diferenca > 0 ? "+" : ""}
                  {percentual}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
  return null
}

export default function VendasPorPeriodo() {
  const [periodo, setPeriodo] = useState<"Hoje" | "Semana" | "Mês">("Semana")
  const [isLoading, setIsLoading] = useState(false)

  const data = dados[periodo] as DadosVenda[]

  // Cálculos de métricas
  const metricas = useMemo(() => {
    const totalAtual = data.reduce((acc, item) => acc + item.vendas, 0)
    const totalAnterior = data.reduce((acc, item) => acc + (item.vendasAnterior || 0), 0)
    const diferenca = totalAtual - totalAnterior
    const percentual = totalAnterior > 0 ? (diferenca / totalAnterior) * 100 : 0

    return {
      totalAtual,
      totalAnterior,
      diferenca,
      percentual,
    }
  }, [data])

  // Função para determinar a cor da barra baseada na performance
  const getBarColor = (value: number, previousValue?: number) => {
    if (!previousValue) return "#14B498"
    if (value > previousValue) return "#14B498" // Verde Kashy
    if (value < previousValue) return "#F59E0B" // Amarelo/laranja
    return "#6B7280" // Cinza neutro
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col text-white">
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gray-600 rounded animate-pulse" />
              <div className="w-32 h-5 bg-gray-600 rounded animate-pulse" />
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-12 h-6 bg-gray-600 rounded-full animate-pulse" />
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 bg-gray-700 m-4 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-600">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#14B498]" />
            <h2 className="text-lg font-semibold">Vendas por Período</h2>
          </div>

          {/* Tabs de período */}
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {(["Hoje", "Semana", "Mês"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setPeriodo(tab)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                  periodo === tab
                    ? "bg-[#14B498] text-white shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Métricas compactas */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-gray-400">Total: </span>
              <span className="font-semibold text-[#14B498]">R$ {metricas.totalAtual.toLocaleString("pt-BR")}</span>
            </div>
            {metricas.diferenca !== 0 && (
              <div className="flex items-center gap-1">
                {metricas.diferenca > 0 ? (
                  <TrendingUp className="w-4 h-4 text-[#14B498]" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
                <span className={`text-xs font-medium ${metricas.diferenca > 0 ? "text-[#14B498]" : "text-red-400"}`}>
                  {metricas.diferenca > 0 ? "+" : ""}
                  {metricas.percentual.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <div className="flex-1 overflow-hidden p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }} barCategoryGap="15%">
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14B498" stopOpacity={1} />
                <stop offset="100%" stopColor="#14B498" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey={periodo === "Hoje" ? "hora" : periodo === "Semana" ? "dia" : "semana"}
              stroke="#9CA3AF"
              tick={{ fontSize: 11, fill: "#9CA3AF" }}
              tickLine={{ stroke: "#4B5563" }}
              axisLine={{ stroke: "#4B5563" }}
            />
            <YAxis
              stroke="#9CA3AF"
              tick={{ fontSize: 11, fill: "#9CA3AF" }}
              tickLine={{ stroke: "#4B5563" }}
              axisLine={{ stroke: "#4B5563" }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="vendas"
              fill="url(#barGradient)"
              radius={[4, 4, 0, 0]}
              animationDuration={600}
              animationBegin={0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.vendas, entry.vendasAnterior)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
