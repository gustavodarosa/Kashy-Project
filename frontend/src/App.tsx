import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DashboardLayout from './pages/dashboard/dashlayout';
import Login from './pages/auth/login';
import Register from './pages/auth/register';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastContainer } from 'react-toastify';
import { NotificationProvider } from './context/NotificationContext'; // Importar o NotificationProvider
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/DashboardHome"
            element={
              <ProtectedRoute>
                <DashboardLayout />
                <ToastContainer />
              </ProtectedRoute>
            }
          />
        </Routes>
      </NotificationProvider>
    </BrowserRouter>
  );
}

export default App;