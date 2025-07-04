import { useState, useEffect, useMemo, useCallback } from 'react';
import { Listbox } from '@headlessui/react';
import { BarChart, Tooltip, ResponsiveContainer, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
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
  Wallet,
  CheckCircle,
  CalendarDays,
  GripVertical,
  X
} from 'lucide-react';

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
  [key: string]: any; 
  result: number; 
}

interface Store {
  _id: string;
  name: string;
}

interface Product {
  _id: string;
  name: string;
}

function useDebounce(value: any, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const arraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

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

  const [selectedLines, setSelectedLines] = useState<string[]>(['store']); 
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [retry, setRetry] = useState(0); 

  const debouncedLines = useDebounce(selectedLines, 500);
  const debouncedValue = useDebounce(selectedValue, 500);
  const debouncedFunction = useDebounce(selectedFunction, 500);

  const [stores, setStores] = useState<Store[]>([]); 
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const fetchAllStores = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3000/api/stores/all', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Erro ao buscar todas as lojas');
        const data: Store[] = await response.json(); 
        console.log('Lojas encontradas:', data); 
        setStores(data); 
      } catch (err: unknown) {
        if (err instanceof Error) {
          console.error('Erro ao buscar todas as lojas:', err.message);
        } else {
          console.error('Erro ao buscar todas as lojas:', err);
        }
      }
    };

    fetchAllStores();
  }, []);

  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3000/api/products', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Erro ao buscar todos os produtos');
        const data: Product[] = await response.json(); 
        console.log('Produtos encontrados:', data); 
        setProducts(data); 
      } catch (err: unknown) {
        if (err instanceof Error) {
          console.error('Erro ao buscar todos os produtos:', err.message);
        } else {
          console.error('Erro ao buscar todos os produtos:', err);
        }
      }
    };

    fetchAllProducts();
  }, []);

  const productOptions = useMemo(() => {
    return products.map(product => ({
      value: `product.${product._id}`,
      label: product.name, 
      icon: <Package size={16} />, 
    }));
  }, [products]);

  const lineOptions = [
    { value: 'store', label: 'Lojas', icon: <Store size={16} /> },
    { value: 'paymentMethod', label: 'Método de Pagamento', icon: <CreditCard size={16} /> },
    { value: 'status', label: 'Status do Pedido', icon: <CheckCircle size={16} /> },
    { value: 'items.name', label: 'Produtos', icon: <Package size={16} /> },
    { value: 'createdAt.month', label: 'Mês do Pedido', icon: <CalendarDays size={16} /> },
   
  ];

  const valueOptions = [
    { value: '', label: 'Selecione o valor', icon: <Info size={16} /> }, 
    { value: 'totalAmount', label: 'Valor Total do Pedido', icon: <DollarSign size={16} /> },
    { value: 'items.quantity', label: 'Quantidade de Itens', icon: <ShoppingBag size={16} /> },
    { value: 'items.revenue', label: 'Faturamento por Produto', icon: <DollarSign size={16} /> },
    { value: 'netAmount', label: 'Valor Líquido', icon: <Wallet size={16} /> }, 
  ];
  const functionOptions = [
    { value: '', label: 'Selecione a função', icon: <Info size={16} /> }, 
    { value: 'sum', label: 'Soma', icon: <Calculator size={16} /> },
    { value: 'avg', label: 'Média', icon: <TrendingUp size={16} /> },
    { value: 'count', label: 'Contagem', icon: <Hash size={16} /> },
  ];

  const lineIconMap = useMemo(() => {
    const map: { [key: string]: JSX.Element } = {};
    lineOptions.forEach(opt => {
      map[opt.value] = opt.icon;
    });
    return map;
  }, [lineOptions]);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { active } = useDndContext();

  useEffect(() => {
    let currentLines = [...selectedLines];
    let currentValue = selectedValue;
    let currentFunction = selectedFunction;
    let stateChanged = false;

    if (currentLines.includes('items.name') && currentValue !== 'items.quantity' && currentValue !== 'items.revenue') {
      currentValue = 'items.revenue'; 
      stateChanged = true;
    }

    if ((currentValue === 'items.quantity' || currentValue === 'items.revenue') && !currentLines.includes('items.name')) {
      currentLines = [...currentLines, 'items.name'];
      stateChanged = true;
    }

    if ((currentValue === 'totalAmount' || currentValue === 'netAmount') && currentLines.includes('items.name')) {
      currentLines = currentLines.filter(line => line !== 'items.name');
      stateChanged = true;
    }

    if (currentValue === 'items.quantity' && currentFunction === 'avg') {
      currentFunction = 'sum';
      stateChanged = true;
    }

    if (stateChanged) {
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

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const isDraggingAvailableOption = active.data.current?.type === 'availableOption';
    const isOverMainDroppableArea = over.id === 'selected-lines-droppable' || selectedLines.includes(over.id as string);

    if (isDraggingAvailableOption && isOverMainDroppableArea) {
      const draggedOptionId = active.id as string;
      if (!selectedLines.includes(draggedOptionId)) {
        setSelectedLines((prev) => [...prev, draggedOptionId]);
      }
      return;
    }

    const isDraggingSortableItem = selectedLines.includes(active.id as string);
    const isOverSortableItem = selectedLines.includes(over.id as string);

    if (isDraggingSortableItem && isOverSortableItem && active.id !== over.id) {
      const oldIndex = selectedLines.indexOf(active.id as string);
      const newIndex = selectedLines.indexOf(over.id as string);
      if (oldIndex !== -1 && newIndex !== -1) {
        setSelectedLines((prev) => arrayMove(prev, oldIndex, newIndex));
      }
    }
  };

  const { setNodeRef: setDroppableNodeRef } = useDroppable({
    id: 'selected-lines-droppable',
  });

  const handleRemoveSelectedLine = (idToRemove: string) => {
    setSelectedLines((prev) => prev.filter((lineId) => lineId !== idToRemove));
  };

  const selectedLineOptions = useMemo(() => {
    return selectedLines
      .map((lineId) => lineOptions.find((opt) => opt.value === lineId))
      .filter(Boolean) as { value: string; label: string; icon: JSX.Element }[];
  }, [selectedLines, lineOptions]);

  const availableLineOptions = useMemo(() => {
    return lineOptions.filter((option) => !selectedLines.includes(option.value));
  }, [selectedLines, lineOptions]);

  const filteredValueOptions = useMemo(() => {
    if (selectedLines.includes('items.name')) {
      return valueOptions.filter(option =>
        option.value === 'items.quantity' || option.value === 'items.revenue'
      );
    }
    return valueOptions;
  }, [selectedLines, valueOptions]);

  const filteredFunctionOptions = useMemo(() => {
    if (selectedValue === 'items.quantity') {
      return functionOptions.filter(option => option.value !== 'avg');
    }
    return functionOptions;
  }, [selectedValue, functionOptions]);

  const fetchReportData = useCallback(async () => {
    if (!selectedFunction) {
      setError('Por favor, selecione uma função de agregação.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        line: debouncedLines.join(','), 
        value: debouncedValue,
        func: debouncedFunction,
      });
      const url = `http://localhost:3000/api/reports?${params.toString()}`;

      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao buscar dados do relatório.');
      }

      const data: ReportRow[] = await response.json();
      setReportData(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Erro inesperado ao carregar relatório.');
      } else {
        setError('Erro inesperado ao carregar relatório.');
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedLines, debouncedValue, debouncedFunction, selectedFunction]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData, retry]);

  const formatValue = (value: number) => {
    if (selectedFunction === 'count') {
      return value.toFixed(0);
    }
    if (selectedValue === 'totalAmount' || selectedValue === 'netAmount' || selectedValue === 'items.revenue') {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }
    if (selectedValue === 'items.quantity') {
      return `${Math.round(value)} un`;
    }
    return value.toFixed(2);
  };

  const getLineLabel = (value: string | string[]) => {
    if (Array.isArray(value)) {
      return value.map(v => lineOptions.find(opt => opt.value === v)?.label || v).join(' + ');
    }
    return lineOptions.find(opt => opt.value === value)?.label || value;
  };

  const getValueLabel = (value: string) => valueOptions.find(opt => opt.value === value)?.label || value;
  const getFunctionLabel = (value: string) => functionOptions.find(opt => opt.value === value)?.label || value;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57'];

  const formatRowLabel = (row: ReportRow) => {
    if (selectedLines.includes('store')) {
      return `Loja: ${row.store || 'N/A'}`; 
    }
    const parts = selectedLines.map(lineKey => {
      const label = lineOptions.find(opt => opt.value === lineKey)?.label || lineKey;
      return `${label}: ${row[lineKey] || 'N/A'}`;
    });
    const fullLabel = parts.join(', ');
    return fullLabel.length > 40 ? fullLabel.substring(0, 37) + '...' : fullLabel;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const formattedValue = formatValue(dataPoint.result);
      const funcLabel = getFunctionLabel(selectedFunction);
      const valLabel = getValueLabel(selectedValue);
      const total = displayData.reduce((sum, item) => sum + item.result, 0);
      const percentage = total > 0 ? ((dataPoint.result / total) * 100).toFixed(2) : 0;

      return (
        <div className="bg-[#24292D] border border-[#3A414A] rounded-lg p-3 text-sm text-white shadow-lg">
          <p className="font-bold text-teal-400">{percentage}% do total</p>
          <p className="font-semibold">{dataPoint.store}</p>
          <p className="text-gray-300">{`${funcLabel} de ${valLabel}: ${formattedValue}`}</p>
        </div>
      );
    }
    return null;
  };

  const displayData = useMemo(() => {
    const storeData = stores.map(store => {
      const matchingReport = reportData.find(row => row.store === store._id);
      return {
        name: store.name, 
        result: matchingReport ? matchingReport.result : 0, 
        type: 'Loja', 
      };
    });

    const productData = selectedLines.includes('items.name')
      ? products.map(product => {
          const matchingReport = reportData.find(row => row.product === product._id);
          return {
            name: product.name, 
            result: matchingReport ? matchingReport.result : 0, 
            type: 'Produto', 
          };
        })
      : [];

    return [...storeData, ...productData];
  }, [stores, products, reportData, selectedLines]);

  const renderChart = () => {
    if (displayData.length === 0) {
      return <div className="flex-grow flex items-center justify-center"><p className="text-gray-400">Nenhum dado para exibir.</p></div>;
    }

    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart layout="vertical" data={displayData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3A414A" horizontal={true} vertical={false} />
          <XAxis type="number" stroke="#9CA3AF" tickFormatter={formatValue} />
          <YAxis type="category" dataKey="name" stroke="#9CA3AF" width={180} interval={0} fontSize={10} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="result" fill="#8884d8" name={`${getFunctionLabel(selectedFunction)} de ${getValueLabel(selectedValue)}`} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="bg-gradient-to-br from-[#1E2328] via-[#24292D] to-[#2B3036] min-h-screen text-white">
      <div className="container mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resultados */}
        <div className="lg:col-span-2 bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-6 flex flex-col min-h-[600px]">
          <h2 className="text-2xl font-bold mb-4 text-white">Relatório: {getFunctionLabel(selectedFunction)} de {getValueLabel(selectedValue)} por {getLineLabel(selectedLines)}</h2>
          {loading && reportData.length === 0 ? (
            <div className="flex-grow flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent" />
              <span className="ml-4 text-white">Carregando relatório...</span>
            </div>
          ) : error ? (
            <div className="flex-grow flex flex-col items-center justify-center text-red-400">
              <p>{error}</p>
              <button onClick={() => setRetry(r => r + 1)} className="mt-4 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-lg transition-colors">
                Tentar Novamente
              </button>
            </div>
          ) : (
            <>
              <div className="flex-grow">{renderChart()}</div>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full bg-[#24292D] rounded-lg overflow-hidden">
                  <thead className="bg-[#2F363E] border-b border-white/10">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-300">{getLineLabel(selectedLines)}</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-300">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayData.length > 0 ? displayData.map((row, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-[#24292D]' : 'bg-[#2F363E]'}>
                        <td className="px-4 py-2 text-sm text-white">{row.name} ({row.type})</td>
                        <td className="px-4 py-2 text-sm text-white text-right">{formatValue(row.result)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={2} className="px-4 py-4 text-center text-gray-400">Nenhum dado encontrado.</td></tr>
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
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-300">Agrupar por (Arraste e Solte)</label>
              <div ref={setDroppableNodeRef} className="min-h-[80px] p-3 bg-[#24292D] rounded-md border border-white/10 flex flex-col gap-2">
                {selectedLineOptions.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Arraste campos para cá</p>}
                <SortableContext items={selectedLines} strategy={verticalListSortingStrategy}>
                  {selectedLineOptions.map((option) => (
                    <SortableSelectedLine key={option.value} id={option.value} label={option.label} icon={lineIconMap[option.value]} onRemove={handleRemoveSelectedLine} />
                  ))}
                </SortableContext>
              </div>
              <DragOverlay adjustScale={true}>
                {active && active.id ? (
                  <div className="flex items-center gap-2 p-2 bg-teal-600 rounded-md border border-teal-400 text-white text-sm shadow-lg">
                    {lineOptions.find(opt => opt.value === active.id)?.icon}
                    {lineOptions.find(opt => opt.value === active.id)?.label}
                  </div>
                ) : null}
              </DragOverlay>
              <p className="text-gray-400 text-xs mt-4 mb-2">Campos disponíveis:</p>
              <div className="grid grid-cols-2 gap-2">
                {availableLineOptions.map((option) => (
                  <DraggableLineOption key={option.value} option={option} />
                ))}
              </div>
            </div>
          </DndContext>

          <Listbox value={selectedValue} onChange={setSelectedValue}>
            <div className="mb-6 relative">
              <Listbox.Label className="block text-sm font-medium mb-2 text-gray-300">Valor para Agregação</Listbox.Label>
              <Listbox.Button className="w-full p-3 rounded bg-[#24292D] text-white border border-white/10 focus:ring-2 focus:ring-teal-500 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {valueOptions.find(opt => opt.value === selectedValue)?.icon}
                  {valueOptions.find(opt => opt.value === selectedValue)?.label || 'Selecione o valor'}
                </span>
                <span className="text-gray-400">▼</span>
              </Listbox.Button>
              <Listbox.Options className="absolute z-10 mt-1 w-full bg-[#24292D] border border-white/10 rounded-md shadow-lg max-h-60 overflow-auto">
                {valueOptions.map((option) => (
                  <Listbox.Option
                    key={option.value}
                    value={option.value}
                    className={({ active }) => `p-3 cursor-pointer text-white flex items-center gap-2 ${active ? 'bg-teal-700/30' : ''}`}
                  >
                    {option.icon} {option.label}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>

          <Listbox value={selectedFunction} onChange={setSelectedFunction}>
            <div className="mb-6 relative">
              <Listbox.Label className="block text-sm font-medium mb-2 text-gray-300">Função de Agregação</Listbox.Label>
              <Listbox.Button className="w-full p-3 rounded bg-[#24292D] text-white border border-white/10 focus:ring-2 focus:ring-teal-500 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {functionOptions.find(opt => opt.value === selectedFunction)?.icon}
                  {functionOptions.find(opt => opt.value === selectedFunction)?.label || 'Selecione a função'}
                </span>
                <span className="text-gray-400">▼</span>
              </Listbox.Button>
              <Listbox.Options className="absolute z-10 mt-1 w-full bg-[#24292D] border border-white/10 rounded-md shadow-lg max-h-60 overflow-auto">
                {functionOptions.map((option) => (
                  <Listbox.Option
                    key={option.value}
                    value={option.value}
                    className={({ active }) => `p-3 cursor-pointer text-white flex items-center gap-2 ${active ? 'bg-teal-700/30' : ''}`}
                  >
                    {option.icon} {option.label}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>

          <button onClick={() => fetchReportData()} className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 rounded-lg transition-colors mt-6">
            Atualizar Relatório (Manual)
          </button>
        </div>
      </div>
    </div>
  );
}
