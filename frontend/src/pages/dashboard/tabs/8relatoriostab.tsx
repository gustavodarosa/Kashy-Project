import { useState, useEffect, useMemo } from 'react';
import { Listbox } from '@headlessui/react';
import { BarChart, PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import {
  DollarSign,
  ShoppingBag,
  CreditCard,
  Store,
  TrendingUp,
  Hash,
  Calculator,
  Info,
  Package,
  Wallet, // Adicionado Wallet
  CheckCircle, 
  CalendarDays, // Adicionado CalendarDays
  GripVertical,
  X
} from 'lucide-react';

// Dnd-kit imports
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  useDndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ReportRow {
  _id: string | Record<string, string>; // Can be a string or a complex object
  result: number; // The aggregated value (sum, average, count)
}

// Helper function for deep array comparison
const arraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

// New component for draggable available options
interface DraggableLineOptionProps {
  option: { value: string; label: string; icon: JSX.Element };
}
function DraggableLineOption({ option }: DraggableLineOptionProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: option.value,
    data: { type: 'availableOption', option },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 1000 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="flex items-center gap-2 p-2 bg-[#24292D] rounded-md border border-white/10 cursor-grab text-sm hover:bg-[#2d3338] transition-colors"
    >
      {option.icon} {option.label}
    </div>
  );
}

// New component for sortable selected lines
interface SortableSelectedLineProps {
  id: string;
  label: string;
  icon: JSX.Element;
  onRemove: (id: string) => void;
}
function SortableSelectedLine({ id, label, icon, onRemove }: SortableSelectedLineProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-2 p-2 bg-[#2F363E] rounded-md border border-teal-500/30 text-sm text-white shadow-sm"
    >
      <div className="flex items-center gap-2">
        <button {...listeners} {...attributes} className="cursor-grab text-gray-400 hover:text-white">
          <GripVertical size={16} />
        </button>
        {icon} {label}
      </div>
      <button onClick={() => onRemove(id)} className="text-red-400 hover:text-red-300">
        <X size={16} />
      </button>
    </div>
  );
}

