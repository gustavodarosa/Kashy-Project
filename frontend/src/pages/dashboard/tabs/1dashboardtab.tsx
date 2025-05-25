import WalletHeader from '../../../components/DashboardHeader'; // O arquivo é DashboardHeader.tsx, mas exporta WalletHeader
import ResumoVendasCard from '../../../components/ResumoVendasCard';

export function DashboardTab() {
  return (
    <div
      className="min-h-screen flex flex-col items-stretch justify-start"
      style={{
        backgroundImage: 'linear-gradient(to bottom, #26a7a2 0%, #26a7a2 5%, #141414 20%, #141414 100%)',
      }}
    >
      <WalletHeader />
      <div> {/* Adiciona margem acima do card */}
        <ResumoVendasCard />
      </div>
      {/* Mais conteúdo pode ser adicionado aqui abaixo */}
    </div>
  );
}
