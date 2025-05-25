import { AlertTriangle, Info } from 'lucide-react';

interface ProdutoEstoque {
  nome: string;
  disponivel: number;
  minimo: number;
  ultimaReposicao?: string; // nova info
}

interface LowStockAlertProps {
  produtos?: ProdutoEstoque[];
}

export function LowStockAlert({
  produtos = [
    { nome: 'Cabo USB-C', disponivel: 8, minimo: 20, ultimaReposicao: '2025-05-20' },
    { nome: 'Mouse sem fio', disponivel: 3, minimo: 10, ultimaReposicao: '2025-05-18' },
    { nome: 'Adaptador HDMI', disponivel: 15, minimo: 25, ultimaReposicao: '2025-05-10' },
  ],
}: LowStockAlertProps) {
  const produtosBaixoEstoque = produtos
    .filter(p => p.disponivel < p.minimo)
    .sort((a, b) => a.disponivel - b.disponivel);

  return (
    <div className="bg-transparent text-black px-4 py-3 rounded-lg">
      <div className="flex items-center gap-2 text-red-600 font-semibold text-sm mb-3">
        <AlertTriangle size={18} />
        Estoque Crítico
        <Info size={14} className="text-gray-400 cursor-pointer" title="Produtos abaixo do nível mínimo definido" />
      </div>

      {produtosBaixoEstoque.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum produto com estoque crítico.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {produtosBaixoEstoque.map((produto, index) => {
            const percentual = Math.round((produto.disponivel / produto.minimo) * 100);
            const criticidade =
              percentual < 40 ? 'text-red-700' : percentual < 70 ? 'text-yellow-600' : 'text-green-600';

            return (
              <li
                key={index}
                className="flex flex-col bg-red-50 px-3 py-2 rounded-md shadow-sm"
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{produto.nome}</span>
                  <span className={`text-xs ${criticidade}`}>
                    {produto.disponivel} / mín. {produto.minimo}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                  Última reposição: {produto.ultimaReposicao}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Botão opcional */}
      <div className="mt-3 text-right">
        <button className="text-xs text-blue-600 hover:underline">Ver todos os produtos</button>
      </div>
    </div>
  );
}
