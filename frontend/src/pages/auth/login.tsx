import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom"; // Import useNavigate
import { LockKeyhole, Mail, Eye, EyeOff } from "lucide-react"; // Import Eye icons

// Consider moving token renewal logic to a higher-level component (e.g., App.tsx or a layout)
// or an authentication context/service, as it typically runs globally for authenticated users.
const renewToken = async () => {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    // Consider extracting API URLs into constants
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
      console.log("Token renewed successfully.");
    } else {
      // Handle token renewal failure (e.g., redirect to login if refresh fails)
      console.error("Erro ao renovar o token. Status:", response.status);
      // Optionally clear token and redirect to login here if refresh fails
      // localStorage.removeItem("token");
      // navigate('/login'); // Requires navigate function passed or available via context
    }
  } catch (error) {
    console.error("Erro ao conectar ao servidor para renovar o token:", error);
  }
};

// Define expected API response types for better type safety
interface LoginSuccessResponse {
  token: string;
  // Add other fields if your backend *actually* sends them on login
  // username?: string;
  // userId?: string;
  message?: string; // Optional success message from backend
}

interface ErrorResponse {
  message: string; // Expecting backend error response to have a message field
}

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false); // Differentiate message type
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // State for password visibility
  const navigate = useNavigate(); // Hook for navigation

  // Setup token renewal interval
  useEffect(() => {
    // Initial renewal check in case the user is already logged in and revisits the page?
    // renewToken(); // Uncomment if needed, but might be better handled elsewhere

    const interval = setInterval(() => {
      renewToken();
    }, 55 * 60 * 1000); // 55 minutes

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, []); // Empty dependency array ensures this runs only once on mount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      // Always try to parse the JSON response body
      const data: LoginSuccessResponse | ErrorResponse = await response.json();

      if (response.ok) {
        // --- SUCCESS ---
        const successData = data as LoginSuccessResponse;
        setMessage(successData.message || "Login realizado com sucesso!");
        setIsError(false);

        // Store the token received from the backend
        localStorage.setItem("token", successData.token);

        // Store other relevant user info IF the backend sends it
        // if (successData.username) localStorage.setItem("username", successData.username);
        // if (successData.userId) localStorage.setItem("userId", successData.userId);

        // Redirect using useNavigate for client-side routing
        // Change '/dashboard' to your actual dashboard route
        navigate("/DashboardHome");

      } else {
        // --- ERROR ---
        const errorData = data as ErrorResponse;
        // Use the error message from the backend response, or a default
        setMessage(errorData.message || `Erro: ${response.statusText}`);
        setIsError(true);
      }
    } catch (error) {
      console.error("Login request failed:", error);
      // Handle network errors or issues parsing JSON
      setMessage("Erro ao conectar ao servidor ou processar a resposta.");
      setIsError(true);
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

        {/* Display message with appropriate color */}
        {message && (
          <div className={`${isError ? 'text-red-500' : 'text-green-600'} text-sm w-4/5 text-center`}>
            {message}
          </div>
        )}

        {/* Email Input */}
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
            autoComplete="email"
          />
        </div>

        {/* Password Input */}
        <div className="relative w-4/5">
          <div className="absolute inset-y-0 pl-1 flex items-center pointer-events-none">
            <LockKeyhole className="text-black h-8 w-8" />
          </div>
          <input
            type={showPassword ? "text" : "password"} // Toggle type based on state
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10 pr-10 py-2 border rounded-lg w-full" // Added pr-10 for icon space
            placeholder="Digite sua Senha..."
            required
            autoComplete="current-password"
          />
          {/* Password Visibility Toggle Button */}
          <div
            className="absolute inset-y-0 right-3 flex items-center cursor-pointer"
            onClick={() => setShowPassword(!showPassword)} // Toggle state on click
            aria-label={showPassword ? "Hide password" : "Show password"} // Accessibility
          >
            {showPassword ? <EyeOff className="text-black h-6 w-6" /> : <Eye className="text-black h-6 w-6" />}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className={`bg-amber-600 hover:bg-amber-500 text-white hover:text-black font-medium py-2 px-4 rounded-lg transition-colors w-2/5 ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {loading ? "Carregando..." : "Entrar"}
        </button>

        {/* Link to Register Page */}
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
