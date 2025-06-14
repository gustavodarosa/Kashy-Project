import { useState, useEffect } from 'react';
import { BarChart3, CalendarDays, Download, Trash2, Edit2, Cpu, Plus, AlertTriangle, FileText, Sparkles, NotepadText, } from 'lucide-react';
import jsPDF from 'jspdf';

interface StandardInventoryPreviewData {
  totalProducts?: number;
  lowStockItemCount?: number; 
  outOfStockItemCount?: number; 
  mostStockedCategory?: string;

  lowStockProductDetails?: Array<{ name: string; sku?: string; category?: string; quantity: number }>;
  outOfStockProductDetails?: Array<{ name: string; sku?: string; category?: string }>;
}

interface SalesPreviewData {
  totalSales?: number;
  totalTransactions?: number;
  bestSellingProduct?: string;
  comparison?: string;
}

interface TransactionsPreviewData {
  totalBCH?: number;
  avgTransaction?: number;
  peakDay?: string;
  comparison?: string;
}

interface AICustomPreviewData {
  insights: string;
  conclusion?: string;
}

type Report = {
  _id?: string;
  id: string;
  title: string;
  type: 'sales' | 'transactions' | 'inventory' | 'custom'; 
  dateRange: string; 
  generatedAt: string; 
  previewData: StandardInventoryPreviewData | SalesPreviewData | TransactionsPreviewData | AICustomPreviewData | { summary?: string } | any; // Union type for previewData
  isAIGenerated?: boolean;
  promptUsed?: string; 
};

