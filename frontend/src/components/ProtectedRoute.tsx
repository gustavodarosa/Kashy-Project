import { useEffect, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [token, setToken] = useState(() => localStorage.getItem("token"));

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      localStorage.setItem("token", urlToken);
      setToken(urlToken); // Atualiza o estado para forçar re-render
      window.history.replaceState({}, document.title, location.pathname);
    } else {
      // Sempre que a rota mudar, tente atualizar o token do localStorage
      setToken(localStorage.getItem("token"));
    }
  }, [location]);

  if (!token) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}