import React, { createContext, useContext, useState, ReactNode } from 'react';
import { PaymentNotification } from '../components/PaymentNotification';

type Notification = {
  id: string;
  amountBCH: number;
  amountBRL: number;
  orderId?: string;
  receivedAt: string;
  onViewDetails: () => void;
  onConfirmDelivery?: () => void;
};

type NotificationContextType = {
  addNotification: (notification: Omit<Notification, 'id'>) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9); // Gera um ID único
    setNotifications((prev) => [...prev, { ...notification, id }]);

    // Remove a notificação automaticamente após 7 segundos
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 7000);
  };

  return (
    <NotificationContext.Provider value={{ addNotification }}>
      {children}
      {/* Renderiza as notificações */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 space-y-4">
        {notifications.map((notification) => (
          <PaymentNotification
            key={notification.id}
            amountBCH={notification.amountBCH}
            amountBRL={notification.amountBRL}
            orderId={notification.orderId}
            receivedAt={notification.receivedAt}
            onClose={() => setNotifications((prev) => prev.filter((n) => n.id !== notification.id))}
            onViewDetails={notification.onViewDetails}
            onConfirmDelivery={notification.onConfirmDelivery}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};