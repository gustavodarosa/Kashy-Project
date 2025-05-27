// z:/slaaa/Kashy-Project/frontend/src/components/dashboard/TopCategories.tsx
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const data = [
  { name: "Roupas", value: 4000 },
  { name: "Acessórios", value: 3000 },
  { name: "Calçados", value: 2000 },
  { name: "Cosméticos", value: 1000 },
];

const COLORS = ["#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function TopCategories() {
  return (
    <div className="h-full p-5 text-white flex flex-col">
      <h2 className="text-xl font-semibold mb-4">🥇 Top Categorias</h2>
      <div className="flex-1 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={40}
              outerRadius={80}
              paddingAngle={5}
              label
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
