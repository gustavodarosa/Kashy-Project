import { useState, useEffect } from 'react'; // Added useEffect if needed later
import { FiBarChart2, FiCalendar, FiDownload, FiTrash2, FiEdit, FiCpu, FiPlus, FiAlertTriangle } from 'react-icons/fi'; // Added icons
import jsPDF from 'jspdf';
 
 
// --- Report Type Definition ---
type Report = {
  _id?: string;
  id: string;
  title: string;
  type: 'sales' | 'transactions' | 'inventory' | 'custom'; // Keep existing types
  dateRange: string; // String for display (e.g., "01/01/2024 - 31/01/2024" or "Período completo")
  generatedAt: string; // Timestamp string
  previewData: any; // Consider more specific types for each report.type if possible
  // For AI: { insights: string, conclusion?: string }
  isAIGenerated?: boolean;
  promptUsed?: string; // Store the prompt used for AI reports
};
 
// --- PDF Generation Function ---
const generatePDF = (report: Report) => {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
  let yPosition = 22; // Initial Y position with margin
 
  // Helper to add text and check for page breaks
  const addText = (text: string | string[], x: number, y: number, options?: any) => {
    doc.text(text, x, y, options);
    // Basic check, might need adjustment based on line height/font size
    const textHeight = Array.isArray(text) ? (text.length * 5) : 5; // Approximate height
    if (y + textHeight > pageHeight - 20) { // Check if text exceeds page boundary (with margin)
      doc.addPage();
      return 20; // Return new Y position for the new page
    }
    return y + textHeight + 3; // Return new Y position + small margin
  };
 
 
  // --- PDF Content ---
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  yPosition = addText(report.title, 14, yPosition); // Add title
 
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100); // Gray color for metadata
 
  yPosition = addText(`Tipo: ${report.type.toUpperCase()}`, 14, yPosition + 2); // Add space before metadata
  yPosition = addText(`Período: ${report.dateRange}`, 14, yPosition);
  yPosition = addText(`Gerado em: ${report.generatedAt}`, 14, yPosition);
  if (report.isAIGenerated && report.promptUsed) {
    // Split long prompt for display
    const promptLines = doc.splitTextToSize(`Prompt: ${report.promptUsed}`, pageWidth - 28); // Max width
    yPosition = addText(promptLines, 14, yPosition);
  }
 
  doc.setLineWidth(0.5);
  doc.setDrawColor(200); // Light gray line
  doc.line(14, yPosition + 2, pageWidth - 14, yPosition + 2); // Separator line
  yPosition += 8;
 
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0); // Black color
  yPosition = addText('Conteúdo do Relatório:', 14, yPosition);
  yPosition += 2; // Space before content
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
 
 
  // --- Report Specific Data ---
  try {
    if (report.type === 'custom' && report.isAIGenerated && report.previewData?.insights) {
      const insightsText = report.previewData.insights;
      // Split the text into lines that fit the page width
      const lines = doc.splitTextToSize(insightsText, pageWidth - 28); // 14 margin each side
      yPosition = addText(lines, 14, yPosition);
 
    } else if (report.type === 'sales' && report.previewData) {
      yPosition = addText(`- Total de Vendas: R$ ${report.previewData.totalSales?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/D'}`, 14, yPosition);
      yPosition = addText(`- Total de Transações: ${report.previewData.totalTransactions || 'N/D'}`, 14, yPosition);
      yPosition = addText(`- Produto Mais Vendido: ${report.previewData.bestSellingProduct || 'N/D'}`, 14, yPosition);
      yPosition = addText(`- Comparativo: ${report.previewData.comparison || 'N/D'}`, 14, yPosition);
    } else if (report.type === 'transactions' && report.previewData) {
      yPosition = addText(`- Total BCH: ${report.previewData.totalBCH?.toFixed(8) || 'N/D'} BCH`, 14, yPosition);
      yPosition = addText(`- Média por Transação: ${report.previewData.avgTransaction?.toFixed(8) || 'N/D'} BCH`, 14, yPosition);
      yPosition = addText(`- Dia com Mais Transações: ${report.previewData.peakDay || 'N/D'}`, 14, yPosition);
      yPosition = addText(`- Comparativo: ${report.previewData.comparison || 'N/D'}`, 14, yPosition);
    } else if (report.type === 'inventory' && report.previewData) {
      yPosition = addText(`- Produtos Cadastrados: ${report.previewData.totalProducts || 'N/D'}`, 14, yPosition);
      yPosition = addText(`- Itens com Baixo Estoque: ${report.previewData.lowStockItems || 'N/D'}`, 14, yPosition);
      yPosition = addText(`- Itens Esgotados: ${report.previewData.outOfStockItems || 'N/D'}`, 14, yPosition);
      yPosition = addText(`- Categoria com Mais Itens: ${report.previewData.mostStockedCategory || 'N/D'}`, 14, yPosition);
    } else if (report.type === 'custom' && report.previewData) {
      // Handle non-AI custom reports if they exist
      const summaryText = report.previewData.summary || report.previewData.insights || 'Relatório personalizado sem conteúdo detalhado.';
      const lines = doc.splitTextToSize(summaryText, pageWidth - 28);
      yPosition = addText(lines, 14, yPosition);
    }
    else {
      yPosition = addText('Dados do relatório não disponíveis ou formato não reconhecido.', 14, yPosition);
    }
 
    // Add conclusion if it exists
    if (report.previewData?.conclusion) {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100);
      const conclusionLines = doc.splitTextToSize(`Conclusão: ${report.previewData.conclusion}`, pageWidth - 28);
      yPosition = addText(conclusionLines, 14, yPosition + 5); // Add extra space before conclusion
    }
 
  } catch (error) {
    console.error("Erro ao adicionar dados ao PDF:", error);
    addText("Erro ao renderizar o conteúdo do relatório no PDF.", 14, yPosition);
  }
 
  // --- Save the PDF ---
  // Sanitize title for filename
  const safeTitle = report.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`${safeTitle}_${report.id.substring(0, 8)}.pdf`);
};
 
 
// --- Main React Component ---
export function RelatoriosTab() {
  // --- State Definitions ---
  const [reports, setReports] = useState<Report[]>([]); // Start with empty reports, load from API if needed
  const [isLoadingReports, setIsLoadingReports] = useState(false); // State for loading initial reports
  const [isNewReportModalOpen, setIsNewReportModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentReport, setCurrentReport] = useState<Report | null>(null); // Report being edited
 
  // Form States
  const [newReportType, setNewReportType] = useState<'standard' | 'ai'>('standard');
  const [dateRange, setDateRange] = useState({ start: '', end: '' }); // YYYY-MM-DD format from input type="date"
  const [reportTitle, setReportTitle] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
 
  const aiPromptOptions = [
    {
      value: 'users_count',
      label: 'Quantos usuários foram cadastrados?',
      prompt: 'Liste o número de usuários cadastrados.'
    },
    {
      value: 'low_stock',
      label: 'Quantos produtos estão com estoque baixo?',
      prompt: 'Liste quantos produtos estão com estoque baixo.'
    },
    {
      value: 'total_products',
      label: 'Quantos produtos existem no estoque?',
      prompt: 'Quantos produtos existem atualmente no estoque?'
    },
    // Adicione mais opções conforme necessário
  ];
 
  const [selectedPromptOption, setSelectedPromptOption] = useState(aiPromptOptions[0].value);
 
  // Action States
  const [isGenerating, setIsGenerating] = useState(false); // For AI generation specifically
  const [isSaving, setIsSaving] = useState(false); // For standard report generation/update
  const [error, setError] = useState<string | null>(null); // Error messages for modal/user feedback
  const [aiPreview, setAiPreview] = useState<string>('');
 
  // --- Form Reset ---
  const resetForm = () => {
    setIsNewReportModalOpen(false);
    setIsEditModalOpen(false);
    setCurrentReport(null);
    setNewReportType('standard'); // Default to standard
    setDateRange({ start: '', end: '' });
    setReportTitle('');
    setAiPrompt('');
    setError(null); // Clear any previous errors
    setIsGenerating(false); // Ensure loading states are reset
    setIsSaving(false);
    setAiPreview('');
  };
 
  // --- Modal Open/Close Handlers ---
  const openNewModal = () => {
    resetForm(); // Ensure clean state
    setIsNewReportModalOpen(true);
  };
 
  const openEditModal = (report: Report) => {
    console.log('Abrindo modal de edição para o relatório:', report); // Adicione este log
    resetForm(); // Ensure clean state before populating
    setCurrentReport(report);
    setReportTitle(report.title);
 
    const dates = report.dateRange.match(/(\d{2}\/\d{2}\/\d{2024})\s*-\s*(\d{2}\/\d{2}\/\d{2024})/);
    if (dates && dates.length === 3) {
      const formatDateToInput = (d: string) => {
        const parts = d.split('/');
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      };
      setDateRange({ start: formatDateToInput(dates[1]), end: formatDateToInput(dates[2]) });
    } else {
      setDateRange({ start: '', end: '' });
    }
 
    setIsEditModalOpen(true);
  };
 
  // --- Backend Save Function ---
  const saveReportToBackend = async (report: Report) => {
    try {
      console.log('Enviando relatório para o backend:', report); // Log para depuração
      const response = await fetch('http://localhost:3000/api/reports/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
 
      if (!response.ok) {
        throw new Error('Erro ao salvar relatório no backend.');
      }
 
      await response.json();
      await fetchReports(); // Atualiza a lista após salvar
    } catch (error) {
      console.error('Erro ao salvar relatório:', error);
      setError('Erro ao salvar relatório no backend.');
    }
  };
 
  // --- CRUD Operations ---
 
  // Generate Standard Report
  const generateStandardReport = async () => {
    setIsSaving(true);
    setError(null);
 
    const newReport: Report = {
      id: `std-report-${Date.now()}`,
      title: reportTitle || `Relatório Padrão ${dateRange.start ? dateRange.start + ' a ' + dateRange.end : 'Geral'}`,
      type: 'custom',
      dateRange: 'Período completo',
      generatedAt: new Date().toLocaleString('pt-BR'),
      previewData: { summary: 'Relatório padrão gerado (simulação).' },
      isAIGenerated: false,
    };
 
    try {
      await saveReportToBackend(newReport);
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };
 
  // Update Report
  const updateReport = async () => {
    if (!currentReport) {
      console.error('Nenhum relatório selecionado para atualização.');
      return;
    }
 
    console.log('Atualizando relatório:', currentReport); // Adicione este log
 
    setIsSaving(true);
    setError(null);
 
    const updatedReport = {
      ...currentReport,
      title: reportTitle || currentReport.title,
      dateRange: 'Período completo',
    };
 
    try {
      const response = await fetch(`http://localhost:3000/api/reports/${currentReport._id}`, { // Use `_id` aqui
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedReport),
      });
 
      if (!response.ok) {
        throw new Error('Erro ao atualizar relatório.');
      }
 
      await response.json();
      await fetchReports(); // Atualiza a lista após editar
      resetForm();
    } catch (error) {
      console.error('Erro ao atualizar relatório:', error);
      setError('Erro ao atualizar relatório.');
    } finally {
      setIsSaving(false);
    }
  };
 
  // Delete Report
  const deleteReport = async (id: string) => {
    console.log('Tentando deletar relatório com ID:', id); // Adicione este log
    if (!window.confirm(`Tem certeza que deseja excluir o relatório ID: ${id}?`)) return;
 
    try {
      const response = await fetch(`http://localhost:3000/api/reports/${id}`, {
        method: 'DELETE',
      });
 
      if (!response.ok) {
        throw new Error('Erro ao deletar relatório.');
      }
 
      await fetchReports(); // Atualiza a lista após deletar
    } catch (error) {
      console.error('Erro ao deletar relatório:', error);
      setError('Erro ao deletar relatório.');
    }
  };
 
  // Generate AI Report
  const generateAIReport = async () => {
    setIsGenerating(true);
    setError(null);
 
    const { start, end } = dateRange;
    const payload = {
      prompt: aiPrompt,
      startDate: start || null,
      endDate: end || null,
    };
 
    try {
      const response = await fetch('http://localhost:3000/api/reports/generate-ai-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
 
      if (!response.ok) {
        throw new Error('Erro ao gerar relatório com IA.');
      }
 
      const data = await response.json();
      const newReport: Report = {
        id: `ai-report-${Date.now()}`,
        title: reportTitle.trim() || `Análise AI: ${aiPrompt.substring(0, 30)}${aiPrompt.length > 30 ? '...' : ''}`,
        type: 'custom',
        dateRange: 'Período completo',
        generatedAt: new Date().toLocaleString('pt-BR'),
        previewData: {
          insights: data.insights,
          conclusion: 'Análise gerada por IA com base nos dados e prompt fornecidos.',
        },
        isAIGenerated: true,
        promptUsed: aiPrompt,
      };
 
      await saveReportToBackend(newReport);
      resetForm();
    } catch (error: any) {
      console.error('Erro ao gerar relatório com IA:', error);
      setError(error.message || 'Falha ao gerar relatório com IA.');
    } finally {
      setIsGenerating(false);
    }
  };
 
  const handleGenerateAIPreview = async () => {
    setIsGenerating(true);
    setError(null);
    setAiPreview('');
    const { start, end } = dateRange;
    const payload = {
      prompt: aiPrompt,
      startDate: start || null,
      endDate: end || null,
    };
 
    try {
      const response = await fetch('http://localhost:3000/api/reports/generate-ai-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
 
      if (!response.ok) {
        throw new Error('Erro ao gerar relatório com IA.');
      }
 
      const data = await response.json();
      setAiPreview(data.insights);
    } catch (error: any) {
      setError(error.message || 'Falha ao gerar relatório com IA.');
    } finally {
      setIsGenerating(false);
    }
  };
 
  // --- Fetch Reports (mova para fora do useEffect) ---
  const fetchReports = async () => {
    setIsLoadingReports(true);
    try {
      const response = await fetch('http://localhost:3000/api/reports');
      if (!response.ok) {
        throw new Error('Erro ao carregar relatórios.');
      }
      let data = await response.json();
      data = data.map((r: any) => ({
        ...r,
        previewData: r.data || r.previewData,
      }));
      setReports(data);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      setError('Falha ao carregar relatórios.');
    } finally {
      setIsLoadingReports(false);
    }
  };
 
  // --- useEffect apenas para carregar na montagem ---
  useEffect(() => {
    fetchReports();
  }, []);
 
  // --- JSX Rendering ---
  return (
    <div className="p-4 md:p-8 bg-[var(--color-bg-primary)] text-white min-h-screen font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <FiBarChart2 /> Relatórios & Análises
          </h2>
          <p className="text-gray-400 text-base mt-1">
            Gere relatórios detalhados, exporte em PDF e obtenha insights automáticos com IA.
          </p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-6 py-3 rounded-lg transition-colors text-base font-semibold shadow"
        >
          <FiPlus size={20} /> Novo Relatório
        </button>
      </div>
 
      {/* Loading State / Report Grid */}
      {isLoadingReports ? (
        <div className="text-center py-16 text-gray-400 text-lg">Carregando relatórios...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 px-6 bg-[var(--color-bg-secondary)] rounded-2xl border border-gray-700 shadow-lg">
          <FiBarChart2 size={48} className="mx-auto text-gray-500 mb-4" />
          <h3 className="text-xl font-semibold text-gray-300">Nenhum relatório encontrado</h3>
          <p className="text-gray-400 mt-2">Clique em <b>Novo Relatório</b> para gerar seu primeiro relatório.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-7">
          {reports.map((report) => (
            <div key={report.id} className="bg-[var(--color-bg-secondary)] rounded-2xl p-7 flex flex-col justify-between border border-[var(--color-border)] hover:border-blue-500 transition-colors group relative shadow-lg min-h-[320px]">
              {/* Action Buttons */}
              <div className="absolute top-3 right-3 flex gap-2 z-10">
                <button
                  onClick={() => openEditModal(report)}
                  className="p-2 bg-green-500 hover:bg-green-700 rounded-full text-white"
                  title="Editar Título/Datas"
                >
                  <FiEdit size={16} />
                </button>
                <button
                  onClick={() => report._id && deleteReport(report._id)}
                  className="p-2 bg-red-500 hover:bg-red-700 rounded-full text-white"
                  title="Excluir"
                >
                  <FiTrash2 size={16} />
                </button>
                <button
                  onClick={() => generatePDF(report)}
                  className="p-2 bg-blue-400 hover:bg-blue-500 rounded-full text-white"
                  title="Baixar PDF"
                >
                  <FiDownload size={16} />
                </button>
              </div>
 
              {/* Card Content */}
              <div>
                {/* Card Header */}
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold pr-20 break-words leading-snug">
                    {report.title}
                    {report.isAIGenerated}
                  </h3>
                </div>
 
                {/* Date Range & Type */}
                <div className="mb-2 flex flex-wrap items-center text-xs text-white">
                  <span className="flex items-center gap-1">
                   
                  </span>
                  <span className="px-3 py-0.5 bg-purple-700 rounded-full font-semibold uppercase tracking-wide">
                    {report.type === 'custom' ? (report.isAIGenerated ? 'IA' : 'Personalizado') : report.type}
                  </span>
                </div>
 
                {/* Preview Data Area */}
                <div className="mb-4 text-xs max-h-32 overflow-y-auto pr-1 text-gray-300 border-t border-b border-gray-700 py-2">
                  {report.previewData?.insights
                    ? (
                      <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                        {report.previewData.insights}
                      </pre>
                    )
                    : (
                      <p className="italic text-gray-500">Preview não disponível para este tipo.</p>
                    )
                  }
                  {/* Detalhes extras */}
                  {report.previewData?.conclusion && (
                    <div className="mt-2 text-gray-400 italic">
                      <b>Conclusão:</b> {report.previewData.conclusion}
                    </div>
                  )}
                  {report.previewData?.totalSales && (
                    <div className="mt-2 text-green-400 font-semibold">
                      Total de Vendas: R$ {report.previewData.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  )}
                  {report.previewData?.totalTransactions && (
                    <div className="text-blue-400 font-semibold">
                      Total de Transações: {report.previewData.totalTransactions}
                    </div>
                  )}
                  {report.previewData?.bestSellingProduct && (
                    <div className="text-yellow-400 font-semibold">
                      Produto Mais Vendido: {report.previewData.bestSellingProduct}
                    </div>
                  )}
                  {report.previewData?.lowStockItems && (
                    <div className="text-red-400 font-semibold">
                      Itens com Baixo Estoque: {report.previewData.lowStockItems}
                    </div>
                  )}
                  {report.previewData?.outOfStockItems && (
                    <div className="text-red-500 font-semibold">
                      Itens Esgotados: {report.previewData.outOfStockItems}
                    </div>
                  )}
                </div>
              </div>
 
              {/* Card Footer */}
              <div className="mt-auto text-xs text-gray-500 pt-2 flex flex-col gap-1">
                <span>Gerado em: {report.generatedAt}</span>
                {report.isAIGenerated && report.promptUsed && (
                  <div className="truncate" title={report.promptUsed}>
                    <span className="text-gray-400">Prompt:</span> <span className="italic">{report.promptUsed}</span>
                  </div>
                )}
                <span className="text-gray-400">ID: <span className="font-mono">{report.id}</span></span>
              </div>
            </div>
          ))}
        </div>
      )}
 
      {/* --- Modal (Novo/Editar) --- */}
      {(isNewReportModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 backdrop-blur-md backdrop-filter flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-bg-secondary)] rounded-2xl p-8 w-full max-w-xl border border-[var(--color-border)] shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">
                {isEditModalOpen ? 'Editar Relatório' : 'Gerar Novo Relatório'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-white text-xl" title="Fechar">✕</button>
            </div>
 
            {/* Type Selection (Only for New Report) */}
            {!isEditModalOpen && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => setNewReportType('standard')}
                  className={`p-4 rounded-xl text-center transition-colors ${newReportType === 'standard'
                    ? 'bg-blue-900 border-blue-600 hover:bg-blue-600 ring-2 ring-blue-500 hover:ring-blue-400'
                    : 'bg-blue-900 border-blue-600 hover:bg-blue-600 ring-2 ring-blue-500 hover:ring-blue-400'
                    }`}>
                  <FiBarChart2 size={22} className="mx-auto mb-1" />
                  <span className="text-base font-semibold">Padrão</span>
                  <span className="block text-xs text-gray-400 mt-1">Modelos fixos</span>
                </button>
                <button
                  onClick={() => setNewReportType('ai')}
                  className={`p-4 rounded-xl text-center transition-colors ${newReportType === 'ai'
                    ? 'bg-purple-900 border-purple-600 ring-2 ring-purple-600 hover:bg-purple-700'
                    : 'bg-purple-900 border-purple-600 ring-2 ring-purple-600 hover:bg-purple-700'
                    }`}>
                  <FiCpu size={22} className="mx-auto mb-1" />
                  <span className="text-base font-semibold">Análise IA</span>
                  <span className="block text-xs text-white mt-1">Insights via prompt</span>
                </button>
              </div>
            )}
 
            {/* Form Fields */}
            <div className="space-y-5">
              {/* Title */}
              <div>
                <label htmlFor="reportTitle" className="block text-xs font-medium mb-1 text-gray-300">Título do Relatório</label>
                <input
                  id="reportTitle"
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder={newReportType === 'ai' ? "Ex: Análise vendas Q1 com IA" : "Ex: Vendas - Maio 2024"}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-tertiary)] border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base text-white"
                />
              </div>
 
              {/* AI Prompt (Only for New AI Report) */}
              {newReportType === 'ai' && !isEditModalOpen && (
                <div>
                  <label htmlFor="aiPromptSelect" className="block text-xs font-medium mb-1 text-gray-300">
                    Escolha o tipo de relatório: <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="aiPromptSelect"
                    value={selectedPromptOption}
                    onChange={e => {
                      setSelectedPromptOption(e.target.value);
                      const found = aiPromptOptions.find(opt => opt.value === e.target.value);
                      setAiPrompt(found?.prompt || '');
                    }}
                    className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 text-base text-white"
                    required
                  >
                    {aiPromptOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    A IA usará o prompt pré-definido para gerar o relatório.
                  </p>
                </div>
              )}
 
              {/* Error Display Area */}
              {error && (
                <div className="p-3 my-2 bg-red-900/50 border border-red-700/50 text-red-200 rounded-md text-sm flex items-center gap-2">
                  <FiAlertTriangle size={16} />
                  {error}
                </div>
              )}
              {aiPreview && (
                <div className="mt-4 p-4 bg-gray-900 border border-gray-700 rounded-lg text-base text-gray-200 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  <strong>Preview do Relatório:</strong>
                  <div>{aiPreview}</div>
                  <div className="flex gap-3 mt-3">
                    <button
                      className="px-5 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold"
                      onClick={async () => {
                        // Salvar o relatório usando o preview já gerado
                        const limitedTitle = (reportTitle.trim() || `Análise AI: ${aiPrompt.substring(0, 30)}${aiPrompt.length > 30 ? '...' : ''}`).slice(0, 35);
                        const newReport: Report = {
                          id: `ai-report-${Date.now()}`,
                          title: limitedTitle,
                          type: 'custom',
                          dateRange: 'Período completo',
                          generatedAt: new Date().toLocaleString('pt-BR'),
                          previewData: {
                            insights: aiPreview,
                            conclusion: 'Análise gerada por IA com base nos dados e prompt fornecidos.',
                          },
                          isAIGenerated: true,
                          promptUsed: aiPrompt,
                        };
                        await saveReportToBackend(newReport);
                        resetForm();
                      }}
                    >
                      Salvar Relatório
                    </button>
                    <button
                      className="px-5 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-base font-semibold"
                      onClick={() => {
                        // Gera PDF do preview AI (sem salvar no backend)
                        const limitedTitle = (reportTitle.trim() || `Análise AI: ${aiPrompt.substring(0, 30)}${aiPrompt.length > 30 ? '...' : ''}`).slice(0, 35);
                        const tempReport: Report = {
                          id: `ai-preview-${Date.now()}`,
                          title: limitedTitle,
                          type: 'custom',
                          dateRange: 'Período completo',
                          generatedAt: new Date().toLocaleString('pt-BR'),
                          previewData: {
                            insights: aiPreview,
                            conclusion: 'Análise gerada por IA com base nos dados e prompt fornecidos.',
                          },
                          isAIGenerated: true,
                          promptUsed: aiPrompt,
                        };
                        // Chame a função corretamente
                        generatePDF(tempReport);
                      }}
                      type="button"
                    >
                      Salvar como PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
 
            {/* Modal Actions */}
            <div className="flex justify-end gap-4 mt-8 border-t border-gray-700 pt-6">
              <button
                onClick={resetForm}
                type="button"
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-800 transition-colors text-base font-semibold text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isEditModalOpen) { updateReport(); }
                  else if (newReportType === 'ai') { handleGenerateAIPreview(); }
                  else { generateStandardReport(); }
                }}
                className={`px-5 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-base font-semibold min-w-[140px]
                    ${(isGenerating || isSaving)
                    ? 'bg-gray-500 cursor-not-allowed'
                    : newReportType === 'ai'
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                disabled={isGenerating || isSaving || (newReportType === 'ai' && !aiPrompt.trim() && !isEditModalOpen)}
              >
                {(isGenerating || isSaving) ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"> <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle> <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path> </svg>
                    {isGenerating ? 'Gerando IA...' : 'Salvando...'}
                  </>
                ) : (
                  isEditModalOpen
                    ? 'Salvar Alterações'
                    : newReportType === 'ai'
                      ? <><FiCpu size={16} /> Gerar Preview IA</>
                      : <><FiBarChart2 size={16} /> Gerar Padrão</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
