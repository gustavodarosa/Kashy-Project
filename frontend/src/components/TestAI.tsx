import { useState } from "react";

export function TestAI() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testAI = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      console.log("Enviando prompt para IA:", prompt);

      const res = await fetch("http://localhost:3000/api/reports/generate-ai-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      console.log("Resposta do servidor:", res);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Erro do servidor:", errorText);
        throw new Error("Erro ao gerar resposta da IA.");
      }

      const data = await res.json();
      console.log("Dados recebidos da IA:", data);

      setResponse(data.insights);
    } catch (err) {
      console.error("Erro ao testar IA:", err);
      setError("Erro ao testar IA. Verifique os logs para mais detalhes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h2 className="text-2xl font-bold mb-6">Teste de Integração com IA</h2>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Digite o prompt para a IA"
        className="w-full p-3 rounded bg-gray-700 border border-gray-600 mb-4"
        rows={4}
      />
      <button
        onClick={testAI}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
        disabled={loading}
      >
        {loading ? "Testando..." : "Testar IA"}
      </button>

      {error && <p className="text-red-500 mt-4">{error}</p>}
      {response && (
        <div className="mt-4 p-4 bg-gray-800 rounded">
          <h3 className="text-lg font-bold">Resposta da IA:</h3>
          <pre className="whitespace-pre-wrap">{response}</pre>
        </div>
      )}
    </div>
  );
}