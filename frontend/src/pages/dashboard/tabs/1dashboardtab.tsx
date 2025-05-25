import { TrendingUp } from 'lucide-react';
import WalletHeader from '../../../components/DashboardHeader';
import ResumoVendasCard from '../../../components/ResumoVendasCard';
import CotacaoCriptoCard from '../../../components/PriceContainer';
import { WalletBalanceCard } from '../../../components/WalletBalanceCard';
import { LowStockAlert } from '../../../components/LowStocksAlert'; // ✅ Novo componente

export function DashboardTab() {
  return (
    <div className="min-h-screen bg-[#141414] text-white p-6">
      {/* Header opcional */}
      {/* <WalletHeader /> */}

      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        {/* Coluna principal */}
        <div className="flex flex-col gap-4 md:w-2/3">
          <ResumoVendasCard />

          {/* ➕ Novo componente de alerta de estoque */}
          <LowStockAlert />

          {/* Aqui você pode adicionar outro componente, como TopProdutos, Últimas Vendas, etc */}
          {/* <TopProdutosMaisVendidos /> */}
        </div>

        {/* Coluna lateral com cotação e saldo */}
        <div className="flex flex-col gap-4 md:w-1/3 md:pr-2">
          <CotacaoCriptoCard />
          <WalletBalanceCard />
        </div>
      </div>
    </div>
  );
}