const generatePDF = (report: Report) => {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
  let yPosition = 22; 

  const addText = (text: string | string[], x: number, y: number, options?: any) => {
    doc.text(text, x, y, options);
    const textHeight = Array.isArray(text) ? (text.length * 5) : 5; 
    if (y + textHeight > pageHeight - 20) { 
      doc.addPage();
      return 20; 
    }
    return y + textHeight + 3; 
  };

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  yPosition = addText(report.title, 14, yPosition);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);

  yPosition = addText(`Tipo: ${report.type.toUpperCase()}`, 14, yPosition + 2);
  yPosition = addText(`Período: ${report.dateRange}`, 14, yPosition);
  yPosition = addText(`Gerado em: ${report.generatedAt}`, 14, yPosition);
  if (report.isAIGenerated && report.promptUsed) {

    const promptLines = doc.splitTextToSize(`Prompt: ${report.promptUsed}`, pageWidth - 28);
    yPosition = addText(promptLines, 14, yPosition);
  }

  doc.setLineWidth(0.5);
  doc.setDrawColor(200); 
  doc.line(14, yPosition + 2, pageWidth - 14, yPosition + 2); 
  yPosition += 8;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0); 
  yPosition = addText('Conteúdo do Relatório:', 14, yPosition);
  yPosition += 2; 
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  try {
    if (report.isAIGenerated && report.type === 'custom') {
      const aiData = report.previewData as AICustomPreviewData;
      if (aiData.insights) {
        const insightsText = aiData.insights;
        const lines = doc.splitTextToSize(insightsText, pageWidth - 28);
        yPosition = addText(lines, 14, yPosition);
      } else {
        yPosition = addText('Conteúdo da análise IA não disponível.', 14, yPosition);
      }
      if (aiData.conclusion) {
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100);
        const conclusionLines = doc.splitTextToSize(`Conclusão: ${aiData.conclusion}`, pageWidth - 28);
        yPosition = addText(conclusionLines, 14, yPosition + 5);
      }
    } else if (report.type === 'sales') {
      const salesData = report.previewData as SalesPreviewData;
      yPosition = addText(`- Total de Vendas: R$ ${salesData.totalSales?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/D'}`, 14, yPosition);
      yPosition = addText(`- Total de Transações: ${salesData.totalTransactions || 'N/D'}`, 14, yPosition);
      yPosition = addText(`- Produto Mais Vendido: ${salesData.bestSellingProduct || 'N/D'}`, 14, yPosition);
      yPosition = addText(`- Comparativo: ${salesData.comparison || 'N/D'}`, 14, yPosition);
    } else if (report.type === 'transactions') {
      const transData = report.previewData as TransactionsPreviewData;
      yPosition = addText(`- Total BCH: ${transData.totalBCH?.toFixed(8) || 'N/D'} BCH`, 14, yPosition);
      yPosition = addText(`- Média por Transação: ${transData.avgTransaction?.toFixed(8) || 'N/D'} BCH`, 14, yPosition);
      yPosition = addText(`- Dia com Mais Transações: ${transData.peakDay || 'N/D'}`, 14, yPosition);
      yPosition = addText(`- Comparativo: ${transData.comparison || 'N/D'}`, 14, yPosition);
    } else if (report.type === 'inventory') {
      const invData = report.previewData as StandardInventoryPreviewData;
      yPosition = addText(`- Produtos Cadastrados: ${invData.totalProducts || 'N/D'}`, 14, yPosition);
      yPosition = addText(`- Contagem de Itens com Baixo Estoque: ${invData.lowStockItemCount || 'N/D'}`, 14, yPosition);
      yPosition = addText(`- Contagem de Itens Esgotados: ${invData.outOfStockItemCount || 'N/D'}`, 14, yPosition);
      yPosition = addText(`- Categoria com Mais Itens: ${invData.mostStockedCategory || 'N/D'}`, 14, yPosition);

      if (invData.lowStockProductDetails && invData.lowStockProductDetails.length > 0) {
        yPosition = addText('Produtos com Estoque Baixo:', 14, yPosition + 4, { fontStyle: 'bold' });
        invData.lowStockProductDetails.forEach(p => {
          let productLine = `  • ${p.name} (Qtd: ${p.quantity})`;
          if (p.sku) productLine += `, SKU: ${p.sku}`;
          if (p.category) productLine += `, Cat: ${p.category}`;
          const productLines = doc.splitTextToSize(productLine, pageWidth - 32); 
          yPosition = addText(productLines, 16, yPosition);
        });
      }
      if (invData.outOfStockProductDetails && invData.outOfStockProductDetails.length > 0) {
        yPosition = addText('Produtos Esgotados:', 14, yPosition + 4, { fontStyle: 'bold' });
        invData.outOfStockProductDetails.forEach(p => {
          let productLine = `  • ${p.name}`;
          if (p.sku) productLine += `, SKU: ${p.sku}`;
          if (p.category) productLine += `, Cat: ${p.category}`;
          const productLines = doc.splitTextToSize(productLine, pageWidth - 32); 
          yPosition = addText(productLines, 16, yPosition);
        });
      }
    } else if (report.type === 'custom' && !report.isAIGenerated) {
      const customData = report.previewData as { summary?: string };
      const summaryText = customData.summary || 'Relatório personalizado sem conteúdo detalhado.';
      const lines = doc.splitTextToSize(summaryText, pageWidth - 28);
      yPosition = addText(lines, 14, yPosition);
    } else { 
      const genericData = report.previewData as any;
      if (genericData && (genericData.insights || genericData.summary)) {
        const content = genericData.insights || genericData.summary;
        const lines = doc.splitTextToSize(content, pageWidth - 28);
        yPosition = addText(lines, 14, yPosition);
      } else {
        yPosition = addText('Dados do relatório não disponíveis ou formato não reconhecido.', 14, yPosition);
      }
    }

  } catch (error) {
    console.error("Erro ao adicionar dados ao PDF:", error);
    addText("Erro ao renderizar o conteúdo do relatório no PDF.", 14, yPosition);
  }

  const safeTitle = report.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`${safeTitle}_${report.id.substring(0, 8)}.pdf`);
};

