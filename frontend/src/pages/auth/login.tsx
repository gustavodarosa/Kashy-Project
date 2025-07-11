import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole, Mail } from "lucide-react";
const renewToken = async () => {
const token = localStorage.getItem("token");
  if (!token) return;
  try {
const response = await fetch("http://localhost:3000/api/refresh-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
    if (response.ok) {
const data = await response.json();
      localStorage.setItem("token", data.token);
      console.log("Token renovado com sucesso.");
    } else {
      console.error("Erro ao renovar o token:", response.statusText);
    }
  } catch (error) {
    console.error("Erro de rede ao tentar renovar o token:", error);
  }
};
const Login = () => {
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [message, setMessage] = useState("");
const [loading, setLoading] = useState(false);
const [showStoreModal, setShowStoreModal] = useState(false);
const [selectedStore, setSelectedStore] = useState<string>("");
const [pendingLogin, setPendingLogin] = useState<{email: string, password: string} | null>(null);
const [stores, setStores] = useState<{ _id: string, name: string }[]>([]);
  useEffect(() => {
const interval = setInterval(() => {
      renewToken();
    }, 55 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
const handleGoogleLogin = () => {
    window.location.href = "http://localhost:3000/api/auth/google?hl=pt-BR";
  };
const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    setPendingLogin({ email, password });
    setShowStoreModal(true);
  };
const handleStoreConfirm = async () => {
    if (!pendingLogin) return;
    try {
const response = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: pendingLogin.email, password: pendingLogin.password }),
      });
const data = await response.json();
      if (response.ok) {
        setMessage(data.message || "Login realizado com sucesso!");
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.username);
        localStorage.setItem("email", data.email);
        localStorage.setItem("userId", data.userId);
        localStorage.setItem("store", selectedStore); 
        setTimeout(() => {
          window.location.href = data.redirectTo || "/";
        }, 1000);
      } else {
        setMessage(data.message || "Erro ao realizar login. Verifique suas credenciais.");
      }
    } catch (error) {
      setMessage("Erro ao conectar ao servidor. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
      setShowStoreModal(false);
      setPendingLogin(null);
    }
  };
