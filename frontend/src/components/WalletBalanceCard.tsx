    // src/components/dashboard/WalletBalanceCard.tsx
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function WalletBalanceCard() {
  const [showBalance, setShowBalance] = useState(true);

  // Dados mockados (você vai substituir pelo hook ou contexto real)
  const balanceBCH = 0.2143;
  const balanceBRL = 612.37;

  return (
    <div className="rounded-2xl shadow-md bg-white">
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-700">Saldo da Carteira</h2>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Toggle balance visibility"
          >
            {showBalance ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-gray-900">
              {showBalance ? `${balanceBCH} BCH` : "•••••"}
            </span>
            <span className="text-sm text-muted-foreground">
              {showBalance ? `≈ R$ ${balanceBRL.toFixed(2)}` : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
