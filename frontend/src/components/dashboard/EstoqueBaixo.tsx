// z:/slaaa/Kashy-Project/frontend/src/components/dashboard/EstoqueBaixo.tsx
import { AlertCircle } from "lucide-react";

const produtosCriticos = [
  { id: 1, nome: "Café Expresso", quantidade: 5 },
  { id: 2, nome: "Água Mineral", quantidade: 2 },
  { id: 3, nome: "Suco de Laranja", quantidade: 1 },
  { id: 4, nome: "Refrigerante Cola", quantidade: 4 },
];

export default function EstoqueBaixo() {
  return (
    <div className="h-full p-5 text-white flex flex-col">
      <h2 className="text-xl font-semibold mb-4">Estoque Baixo</h2>

      <ul className="flex-1 space-y-3 text-sm overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent pr-2">
        {produtosCriticos.map((produto) => (
          <li
            key={produto.id}
            className="flex justify-between items-center bg-[#1F2937] px-4 py-3 rounded-xl"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="text-yellow-400 w-4 h-4" />
              <span>{produto.nome}</span>
            </div>
            <span className="text-red-400 font-semibold">
              {produto.quantidade} un
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
