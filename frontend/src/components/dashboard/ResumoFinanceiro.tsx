// c:\Users\gustavo.rosa8\Desktop\Kashy-Project\frontend\src\components\dashboard\ResumoFinanceiro.tsx
"use client"

import { useState, useMemo } from "react"
import { ArrowDownCircle, ArrowUpCircle, TrendingUp, TrendingDown, DollarSign, Calendar, Eye } from "lucide-react"

interface DadosFinanceiros {
  totalVendido: number
  entradas: number
  saidas: number
  periodo: string
  crescimentoVendas: number
  crescimentoEntradas: number
  crescimentoSaidas: number
  metaMensal: number
  diasRestantes: number
}

const dadosFinanceiros: DadosFinanceiros = {
  totalVendido: 12340.5,
  entradas: 8720.0,
  saidas: 3620.5,
  periodo: "Últimos 7 dias",
  crescimentoVendas: 15.3,
  crescimentoEntradas: 12.8,
  crescimentoSaidas: -8.2,
  metaMensal: 50000,
  diasRestantes: 23,
}

export default function ResumoFinanceiro() {
  const [isLoading, setIsLoading] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const metricas = useMemo(() => {
    const lucroLiquido = dadosFinanceiros.entradas - dadosFinanceiros.saidas
    const margemLucro = (lucroLiquido / dadosFinanceiros.entradas) * 100
    const progressoMeta = (dadosFinanceiros.totalVendido / dadosFinanceiros.metaMensal) * 100
    const projecaoMensal = (dadosFinanceiros.totalVendido / 7) * 30 // Projeção baseada nos últimos 7 dias

    return {
      lucroLiquido,
      margemLucro,
      progressoMeta,
      projecaoMensal,
    }
  }, [])

  if (isLoading) {
    return (
      <div className="h-full p-6 text-white flex flex-col justify-between">
        <div>
          <div className="w-40 h-6 bg-white/20 rounded animate-pulse mb-2" />
          <div className="w-24 h-4 bg-white/10 rounded animate-pulse" />
        </div>

        <div className="my-6">
          <div className="w-48 h-10 bg-white/20 rounded animate-pulse mb-2" />
          <div className="w-32 h-4 bg-white/10 rounded animate-pulse" />
        </div>

        <div className="flex justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 bg-white/20 rounded-full animate-pulse" />
            <div>
              <div className="w-16 h-4 bg-white/10 rounded animate-pulse mb-1" />
              <div className="w-20 h-4 bg-white/20 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 bg-white/20 rounded-full animate-pulse" />
            <div>
              <div className="w-16 h-4 bg-white/10 rounded animate-pulse mb-1" />
              <div className="w-20 h-4 bg-white/20 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full p-6 text-white flex flex-col justify-between relative overflow-hidden">
      {/* Elementos decorativos de fundo */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12" />

      {/* Header */}
      <div className="relative z-10 mb-1">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-white/90" />
              Resumo Financeiro
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-white/60" />
              <p className="text-sm text-white/70">{dadosFinanceiros.periodo}</p>
            </div>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
          >
            <Eye className="w-5 h-5 text-white/70 hover:text-white" />
          </button>
        </div>
      </div>

      {/* Valor principal */}
      <div className="relative z-10"> {/* Removido text-center */}
        <div className="mb-2">
          <p className="text-4xl font-bold tracking-tight">
            R$ {dadosFinanceiros.totalVendido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <div className="flex items-center gap-2 mt-2"> {/* Removido justify-center */}
            <p className="text-sm text-white/70">Total vendido</p>
            {dadosFinanceiros.crescimentoVendas > 0 ? (
              <div className="flex items-center gap-1 bg-green-500/20 px-2 py-1 rounded-full">
                <TrendingUp className="w-3 h-3 text-green-300" />
                <span className="text-xs font-medium text-green-300">+{dadosFinanceiros.crescimentoVendas}%</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-red-500/20 px-2 py-1 rounded-full">
                <TrendingDown className="w-3 h-3 text-red-300" />
                <span className="text-xs font-medium text-red-300">{dadosFinanceiros.crescimentoVendas}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Barra de progresso da meta */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-white/60 mb-1">
            <span>Meta mensal</span>
            <span>{metricas.progressoMeta.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-white to-white/80 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(metricas.progressoMeta, 100)}%` }}
            />
          </div>
          <p className="text-xs text-white/60 mt-1">
            R$ {dadosFinanceiros.metaMensal.toLocaleString("pt-BR")} • {dadosFinanceiros.diasRestantes} dias restantes
          </p>
        </div>
      </div>

      {/* Entradas e Saídas */}
      <div className="relative z-10">
        <div className="flex justify-between gap-6">
          {/* Entradas */}
          <div className="flex items-center space-x-3 bg-white/10 rounded-lg p-3 flex-1">
            <div className="p-2 bg-green-500/20 rounded-full">
              <ArrowUpCircle className="text-green-300 w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white/90">Entradas</p>
              <p className="text-green-200 font-bold">
                R$ {dadosFinanceiros.entradas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              {dadosFinanceiros.crescimentoEntradas !== 0 && (
                <div className="flex items-center gap-1 mt-1">
                  {dadosFinanceiros.crescimentoEntradas > 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-300" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-300" />
                  )}
                  <span
                    className={`text-xs font-medium ${
                      dadosFinanceiros.crescimentoEntradas > 0 ? "text-green-300" : "text-red-300"
                    }`}
                  >
                    {dadosFinanceiros.crescimentoEntradas > 0 ? "+" : ""}
                    {dadosFinanceiros.crescimentoEntradas}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Saídas */}
          <div className="flex items-center space-x-3 bg-white/10 rounded-lg p-3 flex-1">
            <div className="p-2 bg-red-500/20 rounded-full">
              <ArrowDownCircle className="text-red-300 w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white/90">Saídas</p>
              <p className="text-red-200 font-bold">
                R$ {dadosFinanceiros.saidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              {dadosFinanceiros.crescimentoSaidas !== 0 && (
                <div className="flex items-center gap-1 mt-1">
                  {dadosFinanceiros.crescimentoSaidas > 0 ? (
                    <TrendingUp className="w-3 h-3 text-red-300" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-green-300" />
                  )}
                  <span
                    className={`text-xs font-medium ${
                      dadosFinanceiros.crescimentoSaidas > 0 ? "text-red-300" : "text-green-300"
                    }`}
                  >
                    {dadosFinanceiros.crescimentoSaidas > 0 ? "+" : ""}
                    {dadosFinanceiros.crescimentoSaidas}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Métricas adicionais (mostradas quando showDetails é true) */}
        {showDetails && (
          <div className="mt-4 grid grid-cols-2 gap-3 animate-in slide-in-from-bottom duration-300">
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-xs text-white/70 mb-1">Lucro Líquido</p>
              <p className="font-bold text-white">
                R$ {metricas.lucroLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-white/60">Margem: {metricas.margemLucro.toFixed(1)}%</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-xs text-white/70 mb-1">Projeção Mensal</p>
              <p className="font-bold text-white">
                R$ {metricas.projecaoMensal.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-white/60">Baseado nos últimos 7 dias</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
