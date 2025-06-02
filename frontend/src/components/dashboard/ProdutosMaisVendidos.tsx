// c:\Users\gustavo.rosa8\Desktop\Kashy-Project\frontend\src\components\dashboard\ProdutosMaisVendidos.tsx
"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, Cell, Tooltip, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { TrendingUp, Package, Crown, ArrowRight } from "lucide-react"

interface Produto {
  name: string
  value: number
  vendas: number
  crescimento: number
  categoria: string
}

const data: Produto[] = [
  { name: "Camiseta Kashy", value: 38, vendas: 156, crescimento: 12, categoria: "Roupas" },
  { name: "Caneca Verde", value: 33, vendas: 135, crescimento: 8, categoria: "Acessórios" },
  { name: "Moletom Kashy", value: 19, crescimento: -3, vendas: 78, categoria: "Roupas" },
  { name: "Adesivos", value: 10, vendas: 41, crescimento: 25, categoria: "Acessórios" },
]

const COLORS = ["#14B498", "#10B981", "#059669", "#047857"]

// Tooltip customizado
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload as Produto
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
        <p className="font-medium text-white mb-1">{item.name}</p>
        <div className="space-y-1 text-sm">
          <p className="text-gray-300">
            Participação: <span className="text-white font-medium">{item.value}%</span>
          </p>
          <p className="text-gray-300">
            Vendas: <span className="text-white font-medium">{item.vendas} unidades</span>
          </p>
          <p className="text-gray-300">
            Categoria: <span className="text-white font-medium">{item.categoria}</span>
          </p>
          <div className="flex items-center gap-1 pt-1 border-t border-gray-700 mt-1">
            <TrendingUp className={`w-3 h-3 ${item.crescimento > 0 ? "text-[#14B498]" : "text-red-400"}`} />
            <span className={`font-medium ${item.crescimento > 0 ? "text-[#14B498]" : "text-red-400"}`}>
              {item.crescimento > 0 ? "+" : ""}
              {item.crescimento}%
            </span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

export default function ProdutosMaisVendidos() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const metricas = useMemo(() => {
    const totalVendas = data.reduce((sum, item) => sum + item.vendas, 0)
    const produtoLider = data[0]
    const maiorCrescimento = data.reduce((max, item) => (item.crescimento > max.crescimento ? item : max))

    return {
      totalVendas,
      produtoLider,
      maiorCrescimento,
    }
  }, [])

  const onBarEnter = (_: any, index: number) => {
    setActiveIndex(index)
  }

  const onBarLeave = () => {
    setActiveIndex(null)
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col text-white">
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-600 rounded animate-pulse" />
            <div className="w-40 h-5 bg-gray-600 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 p-4">
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-16 h-4 bg-gray-600 rounded animate-pulse" />
                <div className="flex-1 h-4 bg-gray-600 rounded animate-pulse" />
                <div className="w-8 h-4 bg-gray-600 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-600">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-[#14B498]" />
            Produtos Mais Vendidos
          </h2>
          <div className="flex items-center gap-1 text-xs bg-gray-800 px-2 py-1 rounded-md">
            <Crown className="w-3 h-3 text-yellow-400" />
            <span className="text-gray-300">Top 4</span>
          </div>
        </div>
      </div>

      {/* Métricas compactas */}
      <div className="grid grid-cols-3 gap-2 p-3 text-xs">
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-gray-400 mb-1">Líder</div>
          <div className="font-medium text-white truncate">{metricas.produtoLider.name}</div>
          <div className="text-[#14B498]">{metricas.produtoLider.value}%</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-gray-400 mb-1">Total Vendas</div>
          <div className="font-medium text-white">{metricas.totalVendas}</div>
          <div className="text-gray-400">unidades</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-gray-400 mb-1">+ Crescimento</div>
          <div className="font-medium text-white truncate">{metricas.maiorCrescimento.name}</div>
          <div className="text-[#14B498]">+{metricas.maiorCrescimento.crescimento}%</div>
        </div>
      </div>

      {/* Conteúdo Principal: Gráfico e Lista Detalhada */}
      {/* Em telas < md, gráfico e lista ficam um abaixo do outro. Em >= md, ficam lado a lado. */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Contêiner do Gráfico */}
        {/* md:w-3/5 define a largura em telas médias ou maiores. md:h-full para ocupar a altura do pai flex. */}
        <div className="w-full md:w-3/5 md:h-full p-3 md:pr-1.5 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 25, left: 0, bottom: 0 }} barCategoryGap="25%">
              <XAxis
                type="number"
                stroke="#9CA3AF"
                fontSize={9} // Reduzido para caber melhor
                tick={{ fill: "#9CA3AF", dy: 2 }} // dy para ajuste vertical do texto do tick
                tickLine={{ stroke: "#4B5563" }}
                axisLine={{ stroke: "#4B5563" }}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis
                dataKey="name"
                type="category"
                stroke="#9CA3AF"
                fontSize={9} // Reduzido para caber melhor
                tick={{ fill: "#9CA3AF", dx: -2 }} // dx para ajuste horizontal do texto do tick
                width={55} // Largura do eixo Y ajustada
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => {
                  // Truncar nomes longos para caber
                  return value.length > 7 ? `${value.substring(0, 7)}...` : value;
                }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(20, 180, 152, 0.08)" }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} onMouseEnter={onBarEnter} onMouseLeave={onBarLeave} barSize={12}> {/* Tamanho da barra reduzido */}
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index]}
                    opacity={activeIndex === null || activeIndex === index ? 1 : 0.6}
                    style={{
                      cursor: "pointer",
                      transition: "opacity 0.3s ease",
                    }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Lista detalhada */}
        {/* md:w-2/5 define a largura. md:h-full para ocupar altura. overflow-y-auto para scroll interno. */}
        <div className="w-full md:w-2/5 md:h-full flex flex-col p-3 md:pl-1.5 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {data.map((item, index) => (
            <div
              key={item.name}
              className={`group flex justify-between items-center p-2 rounded-lg transition-all duration-200 cursor-pointer hover:bg-gray-700/30 ${
                activeIndex === index ? "bg-gray-700/40" : ""
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                <div>
                  <div className="text-sm font-medium text-white">{item.name}</div>
                  <div className="text-xs text-gray-400">{item.categoria}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-sm font-bold text-white">{item.value}%</div>
                  <div className="text-xs text-gray-400">{item.vendas} un</div>
                </div>
                <div className="flex items-center gap-1">
                  {item.crescimento > 0 ? (
                    <TrendingUp className="w-3 h-3 text-[#14B498]" />
                  ) : (
                    <TrendingUp className="w-3 h-3 text-red-400 rotate-180" /> // Ícone rotacionado para queda
                  )}
                  <span className={`text-xs font-medium ${item.crescimento > 0 ? "text-[#14B498]" : "text-red-400"}`}>
                    {item.crescimento > 0 ? "+" : ""}
                    {item.crescimento}%
                  </span>
                </div>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-[#14B498]">
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
