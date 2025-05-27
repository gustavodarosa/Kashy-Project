// z:/slaaa/Kashy-Project/frontend/src/components/dashboard/SalesComparisonChart.tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const data = [
  { name: "Semana 1", Abril: 3200, Maio: 4100 },
  { name: "Semana 2", Abril: 2700, Maio: 3900 },
  { name: "Semana 3", Abril: 3100, Maio: 4500 },
  { name: "Semana 4", Abril: 2900, Maio: 4700 },
];

export default function SalesComparisonChart() {
  return (
    <div className="h-full p-5 text-white flex flex-col">
      <h2 className="text-xl font-semibold mb-4">📈 Comparativo Abril vs Maio</h2>
      <div className="flex-1 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="name" stroke="#ccc" />
            <YAxis stroke="#ccc" />
            <Tooltip />
            <Legend />
            <Bar dataKey="Abril" fill="#8884d8" />
            <Bar dataKey="Maio" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
