import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Notification = {
  id: string;
  amountBCH: number;
  amountBRL: number;
  message: string;
  timestamp: string;
  orderId?: string;
  receivedAt: string;
  onViewDetails: () => void;
  onConfirmDelivery?: () => void;
};

type NotificationContextType = {
  notifications: Notification[];
  addNotification: (notification: Notification) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Notification) => {
    const id = Math.random().toString(36).substr(2, 9); // Gera um ID único
    setNotifications((prev) => [...prev, { ...notification, id }]);
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification }}>
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