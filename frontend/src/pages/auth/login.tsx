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
    } else {
      console.error("Erro ao renovar o token.");
    }
  } catch (error) {
    console.error("Erro ao conectar ao servidor para renovar o token.");
  }
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      renewToken();
    }, 55 * 60 * 1000); 

    return () => clearInterval(interval); 
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessage(data.message || "Login realizado com sucesso!");
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.username); 
        localStorage.setItem("userId", data.userId); 
        window.location.href = data.redirectTo || "/";
      } else {
        const errorData = await response.json();
        setMessage(errorData.message || "Erro ao realizar login.");
      }
    } catch (error) {
      setMessage("Erro ao conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-amber-600 flex justify-center items-center h-screen">
      <form
        onSubmit={handleSubmit}
        className="bg-white w-full h-full sm:w-2/7 sm:h-2/3 shadow-md space-y-6 flex flex-col items-center justify-center"
      >
        <h2 className="text-3xl font-bold text-center">Acesse sua conta</h2>

        {message && (
          <div className="text-green-700 text-sm w-4/5 text-center">{message}</div>
        )}

        <div className="relative w-4/5">
          <div className="absolute inset-y-0 pl-1 flex items-center pointer-events-none">
            <Mail className="text-black h-8 w-8" />
          </div>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-lg w-full"
            placeholder="Digite seu Email..."
            required
          />
        </div>

        <div className="relative w-4/5">
          <div className="absolute inset-y-0 pl-1 flex items-center pointer-events-none">
            <LockKeyhole className="text-black h-8 w-8" />
          </div>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-lg w-full"
            placeholder="Digite sua Senha..."
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`bg-amber-600 hover:bg-amber-500 text-white hover:text-black font-medium py-2 px-4 rounded-lg transition-colors w-2/5 ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {loading ? "Carregando..." : "Entrar"}
        </button>

        <p className="text-sm text-center mt-4">
          Não tem uma conta?{" "}
          <Link to="/register" className="text-amber-800 hover:underline">
            Cadastre-se
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Login;