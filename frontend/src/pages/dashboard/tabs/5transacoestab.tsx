import { useState, useEffect } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  ListFilter,
  CheckCircle,
  Clock,
  XCircle,
  ChartNoAxesCombined,
  AlertCircle,
  TrendingUp, // Para o resumo
  FileText,   // Para o cabeçalho
} from 'lucide-react';
import { Listbox } from '@headlessui/react';

type Transaction = {
  _id: string;
  txid: string;
  type: 'incoming' | 'outgoing' | 'internal';
  amountSatoshis: number;
  address: string;
  status: 'pending' | 'confirmed' | 'failed' | 'expired';
  blockHeight?: number;
  timestamp: string;
  createdAt: string;
  confirmations?: number;
  feeBCH?: number;
};

export function TransacoesTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const itemsPerPage = 10;

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        // Simulação de fetch com token, se necessário
        // const token = localStorage.getItem('token');
        // const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        // const response = await fetch('http://localhost:3000/api/transactions', { headers });
        const response = await fetch('http://localhost:3000/api/transactions');
        if (!response.ok) throw new Error('Erro ao buscar transações');
        const data: Transaction[] = await response.json();

        const filteredTransactions = data.filter(tx => {
          const matchesSearch =
            (tx.txid && tx.txid.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (tx._id && tx._id.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (tx.address && tx.address.toLowerCase().includes(searchTerm.toLowerCase()));

          const matchesStatus =
            statusFilter === 'all' || tx.status === statusFilter;

          const matchesDate =
            dateFilter === 'all' ||
            (dateFilter === 'today' && new Date(tx.createdAt).toDateString() === new Date().toDateString()) ||
            (dateFilter === 'week' && (new Date().getTime() - new Date(tx.createdAt).getTime()) < 7 * 86400000) ||
            (dateFilter === 'month' && (new Date().getTime() - new Date(tx.createdAt).getTime()) < 30 * 86400000);

          return matchesSearch && matchesStatus && matchesDate;
        });

        filteredTransactions.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);

        setTransactions(paginatedTransactions);
        setTotalPages(Math.ceil(filteredTransactions.length / itemsPerPage));
        setError(null);
      } catch (err) {
        setError('Erro ao carregar transações');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [currentPage, searchTerm, statusFilter, dateFilter]);

  const formatBCH = (value: number | undefined | null) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return (value / 1e8).toFixed(8) + ' BCH'; // Convertendo satoshis para BCH
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAddress = (address: string | undefined) => {
    if (!address || typeof address !== 'string' || address.length < 10) return address || 'N/A';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const getStatusClasses = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'pending':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'expired':
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      default:
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmada';
      case 'pending': return 'Pendente';
      case 'failed': return 'Falhou';
      case 'expired': return 'Expirada';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle size={14} />;
      case 'pending': return <Clock size={14} />;
      case 'failed': return <XCircle size={14} />;
      case 'expired': return <AlertCircle size={14} />;
      default: return <FileText size={14} />;
    }
  };

  const handleExportCSV = () => {
    const csvHeader = ['Hash/ID', 'Tipo', 'Valor (BCH)', 'Endereço', 'Status', 'Data', 'Confirmações', 'Taxa (BCH)'];
    const csvRows = transactions.map(tx => [
      tx.txid || tx._id,
      tx.type === 'incoming' ? 'Recebido' : tx.type === 'outgoing' ? 'Enviado' : 'Interna',
      (tx.amountSatoshis / 1e8).toFixed(8),
      tx.address,
      getStatusLabel(tx.status),
      formatDate(tx.timestamp || tx.createdAt),
      typeof tx.confirmations === 'number' ? tx.confirmations.toString() : '-',
      typeof tx.feeBCH === 'number' ? tx.feeBCH.toFixed(8) : '-'
    ]);

    const csvContent = [
      csvHeader.join(';'),
      ...csvRows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `transacoes_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const statusOptions = [
    { value: 'all', label: 'Todos os Status' },
    { value: 'confirmed', label: 'Confirmadas' },
    { value: 'pending', label: 'Pendentes' },
    { value: 'failed', label: 'Falhas' },
    { value: 'expired', label: 'Expiradas' },
  ];

  const dateOptions = [
    { value: 'all', label: 'Todos os Períodos' },
    { value: 'today', label: 'Hoje' },
    { value: 'week', label: 'Últimos 7 dias' },
    { value: 'month', label: 'Últimos 30 dias' },
  ];


  return (
    <div className="bg-gradient-to-br from-[#1E2328] via-[#24292D] to-[#2B3036] min-h-screen text-white">
      <div className="container mx-auto px-4 py-6">

        {/* Hero Section */}
        <div className="relative overflow-hidden mb-10">
          <div
            className="relative p-6 text-white text-center rounded-3xl shadow-2xl backdrop-blur-xl border border-white/10"
            style={{
              background: `
                radial-gradient(circle at 20% 50%, rgba(129, 140, 248, 0.2) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.3) 0%, transparent 50%),
                linear-gradient(135deg, rgba(129, 140, 248, 0.1) 0%, rgba(99, 102, 241, 0.15) 100%)
              `,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-indigo-700/20 rounded-xl backdrop-blur-sm border border-indigo-400/30">
                  <ChartNoAxesCombined size={36} className="text-indigo-300" />
                </div>
                <div className="text-left">
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent">
                    Histórico de Transações
                  </h1>
                  <p className="text-base text-indigo-100/80">Visualize e gerencie todas as suas transações</p>
                </div>
              </div>
              <div className="mt-8">
                <button
                  onClick={handleExportCSV}
                  className="group relative px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl border border-indigo-400/30 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Download size={18} />
                    <span>Exportar CSV</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="mb-6">
          <div className="p-6 bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl relative z-10">
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full lg:max-w-md">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Buscar por hash, ID ou endereço..."
                  className="w-full pl-10 pr-3 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className="flex gap-3 w-full lg:w-auto">
                {/* Status Listbox */}
                <Listbox value={statusFilter} onChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
                  <div className="relative min-w-[180px]"> {/* Largura mínima definida */}
                    <Listbox.Button className="w-full px-4 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm text-left whitespace-nowrap hover:bg-[#2d3338] truncate"> {/* Adicionado truncate */}
                      {statusOptions.find(s => s.value === statusFilter)?.label || 'Todos os status'}
                    </Listbox.Button>
                    <Listbox.Options className="text-white absolute w-full bg-[#24292D] border border-white/10 rounded-xl shadow-lg z-20">
                      {statusOptions.map((opt, idx) => (
                        <Listbox.Option
                          key={opt.value}
                          value={opt.value}
                          className={`px-4 py-2 bg-[#24292D] hover:bg-[#2d3338] cursor-pointer whitespace-nowrap text-sm
                            ${idx === 0 ? 'rounded-t-xl' : ''}
                            ${idx === statusOptions.length - 1 ? 'rounded-b-xl' : ''}
                          `}
                        >
                          {opt.label}
                        </Listbox.Option>
                      ))}
                    </Listbox.Options>
                  </div>
                </Listbox>

                {/* Date Listbox */}
                <Listbox value={dateFilter} onChange={(value) => { setDateFilter(value); setCurrentPage(1); }}>
                  <div className="relative min-w-[180px]"> {/* Largura mínima definida */}
                    <Listbox.Button className="w-full px-4 py-3 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm text-left whitespace-nowrap hover:bg-[#2d3338] truncate"> {/* Adicionado truncate */}
                      {dateOptions.find(d => d.value === dateFilter)?.label || 'Todo período'}
                    </Listbox.Button>
                    <Listbox.Options className="text-white absolute w-full bg-[#24292D] border border-white/10 rounded-xl shadow-lg z-20">
                      {dateOptions.map((opt, idx) => (
                        <Listbox.Option
                          key={opt.value}
                          value={opt.value}
                          className={`px-4 py-2 bg-[#24292D] hover:bg-[#2d3338] cursor-pointer whitespace-nowrap text-sm
                            ${idx === 0 ? 'rounded-t-xl' : ''}
                            ${idx === dateOptions.length - 1 ? 'rounded-b-xl' : ''}
                          `}
                        >
                          {opt.label}
                        </Listbox.Option>
                      ))}
                    </Listbox.Options>
                  </div>
                </Listbox>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="group p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl backdrop-blur-sm border border-emerald-400/20 hover:border-emerald-400/40 transition-all duration-300 hover:scale-105">
            <div className="text-2xl font-bold text-emerald-300 mb-1">{transactions.filter(t => t.status === 'confirmed').length}</div>
            <div className="text-xs text-emerald-200/80 font-medium">Confirmadas</div>
          </div>
          <div className="group p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-xl backdrop-blur-sm border border-amber-400/20 hover:border-amber-400/40 transition-all duration-300 hover:scale-105">
            <div className="text-2xl font-bold text-amber-300 mb-1">{transactions.filter(t => t.status === 'pending').length}</div>
            <div className="text-xs text-amber-200/80 font-medium">Pendentes</div>
          </div>
          <div className="group p-4 bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl backdrop-blur-sm border border-red-400/20 hover:border-red-400/40 transition-all duration-300 hover:scale-105">
            <div className="text-2xl font-bold text-red-300 mb-1">{transactions.filter(t => t.status === 'failed').length}</div>
            <div className="text-xs text-red-200/80 font-medium">Falhas</div>
          </div>
          <div className="group p-4 bg-gradient-to-br from-sky-500/10 to-sky-600/5 rounded-xl backdrop-blur-sm border border-sky-400/20 hover:border-sky-400/40 transition-all duration-300 hover:scale-105">
            <div className="text-2xl font-bold text-sky-300 mb-1">{transactions.length}</div>
            <div className="text-xs text-sky-200/80 font-medium">Total de Transações</div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-flex items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
                <span className="text-white font-medium">Carregando transações...</span>
              </div>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <div className="text-red-400 font-medium">{error}</div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400">Nenhuma transação encontrada com os filtros aplicados.</div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#24292D]/80 backdrop-blur-sm border-b border-white/10">
                    <tr className="text-xs">
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Hash/ID</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Tipo</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Valor</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Endereço</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Data</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-300 uppercase tracking-wider">Conf.</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300 uppercase tracking-wider">Taxa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {transactions.map((tx) => (
                      <tr key={tx._id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-mono text-indigo-400 hover:text-indigo-300 cursor-pointer" title={tx.txid || tx._id}>
                            {formatAddress(tx.txid || tx._id)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`capitalize text-sm ${
                            tx.type === 'incoming' ? 'text-green-400' : 
                            tx.type === 'outgoing' ? 'text-red-400' : 'text-sky-400'
                          }`}>
                            {tx.type === 'incoming' ? 'Recebido' : tx.type === 'outgoing' ? 'Enviado' : 'Interna'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-white font-medium">
                            {formatBCH(tx.amountSatoshis)}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-mono text-gray-300" title={tx.address}>{formatAddress(tx.address)}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${getStatusClasses(tx.status)}`}>
                            {getStatusIcon(tx.status)}
                            {getStatusLabel(tx.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                          {formatDate(tx.timestamp || tx.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300 text-center">
                          {typeof tx.confirmations === 'number' ? tx.confirmations : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                          {typeof tx.feeBCH === 'number' ? `${tx.feeBCH.toFixed(8)} BCH` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!loading && !error && transactions.length > 0 && (
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
                      className="flex items-center gap-1 px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 rounded-md border border-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      <ChevronLeft size={16} />
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="flex items-center gap-1 px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 rounded-md border border-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      Próximo
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
