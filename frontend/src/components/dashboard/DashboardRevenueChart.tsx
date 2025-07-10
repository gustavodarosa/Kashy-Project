"use client"

import { useState } from "react"
import { Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, ComposedChart } from "recharts"
import { TrendingUp, Calendar, ArrowUpRight, Filter } from "lucide-react"

const revenuePerDay = [
  { date: "01/05", total: 430, meta: 400 },
  { date: "02/05", total: 560, meta: 400 },
  { date: "03/05", total: 300, meta: 400 },
  { date: "04/05", total: 720, meta: 400 },
  { date: "05/05", total: 410, meta: 400 },
  { date: "06/05", total: 540, meta: 400 },
  { date: "07/05", total: 890, meta: 400 },
  { date: "08/05", total: 400, meta: 400 },
  { date: "09/05", total: 750, meta: 400 },
  { date: "10/05", total: 620, meta: 400 },
  { date: "11/05", total: 480, meta: 400 },
  { date: "12/05", total: 650, meta: 400 },
  { date: "13/05", total: 710, meta: 400 },
  { date: "14/05", total: 530, meta: 400 },
  { date: "15/05", total: 900, meta: 600 },
  { date: "16/05", total: 600, meta: 600 },
  { date: "17/05", total: 810, meta: 600 },
  { date: "18/05", total: 450, meta: 600 },
  { date: "19/05", total: 680, meta: 600 },
  { date: "20/05", total: 720, meta: 600 },
  { date: "21/05", total: 500, meta: 600 },
  { date: "22/05", total: 950, meta: 600 },
  { date: "23/05", total: 630, meta: 600 },
  { date: "24/05", total: 850, meta: 600 },
  { date: "25/05", total: 470, meta: 600 },
  { date: "26/05", total: 700, meta: 600 },
  { date: "27/05", total: 760, meta: 600 },
  { date: "28/05", total: 520, meta: 600 },
  { date: "29/05", total: 980, meta: 600 },
  { date: "30/05", total: 670, meta: 600 },
]

