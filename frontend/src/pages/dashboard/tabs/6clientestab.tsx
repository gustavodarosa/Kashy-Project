import { useState, useEffect } from 'react';
import { FiEdit, FiTrash2, FiPlus, FiSearch, FiChevronLeft, FiChevronRight, FiDownload, FiGift, FiUserCheck, FiUserX, FiZap, FiMessageCircle } from 'react-icons/fi';

type Cliente = {
  _id: string;
  nome: string;
  telefone: string;
  email?: string;
  totalGasto: number;
  visitas: number;
  clubeAtivo: boolean;
  ultimaCompra: string;
  tags?: string[];
  pontuacao?: number;
};

export function ClientesTab() {
  // Simulação de dados
  const [clientes, setClientes] = useState<Cliente[]>([
    { _id: '1', nome: 'João Silva', telefone: '(47) 9999-1234', totalGasto: 234, visitas: 12, clubeAtivo: true, ultimaCompra: '2025-05-20', pontuacao: 120, tags: ['VIP'] },
    { _id: '2', nome: 'Maria C.', telefone: '(47) 8888-9876', totalGasto: 89, visitas: 4, clubeAtivo: false, ultimaCompra: '2025-05-18', pontuacao: 30 },
    // ...mais clientes
  ]);
  const [search, setSearch] = useState('');
  const [modalCliente, setModalCliente] = useState<Cliente | null>(null);

  // Filtro
  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.telefone.includes(search) ||
    (c.clubeAtivo ? 'sim' : 'não').includes(search.toLowerCase())
  );

  // Exportar CSV
  const exportarCSV = () => {
    const csv = [
      ['Nome', 'Telefone', 'Última Compra', 'Total Gasto', 'Visitas', 'Clube Ativo'],
      ...clientesFiltrados.map(c => [
        c.nome,
        c.telefone,
        c.ultimaCompra,
        `R$ ${c.totalGasto.toFixed(2)}`,
        c.visitas,
        c.clubeAtivo ? 'Sim' : 'Não'
      ])
    ].map(row => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 bg-[var(--color-bg-primary)] text-white min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="relative w-full md:w-80">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou clube..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 px-4 py-2 rounded-lg transition-colors"
          >
            <FiDownload /> Exportar CSV
          </button>
          <button
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
            // onClick={abrirCadastroCliente}
          >
            <FiPlus /> Novo Cliente
          </button>
        </div>
      </div>

      {/* Insights IA */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 flex items-center gap-3">
          <FiZap className="text-yellow-400" size={24} />
          <span className="text-sm text-gray-200">
            Você tem <b>15 clientes</b> que compraram mais de 5x este mês.
          </span>
        </div>
        <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 flex items-center gap-3">
          <FiGift className="text-pink-400" size={24} />
          <span className="text-sm text-gray-200">
            2 clientes completaram 9 compras – envie incentivo para a 10ª!
          </span>
        </div>
      </div>

      {/* Lista de clientes */}
      <div className="bg-[var(--color-bg-tertiary)] rounded-lg overflow-x-auto border border-[var(--color-border)]">
        <table className="min-w-full divide-y divide-[var(--color-divide)]">
          <thead className="bg-gray-750">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Telefone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Última Compra</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Total Gasto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Visitas</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Clube</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-[var(--color-bg-tertiary)] divide-y divide-[var(--color-divide)]">
            {clientesFiltrados.map(cliente => (
              <tr key={cliente._id} className="hover:bg-gray-750 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap font-medium">{cliente.nome}</td>
                <td className="px-6 py-4 whitespace-nowrap">{cliente.telefone}</td>
                <td className="px-6 py-4 whitespace-nowrap">{new Date(cliente.ultimaCompra).toLocaleDateString('pt-BR')}</td>
                <td className="px-6 py-4 whitespace-nowrap">R$ {cliente.totalGasto.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{cliente.visitas}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {cliente.clubeAtivo
                    ? <span className="inline-flex items-center gap-1 text-green-400"><FiUserCheck /> Sim</span>
                    : <span className="inline-flex items-center gap-1 text-red-400"><FiUserX /> Não</span>
                  }
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                    onClick={() => setModalCliente(cliente)}
                  >
                    Detalhes
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de perfil do cliente */}
      {modalCliente && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[var(--color-bg-secondary)] rounded-2xl p-8 w-full max-w-lg shadow-xl border border-[var(--color-border)]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{modalCliente.nome}</h3>
              <button onClick={() => setModalCliente(null)} className="text-gray-400 hover:text-white text-2xl">×</button>
            </div>
            <div className="mb-4">
              <div className="text-sm text-gray-300 mb-1">Telefone: <b>{modalCliente.telefone}</b></div>
              <div className="text-sm text-gray-300 mb-1">Última compra: <b>{new Date(modalCliente.ultimaCompra).toLocaleDateString('pt-BR')}</b></div>
              <div className="text-sm text-gray-300 mb-1">Total gasto: <b>R$ {modalCliente.totalGasto.toFixed(2)}</b></div>
              <div className="text-sm text-gray-300 mb-1">Visitas: <b>{modalCliente.visitas}</b></div>
              <div className="text-sm text-gray-300 mb-1">Clube: <b>{modalCliente.clubeAtivo ? 'Sim' : 'Não'}</b></div>
              <div className="text-sm text-gray-300 mb-1">Pontuação: <b>{modalCliente.pontuacao ?? 0}</b></div>
              <div className="text-sm text-gray-300 mb-1">Tags: {modalCliente.tags?.map(tag => (
                <span key={tag} className="inline-block bg-blue-900 text-blue-200 px-2 py-0.5 rounded mr-1">{tag}</span>
              ))}</div>
            </div>
            <div className="mb-4">
              <button className="flex items-center gap-2 px-4 py-2 rounded bg-green-700 hover:bg-green-800 text-white font-semibold">
                <FiMessageCircle /> Enviar oferta personalizada
              </button>
            </div>
            <div className="text-xs text-gray-400 italic">
              Histórico de compras, produtos mais comprados e sugestões de IA podem aparecer aqui.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}