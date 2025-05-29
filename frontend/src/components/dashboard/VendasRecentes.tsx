"use client"

import type React from "react"

import { Package, Hash, DollarSign, Clock, TrendingUp, Eye, MoreHorizontal } from "lucide-react"
import { useState, useRef, useEffect } from "react"

interface Venda {
  id: string
  produto: string
  quantidade: number
  total: number
  data: string
  status: "concluida" | "processando" | "cancelada"
  categoria: string
}

const vendasRecentes: Venda[] = [
  {
    id: "1",
    produto: "Camiseta Kashy",
    quantidade: 2,
    total: 120.0,
    data: "2025-05-26T14:12:00",
    status: "concluida",
    categoria: "Roupas",
  },
  {
    id: "2",
    produto: "Caneca Verde",
    quantidade: 1,
    total: 45.5,
    data: "2025-05-26T13:50:00",
    status: "concluida",
    categoria: "Acessórios",
  },
  {
    id: "3",
    produto: "Adesivo",
    quantidade: 3,
    total: 30.0,
    data: "2025-05-26T12:40:00",
    status: "processando",
    categoria: "Acessórios",
  },
  {
    id: "4",
    produto: "Moletom Kashy",
    quantidade: 1,
    total: 199.9,
    data: "2025-05-25T18:30:00",
    status: "concluida",
    categoria: "Roupas",
  },
  {
    id: "5",
    produto: "Boné Kashy",
    quantidade: 1,
    total: 89.9,
    data: "2025-05-25T16:20:00",
    status: "concluida",
    categoria: "Acessórios",
  },
]

// Componente Button customizado
function Button({
  children,
  variant = "default",
  size = "default",
  className = "",
  onClick,
  ...props
}: {
  children: React.ReactNode
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm"
  className?: string
  onClick?: () => void
  [key: string]: any
}) {
  const baseClasses =
    "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50"

  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    outline: "border border-gray-600 bg-transparent hover:bg-gray-700 text-gray-300",
    ghost: "hover:bg-gray-700 text-gray-300",
  }

  const sizes = {
    default: "h-8 px-3 py-1",
    sm: "h-7 px-2 text-sm",
  }

  return (
    <button className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`} onClick={onClick} {...props}>
      {children}
    </button>
  )
}

// Componente Badge customizado
function Badge({
  children,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode
  variant?: "default" | "secondary" | "destructive"
  className?: string
}) {
  const baseClasses = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"

  const variants = {
    default: "bg-green-900/50 text-green-400",
    secondary: "bg-yellow-900/50 text-yellow-400",
    destructive: "bg-red-900/50 text-red-400",
  }

  return <span className={`${baseClasses} ${variants[variant]} ${className}`}>{children}</span>
}

// Componente Avatar customizado
function Avatar({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full ${className}`}>{children}</div>
}

function AvatarFallback({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center rounded-full bg-gray-700 text-gray-300 text-xs ${className}`}
    >
      {children}
    </div>
  )
}

// Componente DropdownMenu customizado
function DropdownMenu({
  children,
  trigger,
  align = "end",
}: {
  children: React.ReactNode
  trigger: React.ReactNode
  align?: "start" | "end"
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      {isOpen && (
        <div
          className={`absolute z-50 mt-1 w-40 rounded-md border border-gray-600 bg-gray-800 py-1 shadow-lg ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

function DropdownMenuItem({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      className="flex w-full items-center px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function formatarData(dataISO: string) {
  const data = new Date(dataISO)
  const hoje = new Date()
  const ontem = new Date(hoje)
  ontem.setDate(hoje.getDate() - 1)

  const formatoHora = data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })

  if (data.toDateString() === hoje.toDateString()) {
    return `Hoje ${formatoHora}`
  } else if (data.toDateString() === ontem.toDateString()) {
    return `Ontem ${formatoHora}`
  } else {
    return data.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    })
  }
}

