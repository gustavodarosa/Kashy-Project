// z:/slaaa/Kashy-Project/frontend/src/components/dashboard/DashboardRevenueChart.tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const revenuePerDay = [
  { date: '01/05', total: 430 },
  { date: '02/05', total: 560 },
  { date: '03/05', total: 300 },
  { date: '04/05', total: 720 },
  { date: '05/05', total: 410 },
  { date: '06/05', total: 540 },
  { date: '07/05', total: 890 },
  { date: '08/05', total: 400 },
  { date: '09/05', total: 750 },
  { date: '10/05', total: 620 },
  // adicione até os dias atuais ou gere via script
  // Para um exemplo mais completo, você pode adicionar mais dados:
  { date: '11/05', total: 480 },
  { date: '12/05', total: 650 },
  { date: '13/05', total: 710 },
  { date: '14/05', total: 530 },
  { date: '15/05', total: 900 },
  { date: '16/05', total: 600 },
  { date: '17/05', total: 810 },
  { date: '18/05', total: 450 },
  { date: '19/05', total: 680 },
  { date: '20/05', total: 720 },
  { date: '21/05', total: 500 },
  { date: '22/05', total: 950 },
  { date: '23/05', total: 630 },
  { date: '24/05', total: 850 },
  { date: '25/05', total: 470 },
  { date: '26/05', total: 700 },
  { date: '27/05', total: 760 },
  { date: '28/05', total: 520 },
  { date: '29/05', total: 980 },
  { date: '30/05', total: 670 },
];

export function DashboardRevenueChart() {
  return (
        <div className="bg-[#272E36] rounded-2xl p-6 shadow-md"> {/* Removido col-span-full */}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white text-lg font-semibold flex items-center gap-2">
          📊 Faturamento Diário (últimos 30 dias)
        </h2>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={revenuePerDay}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="date" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a', // Um fundo mais escuro para o tooltip
              border: '1px solid #334155', // Borda sutil
              borderRadius: '8px',
              color: '#f1f5f9', // Texto claro
            }}
            formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Total']}
            labelStyle={{ color: '#38bdf8' }} // Cor para o label (data)
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="#22c55e" // Verde para a linha de faturamento
            strokeWidth={3}
            dot={{ r: 4, fill: "#22c55e", stroke: "#1E293B", strokeWidth: 2 }} // Pontos estilizados
            activeDot={{ r: 6, fill: "#22c55e", stroke: "#0f172a", strokeWidth: 2 }} // Ponto ativo estilizado
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
