import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

export default function ResumoFinanceiro() {
  return (
    <div className="h-full p-6 text-white flex flex-col justify-between">
      <div>
        <h2 className="text-xl font-semibold mb-2">Resumo Financeiro</h2>
        <p className="text-sm text-white/80">Últimos 7 dias</p>
      </div>

      <div>
        <p className="text-3xl font-bold">R$ 12.340,50</p>
        <p className="text-sm text-white/70 mt-1">Total vendido</p>
      </div>

      <div className="flex justify-between gap-4 mt-4">
        {/* Entradas */}
        <div className="flex items-center space-x-2">
          <ArrowUpCircle className="text-green-200 w-5 h-5" />
          <div>
            <p className="text-sm font-medium">Entradas</p>
            <p className="text-green-100 font-bold text-sm">R$ 8.720,00</p>
          </div>
        </div>

        {/* Saídas */}
        <div className="flex items-center space-x-2">
          <ArrowDownCircle className="text-red-200 w-5 h-5" />
          <div>
            <p className="text-sm font-medium">Saídas</p>
            <p className="text-red-100 font-bold text-sm">R$ 3.620,50</p>
          </div>
        </div>
      </div>
    </div>
  );
}
