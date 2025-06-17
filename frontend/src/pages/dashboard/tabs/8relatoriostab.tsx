import { useState } from 'react';
 
interface MockData {
  id: string;
  store: string;
  price: number;
  email: string;
}
 
export function RelatoriosTab() {
  const [selectedData, setSelectedData] = useState<MockData | null>(null);
  const [filteredResults, setFilteredResults] = useState<MockData[]>([]);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([]);
 
  const mockData: MockData[] = [
    { id: '1', store: 'Loja A', price: 100, email: 'cliente1@exemplo.com' },
    { id: '2', store: 'Loja B', price: 200, email: 'cliente2@exemplo.com' },
    { id: '3', store: 'Loja A', price: 150, email: 'cliente3@exemplo.com' },
    { id: '4', store: 'Loja C', price: 300, email: 'cliente4@exemplo.com' },
  ];
 
  const lineOptions = ['Loja', 'Data', 'Produto', 'Pedido'];
  const valueOptions = ['Valor Total', 'Quantidade'];
  const functionOptions = ['Somar', 'Média', 'Mínimo', 'Máximo'];
 
  const handleFunctionChange = (func: string) => {
    setSelectedFunctions((prev) =>
      prev.includes(func) ? prev.filter((f) => f !== func) : [...prev, func]
    );
  };
 
  const applyFilters = () => {
    if (!filterType || !selectedData) return;
 
    const results = mockData.filter((item) => {
      switch (filterType) {
        case 'Loja':
          return item.store === selectedData.store;
        case 'Preço':
          return item.price === selectedData.price;
        case 'Email':
          return item.email === selectedData.email;
        case 'ID':
          return item.id === selectedData.id;
        default:
          return true;
      }
    });
 
    setFilteredResults(results);
  };
 
  return (
    <div className="bg-gradient-to-br from-[#1E2328] via-[#24292D] to-[#2B3036] min-h-screen text-white">
      <div className="container mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resultados */}
        <div className="lg:col-span-2 bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-6">
          <h2 className="text-2xl font-bold mb-6">Resultados</h2>
          {filteredResults.length > 0 ? (
            <ul className="space-y-4">
              {filteredResults.map((result) => (
                <li
                  key={result.id}
                  className="p-4 bg-[#24292D]/80 rounded-lg border border-white/10 hover:shadow-lg transition-shadow"
                >
                  <p className="text-lg font-semibold">ID: {result.id}</p>
                  <p>Loja: {result.store}</p>
                  <p>Preço: R$ {result.price.toFixed(2)}</p>
                  <p>Email: {result.email}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-center">Nenhum resultado encontrado.</p>
          )}
        </div>
 
        {/* Filtros */}
        <div className="bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-6">
          <h2 className="text-2xl font-bold mb-6">Filtros</h2>
 
          {/* Dropdown para Linhas */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Linhas</label>
            <select
              className="w-full p-3 rounded bg-[#24292D] text-white border border-white/10 focus:ring-2 focus:ring-teal-500"
              value={selectedLine || ''}
              onChange={(e) => setSelectedLine(e.target.value)}
            >
              <option value="" disabled>
                Selecione uma linha
              </option>
              {lineOptions.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>
          </div>
 
          {/* Dropdown para Valores */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Valores</label>
            <select
              className="w-full p-3 rounded bg-[#24292D] text-white border border-white/10 focus:ring-2 focus:ring-teal-500"
              value={selectedValue || ''}
              onChange={(e) => setSelectedValue(e.target.value)}
            >
              <option value="" disabled>
                Selecione um valor
              </option>
              {valueOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
 
          {/* Checkboxes para Funções */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Funções</label>
            <div className="space-y-2">
              {functionOptions.map((func) => (
                <div key={func} className="flex items-center">
                  <input
                    type="checkbox"
                    className="mr-2 accent-teal-500"
                    checked={selectedFunctions.includes(func)}
                    onChange={() => handleFunctionChange(func)}
                  />
                  <span>{func}</span>
                </div>
              ))}
            </div>
          </div>
 
          {/* Botão para Aplicar Filtros */}
          <button
            onClick={applyFilters}
            className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 rounded-lg transition-colors"
          >
            Aplicar Filtros
          </button>
        </div>
      </div>
    </div>
  );
}
 