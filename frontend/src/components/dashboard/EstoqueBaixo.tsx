"use client"

import { useState } from "react"
import { AlertCircle, Package, ArrowRight, Search } from "lucide-react"

interface ProdutoCritico {
  id: number
  nome: string
  quantidade: number
  minimo: number
  categoria: string
  imagem?: string
}

const produtosCriticos: ProdutoCritico[] = [
  {
    id: 1,
    nome: "Camiseta Kashy",
    quantidade: 3,
    minimo: 10,
    categoria: "Roupas",
    imagem: "/placeholder.svg?height=40&width=40",
  },
  {
    id: 2,
    nome: "Caneca Verde",
    quantidade: 2,
    minimo: 5,
    categoria: "Acessórios",
    imagem: "/placeholder.svg?height=40&width=40",
  },
  {
    id: 3,
    nome: "Adesivo",
    quantidade: 1,
    minimo: 20,
    categoria: "Acessórios",
    imagem: "/placeholder.svg?height=40&width=40",
  },
  {
    id: 4,
    nome: "Moletom Kashy",
    quantidade: 4,
    minimo: 8,
    categoria: "Roupas",
    imagem: "/placeholder.svg?height=40&width=40",
  },
  {
    id: 5,
    nome: "Boné Kashy",
    quantidade: 2,
    minimo: 10,
    categoria: "Acessórios",
    imagem: "/placeholder.svg?height=40&width=40",
  },
]

// Função para calcular o nível de criticidade
function getNivelCriticidade(quantidade: number, minimo: number): "critico" | "baixo" | "medio" {
  const percentual = (quantidade / minimo) * 100
  if (percentual <= 20) return "critico"
  if (percentual <= 50) return "baixo"
  return "medio"
}

export default function EstoqueBaixo() {
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const produtosFiltrados = produtosCriticos.filter((produto) =>
    produto.nome.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const totalCritico = produtosCriticos.filter((p) => getNivelCriticidade(p.quantidade, p.minimo) === "critico").length
  const totalBaixo = produtosCriticos.filter((p) => getNivelCriticidade(p.quantidade, p.minimo) === "baixo").length

  if (isLoading) {
    return (
      <div className="h-full flex flex-col text-white">
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-600 rounded animate-pulse" />
            <div className="w-32 h-5 bg-gray-600 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-700 rounded-lg p-3 animate-pulse h-12" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col text-white">
      <div className="p-4 border-b border-gray-600">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-400" />
          Estoque Baixo
        </h2>
      </div>

      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-gray-300">{totalCritico} críticos</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span className="text-gray-300">{totalBaixo} baixos</span>
          </div>
        </div>

        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-md text-xs pl-7 pr-2 py-1 w-24 focus:outline-none focus:ring-1 focus:ring-[#14B498] text-white"
          />
        </div>
      </div>

      <ul className="flex-1 space-y-2 px-4 pb-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {produtosFiltrados.length === 0 ? (
          <li className="text-center py-4 text-gray-400 text-sm">Nenhum produto encontrado</li>
        ) : (
          produtosFiltrados.map((produto) => {
            const criticidade = getNivelCriticidade(produto.quantidade, produto.minimo)
            return (
              <li
                key={produto.id}
                className="flex justify-between items-center bg-gray-800/50 px-3 py-2 rounded-lg hover:bg-gray-700/50 transition-colors duration-200"
              >
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-8 h-8 bg-gray-700 rounded-md flex items-center justify-center">
                      <Package className="w-4 h-4 text-gray-400" />
                    </div>
                    <div
                      className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
                        criticidade === "critico"
                          ? "bg-red-500"
                          : criticidade === "baixo"
                            ? "bg-yellow-500"
                            : "bg-orange-500"
                      }`}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{produto.nome}</div>
                    <div className="text-xs text-gray-400">{produto.categoria}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold ${
                      criticidade === "critico"
                        ? "text-red-400"
                        : criticidade === "baixo"
                          ? "text-yellow-400"
                          : "text-orange-400"
                    }`}
                  >
                    {produto.quantidade} un
                  </span>
                  <button className="text-gray-400 hover:text-[#14B498] transition-colors">
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
