import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LockKeyhole, Mail, Eye, EyeOff, User } from "lucide-react";

const Register = () => {
  const [username, setUsername] = useState(""); 
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }), 
      });

      if (response.ok) {
        setMessage("Usuário cadastrado com sucesso!");
        setUsername(""); 
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setTimeout(() => navigate("/"), 2000);
      } else {
        const errorData = await response.json();
        setMessage(errorData.message || "Erro ao cadastrar usuário.");
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
        <h2 className="text-3xl font-bold text-center">Crie sua conta</h2>

        {message && (
          <div className="text-green-700 text-sm w-4/5 text-center">{message}</div>
        )}

        <div className="relative w-4/5">
          <div className="absolute inset-y-0 pl-1 flex items-center pointer-events-none">
            <User className="text-black h-8 w-8" />
          </div>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-lg w-full"
            placeholder="Digite seu Nome de Usuário..."
            required
          />
        </div>

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
            type={showPassword ? "text" : "password"}
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10 pr-10 py-2 border rounded-lg w-full"
            placeholder="Digite sua Senha..."
            required
          />
          <div
            className="absolute inset-y-0 right-3 flex items-center cursor-pointer"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="text-black h-6 w-6" /> : <Eye className="text-black h-6 w-6" />}
          </div>
        </div>

        <div className="relative w-4/5">
          <div className="absolute inset-y-0 pl-1 flex items-center pointer-events-none">
            <LockKeyhole className="text-black h-8 w-8" />
          </div>
          <input
            type={showConfirmPassword ? "text" : "password"}
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="pl-10 pr-10 py-2 border rounded-lg w-full"
            placeholder="Confirme sua Senha..."
            required
          />
          <div
            className="absolute inset-y-0 right-3 flex items-center cursor-pointer"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? <EyeOff className="text-black h-6 w-6" /> : <Eye className="text-black h-6 w-6" />}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`bg-amber-600 hover:bg-amber-500 text-white hover:text-black font-medium py-2 px-4 rounded-lg transition-colors w-2/5 ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {loading ? "Carregando..." : "Cadastrar"}
        </button>

        <p className="text-sm text-center mt-4">
          Já tem uma conta?{" "}
          <Link to="/" className="text-amber-800 hover:underline">
            Faça Login
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Register;