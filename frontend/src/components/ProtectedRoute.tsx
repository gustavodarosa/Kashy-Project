import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode; 
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const token = localStorage.getItem('token'); 

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>; 
};

export default ProtectedRoute;