export function RelatoriosTab() {
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Estado para os filtros selecionados
  const [selectedLines, setSelectedLines] = useState<string[]>(['store']); // Alterado para array
  const [selectedValue, setSelectedValue] = useState<string>('totalAmount');
  const [selectedFunction, setSelectedFunction] = useState<string>('sum');

  // Opções para os dropdowns
  const lineOptions = [
    { value: 'store', label: 'Loja', icon: <Store size={16} /> },
    { value: 'paymentMethod', label: 'Método de Pagamento', icon: <CreditCard size={16} /> },
    { value: 'status', label: 'Status do Pedido', icon: <CheckCircle size={16} /> },
    { value: 'items.name', label: 'Produto', icon: <Package size={16} /> },
    { value: 'createdAt.month', label: 'Mês do Pedido', icon: <CalendarDays size={16} /> }, // Nova opção
  ];

  const valueOptions = [
    { value: 'totalAmount', label: 'Valor Total do Pedido', icon: <DollarSign size={16} /> },
    { value: 'items.quantity', label: 'Quantidade de Itens', icon: <ShoppingBag size={16} /> },
    { value: 'items.revenue', label: 'Faturamento por Produto', icon: <DollarSign size={16} /> }, // Nova opção
    { value: 'netAmount', label: 'Valor Líquido', icon: <Wallet size={16} /> }, // Nova opção
  ];
  const functionOptions = [
    { value: 'sum', label: 'Soma', icon: <Calculator size={16} /> },
    { value: 'avg', label: 'Média', icon: <TrendingUp size={16} /> },
    { value: 'count', label: 'Contagem', icon: <Hash size={16} /> },
  ];

  // Dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Get the active draggable item from DndContext
  const { active } = useDndContext();

  // Lógica para ajustar seleções inválidas automaticamente
  useEffect(() => {
    let currentLines = [...selectedLines];
    let currentValue = selectedValue;
    let currentFunction = selectedFunction;
    let stateChanged = false;

    // --- Start of Filter Adjustment Logic ---

    // Rule A: If 'items.name' is selected as a line, the value MUST be 'items.quantity'.
    // Updated Rule A: If 'items.name' is selected as a line, the value MUST be 'items.quantity' or 'items.revenue'.
    if (currentLines.includes('items.name') && currentValue !== 'items.quantity' && currentValue !== 'items.revenue') {
      stateChanged = true;
    }

    // Rule B: If the value is 'items.quantity', 'items.name' MUST be included in the lines.
    // If not, add it.
    if (currentValue === 'items.quantity' && !currentLines.includes('items.name')) {
      currentLines = [...currentLines, 'items.name'];
      stateChanged = true;
    }

    // Rule C: If the value is 'totalAmount', 'items.name' MUST NOT be included in the lines.
    // If it is, remove it. This rule now applies only to 'totalAmount'
    if (currentValue === 'totalAmount' && currentLines.includes('items.name')) {
      currentLines = currentLines.filter(line => line !== 'items.name');
      stateChanged = true;
    }

    // Rule D: If the value is 'items.quantity', the 'avg' function is NOT allowed.
    if (currentValue === 'items.quantity' && currentFunction === 'avg') {
      currentFunction = 'sum';
      stateChanged = true;
    }

    // --- End of Filter Adjustment Logic ---

    // Apply changes if any occurred and they are actually different from current state
    if (stateChanged) {
      // Ensure consistent order for array comparison and backend parameter
      currentLines.sort(); // Sort to ensure `arraysEqual` works correctly after changes
      if (!arraysEqual(selectedLines, currentLines)) {
        setSelectedLines(currentLines);
      }
      if (selectedValue !== currentValue) {
        setSelectedValue(currentValue);
      }
      if (selectedFunction !== currentFunction) {
        setSelectedFunction(currentFunction);
      }
    }
  }, [selectedLines, selectedValue, selectedFunction]);

  // Dnd-kit onDragEnd handler
  // Os console.log's abaixo são úteis para depuração, mas podem ser removidos em produção.
  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    console.log('--- Drag End Event ---');
    console.log('Active (item arrastado):', active);
    console.log('Over (onde foi solto):', over);

    // Se não houver 'over', significa que o item foi solto fora de qualquer área droppable
    if (!over) {
      console.log('Arrasto finalizado fora de qualquer área soltável (droppable).');
      return;
    }

    // Verifica se o item ativo é uma opção disponível (do lado esquerdo)
    const isDraggingAvailableOption = active.data.current?.type === 'availableOption';
    // Verifica se o alvo do drop é a área principal de agrupamento OU um item já selecionado dentro dela
    const isOverMainDroppableArea = over.id === 'selected-lines-droppable' || selectedLines.includes(over.id as string);

    // Cenário 1: Adicionando um novo item das opções disponíveis para a área de selecionados
    if (isDraggingAvailableOption && isOverMainDroppableArea) {
      const draggedOptionId = active.id as string;
      if (!selectedLines.includes(draggedOptionId)) {
        console.log(`Tentando adicionar a linha: ${draggedOptionId}`);
        setSelectedLines((prev) => [...prev, draggedOptionId]);
        console.log(`setSelectedLines chamado para adicionar: ${draggedOptionId}`);
      } else {
        console.log(`Linha ${draggedOptionId} já existe, não adicionando.`);
      }
      return; // Já tratamos este caso, saímos da função
    }

    // Cenário 2: Reordenando itens dentro da área de linhas selecionadas
    // Isso se aplica quando um item já selecionado é arrastado e solto sobre outro item selecionado
    const isDraggingSortableItem = selectedLines.includes(active.id as string);
    const isOverSortableItem = selectedLines.includes(over.id as string);

    if (isDraggingSortableItem && isOverSortableItem && active.id !== over.id) {
      const oldIndex = selectedLines.indexOf(active.id as string);
      const newIndex = selectedLines.indexOf(over.id as string);
      if (oldIndex !== -1 && newIndex !== -1) { // Garante que ambos os IDs foram encontrados
        console.log(`Tentando reordenar ${active.id} da posição ${oldIndex} para ${newIndex}.`);
        setSelectedLines((prev) => arrayMove(prev, oldIndex, newIndex));
        console.log(`setSelectedLines chamado para reordenar.`);
      }
    }
    console.log('Nenhuma operação de adição ou reordenação válida detectada.');
  };

  // Droppable for the selected lines area
  const { setNodeRef: setDroppableNodeRef } = useDroppable({
    id: 'selected-lines-droppable',
  });

  // Function to remove a selected line
  const handleRemoveSelectedLine = (idToRemove: string) => {
    setSelectedLines((prev) => prev.filter((lineId) => lineId !== idToRemove));
  };

  // Memoize selected line options for rendering
  const selectedLineOptions = useMemo(() => {
    return selectedLines
      .map((lineId) => lineOptions.find((opt) => opt.value === lineId))
      .filter(Boolean) as { value: string; label: string; icon: JSX.Element }[];
  }, [selectedLines, lineOptions]);

  // Memoize available line options (not yet selected)
  const availableLineOptions = useMemo(() => {
    return lineOptions.filter((option) => !selectedLines.includes(option.value));
  }, [selectedLines, lineOptions]);

  // Filtered value options based on selected lines
  const filteredValueOptions = useMemo(() => {
    if (selectedLines.includes('items.name')) {
      // If 'Produto' is selected, only allow 'Quantidade de Itens' and 'Faturamento por Produto'
      return valueOptions.filter(option =>
        option.value === 'items.quantity' || option.value === 'items.revenue'
      );
    }
    return valueOptions; // Otherwise, allow all value options
  }, [selectedLines, valueOptions]);

  // Filtered function options based on selected value
  const filteredFunctionOptions = useMemo(() => {
    if (selectedValue === 'items.quantity') {
      // If 'Quantidade de Itens' is selected, 'Média' is not allowed
      return functionOptions.filter(option => option.value !== 'avg');
    }
    return functionOptions; // Otherwise, allow all function options
  }, [selectedValue, functionOptions]);


  // Função para buscar os dados do relatório do backend
  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        // Ensure selectedLines are sorted for consistent backend query parameter
        const sortedLines = [...selectedLines].sort(); 
        const params = new URLSearchParams({
          line: sortedLines.join(','), // Passa os campos como uma string separada por vírgula
          value: selectedValue,
          func: selectedFunction,
        });
        const url = `http://localhost:3000/api/reports?${params.toString()}`;
        console.log(`[Frontend] Fetching report with: line=${sortedLines.join(',')}, value=${selectedValue}, func=${selectedFunction}`);

        const response = await fetch(url, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Erro ao buscar dados do relatório.');
        }

        const data: ReportRow[] = await response.json();
        setReportData(data);
      } catch (err: any) {
        setError(err.message || 'Erro inesperado ao carregar relatório.');
        console.error('Erro ao carregar relatório:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [selectedLines, selectedValue, selectedFunction]); // Recarrega quando os filtros mudam

  // Funções auxiliares para formatação
  const formatValue = (value: number) => {
    if (selectedFunction === 'count') {
      return value.toFixed(0);
    }
    // Aplica formatação de moeda para totalAmount, netAmount e items.revenue
    if (selectedValue === 'totalAmount' || selectedValue === 'netAmount' || selectedValue === 'items.revenue') {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }
    if (selectedValue === 'items.quantity') {
      return `${Math.round(value)} un`;
    }
    return value.toFixed(2); // Fallback
  };

  const getLineLabel = (value: string | string[]) => {
    if (Array.isArray(value)) {
      return value.map(v => {
        const option = lineOptions.find(opt => opt.value === v);
        return option ? option.label : v;
      }).join(' + ');
    } else {
      const option = lineOptions.find(opt => opt.value === value);
      return option ? option.label : value;
    }
  };

  const getValueLabel = (value: string) => {
    const option = valueOptions.find(opt => opt.value === value);
    return option ? option.label : value;
  };

  const getFunctionLabel = (value: string) => {
    const option = functionOptions.find(opt => opt.value === value);
    return option ? option.label : value;
  };

  // Cores para o gráfico de pizza
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57'];

  const formatXAxisLabel = (value: any) => {
    console.log("Original _id for label:", value); // Adicione esta linha
    if (typeof value === 'object' && value !== null) {
        const parts = Object.entries(value)
            .map(([key, val]) => {
                const originalKey = key.replace('_', '.');
                const labelOption = lineOptions.find(opt => opt.value === originalKey);
                const label = labelOption ? labelOption.label : originalKey;
                return `${label}: ${val}`;
            });
        const fullLabel = parts.join(', ');
        if (fullLabel.length > 30) {
            return fullLabel.substring(0, 27) + '...';
        }
        console.log("Formatted label:", fullLabel); // Adicione esta linha
        return fullLabel;
    }
    const result = value !== null ? String(value) : 'N/A';
    console.log("Formatted label (non-object):", result); // Adicione esta linha
    return result;
};

  // Custom Tooltip component for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const formattedLabel = formatXAxisLabel(dataPoint._id);
      const formattedValue = formatValue(dataPoint.result);
      const funcLabel = getFunctionLabel(selectedFunction);
      const valLabel = getValueLabel(selectedValue);

      return (
        <div className="bg-[#24292D] border border-[#3A414A] rounded-lg p-3 text-sm text-white shadow-lg">
          <p className="font-semibold">{formattedLabel}</p>
          <p className="text-gray-300">{`${funcLabel} de ${valLabel}: ${formattedValue}`}</p>
        </div>
      );
    }
    return null;
  };

  // Renderiza o gráfico apropriado
  const renderChart = () => {
    if (reportData.length === 0) {
      return (
        <div className="flex-grow flex items-center justify-center">
          <p className="text-gray-400 text-center">Nenhum dado para exibir no gráfico.</p>
        </div>
      );
    }

    if (selectedFunction === 'count') {
      // Gráfico de pizza para contagem
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={reportData} dataKey="result" nameKey="_id" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label={(entry) => formatXAxisLabel(entry._id)}>
              {reportData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number, name) => [formatValue(value), formatXAxisLabel(name)]} />
            <Legend formatter={(value) => formatXAxisLabel(value)} />
          </PieChart>
        </ResponsiveContainer>
      );
    } else {
      // Gráfico de barras para soma/média
      return (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            layout="vertical"
            data={reportData.map((item) => ({
              ...item,
              idKey: JSON.stringify(item._id), // Nova propriedade serializável para o dataKey
            }))}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#3A414A" horizontal={true} vertical={false} />
            <XAxis
              type="number"
              stroke="#9CA3AF"
              tickFormatter={formatValue}
            />
            <YAxis
              type="category"
              dataKey="idKey" // Usando a nova chave serializável
              stroke="#9CA3AF"
              tickFormatter={(value) => formatXAxisLabel(JSON.parse(value))} // Desserializa o objeto para formatar
              width={180}
              interval={0}
              fontSize={10}
            />
            <Tooltip content={<CustomTooltip />} /> {/* Usando o Tooltip personalizado */}
            <Legend />
            <Bar dataKey="result" fill="#8884d8" name={`${getFunctionLabel(selectedFunction)} de ${getValueLabel(selectedValue)}`} />
          </BarChart>
        </ResponsiveContainer>
      );
    }
  };

  return (
    <div className="bg-gradient-to-br from-[#1E2328] via-[#24292D] to-[#2B3036] min-h-screen text-white">
      <div className="container mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resultados */}
        <div className="lg:col-span-2 bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-6 flex flex-col min-h-[600px]">
          <h2 className="text-2xl font-bold mb-4 text-white">Relatório: {getFunctionLabel(selectedFunction)} de {getValueLabel(selectedValue)} por {getLineLabel(selectedLines)}</h2>
          {loading && reportData.length === 0 ? ( // Only show loading if no data is present yet
            <div className="flex-grow flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent" />
              <span className="ml-4 text-white">Carregando relatório...</span>
            </div>
          ) : error ? (
            <div className="flex-grow flex items-center justify-center text-red-400">
              <p>{error}</p>
            </div>
          ) : (
            <>
              <div className="flex-grow">
                {renderChart()}
              </div>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full bg-[#24292D] rounded-lg overflow-hidden">
                  <thead className="bg-[#2F363E] border-b border-white/10">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-300">{getLineLabel(selectedLines)}</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-300">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.length > 0 ? reportData.map((row, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-[#24292D]' : 'bg-[#2F363E]'}>
                        <td className="px-4 py-2 text-sm text-white">{formatXAxisLabel(row._id)}</td>
                        <td className="px-4 py-2 text-sm text-white text-right">{formatValue(row.result)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={2} className="px-4 py-4 text-center text-gray-400">Nenhum dado encontrado para os filtros selecionados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Filtros */}
        <div className="bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-6">
          <h2 className="text-2xl font-bold mb-6">Filtros</h2>

          {/* Drag and Drop para Linhas */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          >
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-300">Agrupar por (Arraste e Solte)</label>
              {/* Área de agrupamentos selecionados (droppable e sortable) */}
              <div
                ref={setDroppableNodeRef}
                className="min-h-[80px] p-3 bg-[#24292D] rounded-md border border-white/10 flex flex-col gap-2"
              >
                {selectedLineOptions.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">Arraste campos para cá</p>
                )}
                <SortableContext items={selectedLines} strategy={verticalListSortingStrategy}>
                  {selectedLineOptions.map((option) => (
                    <SortableSelectedLine
                      key={option.value}
                      id={option.value}
                      label={option.label}
                      icon={option.icon}
                      onRemove={handleRemoveSelectedLine}
                    />
                  ))}
                </SortableContext>
              </div>

              {/* Drag Overlay para o item sendo arrastado */}
              <DragOverlay adjustScale={true}> {/* Added adjustScale for better visual */}
                {active && active.id ? (
                  <div className="flex items-center gap-2 p-2 bg-teal-600 rounded-md border border-teal-400 text-white text-sm shadow-lg">
                    {lineOptions.find(opt => opt.value === active.id)?.icon}
                    {lineOptions.find(opt => opt.value === active.id)?.label}
                  </div>
                ) : null}
              </DragOverlay>

              <p className="text-gray-400 text-xs mt-4 mb-2">Campos disponíveis:</p>
              {/* Lista de campos disponíveis para arrastar */}
              <div className="grid grid-cols-2 gap-2">
                {availableLineOptions.map((option) => (
                  <DraggableLineOption key={option.value} option={option} />
                ))}
              </div>
            </div>
          </DndContext>

          {/* Dropdown para Valores */}
          <Listbox value={selectedValue} onChange={setSelectedValue}>
            <div className="mb-6 relative">
              <Listbox.Label className="block text-sm font-medium mb-2 text-gray-300">Valor para Agregação</Listbox.Label>
              <Listbox.Button className="w-full p-3 rounded bg-[#24292D] text-white border border-white/10 focus:ring-2 focus:ring-teal-500 flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-2">
                  {valueOptions.find(opt => opt.value === selectedValue)?.icon}
                  {valueOptions.find(opt => opt.value === selectedValue)?.label}
                </span>
                <span className="text-gray-400">▼</span>
              </Listbox.Button>
              <Listbox.Options className="absolute z-10 mt-1 w-full bg-[#24292D] border border-white/10 rounded-md shadow-lg max-h-60 overflow-auto">
                {valueOptions.map((option) => (
                  <Listbox.Option
                    key={option.value}
                    value={option.value}
                    className={({ active }) =>
                      `p-3 cursor-pointer text-white flex items-center gap-2 ${active ? 'bg-teal-700/30' : ''}`
                    }
                  >
                    {option.icon} {option.label}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>

          {/* Dropdown para Funções */}
          <Listbox value={selectedFunction} onChange={setSelectedFunction}>
            <div className="mb-6 relative">
              <Listbox.Label className="block text-sm font-medium mb-2 text-gray-300">Função de Agregação</Listbox.Label>
              <Listbox.Button className="w-full p-3 rounded bg-[#24292D] text-white border border-white/10 focus:ring-2 focus:ring-teal-500 flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-2">
                  {functionOptions.find(opt => opt.value === selectedFunction)?.icon}
                  {functionOptions.find(opt => opt.value === selectedFunction)?.label}
                </span>
                <span className="text-gray-400">▼</span>
              </Listbox.Button>
              <Listbox.Options className="absolute z-10 mt-1 w-full bg-[#24292D] border border-white/10 rounded-md shadow-lg max-h-60 overflow-auto">
                {functionOptions.map((option) => (
                  <Listbox.Option
                    key={option.value}
                    value={option.value}
                    className={({ active }) =>
                      `p-3 cursor-pointer text-white flex items-center gap-2 ${active ? 'bg-teal-700/30' : ''}`
                    }
                  >
                    {option.icon} {option.label}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>

          <button
            onClick={() => {
              // Ação de exemplo, o relatório já é gerado automaticamente
              alert('Relatório atualizado!');
            }}
            className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 rounded-lg transition-colors mt-6"
          >
            Atualizar Relatório (Manual)
          </button>
        </div>
      </div>
    </div>
  );
}