"use client"

import { useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { BarChart3, TrendingUp, Calendar } from "lucide-react"

const data = [
  { name: "Semana 1", Abril: 3200, Maio: 4100, crescimento: 28 },
  { name: "Semana 2", Abril: 2700, Maio: 3900, crescimento: 44 },
  { name: "Semana 3", Abril: 3100, Maio: 4500, crescimento: 45 },
  { name: "Semana 4", Abril: 2900, Maio: 4700, crescimento: 62 },
]

// Tooltip customizado
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const abril = payload[0].value
    const maio = payload[1].value
    const crescimento = ((maio - abril) / abril) * 100

    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
        <p className="font-medium text-white mb-1">{label}</p>
        <div className="space-y-1 text-sm">
          <p className="text-gray-300">
            Abril: <span className="text-white font-medium">R$ {abril.toLocaleString("pt-BR")}</span>
          </p>
          <p className="text-gray-300">
            Maio: <span className="text-[#14B498] font-medium">R$ {maio.toLocaleString("pt-BR")}</span>
          </p>
          <div className="flex items-center gap-1 pt-1 border-t border-gray-700 mt-1">
            <TrendingUp className="w-3 h-3 text-[#14B498]" />
            <span className="text-[#14B498] font-medium">+{crescimento.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

export default function SalesComparisonChart() {
  const [isLoading, setIsLoading] = useState(false)

  // Calcular o crescimento total
  const totalAbril = data.reduce((sum, item) => sum + item.Abril, 0)
  const totalMaio = data.reduce((sum, item) => sum + item.Maio, 0)
  const crescimentoTotal = ((totalMaio - totalAbril) / totalAbril) * 100

  if (isLoading) {
    return (
      <div className="h-full flex flex-col text-white">
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-600 rounded animate-pulse" />
            <div className="w-40 h-5 bg-gray-600 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 bg-gray-700 m-4 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col text-white">
      <div className="p-4 border-b border-gray-600">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#14B498]" />
            Comparativo Mensal
          </h2>
          <div className="flex items-center gap-1 text-xs bg-gray-800 px-2 py-1 rounded-md">
            <Calendar className="w-3 h-3 text-gray-400" />
            <span className="text-gray-400">Abril vs Maio</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {/* Métricas resumidas */}
        <div className="grid grid-cols-3 gap-2 p-3">
          <div className="col-span-2 bg-gray-800/50 rounded-lg p-2">
            <div className="text-gray-400 text-xs mb-1">Crescimento Total</div>
            <div className="font-medium text-[#14B498] flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />+{crescimentoTotal.toFixed(1)}%
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-2">
            <div className="text-gray-400 text-xs mb-1">Melhor Semana</div>
            <div className="font-medium text-white text-sm">Semana 4</div>
          </div>
        </div>

        {/* Gráfico */}
        <div className="flex-1 overflow-hidden px-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={0} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#9CA3AF"
                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                tickLine={{ stroke: "#4B5563" }}
                axisLine={{ stroke: "#4B5563" }}
              />
              <YAxis
                stroke="#9CA3AF"
                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                tickLine={{ stroke: "#4B5563" }}
                axisLine={{ stroke: "#4B5563" }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Abril" fill="#6B7280" radius={[4, 4, 0, 0]} maxBarSize={20} />
              <Bar dataKey="Maio" fill="#14B498" radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legenda */}
        <div className="flex justify-center gap-4 p-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-500 rounded" />
            <span className="text-gray-300">Abril</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[#14B498] rounded" />
            <span className="text-gray-300">Maio</span>
          </div>
        </div>
      </div>
    </div>
  )
}