useEffect(() => {
  if (showStoreModal) {
    const fetchStores = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!pendingLogin) return;
        // Faz login temporário só para buscar as lojas
        const tempLogin = await fetch("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: pendingLogin.email, password: pendingLogin.password }),
        });
        if (!tempLogin.ok) return;
        const tempData = await tempLogin.json();
        const tempToken = tempData.token;
        const res = await fetch("http://localhost:3000/api/stores/my", {
          headers: { Authorization: `Bearer ${tempToken}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setStores(data);
      } catch (err) {
        setStores([]);
      }
    };
    fetchStores();
  }
}, [showStoreModal, pendingLogin]);
const messageColor = message.includes("sucesso") ? "text-green-400" : "text-red-400";
  return (
<div className="bg-[rgb(17,40,54)] flex justify-center items-center min-h-screen p-4">
<div className="flex flex-col md:flex-row items-center w-full max-w-6xl">
       
<div className="flex justify-center md:justify-start w-full md:w-1/2 ml-8">
  <svg 
    version="1.2" 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 2000 809" 
    className="w-full h-auto" 
    aria-labelledby="logoTitle"
    role="img">
    <title id="logoTitle">Logo Kashy</title>
    <style>{`.s0 { fill: #70ffbd }`}</style>
    <g>
      <path fillRule="evenodd" className="s0" d="m560.6 185.8c7.8 2.6 33.5 15.4 39.5 19.8 6 4.4 17.4 17.7 26.8 31.2 16.8 24.4 24.3 53.4 20.7 80.8-2.1 15.6-3.4 20.4-9.9 35.7-5.8 13.4-11.1 22.1-18.3 29.7-2.4 2.5-6.2 6.8-8.6 9.7-14.1 16.9-39.1 30-65.9 34.7-4.5 0.8-8.6 1.9-9.2 2.5-0.8 0.8-0.7 1.1 0.3 1.1 0.8 0 20 0.2 42.7 0.3 48.4 0.2 45.2-0.6 46.1 11.5 0.6 9.7-0.5 18-2.7 19.1-1 0.6-8.6 1.1-17 1.2-8.3 0.1-15.4 0.5-15.6 0.9-0.3 0.4-0.5 16.7-0.5 36.1-0.1 35.4-0.1 35.4 16.9 36.4 9.3 0.5 17.3 1.4 17.8 1.8 1 1 1.7 20.8 0.9 24.1-1.1 4.3-4.3 4.8-35.1 5.3-17.1 0.2-29.4 0.8-30 1.4-0.6 0.6-1.2 12.2-1.5 28.5-0.5 25.1-0.7 27.7-2.3 28.9-2.3 1.7-17.5 2.7-24.7 1.8-4.4-0.7-5.7-1.3-6.7-3.3-1-1.9-1.3-13.1-1.3-46.8 0-44.2 0-44.2-14-44.2-10.7 0-14.8-0.4-17-1.5-1.7-0.9-3.1-1.7-3.2-1.8-0.1-0.1-0.5-15.3-0.8-33.7-0.5-33.5-0.5-33.5-15.5-33.5-8.2 0.1-15.8 0.4-16.7 0.7-1.5 0.6-1.6 4.3-1.6 41 0 22.2 0.3 47.9 0.6 57.3 0.7 17 0.7 17 3.7 18.4 1.7 0.8 7.1 1.7 12 2 9 0.6 9 0.6 9.3 22 0.2 16.5-0.1 21.6-1 22.3-1.5 0.9-39.9 1.1-42.3 0.2-0.9-0.4-2-1.7-2.5-3-0.5-1.3-1-25.6-1-54.1 0-28.5-0.4-55.7-0.7-60.6-0.6-8.7-0.6-8.7-17.7-8.5-17.1 0.3-17.1 0.3-17.4 31.4-0.2 31-0.2 31-3.7 32.7-6 2.9-22.9 2.2-26.5-1-0.3-0.3-0.7-22.8-1-50.1-0.5-49.7-0.5-49.7-4.7-58.4-5-10-9.2-14.1-20.2-19.6-7.2-3.5-7.6-3.6-22.3-4.2-16.9-0.6-17.2-0.7-18.4-8.8-0.9-5.8 0.1-19.3 1.5-22.1 1.1-2.1 1.7-2.1 28.1-2.1 27 0 27 0 30.8-3.4 3.7-3.4 3.7-3.5 4.3-13.3 0.4-5.4 0.7-28.6 0.8-51.5 0.1-49.4-1.4-44.8 14.7-44.8 9.2 0 10.5 0.2 13.9 2.6 2.1 1.4 4.1 2.2 4.5 1.7 0.3-0.4 1.2-4.7 1.8-9.4 0.7-4.8 2.1-11.1 3.1-14 2.6-7.6 9.5-21.5 13.4-27.1 1.7-2.5 4.3-6.5 5.7-8.8 1.4-2.3 7.7-9.5 14-15.9 11.2-11.5 11.8-11.9 25.5-18.8 19.8-10 32-13.9 48-15.7 12.9-1.4 37.6 1.2 50.1 5.2zm-46.5 49.8c-1.9 8.9-1.9 8.9-8.3 8.6-3.5-0.1-9.5-1.1-13.3-2.3-10.8-3.2-10.8-3.2-11.7 2.6-1.5 9.5-2 8.7 5.6 11.2 3.9 1.2 7.6 2.8 8.3 3.5 1.7 1.8 0.6 8.5-5.9 35.3-9.1 37.9-7.5 34-13.8 34-3 0-7.4-0.4-9.7-0.9-4.1-0.7-4.3-0.7-4.3 1.6 0 1.3-0.9 4-2 6.1-1.1 2-2 3.9-2 4 0 0.7 7.5 3.5 15 5.7 10.6 3.1 12 3.7 12 5.7 0 1-1.1 6.1-2.5 11.3-1.9 7.4-2.2 9.7-1.2 10.6 1 0.9 10.3 3.4 13.1 3.5 0.6 0 2-4.6 3.3-10.2 2.5-11.1 3.4-12.9 6.8-12.9 6.3 0 6.8 2.3 3.1 15.1-1.9 6.4-2.2 8.7-1.3 9.5 1.1 1 14.6 3.9 15.2 3.2 0.1-0.2 0.9-5 1.6-10.8 1.5-10.5 1.5-10.5 15.9-10.5 17.3-0.1 21.7-1.2 26.4-6.7 5.9-6.9 9.1-14.5 9.1-21.8 0-9.1-0.9-11.5-6.8-17.7-5.2-5.5-5.2-5.5 1-11.2 5.1-4.6 6.6-6.8 8.3-11.6 3.6-10.3 1.4-18.2-7.5-27-4-3.9-6.6-5.5-11.3-6.9-6.9-2.1-7.5-3.3-4.8-9.7 0.8-1.9 1.7-5.7 2.1-8.5 0.8-6.3-0.2-7.3-8.7-8-6.3-0.6-6.3-0.6-7.6 5.7-2.1 9.9-3.7 12.9-6.9 12.9-5.6 0-5.9-0.9-3.5-11.5 1.3-5.3 2-10 1.7-10.4-0.2-0.5-2.5-1.4-4.9-2-8.4-2.1-7.8-2.6-10.5 10.5zm-117.6 133.2c-0.3 0.3-0.5 14.4-0.5 31.3v30.8l57.8 0.3c31.7 0.2 58.3 0.1 59-0.1 2.3-0.6 0.7-2.6-2.4-2.9-25.9-2.4-51.8-12.6-67-26.5-8.7-7.9-24.4-26.7-25.1-29.8-0.3-1.5-1-3-1.7-3.2-1.6-0.6-19.5-0.5-20.1 0.1zm133.4 94.9c-6.6 0.4-6.6 0.4-7.3 5-1.1 8.2-0.7 28.8 0.6 30.1 0.8 0.8 5.6 1.2 15 1.2 13.1 0 13.8-0.1 14.9-2.2 2.9-5.4 3.3-28.7 0.5-32.2-1.2-1.5-12.7-2.4-23.7-1.9zm5.8-194.2c9.4 2.9 13.3 6.6 13.3 12.5 0 4.1-4.7 12.8-7.4 13.6-3.1 1-14.3 0.5-20.6-0.9-4.8-1.1-5.5-1.6-5.8-3.8-0.3-2.4 4.2-22.1 5.5-24.2 0.7-1.1 4.3-0.4 15 2.8zm-23.5 38.5c0.5 0 3.3 0.7 6.1 1.6 23.5 7.2 25.7 8.6 25.7 15.4 0 6.9-4 12.4-10.1 14-4.1 1.1-14.9 0-23.6-2.5-6.5-1.9-6.5-1.9-2.1-17.3 1.7-6.1 3.5-11.2 4-11.2zm-257.2-106.8c70.5 0.3 70.5 0.3 73.7 2.6 2 1.4 3.7 3.8 4.3 6 0.8 2.5 1 26.5 0.8 76.4-0.3 71.7-0.3 72.7-2.4 75.5-4.8 6.6-1.7 6.3-77.9 6.3-53.1 0-69.6-0.3-71.5-1.3-1.3-0.7-3.8-3.4-5.5-6.1-3-4.9-3-4.9-3-77.7 0-71.6 0-72.8 2-75.5 1.1-1.5 3.6-3.5 5.5-4.6 3.3-1.7 6.8-1.8 74-1.6zm0.2 37.8c-22.6 0-39.3 0.4-40.2 1-1.3 0.8-1.5 7.2-1.8 45.4-0.3 44.5-0.3 44.5 3 45.1 1.8 0.3 20.5 0.5 41.5 0.3 29.7-0.2 38.5-0.6 39.5-1.6 1-1 1.4-10.2 1.6-41.3 0.2-22 0.1-41-0.2-42.2-0.3-1.2-1.5-3.2-2.6-4.5-2.1-2.2-2.1-2.2-40.8-2.2zm13.1 31.9c1.5 1.5 2.1 20.8 0.8 25.8-1.3 4.6-2.1 5.1-10.2 6-8.1 0.8-14.7-0.4-17.5-3.2-2.2-2.3-2.4-3.1-2.4-13.8 0-13 0.9-15.2 7-16.7 7.1-1.6 19.8-0.6 22.3 1.9zm112.7-69.8c7.8-0.1 10.1 0.3 12.8 1.9 4.3 2.6 5.2 5.4 5.2 15.6 0 14.6-3 18.4-15.4 19.2-14.9 0.9-17.6-2.1-17.6-19.3 0-10.6 1.3-15.6 4.2-16.8 0.7-0.3 5.6-0.6 10.8-0.6zm1044.8 100.9c10.8 0 20.3 0.4 21 0.9 1.1 0.6 1.3 9.9 1 47.4-0.2 30.8 0 46.6 0.7 46.4 0.6-0.2 2.4-2.8 4-5.8 2.2-3.8 5.5-7.4 11.2-12 13-10.4 25.9-15.7 43.5-18.1 15-2 36 1.7 50.7 8.9 15 7.4 29.4 25 34.5 42.2 2.5 8.5 3.5 27.9 4.1 80.3 0.5 47.6 0.5 48.7-1.4 49.8-2.1 1.1-36.8 1.5-39.5 0.4-1.4-0.5-1.6-6.1-1.6-51.8 0-57-0.3-59.6-6.5-72.3-8.5-17.2-28.9-25.7-54.3-22.4-16.8 2.1-30.8 12.3-38.2 27.5-6.6 13.7-6.8 14.8-7.4 68.1-0.5 40.3-0.9 48.2-2.1 49.4-1.2 1.2-5.1 1.5-20.7 1.6-19.3 0-19.3 0-20-4-1.2-6.6-1-232.3 0.2-234.6 1-1.8 2.3-1.9 20.8-1.9zm-691.2 6.2c0.5 0.7 0.9 40.3 0.9 88 0 47.8 0.3 86.8 0.7 86.8 0.4 0 1.5-1.4 2.4-3.2 0.9-1.7 5.5-7.7 10.3-13.2 4.7-5.6 15-18.1 22.8-27.8 7.8-9.8 20.2-24.8 27.5-33.5 7.4-8.7 18.3-21.9 24.3-29.3 18.6-22.9 39.5-48 48.9-58.8 9-10.2 9-10.2 30.3-10.2 17.9 0 21.5 0.2 21.9 1.5 0.4 0.9-2.7 5.3-8.3 11.7-5 5.7-13.2 15.7-18.3 22.3-9.6 12.3-44.6 54.2-50.7 60.6-3.4 3.5-3.4 3.5 2.3 13 3.1 5.2 11.4 18.2 18.4 28.9 25 38.3 30.1 46.3 41.2 64 17.5 27.9 17.8 28.4 17.8 30.7 0 2.3 0 2.3-22.3 2.3-21.9 0-22.4 0-24.4-2.3-3.6-4-14.6-20.1-25.3-37.3-26.1-41.6-36-57.1-37.7-59.3-1.9-2.4-1.9-2.4-7.9 5.4-15.8 20.8-61.4 75.7-74.1 89.1-3.8 4.1-3.8 4.1-13.8 4.6-16.6 0.8-26.5 0.5-27.4-1-1.5-2.5-2.1-38.3-2.1-134.7 0-74.2 0.3-97.4 1.2-98.3 1.7-1.7 40.2-1.7 41.4 0zm327.1 62.3c14.1 7.2 30.7 21.6 35.7 31.2 0.9 1.8 2 3.3 2.5 3.3 0.4 0 1.1-6 1.5-13.3 0.7-14.2 2-24.5 3.4-25.9 0.4-0.4 9.8-1.1 20.8-1.4 15.9-0.5 20.2-0.3 21.6 0.7 1.9 1.5 1.9 1.6-6.7 75.3-1.3 11.1-1.4 15.6-0.6 22 0.6 4.5 2.7 22.5 4.6 40.1 1.9 17.6 3.7 33.1 3.9 34.5 0.3 1.4 0.2 3.1-0.2 3.7-0.8 1.3-33.2 2.9-38.7 1.9-2.9-0.6-3.9-1.4-5-4.1-1.5-3.4-3.5-21-3.5-30.2 0-2.8-0.4-5.4-0.9-5.8-0.5-0.3-2.6 1.9-4.6 4.9-3.8 5.7-15.5 17.4-22.7 22.7-5.7 4.1-18.1 10.3-28.1 14-16.9 6.3-39.7 6.3-54.3 0-8.2-3.5-22.8-11.7-29.6-16.7-13.3-9.8-23-25.9-29.5-49.4-2.4-8.3-2.7-11.3-2.7-24 0.1-11.6 0.5-16.2 2.3-23.3 9.5-37.5 35.1-62.4 70.9-69.2 18.4-3.5 42.1 0.1 59.9 9zm-42.2 24.1c-10.4 1.6-14 2.8-20.9 7.5-9.1 6.1-13.6 10.9-18 19.6-7.1 14.2-9.2 26.1-7.1 40.8 1.7 12.3 3.3 16.9 9 26.1 7.6 12.1 15.1 17.8 31 23.4 7.8 2.8 9.9 3.1 16 2.7 8.8-0.7 25.9-6.2 34.5-11.3 12.9-7.5 26.7-23.4 35.1-40.6 3.2-6.6 3.2-6.6 1.4-13.3-2-7.6-9.7-20.8-16.9-29-9.2-10.6-27-22-38.1-24.3-5.9-1.2-21.7-2.2-26-1.6zm-73.6 50.4c-0.5 0-0.7 0.4-0.4 1 0.3 0.5 0.8 1 1.1 1 0.2 0 0.4-0.5 0.4-1 0-0.6-0.5-1-1.1-1zm0.7 11c-0.3 0-0.8 0.4-1.1 1-0.3 0.5-0.1 1 0.4 1 0.6 0 1.1-0.5 1.1-1 0-0.6-0.2-1-0.4-1zm348.3-93.5c17.5 3 27.7 6.1 39.1 12.2 10.6 5.6 17.9 11.1 23.2 17.7 5.6 6.9 11 18.7 11.2 24.4 0.1 4.1-0.2 4.6-2.4 5.3-4.5 1.3-34.3 1-37-0.4-1.4-0.7-3.9-3.5-5.7-6.2-5.4-8.5-8.3-11.4-14.7-15-9.7-5.4-26.3-8.6-44.1-8.6-12.9 0-28.5 3.4-34.5 7.6-12.8 8.8-11.1 21 3.8 27.7 5.5 2.5 8.5 3.1 19.1 3.9 14.4 1 21.3 1.7 29.1 2.9 3 0.5 13.4 1.9 23 3 20 2.3 32.9 5.4 42.9 10.5 9.4 4.7 13.2 8.2 17.5 16.4 4.9 9.5 7 18.6 6.2 28.6-1.8 26.8-18.7 42.5-56.1 52.2-10.7 2.7-11.7 2.8-36.5 2.8-26.8 0-28.7-0.3-49.5-6.4-6.4-1.9-20.4-8.3-27.9-12.9-14.5-8.7-24.5-22.7-25.8-36.2-0.4-4.8-0.3-7.9 0.4-8.7 0.8-1 5.7-1.3 19.4-1.3 20.7 0 17.5-1.5 26.8 12.5 4.7 7.1 13.6 12.8 26.8 17 9.7 3.1 12.4 3.6 25.6 4.1 20.3 0.9 31.2-0.5 40.8-5.1 9.7-4.7 12.7-8.8 13.2-18.6 0.4-6.5 0.3-7-2.5-9.8-3.6-3.6-13.2-6.7-23.4-7.6-4.1-0.4-12.6-1.5-19-2.6-6.4-1-15.4-1.9-20-1.9-15.2-0.1-27.4-1.8-39.7-5.6-22.8-7.1-33.2-14.6-40.5-29.2-4.2-8.5-4.2-8.5-4.2-20.2 0-11.2 0.1-11.8 3.4-18.3 8.8-17.3 31-30.6 56.1-33.7 5.2-0.6 11.3-1.5 13.5-2 8.6-1.7 27.3-1.1 42.4 1.5zm353.9 2.3c5.4 0.2 6.4 0.5 7.2 2.4 0.5 1.3 8.1 18.3 16.9 37.8 14.7 32.9 42.1 94.6 44.1 99.7 1.4 3.4 2.5 2.8 4-1.9 0.7-2.4 3.4-8.6 6-13.8 2.6-5.2 10.2-21.4 16.8-36 33.7-74 38.7-84.5 41.8-87.1 1.3-1 5.9-1.3 21.3-1 10.8 0.1 20 0.6 20.4 1 0.4 0.4-3 8.6-7.6 18.2-4.7 9.6-15 30.9-22.9 47.4-8 16.5-16.7 34.5-19.3 40-26.6 55.2-41.8 86.2-45.4 92.4-5.1 8.6-15.3 19.4-23.1 24.3-7.6 4.8-17.3 8.5-26.1 9.9-11.2 1.7-30.3 0.5-41.4-2.7-11.1-3.3-22-8.6-23.6-11.6-0.8-1.4-1.4-8-1.7-16.1-0.4-13.5-0.4-13.7 1.7-13.7 1.2 0 5.2 1.5 8.9 3.4 14.6 7.3 18.1 8.1 35.7 8.1 15.7 0 16.1-0.1 22-2.9 6.7-3.3 13.9-10.1 17.9-17 4.4-7.5 4-7.8-7.6-9.1-5.8-0.6-5.8-0.6-9.9-9.3-2.3-4.8-6.3-13.4-8.9-19.2-2.6-5.8-10.8-23.1-18.2-38.5-33.8-70-48.8-102-48.8-103.9 0-0.3 2.4-0.6 5.3-0.8 6.1-0.3 25.4-0.4 34.5 0zm-13.4 209.2c-0.2 0-0.4 0.4-0.4 1 0 0.5 0.5 1 1.1 1 0.5 0 0.7-0.5 0.4-1-0.3-0.6-0.8-1-1.1-1zm-1443.3-175c11 0 12 0.2 14.6 2.4 2.7 2.3 2.8 2.9 3.1 12.3 0.4 11.8-0.6 14.9-5.3 16.8-4.1 1.8-21.6 2-24.7 0.4-2.7-1.5-5.8-8.5-5.8-13.6 0-6.7 2-14.6 4.2-16.6 1.7-1.4 4-1.7 13.9-1.7zm0.7 11.5c-0.3-0.3-0.9 0.2-1.2 1.2-0.6 1.4-0.5 1.5 0.5 0.6 0.7-0.7 1-1.5 0.7-1.8zm63.9-11.2c12.8 0.3 12.8 0.3 12.8 16.2 0 15.5 0 15.5-11.6 16.2-16.1 0.9-20.3-2.7-19.6-17.2 0.4-9.7 2.1-13.7 6.2-14.7 1.7-0.3 7.1-0.6 12.2-0.5zm0 63.1c64.2 0.4 69.4 0.6 72.2 2.2 1.7 1 3.5 3.1 4.1 4.7 0.6 2 1 28.2 1 74.9 0 77.8 0.1 75.6-5.5 80.8-2.7 2.5-2.7 2.5-73.1 2.8-78.8 0.3-74.1 0.7-79.2-7-2.7-4.2-2.7-4.2-3-74.7-0.2-48.6 0-71.8 0.8-74.3 1.1-4 5.3-7.6 10.4-8.9 1.7-0.5 34.2-0.7 72.3-0.5zm-2.1 37.6c-34 0-38.6 0.2-40.1 1.6-1.4 1.5-1.6 6.1-1.3 43.5 0.2 32.7 0.6 42.1 1.6 43.1 1 1 9.6 1.3 40.2 1.3 44.4 0 41.8 0.5 43.1-8.7 0.4-2.9 0.8-21 0.8-40.1 0.1-34.9 0.1-34.9-2.8-37.8-2.9-2.9-2.9-2.9-41.5-2.9zm360.3 97.9c10 1 10.3 1.5 9.9 15.9-0.3 9.6-0.6 11.6-2.1 12.7-2.3 1.7-16.9 2.9-23.6 2-7.8-1.1-9.1-3.3-9.1-15.6 0-12.2 0.8-14.6 5.2-15.2 5.5-0.7 11.9-0.6 19.7 0.2zm-218.3 1.2c1 1.7 1.8 19.1 1 23.2-0.9 4.8-5 6.2-17.9 6.2-13.4 0-13.7-0.4-13.7-16.4q0-11.7 1.2-12.9c1.6-1.6 28.4-1.7 29.4-0.1z"/>
	</g>
</svg>
    </div>  
<form
onSubmit={handleSubmit}
className="bg-gray-800 border border-gray-600 w-full max-w-md p-8 rounded-lg shadow-2xl space-y-6 flex flex-col items-center justify-center transition-all duration-300 hover:shadow-[0_0_30px_5px_rgb(112,255,189)] hover:border-[rgb(112,255,189)] hover:animate-pulseCard"
>
<h2 className="text-3xl font-bold text-center text-gray-100">Acesse sua conta</h2>
          {message && (
<div className={`${messageColor} text-sm w-full text-center break-words`}>
              {message}
</div>
          )}
          {/* Campo de Email */}
<div className="relative w-full">
<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
<Mail className="text-gray-400 h-5 w-5" />
</div>
<input
type="email"
id="email"
value={email}
onChange={(e) => setEmail(e.target.value)}
className="pl-10 pr-4 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-100 rounded-lg w-full placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[rgb(112,255,189)] focus:border-transparent"
placeholder="Digite seu Email..."
required
              autoComplete="email"
            />
</div>
          {/* Campo de Senha */}
<div className="relative w-full">
<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
<LockKeyhole className="text-gray-400 h-5 w-5" />
</div>
<input
type="password"
id="password"
value={password}
onChange={(e) => setPassword(e.target.value)}
className="pl-10 pr-4 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-100 rounded-lg w-full placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[rgb(112,255,189)] focus:border-transparent"
placeholder="Digite sua Senha..."
required
              autoComplete="current-password"
            />
</div>
          {/* Botão de Entrar */}
<button
type="submit"
disabled={loading}
className={`bg-[rgb(112,255,189)] hover:bg-[rgb(90,230,160)] text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors w-full ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
>
            {loading ? "Carregando..." : "Entrar"}
</button>
          {/* Separador "OU" */}
<div className="flex items-center w-full">
<hr className="flex-grow border-t border-gray-600" />
<span className="px-3 text-gray-400 text-xs">OU</span>
<hr className="flex-grow border-t border-gray-600" />
</div>
          {/* Botão de Login com Google */}
<button
type="button"
onClick={handleGoogleLogin}
className="bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-100 p-3 rounded-lg transition-colors flex items-center justify-center w-full"
>
<img
src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
alt="Google Logo"
className="h-5 w-5 mr-2"
            />
            Entrar com Google
</button>
          {/* Link para Cadastro */}
<p className="text-sm text-center text-gray-400 mt-4">
            Não tem uma conta?{" "}
<Link
to="/register"
className="text-[rgb(112,255,189)] hover:text-[rgb(90,230,160)] hover:underline font-medium"
>
              Cadastre-se
</Link>
</p>
</form>

{/* Modal de seleção de loja */}
{showStoreModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" tabIndex={-1}>
    <div className="bg-gradient-to-br from-[#23272F] via-[#24292D]/95 to-[#1EC2A6]/10 rounded-2xl border border-teal-400/30 shadow-2xl w-full max-w-md p-8 text-white animate-modalIn relative">
      <button
        className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl transition-colors"
        onClick={() => { setShowStoreModal(false); setLoading(false); setPendingLogin(null); }}
        aria-label="Fechar"
      >×</button>
      <h3 className="text-2xl font-bold mb-2 text-center">Selecione sua Loja</h3>
      <p className="text-gray-400 text-center mb-6 text-sm">Escolha a loja para acessar o painel de gestão.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {stores.map(store => (
          <button
            key={store._id}
            type="button"
            onClick={() =>
              setSelectedStore(selectedStore === store.name ? "" : store.name)
            }
            className={`flex items-center gap-3 w-full p-4 rounded-xl border transition-all duration-200
              ${selectedStore === store.name
                ? "border-teal-400 bg-teal-500/10 shadow-lg scale-105"
                : "border-gray-700 bg-[#23272F] hover:border-teal-400 hover:bg-teal-500/5"}
            `}
          >
            <span className=" w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400 font-bold text-lg">
              {store.name.charAt(0).toUpperCase()}
            </span>
            <span className="flex-1 text-left font-medium">{store.name}</span>
            {selectedStore === store.name && (
              <span className="ml-2 text-teal-400 font-bold">✓</span>
            )}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          className="flex-1 py-2 rounded-lg bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-semibold transition-all duration-200 hover:scale-105"
          onClick={() => { setShowStoreModal(false); setLoading(false); setPendingLogin(null); }}
        >
          Cancelar
        </button>
        <button
          className="flex-1 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-600 hover:to-teal-500 text-white font-semibold transition-all duration-200 hover:scale-105 shadow-lg"
          onClick={handleStoreConfirm}
        >
          Confirmar
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-4 text-center">Ou continue sem selecionar uma loja.</p>
    </div>
  </div>
)}
</div>
</div>
  );
};
export default Login;