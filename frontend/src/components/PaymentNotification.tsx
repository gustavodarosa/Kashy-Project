import React, { useEffect } from 'react';
import { FiCheckCircle, FiClock, FiX } from 'react-icons/fi';

type PaymentNotificationProps = {
  amountBCH: number;
  amountBRL: number;
  orderId?: string;
  receivedAt: string;
  onClose: () => void;
  onViewDetails: () => void;
  onConfirmDelivery?: () => void;
};

export const PaymentNotification: React.FC<PaymentNotificationProps> = ({
  amountBCH,
  amountBRL,
  orderId,
  receivedAt,
  onClose,
  onViewDetails,
  onConfirmDelivery,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 7000); // Auto-dismiss after 7 seconds

    return () => clearTimeout(timer); // Cleanup on unmount
  }, [onClose]);

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full bg-green-50 border border-green-400 rounded-lg shadow-lg p-4 flex items-start gap-4 animate-slide-down">
      {/* Ícone de Sucesso */}
      <div className="text-green-500">
        <FiCheckCircle size={32} />
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1">
        <h4 className="text-lg font-semibold text-gray-900">Pagamento Recebido!</h4>
        <p className="text-sm text-gray-700 flex items-center gap-2">
          <span className="font-bold text-gray-900">+ {amountBCH.toFixed(8)} BCH</span>
          <span className="text-gray-500">(≈ R$ {amountBRL.toFixed(2)})</span>
        </p>
        {orderId && (
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <span className="font-medium">Pedido #{orderId}</span>
          </p>
        )}
        <p className="text-xs text-gray-500 flex items-center gap-2">
          <FiClock /> Recebido às {receivedAt}
        </p>
      </div>

      {/* Botões de Ação */}
      <div className="flex flex-col gap-2">
        {onConfirmDelivery && (
          <button
            onClick={onConfirmDelivery}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-lg border border-gray-300"
          >
            Confirmar Entrega
          </button>
        )}
        <button
          onClick={onViewDetails}
          className="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg"
        >
          Ver Detalhes
        </button>
      </div>

      {/* Botão Fechar */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
      >
        <FiX size={20} />
      </button>
    </div>
  );
};