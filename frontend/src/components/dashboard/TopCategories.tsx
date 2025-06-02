// c:\Users\gustavo.rosa8\Desktop\Kashy-Project\frontend\src\components\dashboard\TopCategories.tsx
"use client"

import { useState } from "react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { PieChartIcon as ChartPie, TrendingUp, TrendingDown } from "lucide-react"

const data = [
  { name: "Roupas", value: 4000, percentual: 40, crescimento: 12 },
  { name: "Acessórios", value: 3000, percentual: 30, crescimento: -5 },
  { name: "Calçados", value: 2000, percentual: 20, crescimento: 8 },
  { name: "Cosméticos", value: 1000, percentual: 10, crescimento: 15 },
]

const COLORS = ["#14B498", "#FFB547", "#FF8042", "#9F7AEA"]

// Tooltip customizado
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
        <p className="font-medium text-white mb-1">{item.name}</p>
        <p className="text-sm text-gray-300">
          Vendas: <span className="text-white font-medium">R$ {item.value.toLocaleString("pt-BR")}</span>
        </p>
        <p className="text-sm text-gray-300">
          Participação: <span className="text-white font-medium">{item.percentual}%</span>
        </p>
        <div className="flex items-center gap-1 mt-1 text-sm">
          <span className="text-gray-300">Crescimento:</span>
          {item.crescimento > 0 ? (
            <div className="flex items-center text-[#14B498]">
              <TrendingUp className="w-3 h-3 mr-1" />+{item.crescimento}%
            </div>
          ) : (
            <div className="flex items-center text-red-400">
              <TrendingDown className="w-3 h-3 mr-1" />
              {item.crescimento}%
            </div>
          )}
        </div>
      </div>
    )
  }
  return null
}

export default function TopCategories() {
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index)
  }

  const onPieLeave = () => {
    setActiveIndex(null)
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col text-white">
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-600 rounded animate-pulse" />
            <div className="w-32 h-5 bg-gray-600 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full bg-gray-700 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col text-white">
      <div className="p-4 border-b border-gray-600">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ChartPie className="w-5 h-5 text-[#14B498]" />
          Top Categorias
        </h2>
      </div>

      {/* Conteúdo Principal: Gráfico e Lista Detalhada */}
      {/* Em telas < md, gráfico e lista ficam um abaixo do outro. Em >= md, ficam lado a lado. */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Contêiner do Gráfico */}
        {/* md:w-2/5 define a largura em telas médias ou maiores. */}
        <div className="w-full md:w-2/5 md:h-full p-3 md:pr-1.5 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="55%" // Ajuste para um anel mais fino ou mais grosso
                outerRadius="85%"
                paddingAngle={5}
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={activeIndex === index ? COLORS[index % COLORS.length] : `${COLORS[index % COLORS.length]}99`} // Cor mais clara se não ativo
                    stroke="transparent"
                    style={{
                      transition: "all 0.3s ease",
                      transform: activeIndex === index ? "scale(1.03)" : "scale(1)",
                      transformOrigin: "center center",
                    }}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Lista detalhada / Legenda Interativa */}
        {/* md:w-3/5 define a largura. md:h-full para ocupar altura. overflow-y-auto para scroll interno. */}
        <div className="w-full md:w-3/5 md:h-full flex flex-col p-3 md:pl-1.5 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {data.map((item, index) => (
            <div
              key={item.name}
              className={`group flex justify-between items-center p-3 rounded-lg transition-all duration-200 cursor-pointer hover:bg-gray-700/30 ${
                activeIndex === index ? "bg-gray-700/40 ring-1 ring-[#14B498]" : ""
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <div>
                  <div className="text-sm font-medium text-white">{item.name}</div>
                  <div className="text-xs text-gray-400">
                    R$ {item.value.toLocaleString("pt-BR")} ({item.percentual}%)
                  </div>
                </div>
              </div>
              <div className={`flex items-center gap-1 text-xs font-medium ${item.crescimento > 0 ? "text-[#14B498]" : "text-red-400"}`}>
                {item.crescimento > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {item.crescimento > 0 ? "+" : ""}
                {item.crescimento}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