// Tooltip customizado
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const total = data.total
    const meta = data.meta
    const diferenca = total - meta
    const percentual = (diferenca / meta) * 100

    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
        <p className="font-medium text-white mb-2">{label}</p>
        <div className="space-y-1">
          <p className="text-sm text-gray-300">
            Faturamento: <span className="text-white font-medium">R$ {total.toLocaleString("pt-BR")}</span>
          </p>
          <p className="text-sm text-gray-300">
            Meta: <span className="text-white font-medium">R$ {meta.toLocaleString("pt-BR")}</span>
          </p>
          {diferenca !== 0 && (
            <div className="flex items-center gap-1 pt-1 border-t border-gray-700 mt-1">
              {diferenca > 0 ? (
                <div className="flex items-center text-[#14B498]">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  <span className="text-sm font-medium">+{percentual.toFixed(1)}% acima da meta</span>
                </div>
              ) : (
                <div className="flex items-center text-red-400">
                  <ArrowUpRight className="w-3 h-3 mr-1 rotate-90" />
                  <span className="text-sm font-medium">{percentual.toFixed(1)}% abaixo da meta</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
  return null
}

// Componente customizado para o ponto ativo brilhante no hover
const CustomActiveDot = (props: any) => {
  const { cx, cy } = props

  // Não renderiza nada se as coordenadas não estiverem disponíveis
  if (!cx || !cy) {
    return null
  }

  return (
    <g>
      {/* Círculo maior que cria o efeito de brilho (glow) */}
      <circle cx={cx} cy={cy} r={10} fill="#34d399" filter="url(#neon-glow-active)" />
      {/* Círculo menor e sólido que representa o ponto exato */}
      <circle cx={cx} cy={cy} r={5} fill="#14B498" stroke="#0f172a" strokeWidth={2} />
    </g>
  )
}

export function DashboardRevenueChart() {
  const [isLoading, setIsLoading] = useState(false)
  const [showMeta, setShowMeta] = useState(true)

  // Calcular métricas
  const totalFaturamento = revenuePerDay.reduce((sum, day) => sum + day.total, 0)
  const totalMeta = revenuePerDay.reduce((sum, day) => sum + day.meta, 0)
  const mediaFaturamento = totalFaturamento / revenuePerDay.length
  const maiorFaturamento = Math.max(...revenuePerDay.map((day) => day.total))
  const diaMaiorFaturamento = revenuePerDay.find((day) => day.total === maiorFaturamento)?.date

  // Calcular dias acima da meta
  const diasAcimaMeta = revenuePerDay.filter((day) => day.total > day.meta).length
  const percentualAcimaMeta = (diasAcimaMeta / revenuePerDay.length) * 100

  if (isLoading) {
    return (
      <div className="h-full flex flex-col text-white">
        <div className="p-6 border-b border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gray-600 rounded animate-pulse" />
              <div className="w-48 h-6 bg-gray-600 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex-1 p-6">
          <div className="h-full bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col text-white">
      <div className="p-6 border-b border-gray-600">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#14B498] drop-shadow-[0_0_5px_#14B498]" />
            <h2 className="text-xl font-semibold">Faturamento Diário</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-sm bg-gray-800 px-3 py-1 rounded-md">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-300">Maio 2025</span>
            </div>
            <button
              onClick={() => setShowMeta(!showMeta)}
              className={`flex items-center gap-1 text-sm px-3 py-1 rounded-md transition-colors ${
                showMeta ? "bg-[#14B498]/20 text-[#14B498]" : "bg-gray-800 text-gray-300"
              }`}
            >
              <Filter className="w-4 h-4" />
              {showMeta ? "Ocultar Meta" : "Mostrar Meta"}
            </button>
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-gray-400 text-sm mb-1">Total Faturado</div>
          <div className="text-xl font-bold text-white">R$ {totalFaturamento.toLocaleString("pt-BR")}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-gray-400 text-sm mb-1">Média Diária</div>
          <div className="text-xl font-bold text-[#14B498]">
            R$ {mediaFaturamento.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-gray-400 text-sm mb-1">Maior Faturamento</div>
          <div className="text-xl font-bold text-white">R$ {maiorFaturamento.toLocaleString("pt-BR")}</div>
          <div className="text-xs text-gray-400 mt-1">Dia {diaMaiorFaturamento}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-gray-400 text-sm mb-1">Dias Acima da Meta</div>
          <div className="text-xl font-bold text-[#14B498]">{diasAcimaMeta} dias</div>
          <div className="text-xs text-gray-400 mt-1">{percentualAcimaMeta.toFixed(0)}% do mês</div>
        </div>
      </div>

      {/* Gráfico */}
      <div className="flex-1 px-6 pb-6">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={revenuePerDay}>
            <defs>
              <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#14B498" floodOpacity="0.7" />
              </filter>
              {/* Filtro mais intenso e claro para o efeito de hover */}
              <filter id="neon-glow-active" x="-150%" y="-150%" width="400%" height="400%">
                <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#34d399" floodOpacity="1" />
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#94a3b8"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={{ stroke: "#4B5563" }}
              axisLine={{ stroke: "#4B5563" }}
              interval="preserveStartEnd"
              minTickGap={15}
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={{ stroke: "#4B5563" }}
              axisLine={{ stroke: "#4B5563" }}
              tickFormatter={(value) => `R$ ${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#14B498"
              strokeWidth={2}
              fill="transparent"
              dot={{ r: 0 }}
              activeDot={<CustomActiveDot />}
              filter="url(#neon-glow)"
            />
            {showMeta && (
              <Line type="monotone" dataKey="meta" stroke="#94a3b8" strokeWidth={1} strokeDasharray="5 5" dot={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
