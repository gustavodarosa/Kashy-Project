import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  ChartData,
  ChartOptions,
} from 'chart.js';
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale
);
export function WalletTab() {
   
      const dailySalesData: ChartData<'line', number[], string> = {
          labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'], 
          datasets: [{
            label: 'Vendas Diárias (R$)', 
            data: [4500, 1900, 6000, 2500, 4000, 1200, 5000], 
            borderColor: 'rgb(206, 55, 45)',
            backgroundColor: 'rgba(206, 55, 45, 0.2)',
            tension: 0.1,
          }]
        };
        const mensalSalesData: ChartData<'line', number[], string> = {
          labels: ['Outubro', 'Novembro', 'Dezembro', 'Janeiro', 'Fevereiro', 'Março', 'Abril'], 
          datasets: [{
            label: 'Vendas Mensais (R$)', 
            data: [1000, 3900, 9000, 2500, 6000, 2200, 9800], 
            borderColor: 'rgb(206, 55, 45)',
            backgroundColor: 'rgba(206, 55, 45, 0.2)',
            tension: 0.1,
          }]
        };
        const anuaisSalesData: ChartData<'line', number[], string> = {
          labels: ['2019', '2020', '2021', '2022', '2023', '2024', '2025'], 
          datasets: [{
            label: 'Vendas Anuais (R$)', 
            data: [2000, 1900, 6000, 2500, 4100, 3200, 6800], 
            borderColor: 'rgb(206, 55, 45)',
            backgroundColor: 'rgba(206, 55, 45, 0.2)',
            tension: 0.1,
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
        const lineOptions: ChartOptions<'line'> = {
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
        const pieOptions: ChartOptions<'pie'> = {
          ...baseOptions,
          maintainAspectRatio: true,
          aspectRatio: 1.5,
          plugins: {
            legend: {
              labels: {
                color: '#FFFFFF', 
              },
            },
          },
        };
        const doughnutOptions: ChartOptions<'doughnut'> = {
          ...baseOptions,
          maintainAspectRatio: true,
          aspectRatio: 1.5,
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
            <h2 className="text-2xl text-white font-bold">Dashboard de Vendas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[var(--color-bg-tertiary)] text-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Vendas Diárias</h3>
                <div className="h-auto">
                  <Line data={dailySalesData} options={lineOptions} />
                </div>
              </div>
              <div className="bg-[var(--color-bg-tertiary)] text-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Vendas Mensais</h3>
                <div className="h-auto">
                  <Line data={mensalSalesData} options={lineOptions} />
                </div>
              </div>
              <div className="bg-[var(--color-bg-tertiary)] text-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Vendas Anuais</h3>
                <div className="h-auto">
                  <Line data={anuaisSalesData} options={lineOptions} />
                </div>
              </div>
              </div>
              </div>
    );
  }