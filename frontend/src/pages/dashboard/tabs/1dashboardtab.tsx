// z:/slaaa/Kashy-Project/frontend/src/pages/dashboard/tabs/1dashboardtab.tsx
import ResumoFinanceiro from "../../../components/dashboard/ResumoFinanceiro";
import EstoqueBaixo from "../../../components/dashboard/EstoqueBaixo";
import ProdutosMaisVendidos from "../../../components/dashboard/ProdutosMaisVendidos";
import VendasPorPeriodo from "../../../components/dashboard/VendasPorPeriodo";
import VendasRecentes from "../../../components/dashboard/VendasRecentes";
import InsightsCard from "../../../components/dashboard/Insights";
import SalesComparisonChart from "../../../components/dashboard/SalesComparisonChart";
import TopCategories from "../../../components/dashboard/TopCategories";
import BCHContainer from "../../../components/dashboard/BCHContainer"; // Import the new component
import { DashboardRevenueChart } from "../../../components/dashboard/DashboardRevenueChart"; // Importar o novo gráfico

export function DashboardTab() {
  return (
    <div className="min-h-screen bg-[#141414] text-white p-10 space-y-12">
      <style jsx>{`
        .resumo-financeiro-card {
          position: relative;
        }

        @media (min-width: 1024px) { /* For lg screens and above */
          .vendas-por-periodo-card {
            width: auto;
          }
        }
      `}</style>
      {/* First Row - 3 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="bg-gradient-to-br from-[#14B498] to-[#0A7460] rounded-2xl col-span-1 lg:col-span-2 overflow-hidden h-60 resumo-financeiro-card">
          <ResumoFinanceiro />
        </div>
        <div className="bg-[#272E36] rounded-2xl h-60 lg:col-span-1">
          <ProdutosMaisVendidos />
        </div>
      </div>

      {/* Second Row - 3 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1 flex flex-col gap-10"> {/* Transparent div occupies column 1 */}
          <div className="bg-[#272E36] rounded-2xl h-60">
            <VendasPorPeriodo />
          </div>
          <div className="bg-[#272E36] rounded-2xl h-60">
            <SalesComparisonChart />
          </div>
        </div>
        <div className="lg:col-span-2 h-full"> {/* Faturamento Diário occupies columns 2 and 3 */}
          <DashboardRevenueChart />
        </div>
      </div>

      {/* Third Row - 4 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-1 bg-[#272E36] rounded-2xl p-6 shadow-md h-full">
          <BCHContainer />
        </div>
        <div className="bg-[#272E36] rounded-2xl h-60 lg:col-span-2"> {/* VendasRecentes ocupa 2 colunas */}
          <VendasRecentes />
        </div>
        <div className="bg-[#272E36] rounded-2xl h-60 lg:col-span-1"> {/* EstoqueBaixo ocupa 1 coluna */}
          <EstoqueBaixo />
        </div>
      </div>

      {/* Remaining components */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-10">
        <div className="bg-[#272E36] rounded-2xl h-60">
          <InsightsCard />
        </div>
        <div className="bg-[#272E36] rounded-2xl h-60">
          <TopCategories />
        </div>
      </div>
      <div className="grid grid-cols-1">
        <div className="bg-[#272E36] rounded-2xl h-60">
          {/* Empty div */}
        </div>
      </div>
    </div>
  );
}
