import { useState, useEffect } from 'react';
import {
  Edit2, // ou Edit
  Trash2,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Users, // Ícone para o cabeçalho
  Award, // Para clube ativo
  UserCheck,
  UserX,
  Zap, // Para insights
  Gift, // Para insights
  MessageCircle, // Para ações no modal
  DollarSign, // Para total gasto
  Activity, // Para visitas
  CalendarDays, // Para última compra
} from 'lucide-react';

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
  // Adicionar campos que podem vir da API, como createdAt
  createdAt?: string; 
};

export function ClientesTab() {
  const [clientes, setClientes] = useState<Cliente[]>([
    // Dados mocados iniciais
    { _id: '1', nome: 'João Silva Pereira', telefone: '(47) 99999-1234', email: 'joao.silva@email.com', totalGasto: 234.50, visitas: 12, clubeAtivo: true, ultimaCompra: '2024-07-20T10:30:00Z', pontuacao: 120, tags: ['VIP', 'Frequente'], createdAt: '2023-01-15T00:00:00Z' },
    { _id: '2', nome: 'Maria Clara Oliveira', telefone: '(47) 98888-9876', email: 'maria.clara@email.com', totalGasto: 89.00, visitas: 4, clubeAtivo: false, ultimaCompra: '2024-07-18T15:00:00Z', pontuacao: 30, tags: ['Novo'], createdAt: '2024-03-10T00:00:00Z' },
    { _id: '3', nome: 'Carlos Alberto Souza', telefone: '(48) 99123-4567', email: 'carlos.souza@email.com', totalGasto: 560.80, visitas: 25, clubeAtivo: true, ultimaCompra: '2024-07-22T09:15:00Z', pontuacao: 250, tags: ['VIP', 'Alto Valor'], createdAt: '2022-11-05T00:00:00Z' },
    { _id: '4', nome: 'Ana Beatriz Lima', telefone: '(49) 99234-5678', email: 'ana.lima@email.com', totalGasto: 15.00, visitas: 1, clubeAtivo: false, ultimaCompra: '2024-06-01T14:00:00Z', pontuacao: 5, createdAt: '2024-06-01T00:00:00Z' },
    { _id: '5', nome: 'Pedro Henrique Costa', telefone: '(47) 99345-6789', email: 'pedro.costa@email.com', totalGasto: 125.30, visitas: 8, clubeAtivo: true, ultimaCompra: '2024-07-15T11:00:00Z', pontuacao: 80, tags: ['Regular'], createdAt: '2023-08-20T00:00:00Z' },
  ]);
  const [loading, setLoading] = useState<boolean>(false); // Para simular carregamento
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [modalCliente, setModalCliente] = useState<Cliente | null>(null);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState<boolean>(false);
  const [newClientForm, setNewClientForm] = useState<Partial<Cliente>>({
    nome: '',
    telefone: '',
    email: '',
    clubeAtivo: false,
  });

  // Paginação (ainda sem lógica completa, apenas UI)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1); // Será calculado com base nos dados reais
  const itemsPerPage = 8;

  // Simulação de fetch (pode ser substituído por uma chamada de API real)
  useEffect(() => {
    setLoading(true);
    // Simula um delay de API
    setTimeout(() => {
      // Aqui você faria o fetch dos clientes da API
      // Por enquanto, usamos os dados mocados e aplicamos filtros
      const filtered = clientes.filter(c =>
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.telefone.includes(searchTerm) ||
        (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.clubeAtivo ? 'clube ativo' : 'sem clube').includes(searchTerm.toLowerCase())
      );
      // Atualiza o total de páginas para a paginação (exemplo)
      setTotalPages(Math.ceil(filtered.length / itemsPerPage));
      // Aqui você aplicaria a paginação nos 'filtered'
      setClientes(filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage));
      setLoading(false);
    }, 500);
  }, [searchTerm, currentPage]); // Adicionar dependências reais quando buscar da API


  const clientesFiltrados = clientes; // A filtragem agora é feita no useEffect de "fetch"

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const exportarCSV = () => {
    const csvHeader = ['Nome', 'Telefone', 'Email', 'Última Compra', 'Total Gasto', 'Visitas', 'Clube Ativo', 'Pontuação', 'Tags'];
    const csvRows = clientesFiltrados.map(c => [
      c.nome,
      c.telefone,
      c.email || '',
      formatDate(c.ultimaCompra),
      c.totalGasto.toFixed(2).replace('.', ','),
      c.visitas,
      c.clubeAtivo ? 'Sim' : 'Não',
      c.pontuacao || 0,
      c.tags?.join(', ') || ''
    ]);

    const csvContent = [
      csvHeader.join(';'),
      ...csvRows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // Adiciona BOM para Excel
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `clientes_kashy_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleNewClientInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setNewClientForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSaveNewClient = (e: React.FormEvent) => {
    e.preventDefault();
    // Lógica para salvar novo cliente (ex: chamada API)
    console.log("Novo cliente para salvar:", newClientForm);
    // Adicionar à lista (simulação)
    const novoId = String(clientes.length + 10); // Simula um ID único
    const clienteCriado: Cliente = {
      _id: novoId,
      nome: newClientForm.nome || 'Novo Cliente',
      telefone: newClientForm.telefone || '(00) 00000-0000',
      email: newClientForm.email,
      totalGasto: 0,
      visitas: 0,
      clubeAtivo: newClientForm.clubeAtivo || false,
      ultimaCompra: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    setClientes(prev => [clienteCriado, ...prev]);
    setIsNewClientModalOpen(false);
    setNewClientForm({ nome: '', telefone: '', email: '', clubeAtivo: false });
    // Adicionar notificação de sucesso
  };

  // Estatísticas para o Hero
  const totalClientes = clientes.length; // Usar o total real quando vier da API
  const clientesAtivosClube = clientes.filter(c => c.clubeAtivo).length;
  const mediaGasto = clientes.length > 0 ? clientes.reduce((acc, c) => acc + c.totalGasto, 0) / clientes.length : 0;


  return (
    <div className="bg-gradient-to-br from-[#1E2328] via-[#24292D] to-[#2B3036] min-h-screen text-white">
      <div className="container mx-auto px-4 py-6">

        {/* Hero Section */}
        <div className="relative overflow-hidden mb-10">
          <div
            className="relative p-6 text-white text-center rounded-3xl shadow-2xl backdrop-blur-xl border border-white/10"
            style={{
              background: `
                radial-gradient(circle at 20% 50%, rgba(79, 70, 229, 0.2) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.3) 0%, transparent 50%),
                linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(99, 102, 241, 0.15) 100%)
              `,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-indigo-700/20 rounded-xl backdrop-blur-sm border border-indigo-400/30">
                  <Users size={36} className="text-indigo-300" />
                </div>
                <div className="text-left">
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent">
                    Gestão de Clientes
                  </h1>
                  <p className="text-base text-indigo-100/80">Conheça e gerencie sua base de clientes</p>
                </div>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <div className="group p-4 bg-gradient-to-br from-sky-500/10 to-sky-600/5 rounded-xl backdrop-blur-sm border border-sky-400/20 hover:border-sky-400/40 transition-all duration-300 hover:scale-105">
                  <div className="text-2xl font-bold text-sky-300 mb-1">{totalClientes}</div>
                  <div className="text-xs text-sky-200/80 font-medium">Total de Clientes</div>
                </div>
                <div className="group p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl backdrop-blur-sm border border-emerald-400/20 hover:border-emerald-400/40 transition-all duration-300 hover:scale-105">
                  <div className="text-2xl font-bold text-emerald-300 mb-1">{clientesAtivosClube}</div>
                  <div className="text-xs text-emerald-200/80 font-medium">Ativos no Clube</div>
                </div>
                <div className="group p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-xl backdrop-blur-sm border border-amber-400/20 hover:border-amber-400/40 transition-all duration-300 hover:scale-105">
                  <div className="text-2xl font-bold text-amber-300 mb-1">{formatCurrency(mediaGasto)}</div>
                  <div className="text-xs text-amber-200/80 font-medium">Gasto Médio</div>
                </div>
              </div>

              <div className="mt-8">
                <button
                  onClick={() => setIsNewClientModalOpen(true)}
                  className="group relative px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl border border-indigo-400/30 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Plus size={18} />
                    <span>Novo Cliente</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Filters and Actions Section */}
        <div className="mb-6">
          <div className="p-6 bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full lg:max-w-md">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Buscar por nome, telefone, email ou clube..."
                  className="w-full pl-10 pr-3 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                onClick={exportarCSV}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-xl border border-emerald-500/30 hover:border-emerald-500/50 font-medium transition-all duration-200 hover:scale-105 text-sm"
              >
                <Download size={18} /> Exportar CSV
              </button>
            </div>
          </div>
        </div>

        {/* Insights IA */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="group p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 rounded-xl backdrop-blur-sm border border-yellow-400/20 hover:border-yellow-400/40 transition-all duration-300 hover:scale-105 flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
              <Zap className="text-yellow-300" size={20} />
            </div>
            <span className="text-sm text-yellow-200/90">
              Você tem <b>{clientes.filter(c => c.visitas > 5).length} clientes</b> que compraram mais de 5x.
            </span>
          </div>
          <div className="group p-4 bg-gradient-to-br from-pink-500/10 to-pink-600/5 rounded-xl backdrop-blur-sm border border-pink-400/20 hover:border-pink-400/40 transition-all duration-300 hover:scale-105 flex items-center gap-3">
            <div className="p-2 bg-pink-500/20 rounded-lg border border-pink-500/30">
              <Gift className="text-pink-300" size={20} />
            </div>
            <span className="text-sm text-pink-200/90">
              <b>{clientes.filter(c => c.visitas === 9).length} clientes</b> completaram 9 compras – incentive a 10ª!
            </span>
          </div>
        </div>

        {/* Lista de clientes */}
        <div className="bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-flex items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
                <span className="text-white font-medium">Carregando clientes...</span>
              </div>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <div className="text-red-400 font-medium">{error}</div>
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400">Nenhum cliente encontrado.</div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#24292D]/80 backdrop-blur-sm border-b border-white/10">
                    <tr className="text-xs">
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Nome</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Contato</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Última Compra</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Total Gasto</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-300 uppercase tracking-wider">Visitas</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Clube</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-300 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {clientesFiltrados.map(cliente => (
                      <tr key={cliente._id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-sm text-white font-medium">{cliente.nome}</div>
                          {cliente.email && <div className="text-xs text-gray-400">{cliente.email}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">{cliente.telefone}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">{formatDate(cliente.ultimaCompra)}</td>
                        <td className="px-4 py-3 text-sm text-white font-medium">{formatCurrency(cliente.totalGasto)}</td>
                        <td className="px-4 py-3 text-sm text-gray-300 text-center">{cliente.visitas}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${
                            cliente.clubeAtivo
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 border-red-500/30'
                          }`}>
                            {cliente.clubeAtivo ? <UserCheck size={14} /> : <UserX size={14} />}
                            {cliente.clubeAtivo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => setModalCliente(cliente)}
                              className="p-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded-md border border-sky-500/30 hover:border-sky-500/50 transition-all duration-200 hover:scale-110"
                              title="Ver Detalhes"
                            >
                              <Users size={14} />
                            </button>
                            {/* Adicionar botões de editar e excluir se necessário */}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination Controls */}
              {!loading && !error && clientesFiltrados.length > 0 && (
                <div className="mt-0 flex items-center justify-between px-4 py-3 border-t border-white/10">
                  <div>
                    <p className="text-xs text-gray-300">
                      Página <span className="font-semibold text-white">{currentPage}</span> de <span className="font-semibold text-white">{totalPages}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-md border border-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      <ChevronLeft size={16} /> Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-md border border-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      Próximo <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal de perfil do cliente */}
        {modalCliente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl bg-[#24292D]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-white/10 flex-shrink-0">
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Users size={22} /> Perfil de {modalCliente.nome}
                  </h2>
                  <button
                    className="p-2 text-gray-400 hover:text-white transition-colors z-10 bg-white/5 hover:bg-white/10 rounded-xl"
                    onClick={() => setModalCliente(null)}
                    aria-label="Fechar"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6 flex-grow overflow-y-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Coluna 1: Informações Básicas e Contato */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-indigo-300 mb-1">Informações de Contato</h4>
                      <div className="text-sm text-gray-300 space-y-0.5">
                        <p><b>Telefone:</b> {modalCliente.telefone}</p>
                        {modalCliente.email && <p><b>Email:</b> {modalCliente.email}</p>}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-indigo-300 mb-1">Clube de Fidelidade</h4>
                      <p className={`text-sm font-medium ${modalCliente.clubeAtivo ? 'text-emerald-400' : 'text-red-400'}`}>
                        {modalCliente.clubeAtivo ? 'Membro Ativo' : 'Não é membro'}
                        {modalCliente.clubeAtivo && modalCliente.pontuacao && ` - ${modalCliente.pontuacao} pontos`}
                      </p>
                    </div>
                    {modalCliente.tags && modalCliente.tags.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-indigo-300 mb-1.5">Tags</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {modalCliente.tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-sky-700/50 text-sky-300 text-xs rounded-md border border-sky-600/70">{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Coluna 2: Atividade e Métricas */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-indigo-300 mb-1">Atividade Recente</h4>
                      <div className="text-sm text-gray-300 space-y-0.5">
                        <p><b>Última Compra:</b> {formatDate(modalCliente.ultimaCompra)}</p>
                        <p><b>Cliente desde:</b> {modalCliente.createdAt ? formatDate(modalCliente.createdAt) : 'N/A'}</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-indigo-300 mb-1">Métricas de Compra</h4>
                      <div className="text-sm text-gray-300 space-y-0.5">
                        <p><b>Total Gasto:</b> {formatCurrency(modalCliente.totalGasto)}</p>
                        <p><b>Total de Visitas:</b> {modalCliente.visitas}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Seção de Ações Rápidas */}
                <div>
                  <h4 className="text-sm font-semibold text-indigo-300 mb-2">Ações Rápidas</h4>
                  <div className="flex flex-wrap gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-sm font-medium transition-colors">
                      <MessageCircle size={16} /> Enviar Oferta
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-sm font-medium transition-colors">
                      <Award size={16} /> Adicionar Pontos
                    </button>
                  </div>
                </div>

                {/* Placeholder para Histórico e IA */}
                <div className="pt-4 border-t border-white/10">
                  <p className="text-xs text-gray-400 italic">
                    Área para histórico de compras detalhado, produtos mais comprados e sugestões personalizadas da IA.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-white/10 flex-shrink-0">
                <button
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm text-white font-medium transition-colors"
                  onClick={() => setModalCliente(null)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Novo Cliente */}
        {isNewClientModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-lg bg-[#24292D]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl flex flex-col">
              <button
                className="absolute top-6 right-6 p-2 text-gray-400 hover:text-white transition-colors z-10 bg-white/5 hover:bg-white/10 rounded-xl"
                onClick={() => {
                  setIsNewClientModalOpen(false);
                  setNewClientForm({ nome: '', telefone: '', email: '', clubeAtivo: false });
                }}
                aria-label="Fechar"
              >
                ×
              </button>
              <div className="p-6 border-b border-white/10 flex-shrink-0">
                <h2 className="text-xl font-bold text-white">Adicionar Novo Cliente</h2>
                <p className="text-gray-400 mt-1 text-sm">Preencha os dados do novo cliente.</p>
              </div>
              <form onSubmit={handleSaveNewClient} className="p-6 flex-grow overflow-y-auto space-y-4 max-h-[70vh]">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Nome Completo *</label>
                  <input
                    type="text"
                    name="nome"
                    value={newClientForm.nome}
                    onChange={handleNewClientInputChange}
                    className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Telefone *</label>
                  <input
                    type="tel"
                    name="telefone"
                    value={newClientForm.telefone}
                    onChange={handleNewClientInputChange}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Email (Opcional)</label>
                  <input
                    type="email"
                    name="email"
                    value={newClientForm.email}
                    onChange={handleNewClientInputChange}
                    className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="clubeAtivoNovo"
                    name="clubeAtivo"
                    checked={newClientForm.clubeAtivo}
                    onChange={handleNewClientInputChange}
                    className="h-3.5 w-3.5 text-indigo-600 rounded bg-[#2F363E] border-white/20 focus:ring-indigo-500 focus:ring-offset-0"
                  />
                  <label htmlFor="clubeAtivoNovo" className="ml-2 text-xs text-gray-300">
                    Adicionar ao Clube de Fidelidade
                  </label>
                </div>
              </form>
              <div className="flex justify-end gap-3 p-6 border-t border-white/10 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewClientModalOpen(false);
                    setNewClientForm({ nome: '', telefone: '', email: '', clubeAtivo: false });
                  }}
                  className="px-5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30 hover:border-red-500/50 font-medium transition-all duration-200 hover:scale-105 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  onClick={handleSaveNewClient}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg text-sm"
                >
                  Salvar Cliente
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
