import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LockKeyhole, Mail, Eye, EyeOff, User, FileText } from "lucide-react";
const Register = () => {
  const [email, setEmail] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [username, setName] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [cnpjError, setCnpjError] = useState("");
  const navigate = useNavigate();

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCnpj(value);
    if (!/^\d{14}$/.test(value)) {
      setCnpjError("CNPJ inválido. Deve conter 14 dígitos.");
    } else {
      setCnpjError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    if (password !== confirmPassword) {
      setMessage("As senhas não coincidem.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          cnpj,
          username,
          password,
          token,
        }),
      });
      if (response.ok) {
        setMessage("Usuário cadastrado com sucesso!");
        setEmail("");
        setCnpj("");
        setName("");
        setToken("");
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
  const messageColor = message.includes("sucesso") ? "text-green-400" : "text-red-400";
  return (
    <div className="bg-[rgb(17,40,54)] flex justify-center items-center min-h-screen p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 border border-gray-600 w-full max-w-md p-8 rounded-lg shadow-2xl space-y-6 flex flex-col items-center justify-center transition-all duration-300 hover:shadow-[0_0_30px_5px_rgb(112,255,189)] hover:border-[rgb(112,255,189)] hover:animate-pulseCard"
      >
        <h2 className="text-3xl font-bold text-center text-gray-100">Crie sua conta</h2>
        {message && (
          <div className={`${messageColor} text-sm w-full text-center break-words`}>
            {message}
          </div>
        )}



        {/* Nome */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <User className="text-gray-400 h-5 w-5" />
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setName(e.target.value)}
            className="pl-10 pr-4 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-100 rounded-lg w-full placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[rgb(112,255,189)]"
            placeholder="Digite seu nome..."
            required
          />
        </div>
        {/* Email */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Mail className="text-gray-400 h-5 w-5" />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10 pr-4 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-100 rounded-lg w-full placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[rgb(112,255,189)]"
            placeholder="Digite seu Email..."
            required
          />
        </div>
        {/* CNPJ */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={cnpj}
            onChange={handleCnpjChange}
            className={`w-full pl-10 pr-4 py-2 text-gray-100 placeholder-gray-400 bg-gray-700 border rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 ${cnpjError
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-600 focus:ring-[rgb(112,255,189)]"
              }`}
            placeholder="Digite seu CNPJ..."
            required
          />
        </div>

        {/* Mensagem de erro */}
        {cnpjError && (
          <p className="absolute bottom mt-5 text-xs text-red-500">
            {cnpjError}
          </p>
        )}


        {/* Senha */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <LockKeyhole className="text-gray-400 h-5 w-5" />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10 pr-10 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-100 rounded-lg w-full placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[rgb(112,255,189)]"
            placeholder="Digite sua senha..."
            required
          />
          <div
            className="absolute inset-y-0 right-3 flex items-center cursor-pointer"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="text-gray-400 h-5 w-5" />
            ) : (
              <Eye className="text-gray-400 h-5 w-5" />
            )}
          </div>
        </div>
        {/* Confirmar Senha */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <LockKeyhole className="text-gray-400 h-5 w-5" />
          </div>
          <input
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="pl-10 pr-10 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-100 rounded-lg w-full placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[rgb(112,255,189)]"
            placeholder="Confirme sua senha..."
            required
          />
          <div
            className="absolute inset-y-0 right-3 flex items-center cursor-pointer"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? (
              <EyeOff className="text-gray-400 h-5 w-5" />
            ) : (
              <Eye className="text-gray-400 h-5 w-5" />
            )}
          </div>
        </div>

        {/* Botão de Cadastrar */}
        <button
          type="submit"
          disabled={loading}
          className={`bg-[rgb(112,255,189)] hover:bg-[rgb(90,230,160)] text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors w-full ${loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
        >
          {loading ? "Carregando..." : "Cadastrar"}
        </button>
        {/* Link para login */}
        <p className="text-sm text-center text-gray-400 mt-4">
          Já tem uma conta?{" "}
          <Link
            to="/"
            className="text-[rgb(112,255,189)] hover:text-[rgb(90,230,160)] hover:underline font-medium"
          >
            Faça Login
          </Link>
        </p>
      </form>
    </div>
  );
};
export default Register;