
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from 'chart.js';
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export function ProdutosTab() {
  
  const unidadesSalesData: ChartData<'bar', number[], string> = {
    labels: ['Água Verde', 'Centro', 'Fortaleza', 'Velha'],
    datasets: [{
      label: 'Vendas por Unidades (R$)',
      data: [5000, 3000, 4000, 2000],
      backgroundColor: 'rgba(206, 55, 45, 0.7)',
    }]
  };
  
  
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { position: 'top' as const },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            if (context.dataset.label) {
              return `${context.dataset.label}: ${context.parsed.y || context.raw}`;
            }
            return context.raw;
          }
        }
      }
    }
  };
  
  const barOptions: ChartOptions<'bar'> = {
    ...baseOptions,
    scales: {
      x: {
        ticks: {
          color: '#FFFFFF', 
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#FFFFFF', 
        },
      },
    },
    plugins: {
      legend: {
        labels: {
          color: '#FFFFFF', 
        },
       
      },
      
    },
    
  };
  return (
    <div className="space-y-6">
      <h2 className="text-2xl text-white font-bold">Dashboard de Unidades</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[var(--color-bg-tertiary)] text-white p-4 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-4">Unidades Populares</h3>
                  <div className="h-auto">
                    <Bar data={unidadesSalesData} options={barOptions} />
                  </div>
                </div>
      </div>
    </div>
  );
}