export function RelatoriosTab() {

  const [reports, setReports] = useState<Report[]>([]); 
  const [isLoadingReports, setIsLoadingReports] = useState(false); 
  const [isNewReportModalOpen, setIsNewReportModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentReport, setCurrentReport] = useState<Report | null>(null); 

  const [newReportType, setNewReportType] = useState<'standard' | 'ai'>('standard');
  const [dateRange, setDateRange] = useState({ start: '', end: '' }); 
  const [reportTitle, setReportTitle] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');

  const aiPromptOptions = [
    // --- Novos prompts para pedidos ---
    {
      value: 'count_orders',
      label: 'Quantos pedidos existem?',
      prompt: 'Conte quantos pedidos existem no sistema. Responda apenas com o número total de pedidos.'
    },
    {
      value: 'highest_order_value',
      label: 'Qual o maior valor de pedido?',
      prompt: 'Identifique qual pedido possui o maior valor total. Informe o valor, o ID do pedido e a loja correspondente.'
    },
    {
      value: 'store_with_most_orders',
      label: 'Qual loja teve mais pedidos?',
      prompt: 'Analise os dados e diga qual loja recebeu o maior número de pedidos. Informe o nome da loja e a quantidade de pedidos.'
    },
    {
      value: 'most_frequent_customer',
      label: 'Qual cliente mais comprou?',
      prompt: 'Identifique o cliente que mais realizou pedidos. Informe o e-mail do cliente e a quantidade de pedidos feitos.'
    },
    // --- Fim dos prompts de pedidos ---
    {
      value: 'count_products',
      label: 'Quantos produtos existem?',
      prompt: 'Conte quantos produtos existem no inventário. Responda apenas com o número total de produtos.'
    },
    {
      value: 'most_expensive_product',
      label: 'Qual o produto mais caro?',
      prompt: 'Identifique qual é o produto mais caro do inventário e informe o nome, o preço e a loja correspondente.'
    },
    {
      value: 'store_with_most_products',
      label: 'Qual loja tem mais produtos?',
      prompt: 'Analise os dados e diga qual loja possui o maior número de produtos cadastrados. Informe o nome da loja e a quantidade de produtos.'
    },
    // --- Fim dos prompts de produto ---
    {
      value: 'default_select',
      label: 'Selecione um modelo ou escreva seu prompt abaixo...',
      prompt: ''
    },
    {
      value: 'sales_summary_last_month',
      label: 'Resumo de Vendas do Último Mês',
      prompt: 'Gere um resumo detalhado das vendas do último mês, incluindo total de vendas, número de transações, ticket médio e produto mais vendido. Compare com o mês anterior, se possível, destacando variações percentuais.'
    },
    {
      value: 'inventory_status_critical',
      label: 'Status Crítico do Inventário',
      prompt: 'Identifique produtos com estoque baixo (definido como menos de 10 unidades) e produtos atualmente esgotados. Liste-os por categoria e sugira ações prioritárias.'
    },
    {
      value: 'customer_engagement_vip',
      label: 'Engajamento de Clientes VIP',
      prompt: 'Analise o comportamento de compra dos clientes marcados como VIP nos últimos 3 meses. Quais são os produtos mais comprados por este segmento e qual a frequência média de compra? Há alguma tendência emergente?'
    },
    {
      value: 'transaction_peak_hours_bch',
      label: 'Horários de Pico para Transações BCH',
      prompt: 'Analise as transações em BCH da última semana e identifique os horários de pico (maior volume de transações). Existe algum padrão específico nos dias da semana?'
    },
    {
      value: 'product_performance_new_releases',
      label: 'Performance de Novos Produtos Lançados',
      prompt: 'Compare a performance de vendas dos produtos adicionados ao catálogo nos últimos 30 dias. Quais estão com maior volume de vendas e quais necessitam de mais atenção promocional?'
    },
    {
      value: 'custom_prompt_indicator', 
      label: 'Prompt Personalizado (digitado abaixo)',
      prompt: '' 
    }
  ];

  const [selectedPromptOption, setSelectedPromptOption] = useState(aiPromptOptions[0].value);
  const [isGenerating, setIsGenerating] = useState(false); 
  const [isSaving, setIsSaving] = useState(false); 
  const [error, setError] = useState<string | null>(null); 
  const [aiPreview, setAiPreview] = useState<string>('');

  const resetForm = () => {
    setIsNewReportModalOpen(false);
    setIsEditModalOpen(false);
    setCurrentReport(null);
    setNewReportType('standard'); 
    setDateRange({ start: '', end: '' });
    setReportTitle('');
    setAiPrompt('');
    setError(null); 
    setIsGenerating(false); 
    setIsSaving(false);
    setAiPreview('');
  };

  const openNewModal = () => {
    resetForm(); 
    setIsNewReportModalOpen(true);
  };

  const openEditModal = (report: Report) => {
    console.log('Abrindo modal de edição para o relatório:', report); 
    resetForm();
    setCurrentReport(report);
    setReportTitle(report.title);

    const dates = report.dateRange.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
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

  const saveReportToBackend = async (report: Report) => {
    try {
      console.log('Enviando relatório para o backend:', report); 
      const response = await fetch('http://localhost:3000/api/reports/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar relatório no backend.');
      }

      await response.json();
      await fetchReports(); 
    } catch (error) {
      console.error('Erro ao salvar relatório:', error);
      setError('Erro ao salvar relatório no backend.');
    }
  };

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

  const updateReport = async () => {
    if (!currentReport) {
      console.error('Nenhum relatório selecionado para atualização.');
      return;
    }

    console.log('Atualizando relatório:', currentReport);

    setIsSaving(true);
    setError(null);

    const updatedReport = {
      ...currentReport,
      title: reportTitle || currentReport.title,
      dateRange: 'Período completo',
    };

    try {
      const response = await fetch(`http://localhost:3000/api/reports/${currentReport._id}`, { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedReport),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar relatório.');
      }

      await response.json();
      await fetchReports(); 
      resetForm();
    } catch (error) {
      console.error('Erro ao atualizar relatório:', error);
      setError('Erro ao atualizar relatório.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteReport = async (id: string) => {
    console.log('Tentando deletar relatório com ID:', id); 
    if (!window.confirm(`Tem certeza que deseja excluir o relatório ID: ${id}?`)) return;

    try {
      const response = await fetch(`http://localhost:3000/api/reports/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar relatório.');
      }

      await fetchReports(); 
    } catch (error) {
      console.error('Erro ao deletar relatório:', error);
      setError('Erro ao deletar relatório.');
    }
  };

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

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <div className="bg-gradient-to-br from-[#1E2328] via-[#24292D] to-[#2B3036] min-h-screen text-white">
      <div className="container mx-auto px-4 py-6">  
        <div className="relative overflow-hidden mb-10">
          <div className="relative p-6 text-white text-center rounded-3xl shadow-2xl backdrop-blur-xl border border-white/10"
            style={{
              background: `
                radial-gradient(circle at 20% 50%, rgba(96, 165, 250, 0.2) 0%, transparent 50%), /* blue-400 */
                radial-gradient(circle at 80% 20%, rgba(129, 140, 248, 0.3) 0%, transparent 50%), /* indigo-400 */
                linear-gradient(135deg, rgba(96, 165, 250, 0.1) 0%, rgba(129, 140, 248, 0.15) 100%)
              `,
            }}>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-xl backdrop-blur-sm border border-blue-400/30">
                  <NotepadText size={36} className="text-blue-300" />
                </div>
                <div className="text-left">
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                    Relatórios & Análises
                  </h1>
                  <p className="text-base text-blue-100/80">Gere, visualize e exporte seus dados com facilidade.</p>
                </div>
              </div>
              <div className="mt-8">
                <button
                  onClick={openNewModal}
                  className="cursor-pointer group relative px-8 py-3 bg-gradient-to-r from-pink-500 via-fuchsia-600 to-violet-500 hover:from-pink-400 hover:to-violet-500 text-white font-bold rounded-2xl shadow-xl transition-all duration-300 hover:scale-105 border border-pink-400/40 text-base overflow-hidden"
                >
                  <span className="flex items-center gap-2 relative z-10">
                    <Plus size={20} />
                    <span>Novo Relatório</span>
                  </span>
                  <span className="absolute left-0 top-0 w-full h-full rounded-2xl bg-gradient-to-r from-white/10 via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none animate-shine" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State / Report Grid */}
        {isLoadingReports ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
              <span className="text-white font-medium">Carregando relatórios...</span>
            </div>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16 px-6 bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl">
            <BarChart3 size={48} className="mx-auto text-gray-500 mb-4" />
            <h3 className="text-xl font-semibold text-gray-300">Nenhum relatório encontrado</h3>
            <p className="text-gray-400 mt-2">Clique em <b>Novo Relatório</b> para gerar seu primeiro relatório.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-7">
            {reports.map((report) => (
              <div
                key={report.id}
                className={`
                group relative p-6 flex flex-col justify-between min-h-[320px]
                bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border 
                hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]
                ${report.isAIGenerated
                    ? 'border-purple-500/30 hover:border-purple-500/50'
                    : 'border-blue-500/30 hover:border-blue-500/50'
                  }
              `}>

                {/* Action Buttons */}
                <div className="absolute top-3 right-3 flex gap-2 z-10">
                  <button
                    onClick={() => openEditModal(report)}
                    className="p-1.5 cursor-pointer bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-md border border-teal-500/30 hover:border-teal-500/50 transition-all duration-200 hover:scale-110"
                    title="Editar Título/Datas"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => report._id && deleteReport(report._id)}
                    className="p-1.5 cursor-pointer bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-md border border-red-500/30 hover:border-red-500/50 transition-all duration-200 hover:scale-110"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={() => generatePDF(report)}
                    className="p-1.5 cursor-pointer bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded-md border border-sky-500/30 hover:border-sky-500/50 transition-all duration-200 hover:scale-110"
                    title="Baixar PDF"
                  >
                    <Download size={14} />
                  </button>
                </div>

                {/* Card Content */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    {report.isAIGenerated ? <Cpu size={20} className="text-purple-400 flex-shrink-0" /> : <BarChart3 size={20} className="text-blue-400 flex-shrink-0" />}
                    <h3 className="text-lg font-semibold text-white pr-20 break-words leading-snug">
                      {report.title}
                    </h3>
                  </div>

                  {/* Date Range & Type */}
                  <div className="mb-3 flex flex-wrap items-center text-xs">
                    <span className={`px-2 py-0.5 rounded-md font-medium border ${report.isAIGenerated ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                      {report.type === 'custom' ? (report.isAIGenerated ? 'IA' : 'Personalizado') : report.type}
                    </span>
                  </div>

                  {/* Preview Data Area */}
                  <div className="mb-4 text-xs max-h-28 overflow-y-auto pr-1 text-gray-300 border-t border-b border-white/10 py-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
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
                <div className="mt-auto text-xs text-gray-400 pt-2 flex flex-col gap-1 border-t border-white/10">
                  <div className="flex items-center gap-1">
                    <CalendarDays size={12} /> <span>Gerado em: {report.generatedAt}</span>
                  </div>
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

        {/*Modal (Novo/Editar) */}
        {(isNewReportModalOpen || isEditModalOpen) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-xl bg-[#24292D]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl flex flex-col">
              <button className="absolute top-6 right-6 p-2 text-gray-400 hover:text-white transition-colors z-10 bg-white/5 hover:bg-white/10 rounded-xl" onClick={resetForm} aria-label="Fechar">×</button>
              <div className="flex justify-between items-center mb-6 p-6 border-b border-white/10">
                <h3 className="text-2xl font-bold">
                  {isEditModalOpen ? 'Editar Relatório' : (newReportType === 'ai' ? 'Gerar Relatório com IA' : 'Gerar Relatório Padrão')}
                </h3>
                <button onClick={resetForm} className="text-gray-400 hover:text-white text-xl" title="Fechar">✕</button>
              </div>

              <div className="p-6 flex-grow overflow-y-auto space-y-5 max-h-[70vh]">
                {/* Type Selection */}
                {!isEditModalOpen && (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <button
                      onClick={() => setNewReportType('standard')}
                      className={`cursor-pointer p-4 rounded-xl text-center transition-all duration-300 border-2
                      ${newReportType === 'standard'
                          ? 'bg-blue-500/20 border-blue-500 text-white shadow-lg scale-105'
                          : 'bg-[#2F363E]/70 border-transparent hover:border-blue-500/50 text-gray-300'
                        }`}
                    >
                      <FileText size={24} className="mx-auto mb-2" />
                      <span className="text-base font-semibold">Padrão</span>
                      <span className="block text-xs text-gray-400 mt-1">Modelos fixos</span>
                    </button>
                    <button
                      onClick={() => setNewReportType('ai')}
                      className={`cursor-pointer p-4 rounded-xl text-center transition-all duration-300 border-2
                      ${newReportType === 'ai'
                          ? 'bg-purple-500/20 border-purple-500 text-white shadow-lg scale-105'
                          : 'bg-[#2F363E]/70 border-transparent hover:border-purple-500/50 text-gray-300'
                        }`}
                    >
                      <Sparkles size={24} className="mx-auto mb-2" />
                      <span className="text-base font-semibold">IA</span>
                      <span className="block text-xs text-gray-400 mt-1">Modelos dinâmicos</span>
                    </button>
                  </div>
                )}

                {/* Report Title and Date Range */}
                <div className="mb-4">
                  <div>
                    <label htmlFor="reportTitle" className="block text-xs font-medium mb-1.5 text-gray-300">
                      Título do Relatório <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="reportTitle"
                      type="text"
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      placeholder="Insira um título para o relatório..."
                      className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label htmlFor="dateRangeStart" className="block text-xs font-medium mb-1.5 text-gray-300">
                        Data Início
                      </label>
                      <input
                        id="dateRangeStart"
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="dateRangeEnd" className="block text-xs font-medium mb-1.5 text-gray-300">
                        Data Fim
                      </label>
                      <input
                        id="dateRangeEnd"
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* AI Prompt */}
                {newReportType === 'ai' && !isEditModalOpen && (
                  <>
                    <div>
                      <label htmlFor="aiPromptSelect" className="block text-xs font-medium mb-1.5 text-gray-300">
                        Modelos de Prompt (Opcional)
                      </label>
                      <select
                        id="aiPromptSelect"
                        value={selectedPromptOption}
                        onChange={e => {
                          const selectedValue = e.target.value;
                          setSelectedPromptOption(selectedValue);
                          const found = aiPromptOptions.find(opt => opt.value === selectedValue);
                          if (found && found.prompt) { 
                            setAiPrompt(found.prompt);
                          } else if (selectedValue === 'default_select' || selectedValue === 'custom_prompt_indicator') {
                          
                          }
                        }}
                        className="cursor-pointer w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm"
                      >
                        {aiPromptOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="aiPromptTextarea" className="block text-xs font-medium mb-1.5 text-gray-300">
                        Seu Prompt para IA <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        id="aiPromptTextarea"
                        rows={4}
                        value={aiPrompt}
                        onChange={(e) => {
                          setAiPrompt(e.target.value);
                
                          if (selectedPromptOption !== 'custom_prompt_indicator') {
                            setSelectedPromptOption('custom_prompt_indicator');
                          }
                        }}
                        placeholder="Descreva o que você gostaria de analisar ou qual pergunta você quer responder com os dados..."
                        className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm resize-y"
                        required
                      />
                    </div>
                    <div className="mt-3 p-3 bg-[#2F363E]/40 rounded-lg border border-white/10 text-xs text-gray-400 space-y-1">
                      <p className="font-semibold text-gray-300">Dicas para Prompts Eficazes:</p>
                      <ul className="list-disc list-inside pl-1 space-y-0.5">
                        <li><b>Seja específico:</b> Quanto mais detalhes, melhor o resultado.</li>
                        <li><b>Defina o período:</b> Se relevante, mencione datas (Ex: "vendas de 01/01/2024 a 31/01/2024").</li>
                        <li><b>Peça formatos:</b> Sugira o formato da resposta (Ex: "liste em tópicos", "crie uma tabela").</li>
                        <li><b>Contexto:</b> A IA utiliza dados processados e fornecidos pelo sistema para gerar as respostas.</li>
                      </ul>
                    </div>
                  </>
                )}

                {/* Error Display Area */}
                {error && (
                  <div className="p-3 my-2 bg-red-500/20 border border-red-500/30 text-red-300 rounded-md text-sm flex items-center gap-2">
                    <AlertTriangle size={16} />
                    {error}
                  </div>
                )}
                {aiPreview && newReportType === 'ai' && !isEditModalOpen && (
                  <div className="mt-4 p-4 bg-[#2F363E]/50 border border-white/10 rounded-lg text-sm text-gray-200 whitespace-pre-wrap max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                    <strong className="block mb-2 text-gray-100">Preview do Relatório (IA):</strong>
                    <div>{aiPreview}</div>
                    <div className="flex gap-3 mt-3">
                      <button
                        className="cursor-pointer flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-400 hover:to-teal-500 text-white font-semibold transition-all duration-200 hover:scale-105 shadow-md text-sm"
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
                        Salvar Relatório Gerado
                      </button>
                      <button
                        className="cursor-pointer flex-1 px-4 py-2 rounded-lg bg-sky-600/80 hover:bg-sky-700/80 text-white font-semibold transition-all duration-200 hover:scale-105 shadow-md text-sm border border-sky-500/50"
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
                  
                          generatePDF(tempReport);
                        }}
                        type="button"
                      >
                        Baixar Preview em PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 p-6 border-t border-white/10 flex-shrink-0">
                <button
                  onClick={resetForm}
                  type="button"
                  className="cursor-pointer px-5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30 hover:border-red-500/50 font-medium transition-all duration-200 hover:scale-105 text-sm"
                >
                  Cancelar
                </button>
                {!aiPreview && <button 
                  type="button"
                  onClick={() => {
                    if (isEditModalOpen) { updateReport(); }
                    else if (newReportType === 'ai') { handleGenerateAIPreview(); }
                    else { generateStandardReport(); }
                  }}
                  className={`px-5 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-semibold min-w-[160px]
                    ${(isGenerating || isSaving || (newReportType === 'ai' && !aiPrompt.trim() && !isEditModalOpen))
                      ? 'bg-gray-500/50 cursor-not-allowed text-gray-300'
                      : newReportType === 'ai'
                        ? 'cursor-pointer bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-lg'
                        : 'cursor-pointer bg-green-600 hover:bg-green-700 text-white'
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
                        ? <><Sparkles size={16} /> Gerar Preview IA</>
                        : <><FileText size={16} /> Gerar Padrão</>
                  )}
                </button>
                }
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

