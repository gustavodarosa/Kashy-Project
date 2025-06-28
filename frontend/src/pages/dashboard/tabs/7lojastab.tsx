import { useEffect, useState } from "react";

type Store = {
  _id: string;
  name: string;
  owner?: string;
  collaborators?: string[];
  createdAt?: string;
};

export function LojasTab() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStoreName, setEditStoreName] = useState("");
  const [editStoreId, setEditStoreId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStoreId, setDeleteStoreId] = useState<string | null>(null);
  const [newStoreName, setNewStoreName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showAddColabModal, setShowAddColabModal] = useState(false);
  const [colabEmail, setColabEmail] = useState("");
  const [colabStoreId, setColabStoreId] = useState<string | null>(null);
  const [colabError, setColabError] = useState<string | null>(null);
  const [colabSuccess, setColabSuccess] = useState<string | null>(null);

  const fetchStores = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:3000/api/stores/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Erro ao buscar lojas");
      const data = await response.json();
      setStores(data);
    } catch (err: any) {
      setError(err.message || "Erro ao buscar lojas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:3000/api/stores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newStoreName }),
      });
      if (!response.ok) throw new Error("Erro ao criar loja");
      const store = await response.json();
      setStores((prev) => [...prev, store]);
      setShowCreateModal(false);
      setNewStoreName("");
    } catch (err: any) {
      setError(err.message || "Erro ao criar loja");
    } finally {
      setLoading(false);
    }
  };

  const handleEditStore = (store: Store) => {
    setEditStoreId(store._id);
    setEditStoreName(store.name);
    setShowEditModal(true);
  };

  const handleUpdateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStoreId || !editStoreName) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:3000/api/stores/${editStoreId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: editStoreName }),
      });
      if (!response.ok) throw new Error("Erro ao editar loja");
      const updated = await response.json();
      setStores((prev) => prev.map(s => s._id === editStoreId ? { ...s, name: updated.name } : s));
      setShowEditModal(false);
      setEditStoreId(null);
      setEditStoreName("");
    } catch (err: any) {
      setError(err.message || "Erro ao editar loja");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStore = (storeId: string) => {
    setDeleteStoreId(storeId);
    setShowDeleteModal(true);
  };

  const confirmDeleteStore = async () => {
    if (!deleteStoreId) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:3000/api/stores/${deleteStoreId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Erro ao excluir loja");
      setStores((prev) => prev.filter(s => s._id !== deleteStoreId));
      setShowDeleteModal(false);
      setDeleteStoreId(null);
    } catch (err: any) {
      setError(err.message || "Erro ao excluir loja");
    } finally {
      setLoading(false);
    }
  };

  // Função para abrir modal de colaborador
  const handleOpenAddColab = (storeId: string) => {
    setColabStoreId(storeId);
    setColabEmail("");
    setColabError(null);
    setColabSuccess(null);
    setShowAddColabModal(true);
  };

  // Função para adicionar colaborador
  const handleAddColab = async (e: React.FormEvent) => {
    e.preventDefault();
    setColabError(null);
    setColabSuccess(null);
    if (!colabEmail || !colabStoreId) {
      setColabError("Preencha o email do funcionário.");
      return;
    }
    // Validação extra para espaços
    const emailTrimmed = colabEmail.trim();
    if (!emailTrimmed) {
      setColabError("Preencha o email do funcionário.");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const userRes = await fetch(`http://localhost:3000/api/users/by-email?email=${encodeURIComponent(emailTrimmed)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!userRes.ok) throw new Error("Usuário não encontrado.");
      const user = await userRes.json(); // <-- Adicione esta linha
      // Adicionar colaborador
      const res = await fetch("http://localhost:3000/api/stores/add-collaborator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId: colabStoreId, collaboratorId: user._id }),
      });
      if (!res.ok) throw new Error("Erro ao adicionar colaborador.");
      setColabSuccess("Funcionário adicionado com sucesso!");
      setTimeout(() => setShowAddColabModal(false), 1500);
    } catch (err: any) {
      setColabError(err.message || "Erro ao adicionar colaborador.");
    }
  };

  return (
    <div className="bg-gradient-to-br from-[#1E2328] via-[#24292D] to-[#2B3036] min-h-screen text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Minhas Lojas</h1>
          <button
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-teal-700 to-teal-500 text-white font-semibold"
            onClick={() => setShowCreateModal(true)}
          >
            + Nova Loja
          </button>
        </div>
        {error && (
          <div className="mb-4 text-red-400 bg-red-900/30 rounded-lg px-4 py-2">{error}</div>
        )}
        {loading ? (
          <div className="text-center text-gray-300 py-8">Carregando...</div>
        ) : (
          <ul className="space-y-4">
            {stores.map((store) => (
              <li
                key={store._id}
                className="bg-[#23272F] border border-teal-400/20 rounded-xl p-4 flex justify-between items-center"
              >
                <div>
                  <div className="text-lg font-semibold text-teal-300">{store.name}</div>
                  <div className="text-xs text-gray-400">
                    Criada em: {store.createdAt ? new Date(store.createdAt).toLocaleDateString("pt-BR") : "N/A"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs"
                    onClick={() => handleEditStore(store)}
                  >
                    Editar
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    onClick={() => handleOpenAddColab(store._id)}
                  >
                    Adicionar Funcionário
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs"
                    onClick={() => handleDeleteStore(store._id)}
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
            {stores.length === 0 && (
              <li className="text-gray-400 text-center py-8">Nenhuma loja cadastrada.</li>
            )}
          </ul>
        )}
      </div>

      {/* Modal de cadastro */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#23272F] rounded-2xl border border-teal-400/30 shadow-2xl w-full max-w-xs p-8 text-white relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl"
              onClick={() => setShowCreateModal(false)}
              aria-label="Fechar"
            >×</button>
            <h3 className="text-xl font-bold mb-4 text-center">Cadastrar Nova Loja</h3>
            <form onSubmit={handleCreateStore}>
              <input
                type="text"
                className="w-full p-3 rounded-lg bg-[#23272F] border border-teal-400/20 text-white mb-6"
                placeholder="Nome da loja"
                value={newStoreName}
                onChange={e => setNewStoreName(e.target.value)}
                required
              />
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-gradient-to-r from-teal-500 to-teal-400 text-white font-semibold"
                disabled={loading}
              >
                {loading ? "Cadastrando..." : "Cadastrar"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de edição */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#23272F] rounded-2xl border border-blue-400/30 shadow-2xl w-full max-w-xs p-8 text-white relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl"
              onClick={() => setShowEditModal(false)}
              aria-label="Fechar"
            >×</button>
            <h3 className="text-xl font-bold mb-4 text-center">Editar Loja</h3>
            <form onSubmit={handleUpdateStore}>
              <input
                type="text"
                className="w-full p-3 rounded-lg bg-[#23272F] border border-blue-400/20 text-white mb-6"
                placeholder="Nome da loja"
                value={editStoreName}
                onChange={e => setEditStoreName(e.target.value)}
                required
              />
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-400 text-white font-semibold"
                disabled={loading}
              >
                {loading ? "Salvando..." : "Salvar"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#23272F] rounded-2xl border border-red-400/30 shadow-2xl w-full max-w-xs p-8 text-white relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl"
              onClick={() => setShowDeleteModal(false)}
              aria-label="Fechar"
            >×</button>
            <h3 className="text-xl font-bold mb-4 text-center">Excluir Loja</h3>
            <p className="mb-6 text-center text-gray-300">Tem certeza que deseja excluir esta loja? Esta ação não poderá ser desfeita.</p>
            <div className="flex gap-3">
              <button
                className="flex-1 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-semibold"
                onClick={() => setShowDeleteModal(false)}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                className="flex-1 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-400 text-white font-semibold"
                onClick={confirmDeleteStore}
                disabled={loading}
              >
                {loading ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de adicionar colaborador */}
      {showAddColabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#23272F] rounded-2xl border border-emerald-400/30 shadow-2xl w-full max-w-xs p-8 text-white relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl"
              onClick={() => setShowAddColabModal(false)}
              aria-label="Fechar"
            >×</button>
            <h3 className="text-xl font-bold mb-4 text-center">Adicionar Funcionário</h3>
            <form onSubmit={handleAddColab}>
              <input
                type="email"
                className="w-full p-3 rounded-lg bg-[#23272F] border border-emerald-400/20 text-white mb-6"
                placeholder="Email do funcionário"
                value={colabEmail}
                onChange={e => setColabEmail(e.target.value)}
                required
              />
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-400 text-white font-semibold"
                disabled={loading}
              >
                {loading ? "Adicionando..." : "Adicionar"}
              </button>
              {colabError && <div className="mt-2 text-red-400">{colabError}</div>}
              {colabSuccess && <div className="mt-2 text-green-400">{colabSuccess}</div>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}