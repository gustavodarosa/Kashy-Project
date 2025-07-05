"use client"

import { useState, useEffect } from "react"
import { AlertCircle, Package, ArrowRight, Search } from "lucide-react"

interface Produto {
  _id: string
  name: string
  quantity: number
  category: string
}

export default function EstoqueBaixo() {
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [produtos, setProdutos] = useState<Produto[]>([])

  useEffect(() => {
    const fetchProdutosBaixoEstoque = async () => {
      try {
        setIsLoading(true)
        const token = localStorage.getItem("token")
        const store = localStorage.getItem("store") // <- pega a loja logada
        if (!store) {
          setProdutos([])
          setIsLoading(false)
          return
        }
        const response = await fetch(`http://localhost:3000/api/products/low-stock?store=${encodeURIComponent(store)}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!response.ok) {
          throw new Error("Erro ao buscar produtos com estoque baixo")
        }
        const data: Produto[] = await response.json()
        setProdutos(data)
      } catch (error) {
        console.error("Erro ao buscar produtos com estoque baixo:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProdutosBaixoEstoque()
  }, [])

  const produtosFiltrados = produtos.filter(
    (produto) =>
      (produto.quantity === 0 || (produto.quantity > 0 && produto.quantity <= 15)) &&
      produto.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

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
          Controle de Estoque
        </h2>
      </div>
      <ul className="flex-1 space-y-2 px-4 pb-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {produtosFiltrados.length === 0 ? (
          <li className="text-center py-4 text-gray-400 text-sm">Nenhum produto encontrado</li>
        ) : (
          produtosFiltrados.map((produto) => (
            <li
              key={produto._id}
              className={`flex justify-between items-center bg-gray-800/50 px-3 py-2 rounded-lg hover:bg-gray-700/50 transition-colors duration-200 ${
                produto.quantity === 0 ? "border-red-500" : produto.quantity <= 15 ? "border-yellow-500" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-8 h-8 bg-gray-700 rounded-md flex items-center justify-center">
                    <Package
                      className={`w-4 h-4 ${
                        produto.quantity === 0 ? "text-red-400" : produto.quantity <= 15 ? "text-yellow-400" : "text-gray-400"
                      }`}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">{produto.name}</div>
                  <div className="text-xs text-gray-400">{produto.category}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold ${
                    produto.quantity === 0 ? "text-red-400" : produto.quantity <= 15 ? "text-yellow-400" : "text-gray-400"
                  }`}
                >
                  {produto.quantity === 0 ? "Esgotado" : `${produto.quantity} un`}
                </span>
                <button className="text-gray-400 hover:text-[#14B498] transition-colors">
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
