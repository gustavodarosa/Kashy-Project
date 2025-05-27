// z:/slaaa/Kashy-Project/frontend/src/components/dashboard/VendasRecentes.tsx
const vendasRecentes = [
  {
    produto: "Camiseta Kashy",
    quantidade: 2,
    total: 120.0,
    data: "26/05/2025 - 14:12",
  },
  {
    produto: "Caneca Verde",
    quantidade: 1,
    total: 45.5,
    data: "26/05/2025 - 13:50",
  },
  {
    produto: "Adesivo",
    quantidade: 3,
    total: 30.0,
    data: "26/05/2025 - 12:40",
  },
  {
    produto: "Moletom Kashy",
    quantidade: 1,
    total: 199.9,
    data: "25/05/2025 - 18:30",
  },
];

export default function VendasRecentesDetalhadas() {
  return (
    <div className="h-full p-5 text-white flex flex-col">
      <h2 className="text-xl font-semibold mb-4">Vendas Recentes</h2>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent pr-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white/70 border-b border-white/10">
              <th className="pb-2">Produto</th>
              <th className="pb-2">Qtd</th>
              <th className="pb-2">Total</th>
              <th className="pb-2">Data</th>
            </tr>
          </thead>
          <tbody>
            {vendasRecentes.map((venda, idx) => (
              <tr
                key={idx}
                className="border-b border-white/5 hover:bg-white/5 transition"
              >
                <td className="py-2">{venda.produto}</td>
                <td className="py-2">{venda.quantidade}</td>
                <td className="py-2">R$ {venda.total.toFixed(2)}</td>
                <td className="py-2 text-white/70">{venda.data}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
