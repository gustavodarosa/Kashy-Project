import { Bitcoin, DollarSign, CalendarDays, TrendingUp } from "lucide-react";

export default function ResumoVendasCard() {
  // Você pode passar esses dados por props futuramente
  const totalBCH = 1.2345;
  const totalBRL = 3456.78;
  const vendasHoje = 12;
  const vendasSemana = 78;

  return (
    <div className="flex flex-col justify-between h-full text-white">
      <h2 className="text-xl font-semibold mb-4">Resumo de Vendas</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#0F766E] rounded-xl p-4 flex items-center space-x-3">
          <Bitcoin className="w-6 h-6 text-yellow-400" />
          <div>
            <p className="text-sm">Total (BCH)</p>
            <p className="text-lg font-bold">{totalBCH} BCH</p>
          </div>
        </div>

        <div className="bg-[#0E7490] rounded-xl p-4 flex items-center space-x-3">
          <DollarSign className="w-6 h-6 text-green-400" />
          <div>
            <p className="text-sm">Total (BRL)</p>
            <p className="text-lg font-bold">R$ {totalBRL.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-[#1E40AF] rounded-xl p-4 flex items-center space-x-3">
          <CalendarDays className="w-6 h-6 text-sky-400" />
          <div>
            <p className="text-sm">Vendas Hoje</p>
            <p className="text-lg font-bold">{vendasHoje}</p>
          </div>
        </div>

        <div className="bg-[#78350F] rounded-xl p-4 flex items-center space-x-3">
          <TrendingUp className="w-6 h-6 text-orange-400" />
          <div>
            <p className="text-sm">Vendas na Semana</p>
            <p className="text-lg font-bold">{vendasSemana}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
