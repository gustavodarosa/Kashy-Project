import { AlertTriangle, Info } from "lucide-react";

interface ProdutoEstoque {
  nome: string;
  disponivel: number;
  minimo: number;
  ultimaReposicao?: string;
}

interface LowStockAlertProps {
  produtos?: ProdutoEstoque[];
}

export function LowStockAlert({ produtos }: LowStockAlertProps) {
  const produtosCriticosMock: ProdutoEstoque[] = [
    {
      nome: "Mouse Gamer RGB",
      disponivel: 3,
      minimo: 10,
      ultimaReposicao: "05/05/2025",
    },
    {
      nome: "Teclado Mecânico ABNT2",
      disponivel: 5,
      minimo: 12,
      ultimaReposicao: "11/05/2025",
    },
    {
      nome: "Cadeira Ergonômica Pro",
      disponivel: 2,
      minimo: 5,
      ultimaReposicao: "03/05/2025",
    },
    {
      nome: "Notebook i5 11ª Geração",
      disponivel: 1,
      minimo: 4,
      ultimaReposicao: "17/05/2025",
    },
    {
      nome: "Suporte para Notebook",
      disponivel: 8,
      minimo: 12,
      ultimaReposicao: "10/05/2025",
    },
  ];

  const produtosBaixoEstoque = (produtos ?? produtosCriticosMock)
    .filter((p) => p.disponivel < p.minimo)
    .sort((a, b) => a.disponivel - b.disponivel);

  return (
    <div className=" text-white px-4 py-3 rounded-2xl  shadow-sm">
      <div className="flex items-center gap-2 text-red-400 font-semibold text-sm mb-3">
        <AlertTriangle size={18} />
        Estoque Crítico
        <Info
          size={14}
          className="text-gray-400 cursor-pointer"
        />
      </div>

      {produtosBaixoEstoque.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nenhum produto com estoque crítico.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {produtosBaixoEstoque.map((produto, index) => {
            const percentual = Math.round(
              (produto.disponivel / produto.minimo) * 100
            );
            const criticidade =
              percentual < 30
                ? "text-red-400"
                : percentual < 60
                ? "text-yellow-400"
                : "text-green-400";

            return (
              <li
                key={index}
                className="flex flex-col bg-white/5 px-3 py-2 rounded-lg"
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-white truncate">
                    {produto.nome}
                  </span>
                  <span className={`text-xs ${criticidade}`}>
                    {produto.disponivel} / mín. {produto.minimo}
                  </span>
                </div>
                <div className="text-[11px] text-white/40 mt-0.5">
                  Última reposição: {produto.ultimaReposicao ?? "Não informado"}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 text-right">
        <button className="text-xs text-white/60 hover:text-white underline">
          Ver todos os produtos
        </button>
      </div>
    </div>
  );
}
