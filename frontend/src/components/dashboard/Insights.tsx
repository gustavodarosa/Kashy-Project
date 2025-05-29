"use client"

import { useState } from "react"
import { TrendingUp, TrendingDown, AlarmClock, PackageSearch, Lightbulb, ChevronRight } from "lucide-react"

const insights = [
  {
    icon: <TrendingUp className="text-[#14B498] w-5 h-5" />,
    titulo: "Mais vendido do mês",
    texto: "Camiseta Kashy teve 32 vendas em maio.",
    tag: "Vendas",
    acao: "Ver produto",
  },
  {
    icon: <TrendingDown className="text-yellow-400 w-5 h-5" />,
    titulo: "Ticket médio caiu",
    texto: "Redução de 12% em relação à semana anterior.",
    tag: "Financeiro",
    acao: "Ver relatório",
  },
  {
    icon: <AlarmClock className="text-blue-400 w-5 h-5" />,
    titulo: "Melhor horário de vendas",
    texto: "Entre 11h e 14h você vendeu 40% mais.",
    tag: "Análise",
    acao: "Ver detalhes",
  },
  {
    icon: <PackageSearch className="text-red-400 w-5 h-5" />,
    titulo: "Estoque baixo no mais vendido",
    texto: "Camiseta Kashy tem apenas 3 unidades restantes.",
    tag: "Estoque",
    acao: "Repor estoque",
  },
  {
    icon: <TrendingUp className="text-purple-400 w-5 h-5" />,
    titulo: "Acessórios em alta",
    texto: "Vendas de acessórios cresceram 18% este mês.",
    tag: "Tendência",
    acao: "Ver categoria",
  },
]

export default function Insights() {
  const [isLoading, setIsLoading] = useState(false)
  const [activeInsight, setActiveInsight] = useState<number | null>(null)

  if (isLoading) {
    return (
      <div className="h-full flex flex-col text-white">
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-600 rounded animate-pulse" />
            <div className="w-24 h-5 bg-gray-600 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3 bg-gray-700 rounded-lg p-3 animate-pulse">
              <div className="w-8 h-8 bg-gray-600 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="w-24 h-4 bg-gray-600 rounded" />
                <div className="w-40 h-3 bg-gray-600 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col text-white">
      <div className="p-4 border-b border-gray-600">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-[#14B498]" />
          Insights
        </h2>
      </div>

      <div className="flex-1 p-3 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 bg-gray-800/50 rounded-lg p-3 hover:bg-gray-700/50 transition-all duration-200 cursor-pointer ${
              activeInsight === i ? "ring-1 ring-[#14B498]" : ""
            }`}
            onClick={() => setActiveInsight(i === activeInsight ? null : i)}
          >
            <div className="p-1.5 bg-gray-800 rounded-full">{insight.icon}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="font-medium">{insight.titulo}</div>
                <span className="text-xs px-2 py-0.5 bg-gray-700 rounded-full text-gray-300">{insight.tag}</span>
              </div>
              <div className="text-gray-400 text-sm mt-1">{insight.texto}</div>

              {activeInsight === i && (
                <button className="mt-2 flex items-center gap-1 text-xs text-[#14B498] hover:underline">
                  {insight.acao}
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
