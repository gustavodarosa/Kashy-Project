
import { Line, Bar, Doughnut, Radar } from 'react-chartjs-2';
import { Chart as ChartJS,Title,Tooltip,Legend,ChartData,ChartOptions,} from 'chart.js';

ChartJS.register(
  Title,
  Tooltip,
  Legend
);

export function OfertasTab() {
  

  return (
      <h2 className="text-2xl text-white font-bold">Dashboard de Franqueados</h2>
  );
}