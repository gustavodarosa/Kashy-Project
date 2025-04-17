import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DashboardLayout from './pages/dashboard/dashlayout';
import Login from './pages/auth/login';
import Register from './pages/auth/register';
import ProtectedRoute from './components/ProtectedRoute';
import React from 'react';
import { NotificationProvider } from './context/NotificationContext';
import { WalletTab } from './pages/dashboard/tabs/2wallettab';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/DashboardHome" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;