function getStatusBadge(status: Venda["status"]) {
  const variants = {
    concluida: {
      variant: "default" as const,
      label: "Concluída",
    },
    processando: {
      variant: "secondary" as const,
      label: "Processando",
    },
    cancelada: {
      variant: "destructive" as const,
      label: "Cancelada",
    },
  }

  const config = variants[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}

function getInitials(produto: string) {
  return produto
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export default function VendasRecentes() {
  const [isLoading, setIsLoading] = useState(false)

  const totalVendas = vendasRecentes.reduce((acc, venda) => acc + venda.total, 0)
  const vendasConcluidas = vendasRecentes.filter((v) => v.status === "concluida").length

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gray-600 rounded animate-pulse" />
              <div className="w-32 h-5 bg-gray-600 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3 flex-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
              <div className="w-8 h-8 bg-gray-600 rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="w-24 h-3 bg-gray-600 rounded animate-pulse" />
                <div className="w-16 h-2 bg-gray-600 rounded animate-pulse" />
              </div>
              <div className="w-16 h-3 bg-gray-600 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (vendasRecentes.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-600">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
            <Package className="w-5 h-5 text-[#14B498]" />
            Vendas Recentes
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center px-4">
          <Package className="w-10 h-10 text-gray-500 mb-3" />
          <h3 className="text-base font-medium text-white mb-1">Nenhuma venda recente</h3>
          <p className="text-gray-400 text-sm mb-3">Suas vendas aparecerão aqui quando começarem a chegar.</p>
          <Button variant="outline" size="sm">
            <TrendingUp className="w-4 h-4 mr-2" />
            Ver Relatórios
          </Button>
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
            Vendas Recentes
          </h2>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-[#14B498] rounded-full" />
              {vendasConcluidas} concluídas
            </div>
            <div className="font-medium text-[#14B498]">
              R$ {totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden lg:block h-full overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#272E36] border-b border-gray-600">
              <tr className="text-left">
                <th className="pb-2 px-4 pt-3 text-gray-400 font-medium text-xs">
                  <div className="flex items-center gap-2">
                    <Package className="w-3 h-3" />
                    Produto
                  </div>
                </th>
                <th className="pb-2 px-2 pt-3 text-gray-400 font-medium text-xs">
                  <div className="flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    Qtd
                  </div>
                </th>
                <th className="pb-2 px-2 pt-3 text-gray-400 font-medium text-xs">
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Total
                  </div>
                </th>
                <th className="pb-2 px-2 pt-3 text-gray-400 font-medium text-xs">Status</th>
                <th className="pb-2 px-2 pt-3 text-gray-400 font-medium text-xs">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Data
                  </div>
                </th>
                <th className="pb-2 px-4 pt-3 text-gray-400 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {vendasRecentes.map((venda) => (
                <tr
                  key={venda.id}
                  className="border-b border-gray-700 hover:bg-gray-700/30 transition-colors duration-150"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className="text-xs bg-[#14B498]/20 text-[#14B498]">
                          {getInitials(venda.produto)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-white text-sm">{venda.produto}</div>
                        <div className="text-xs text-gray-400">{venda.categoria}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-gray-700 text-gray-300 rounded-full text-xs font-medium">
                      {venda.quantidade}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <span className="font-semibold text-[#14B498] text-sm">
                      R$ {venda.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="py-3 px-2">{getStatusBadge(venda.status)}</td>
                  <td className="py-3 px-2 text-gray-400 text-xs">{formatarData(venda.data)}</td>
                  <td className="py-3 px-4">
                    <DropdownMenu
                      trigger={
                        <Button variant="ghost" size="sm" className="w-6 h-6 p-0">
                          <MoreHorizontal className="w-3 h-3" />
                        </Button>
                      }
                    >
                      <DropdownMenuItem onClick={() => console.log("Ver detalhes", venda.id)}>
                        <Eye className="w-3 h-3 mr-2" />
                        Ver detalhes
                      </DropdownMenuItem>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden h-full overflow-y-auto px-4 py-3 space-y-3">
          {vendasRecentes.map((venda) => (
            <div
              key={venda.id}
              className="p-3 border border-gray-600 rounded-lg hover:bg-gray-700/30 transition-colors duration-150"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs bg-[#14B498]/20 text-[#14B498]">
                      {getInitials(venda.produto)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-white text-sm">{venda.produto}</div>
                    <div className="text-xs text-gray-400">{venda.categoria}</div>
                  </div>
                </div>
                {getStatusBadge(venda.status)}
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-gray-400 mb-1">Quantidade</div>
                  <div className="font-medium text-white">{venda.quantidade}</div>
                </div>
                <div>
                  <div className="text-gray-400 mb-1">Total</div>
                  <div className="font-semibold text-[#14B498]">
                    R$ {venda.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 mb-1">Data</div>
                  <div className="text-gray-300">{formatarData(venda.data)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-600">
        <Button variant="outline" className="w-full text-xs" size="sm">
          <TrendingUp className="w-3 h-3 mr-2" />
          Ver todas as vendas
        </Button>
      </div>
    </div>
  )
}
