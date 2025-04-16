import { useState, useEffect } from 'react';
import { FiShoppingBag, FiPercent, FiClock, FiCheckCircle, FiStar, FiCreditCard } from 'react-icons/fi';

type Offer = {
  id: string;
  title: string;
  description: string;
  discount: string;
  category: 'cashback' | 'discount' | 'benefit' | 'partner';
  validity: string;
  isActive: boolean;
  isExclusive: boolean;
  conditions?: string[];
  partner?: {
    name: string;
    logo: string;
  };
  cashbackValue?: number;
  discountValue?: number;
};

export function OfertasTab() {
  // Estado para ofertas
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  // Simulação de fetch de dados
  useEffect(() => {
    const fetchOffers = async () => {
      try {
        setLoading(true);
        // Simulando uma chamada API
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Dados mockados
        const mockOffers: Offer[] = [
          {
            id: '1',
            title: 'Cashback de 5% em todas as vendas',
            description: 'Receba 5% de cashback em todas as vendas realizadas na plataforma este mês',
            discount: '5%',
            category: 'cashback',
            validity: '30/06/2024',
            isActive: true,
            isExclusive: true,
            cashbackValue: 5,
            conditions: [
              'Válido para vendas acima de R$ 50,00',
              'Cashback creditado em até 5 dias úteis',
              'Máximo de R$ 500,00 por mês'
            ]
          },
          {
            id: '2',
            title: '50% de desconto na taxa de saque',
            description: 'Promoção especial para saques realizados até o final do mês',
            discount: '50%',
            category: 'discount',
            validity: '30/06/2024',
            isActive: true,
            isExclusive: false,
            discountValue: 50,
            conditions: [
              'Válido apenas para primeiro saque do mês',
              'Valor mínimo de saque: R$ 100,00',
              'Desconto aplicado automaticamente'
            ]
          },
          {
            id: '3',
            title: 'Conta Premium grátis por 3 meses',
            description: 'Upgrade gratuito para conta premium por 3 meses',
            discount: 'GRÁTIS',
            category: 'benefit',
            validity: '30/06/2024',
            isActive: true,
            isExclusive: true,
            conditions: [
              'Para comerciantes com mais de 10 vendas/mês',
              'Renovação automática após período promocional'
            ]
          },
          {
            id: '4',
            title: 'Desconto em serviços de contabilidade',
            description: '20% de desconto nos planos da Contabilly para usuários Kashy',
            discount: '20%',
            category: 'partner',
            validity: '31/12/2024',
            isActive: true,
            isExclusive: false,
            partner: {
              name: 'Contabilly',
              logo: '/contabilly-logo.png'
            },
            discountValue: 20,
            conditions: [
              'Apresente o cupom KASHY20 no checkout',
              'Válido para novos clientes'
            ]
          },
          {
            id: '5',
            title: 'Cashback dobrado no primeiro mês',
            description: 'Ganhe o dobro de cashback em todas as vendas no primeiro mês',
            discount: '2X',
            category: 'cashback',
            validity: '30/06/2024',
            isActive: false,
            isExclusive: true,
            cashbackValue: 100,
            conditions: [
              'Apenas para novos comerciantes',
              'Cashback normal após o período promocional'
            ]
          }
        ];
        
        setOffers(mockOffers);
        setError(null);
      } catch (err) {
        setError('Erro ao carregar ofertas');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOffers();
  }, []);

  // Filtrar ofertas por categoria
  const filteredOffers = selectedCategory === 'all' 
    ? offers 
    : offers.filter(offer => offer.category === selectedCategory);

  // Formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Obter ícone por categoria
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'cashback':
        return <FiCreditCard className="text-green-500" />;
      case 'discount':
        return <FiPercent className="text-blue-500" />;
      case 'benefit':
        return <FiStar className="text-yellow-500" />;
      case 'partner':
        return <FiShoppingBag className="text-purple-500" />;
      default:
        return <FiPercent className="text-gray-500" />;
    }
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <FiShoppingBag /> Ofertas Exclusivas
      </h2>

      {/* Introdução */}
      <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-xl font-bold mb-2">Benefícios para seu negócio</h3>
            <p className="text-gray-300">
              Como parceiro Kashy, você tem acesso a ofertas exclusivas que ajudam a reduzir custos e aumentar seus lucros.
            </p>
          </div>
          <div className="bg-black bg-opacity-30 px-4 py-2 rounded-full text-sm">
            <span className="font-medium">Programa Kashy Rewards</span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex overflow-x-auto pb-2 mb-6 gap-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-full whitespace-nowrap ${
            selectedCategory === 'all' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setSelectedCategory('cashback')}
          className={`px-4 py-2 rounded-full whitespace-nowrap flex items-center gap-2 ${
            selectedCategory === 'cashback' 
              ? 'bg-green-600 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <FiCreditCard /> Cashback
        </button>
        <button
          onClick={() => setSelectedCategory('discount')}
          className={`px-4 py-2 rounded-full whitespace-nowrap flex items-center gap-2 ${
            selectedCategory === 'discount' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <FiPercent /> Descontos
        </button>
        <button
          onClick={() => setSelectedCategory('benefit')}
          className={`px-4 py-2 rounded-full whitespace-nowrap flex items-center gap-2 ${
            selectedCategory === 'benefit' 
              ? 'bg-yellow-600 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <FiStar /> Benefícios
        </button>
        <button
          onClick={() => setSelectedCategory('partner')}
          className={`px-4 py-2 rounded-full whitespace-nowrap flex items-center gap-2 ${
            selectedCategory === 'partner' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <FiShoppingBag /> Parceiros
        </button>
      </div>

      {/* Lista de Ofertas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="col-span-full text-center py-12 text-red-400">
            {error}
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400">
            Nenhuma oferta disponível nesta categoria
          </div>
        ) : (
          filteredOffers.map((offer) => (
            <div 
              key={offer.id} 
              className={`bg-gray-800 rounded-lg p-6 border hover:border-blue-500 transition-colors relative overflow-hidden ${
                !offer.isActive ? 'opacity-70' : ''
              } ${
                offer.isExclusive ? 'border-yellow-500' : 'border-gray-700'
              }`}
            >
              {offer.isExclusive && (
                <div className="absolute top-0 right-0 bg-yellow-600 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">
                  EXCLUSIVO
                </div>
              )}
              
              {!offer.isActive && (
                <div className="absolute top-0 left-0 w-full bg-gray-900 bg-opacity-70 text-center py-1 text-xs font-bold">
                  EXPIRADA
                </div>
              )}
              
              <div className="flex items-start gap-4 mb-4">
                <div className={`p-3 rounded-full ${
                  offer.category === 'cashback' ? 'bg-green-900 text-green-400' :
                  offer.category === 'discount' ? 'bg-blue-900 text-blue-400' :
                  offer.category === 'benefit' ? 'bg-yellow-900 text-yellow-400' :
                  'bg-purple-900 text-purple-400'
                }`}>
                  {getCategoryIcon(offer.category)}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{offer.title}</h3>
                  {offer.partner && (
                    <p className="text-sm text-gray-400 flex items-center gap-1">
                      Parceiro: {offer.partner.name}
                    </p>
                  )}
                </div>
              </div>
              
              <p className="text-gray-300 mb-4">{offer.description}</p>
              
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <FiClock /> Válido até: {offer.validity}
                </div>
                <div className={`text-xl font-bold ${
                  offer.category === 'cashback' ? 'text-green-400' :
                  offer.category === 'discount' ? 'text-blue-400' :
                  offer.category === 'benefit' ? 'text-yellow-400' :
                  'text-purple-400'
                }`}>
                  {offer.discount}
                </div>
              </div>
              
              <button
                onClick={() => setSelectedOffer(offer)}
                className={`w-full py-2 rounded-lg flex items-center justify-center gap-2 ${
                  !offer.isActive ? 'bg-gray-700 cursor-not-allowed' :
                  offer.isExclusive ? 'bg-yellow-600 hover:bg-yellow-700' :
                  'bg-blue-600 hover:bg-blue-700'
                } transition-colors`}
                disabled={!offer.isActive}
              >
                {offer.isActive ? (
                  <>
                    <FiCheckCircle /> Saber mais
                  </>
                ) : (
                  'Oferta expirada'
                )}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Modal de Detalhes da Oferta */}
      {selectedOffer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                {getCategoryIcon(selectedOffer.category)}
                {selectedOffer.title}
                {selectedOffer.isExclusive && (
                  <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded-full">
                    EXCLUSIVO
                  </span>
                )}
              </h3>
              <button
                onClick={() => setSelectedOffer(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            {selectedOffer.partner && (
              <div className="flex items-center gap-3 mb-4 p-3 bg-gray-700 rounded-lg">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                  {selectedOffer.partner.logo ? (
                    <img src={selectedOffer.partner.logo} alt={selectedOffer.partner.name} className="w-8 h-8 object-contain" />
                  ) : (
                    <FiShoppingBag className="text-gray-800" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-400">Parceiro</p>
                  <p className="font-medium">{selectedOffer.partner.name}</p>
                </div>
              </div>
            )}
            
            <div className="mb-6">
              <p className="text-gray-300 mb-4">{selectedOffer.description}</p>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-700 p-3 rounded-lg">
                  <p className="text-sm text-gray-400">Validade</p>
                  <p className="font-medium">{selectedOffer.validity}</p>
                </div>
                <div className={`p-3 rounded-lg ${
                  selectedOffer.category === 'cashback' ? 'bg-green-900 text-green-400' :
                  selectedOffer.category === 'discount' ? 'bg-blue-900 text-blue-400' :
                  selectedOffer.category === 'benefit' ? 'bg-yellow-900 text-yellow-400' :
                  'bg-purple-900 text-purple-400'
                }`}>
                  <p className="text-sm">Benefício</p>
                  <p className="font-bold text-xl">{selectedOffer.discount}</p>
                </div>
              </div>
              
              {selectedOffer.conditions && (
                <div>
                  <h4 className="font-medium mb-2">Condições</h4>
                  <ul className="list-disc pl-5 space-y-1 text-gray-300">
                    {selectedOffer.conditions.map((condition, index) => (
                      <li key={index}>{condition}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedOffer(null)}
                className="px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-700 transition-colors flex-1"
              >
                Fechar
              </button>
              <button
                className={`px-4 py-2 rounded-lg transition-colors flex-1 flex items-center justify-center gap-2 ${
                  !selectedOffer.isActive ? 'bg-gray-700 cursor-not-allowed' :
                  selectedOffer.isExclusive ? 'bg-yellow-600 hover:bg-yellow-700' :
                  'bg-blue-600 hover:bg-blue-700'
                }`}
                disabled={!selectedOffer.isActive}
              >
                {selectedOffer.isActive ? (
                  <>
                    <FiCheckCircle /> Ativar Oferta
                  </>
                ) : (
                  'Oferta expirada'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seção de Programa de Recompensas */}
      <div className="mt-12 bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <FiStar className="text-yellow-400" /> Programa Kashy Rewards
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-750 p-4 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-yellow-600 p-2 rounded-full">
                <FiCreditCard className="text-white" />
              </div>
              <h4 className="font-bold">Cashback Automático</h4>
            </div>
            <p className="text-gray-400">
              Receba parte do valor das suas vendas de volta como crédito na plataforma.
            </p>
          </div>
          
          <div className="bg-gray-750 p-4 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-purple-600 p-2 rounded-full">
                <FiPercent className="text-white" />
              </div>
              <h4 className="font-bold">Descontos Progressivos</h4>
            </div>
            <p className="text-gray-400">
              Quanto mais você usa, maiores os descontos em taxas e serviços.
            </p>
          </div>
          
          <div className="bg-gray-750 p-4 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-blue-600 p-2 rounded-full">
                <FiShoppingBag className="text-white" />
              </div>
              <h4 className="font-bold">Benefícios Exclusivos</h4>
            </div>
            <p className="text-gray-400">
              Acesso a ofertas especiais de nossos parceiros estratégicos.
            </p>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg">
          <h4 className="font-bold mb-2">Seu nível atual: <span className="text-yellow-400">Prata</span></h4>
          <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
            <div 
              className="bg-yellow-400 h-2.5 rounded-full" 
              style={{ width: '45%' }}
            ></div>
          </div>
          <p className="text-sm text-gray-300">
            Faltam R$ 1.200,00 em vendas para atingir o nível Ouro e dobrar seus benefícios.
          </p>
        </div>
      </div>
    </div>
  );
}