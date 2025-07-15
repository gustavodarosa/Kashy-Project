"use client"

import type React from "react"

import { Package, Hash, DollarSign, Clock, TrendingUp, Eye, MoreHorizontal } from "lucide-react"
import { useState, useRef, useEffect } from "react"

interface Venda {
  id: string
  loja: string // Substitui produto pelo nome da loja
  quantidade: number
  total: number
  data: string
  status: "concluida" | "processando" | "cancelada"
  categoria: string
  metodoPagamento: string // Adicionado método de pagamento
}

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
  };

  const config = variants[status] || {
    variant: "default" as const,
    label: "Desconhecido", // Fallback label for unknown statuses
  };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getInitials(loja: string) {
  return loja
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export default function VendasRecentes() {
  const [isLoading, setIsLoading] = useState(false)
  const [vendasRecentes, setVendasRecentes] = useState<Venda[]>([])

  useEffect(() => {
    const fetchVendasRecentes = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Usuário não autenticado.");
        }

        const response = await fetch("http://localhost:3000/api/orders", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Erro ao buscar vendas recentes.");
        }

        const orders = await response.json();
        const vendas = orders.map((order: any) => ({
          id: order._id,
          loja: order.store, // Substitui produto pelo nome da loja
          quantidade: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
          total: order.totalAmount,
          data: order.createdAt,
          status: order.status,
          categoria: order.items[0]?.product.category || "N/A",
          metodoPagamento: order.paymentMethod || "N/A", // Adicionado método de pagamento
        }));

        setVendasRecentes(vendas);
      } catch (error) {
        console.error("Erro ao buscar vendas recentes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVendasRecentes();
  }, []);

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
                    Loja
                  </div>
                </th>
                <th className="pb-2 px-2 pt-3 text-gray-400 font-medium text-xs">
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Método de Pagamento
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
                          {getInitials(venda.loja)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-white text-sm">{venda.loja}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      {venda.metodoPagamento === 'bch' && (
                        <span className="inline-block w-5 h-5 align-middle">
                          <svg viewBox="0 0 788 788" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="394" cy="394" r="394" fill="#fff" />
                            <path d="M516.9,261.7c-19.8-44.9-65.3-54.5-121-45.2L378,147.1l-42.2,10.9l17.6,69.2
                              c-11.1,2.8-22.5,5.2-33.8,8.4L302,166.8l-42.2,10.9l17.9,69.4c-9.1,2.6-85.2,22.1-85.2,22.1l11.6,45.2c0,0,31-8.7,30.7-8
                              c17.2-4.5,25.3,4.1,29.1,12.2l49.2,190.2c0.6,5.5-0.4,14.9-12.2,18.1c0.7,0.4-30.7,7.9-30.7,7.9l4.6,52.7c0,0,75.4-19.3,85.3-21.8
                              l18.1,70.2l42.2-10.9l-18.1-70.7c11.6-2.7,22.9-5.5,33.9-8.4l18,70.3l42.2-10.9l-18.1-70.1c65-15.8,110.9-56.8,101.5-119.5
                              c-6-37.8-47.3-68.8-81.6-72.3C519.3,324.7,530,297.4,516.9,261.7L516.9,261.7z M496.6,427.2c8.4,62.1-77.9,69.7-106.4,77.2
                              l-24.8-92.9C394,404,482.4,372.5,496.6,427.2z M444.6,300.7c8.9,55.2-64.9,61.6-88.7,67.7l-22.6-84.3
                              C357.2,278.2,426.5,249.6,444.6,300.7z"
                              fill="#0AC18E" />
                          </svg>
                        </span>
                      )}
                      {venda.metodoPagamento === 'pix' && (
                        <span className="inline-block w-5 h-5 align-middle">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
                            <path fill="#4db6ac" d="M11.9,12h-0.68l8.04-8.04c2.62-2.61,6.86-2.61,9.48,0L36.78,12H36.1c-1.6,0-3.11,0.62-4.24,1.76	l-6.8,6.77c-0.59,0.59-1.53,0.59-2.12,0l-6.8-6.77C15.01,12.62,13.5,12,11.9,12z"></path>
                            <path fill="#4db6ac" d="M36.1,36h0.68l-8.04,8.04c-2.62,2.61-6.86,2.61-9.48,0L11.22,36h0.68c1.6,0,3.11-0.62,4.24-1.76	l6.8-6.77c0.59,0.59,1.53,0.59,2.12,0l6.8,6.77C32.99,35.38,34.5,36,36.1,36z"></path>
                            <path fill="#4db6ac" d="M44.04,28.74L38.78,34H36.1c-1.07,0-2.07-0.42-2.83-1.17l-6.8-6.78c-1.36-1.36-3.58-1.36-4.94,0	l-6.8,6.78C13.97,33.58,12.97,34,11.9,34H9.22l-5.26-5.26c-2.61-2.62-2.61-6.86,0-9.48L9.22,14h2.68c1.07,0,2.07,0.42,2.83,1.17	l6.8,6.78c0.68,0.68,1.58,1.02,2.47,1.02s1.79-0.34,2.47-1.02l6.8-6.78C34.03,14.42,35.03,14,36.1,14h2.68l5.26,5.26	C46.65,21.88,46.65,26.12,44.04,28.74z"></path>
                          </svg>
                        </span>
                      )}
                      {venda.metodoPagamento === 'card' && (
                        <span className="inline-block w-5 h-5 align-middle">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <rect x="2" y="5" width="20" height="14" rx="2" fill="#3b82f6" />
                            <rect x="2" y="8" width="20" height="2" fill="#fff" />
                            <rect x="6" y="16" width="4" height="2" fill="#fff" />
                          </svg>
                        </span>
                      )}
                      <span className="font-medium text-gray-300 text-sm">
                        {venda.metodoPagamento === 'bch' && 'Bitcoin Cash'}
                        {venda.metodoPagamento === 'pix' && 'Pix'}
                        {venda.metodoPagamento === 'card' && 'Cartão'}
                      </span>
                    </div>
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
                      {getInitials(venda.loja)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-white text-sm">{venda.loja}</div>
                  </div>
                </div>
                {getStatusBadge(venda.status)}
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-gray-400 mb-1">Método de Pagamento</div>
                  <div className="font-medium text-white">{venda.metodoPagamento}</div>
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
