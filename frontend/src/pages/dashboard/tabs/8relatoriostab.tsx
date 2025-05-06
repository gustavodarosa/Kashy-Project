import { useState } from 'react';
import { FiBarChart2, FiCalendar, FiDownload, FiTrash2, FiEdit } from 'react-icons/fi';

type Report = {
  id: string;
  title: string;
  type: 'sales' | 'transactions' | 'inventory' | 'custom';
  dateRange: string;
  generatedAt: string;
  previewData: any;
  isAIGenerated?: boolean;
};

export function RelatoriosTab() {
  // Estado para os relatórios
  const [reports, setReports] = useState<Report[]>([
    {
      id: '1',
      title: 'Relatório de Vendas Mensal',
      type: 'sales',
      dateRange: '01/05/2024 - 31/05/2024',
      generatedAt: '02/06/2024 14:30',
      previewData: {
        totalSales: 12540.75,
        totalTransactions: 84,
        bestSellingProduct: 'Smartphone XYZ',
        comparison: '+12% vs mês anterior'
      }
    },
    {
      id: '2',
      title: 'Fluxo de Transações em BCH',
      type: 'transactions',
      dateRange: '01/04/2024 - 30/04/2024',
      generatedAt: '01/05/2024 09:15',
      previewData: {
        totalBCH: 8.5421,
        avgTransaction: 0.1245,
        peakDay: '15/04/2024',
        comparison: '+5% vs mês anterior'
      }
    },
    {
      id: '3',
      title: 'Análise de Estoque',
      type: 'inventory',
      dateRange: 'Atual',
      generatedAt: '15/05/2024 16:45',
      previewData: {
        totalProducts: 42,
        lowStockItems: 5,
        outOfStockItems: 2,
        mostStockedCategory: 'Eletrônicos'
      },
      isAIGenerated: true
    }
  ]);

  // Estados para modais
  const [isNewReportModalOpen, setIsNewReportModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  
  // Estados para formulários
  const [newReportType, setNewReportType] = useState<'standard' | 'ai'>('standard');
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [reportTitle, setReportTitle] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Gerar novo relatório
  const generateNewReport = () => {
    const newReport: Report = {
      id: `report-${Date.now()}`,
      title: reportTitle || `Relatório de ${newReportType === 'standard' ? 'Vendas' : 'Personalizado'} ${dateRange.start ? dateRange.start + ' a ' + dateRange.end : 'Geral'}`,
      type: 'custom',
      dateRange: dateRange.start && dateRange.end ? 
        `${dateRange.start} - ${dateRange.end}` : 'Período completo',
      generatedAt: new Date().toLocaleString('pt-BR'),
      previewData: {
        summary: 'Dados coletados conforme parâmetros selecionados',
        insights: newReportType === 'ai' ? 'Análise gerada por IA' : 'Relatório padrão'
      },
      isAIGenerated: newReportType === 'ai'
    };
    
    setReports(prev => [newReport, ...prev]);
    resetForm();
  };

  // Atualizar relatório existente
  const updateReport = () => {
    if (!currentReport) return;
    
    const updatedReport = {
      ...currentReport,
      title: reportTitle || currentReport.title,
      dateRange: dateRange.start && dateRange.end ? 
        `${dateRange.start} - ${dateRange.end}` : currentReport.dateRange,
      generatedAt: new Date().toLocaleString('pt-BR')
    };
    
    setReports(prev => prev.map(r => r.id === currentReport.id ? updatedReport : r));
    resetForm();
  };

  // Excluir relatório
  const deleteReport = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este relatório?')) {
      setReports(prev => prev.filter(r => r.id !== id));
    }
  };

  // Gerar relatório com IA (simulação)
  const generateAIReport = () => {
    setIsGenerating(true);
    
    setTimeout(() => {
      const newReport: Report = {
        id: `ai-report-${Date.now()}`,
        title: reportTitle || `Análise IA: ${aiPrompt.substring(0, 30)}${aiPrompt.length > 30 ? '...' : ''}`,
        type: 'custom',
        dateRange: dateRange.start && dateRange.end ? 
          `${dateRange.start} - ${dateRange.end}` : 'Período completo',
        generatedAt: new Date().toLocaleString('pt-BR'),
        previewData: {
          insights: [
            "Padrão identificado: aumento de vendas às sextas-feiras",
            "Recomendação: promoções especiais nas quintas para impulsionar vendas",
            "Produto com potencial: Câmera Digital aumentou 25% em buscas"
          ],
          conclusion: "O período analisado mostra crescimento consistente com oportunidades claras de otimização."
        },
        isAIGenerated: true
      };
      
      setReports(prev => [newReport, ...prev]);
      resetForm();
      setIsGenerating(false);
    }, 2000);
  };

  // Preparar para edição
  const prepareForEdit = (report: Report) => {
    setCurrentReport(report);
    setReportTitle(report.title);
    
    // Extrai datas do dateRange se existir
    const dates = report.dateRange.split(' - ');
    if (dates.length === 2) {
      setDateRange({ start: dates[0], end: dates[1] });
    }
    
    setIsEditModalOpen(true);
  };

  // Resetar formulários
  const resetForm = () => {
    setIsNewReportModalOpen(false);
    setIsEditModalOpen(false);
    setCurrentReport(null);
    setDateRange({ start: '', end: '' });
    setReportTitle('');
    setAiPrompt('');
  };

  // Formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <FiBarChart2 /> Relatórios e Análises
      </h2>

      {/* Cabeçalho com ações */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="text-gray-300">
          <p>Gerencie seus relatórios e análises</p>
          <p className="text-sm">{reports.length} relatórios disponíveis</p>
        </div>
        
        <button
          onClick={() => setIsNewReportModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
        >
           Novo Relatório
        </button>
      </div>

      {/* Grid de Relatórios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => (
          <div key={report.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-blue-500 transition-colors group relative">
            {/* Menu de ações */}
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <button
                onClick={() => prepareForEdit(report)}
                className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded"
                title="Editar"
              >
                <FiEdit size={16} />
              </button>
              <button
                onClick={() => deleteReport(report.id)}
                className="p-1.5 bg-gray-700 hover:bg-red-600 rounded"
                title="Excluir"
              >
                <FiTrash2 size={16} />
              </button>
            </div>
            
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold">
                {report.title}
                {report.isAIGenerated && (
                  <span className="ml-2 text-xs bg-purple-600 text-white px-2 py-1 rounded-full">
                    IA
                  </span>
                )}
              </h3>
              <button className="text-gray-400 hover:text-blue-400">
                <FiDownload />
              </button>
            </div>
            
            <div className="mb-4 text-sm text-gray-400 flex items-center gap-2">
              <FiCalendar /> {report.dateRange}
            </div>
            
            <div className="mb-6">
              {report.type === 'sales' && (
                <div className="space-y-2">
                  <p><span className="text-gray-400">Total vendas:</span> R$ {report.previewData.totalSales.toLocaleString('pt-BR')}</p>
                  <p><span className="text-gray-400">Transações:</span> {report.previewData.totalTransactions}</p>
                  <p><span className="text-gray-400">Produto mais vendido:</span> {report.previewData.bestSellingProduct}</p>
                  <p><span className="text-gray-400">Comparativo:</span> <span className={report.previewData.comparison.includes('+') ? 'text-green-400' : 'text-red-400'}>
                    {report.previewData.comparison}
                  </span></p>
                </div>
              )}
              
              {report.type === 'transactions' && (
                <div className="space-y-2">
                  <p><span className="text-gray-400">Total BCH:</span> {report.previewData.totalBCH} BCH</p>
                  <p><span className="text-gray-400">Média por transação:</span> {report.previewData.avgTransaction} BCH</p>
                  <p><span className="text-gray-400">Dia com mais transações:</span> {report.previewData.peakDay}</p>
                  <p><span className="text-gray-400">Comparativo:</span> <span className={report.previewData.comparison.includes('+') ? 'text-green-400' : 'text-red-400'}>
                    {report.previewData.comparison}
                  </span></p>
                </div>
              )}
              
              {report.type === 'inventory' && (
                <div className="space-y-2">
                  <p><span className="text-gray-400">Produtos cadastrados:</span> {report.previewData.totalProducts}</p>
                  <p><span className="text-gray-400">Itens com baixo estoque:</span> {report.previewData.lowStockItems}</p>
                  <p><span className="text-gray-400">Itens esgotados:</span> {report.previewData.outOfStockItems}</p>
                  <p><span className="text-gray-400">Categoria com mais itens:</span> {report.previewData.mostStockedCategory}</p>
                </div>
              )}
              
              {report.type === 'custom' && (
                <div className="space-y-3">
                  {Array.isArray(report.previewData.insights) ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {report.previewData.insights.map((insight: string, index: number) => (
                        <li key={index}>{insight}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{report.previewData.insights || report.previewData.summary}</p>
                  )}
                  {report.previewData.conclusion && (
                    <p className="mt-2 p-2 bg-gray-700 rounded italic">{report.previewData.conclusion}</p>
                  )}
                </div>
              )}
            </div>
            
            <div className="text-xs text-gray-500">
              Gerado em: {report.generatedAt}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Novo Relatório */}
      {(isNewReportModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0  bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {isEditModalOpen ? 'Editar Relatório' : 'Gerar Novo Relatório'}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-6">
              {!isEditModalOpen && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <button
                    onClick={() => setNewReportType('standard')}
                    className={`p-4 rounded-lg border transition-colors ${
                      newReportType === 'standard' 
                        ? 'bg-blue-900 border-blue-600' 
                        : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <FiBarChart2 size={24} className="mb-2" />
                      <span>Relatório Padrão</span>
                      <span className="text-xs text-gray-400 mt-1">Dados estruturados</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setNewReportType('ai')}
                    className={`p-4 rounded-lg border transition-colors ${
                      newReportType === 'ai' 
                        ? 'bg-purple-900 border-purple-600' 
                        : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      
                      <span>Análise por IA</span>
                      <span className="text-xs text-gray-400 mt-1">Insights personalizados</span>
                    </div>
                  </button>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Título do Relatório</label>
                  <input
                    type="text"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    placeholder="Digite um título descritivo"
                    className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Data inicial</label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                      className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Data final</label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                      className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                {newReportType === 'ai' && !isEditModalOpen && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      O que você gostaria de analisar?
                    </label>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Ex: Analise o padrão de vendas por dia da semana e sugira promoções..."
                      className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows={3}
                    />
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={resetForm}
                className="px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (isEditModalOpen) {
                    updateReport();
                  } else if (newReportType === 'ai') {
                    generateAIReport();
                  } else {
                    generateNewReport();
                  }
                }}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  newReportType === 'ai' && !isEditModalOpen
                    ? 'bg-purple-600 hover:bg-purple-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isEditModalOpen ? 'Atualizando...' : 'Gerando...'}
                  </>
                ) : (
                  <>
                    {isEditModalOpen ? (
                      <FiEdit />
                    ) : newReportType === 'ai' ? (
                      <FiCalendar />
                    ) : (
                      <FiBarChart2 />
                    )}
                    {isEditModalOpen ? 'Atualizar Relatório' : newReportType === 'ai' ? 'Gerar com IA' : 'Gerar Relatório'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}