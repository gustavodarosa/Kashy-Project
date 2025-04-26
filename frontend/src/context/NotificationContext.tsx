import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Notification = {
  id: string;
  amountBCH: number;
  amountBRL: number;
  message: string;
  timestamp: string;
  orderId?: string;
  receivedAt: string;
  userId?: string; // Adicione esta linha
  onViewDetails: () => void;
  onConfirmDelivery?: () => void;
};

type NotificationContextType = {
  notifications: Notification[];
  addNotification: (notification: Notification) => void;
  clearNotifications: () => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const storedNotifications = localStorage.getItem('notifications');
    return storedNotifications ? JSON.parse(storedNotifications) : [];
  });

  const addNotification = (notification: Notification) => {
    const userId = localStorage.getItem('userId'); // Obtenha o ID do usuário autenticado
    if (notification.userId && notification.userId !== userId) {
      console.warn('Notificação ignorada: não pertence ao usuário autenticado.');
      return;
    }

    const updatedNotifications = [...notifications, notification];
    setNotifications(updatedNotifications);

    // Salvar notificações no localStorage
    localStorage.setItem('notifications', JSON.stringify(updatedNotifications));
  };

  const clearNotifications = () => {
    setNotifications([]);
    localStorage.removeItem('notifications');
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, clearNotifications }}>
      {children}
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