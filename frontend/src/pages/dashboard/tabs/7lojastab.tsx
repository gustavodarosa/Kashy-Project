import { useEffect, useState } from "react";
import { Store as StoreIcon, UserPlus, Edit, Trash2, Users, Loader2 } from "lucide-react";

// Types
type Store = {
  _id: string;
  name: string;
  owner?: string;
  collaborators?: string[];
  createdAt?: string;
};

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  borderColor?: string;
};

function Modal({ open, title, onClose, children, borderColor = "border-teal-400/30" }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className={`bg-[#23272F] rounded-2xl ${borderColor} border shadow-2xl w-full max-w-xs p-8 text-white relative`}>
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl"
          onClick={onClose}
          aria-label="Fechar"
        >×</button>
        <h3 className="text-xl font-bold mb-4 text-center">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function StoreCard({
  store,
  onEdit,
  onDelete,
  onAddColab,
  onRemoveColab,
}: {
  store: Store;
  onEdit: (store: Store) => void;
  onDelete: (id: string) => void;
  onAddColab: (id: string) => void;
  onRemoveColab: (storeId: string, colabId: string) => void;
}) {
  return (
    <div className="relative group bg-[#23272F]/90 border border-teal-400/20 rounded-2xl p-6 flex flex-col shadow-xl hover:shadow-2xl hover:border-teal-400/50 transition-all duration-200">
      <div className="flex items-center gap-3 mb-2">
        <StoreIcon size={28} className="text-teal-400" />
        <span className="text-xl font-semibold text-teal-200 truncate">{store.name}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
        <span>Criada em: {store.createdAt ? new Date(store.createdAt).toLocaleDateString("pt-BR") : "N/A"}</span>
        {store.collaborators && store.collaborators.length > 0 && (
          <>
            <span className="mx-1">•</span>
            <Users size={14} className="inline text-emerald-400" />{" "}
            <span>{store.collaborators.length} colaborador{store.collaborators.length > 1 ? "es" : ""}</span>
          </>
        )}
      </div>
      <div className="flex gap-2 mt-auto">
        <button
          className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-gradient-to-r from-blue-600/30 to-blue-400/20 hover:from-blue-500 hover:to-blue-400 text-blue-200 rounded-lg border border-blue-400/30 hover:border-blue-400/60 font-medium transition-all duration-200 hover:scale-105 text-xs shadow"
          onClick={() => onEdit(store)}
        >
          <Edit size={14} /> Editar
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-gradient-to-r from-emerald-600/30 to-emerald-400/20 hover:from-emerald-500 hover:to-emerald-400 text-emerald-200 rounded-lg border border-emerald-400/30 hover:border-emerald-400/60 font-medium transition-all duration-200 hover:scale-105 text-xs shadow"
          onClick={() => onAddColab(store._id)}
        >
          <UserPlus size={14} /> Colaborador
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-gradient-to-r from-red-600/30 to-red-400/20 hover:from-red-500 hover:to-red-400 text-red-300 rounded-lg border border-red-400/30 hover:border-red-400/60 font-medium transition-all duration-200 hover:scale-105 text-xs shadow"
          onClick={() => onDelete(store._id)}
        >
          <Trash2 size={14} /> Excluir
        </button>
      </div>
    </div>
  );
}

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
  const [showRemoveColabModal, setShowRemoveColabModal] = useState(false);
  const [colabToRemove, setColabToRemove] = useState<{ storeId: string, collaboratorId: string } | null>(null);
  const [removeColabError, setRemoveColabError] = useState<string | null>(null);

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

  const handleAddColab = async (e: React.FormEvent) => {
    e.preventDefault();
    setColabError(null);
    setColabSuccess(null);
    if (!colabEmail || !colabStoreId) {
      setColabError("Preencha o email do funcionário.");
      return;
    }

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
      const user = await userRes.json(); 

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

  const handleOpenRemoveColab = (storeId: string, collaboratorId: string) => {
    setColabToRemove({ storeId, collaboratorId });
    setRemoveColabError(null);
    setShowRemoveColabModal(true);
  };

  const handleRemoveColab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colabToRemove) return;
    setRemoveColabError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3000/api/stores/remove-collaborator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(colabToRemove),
      });
      if (!res.ok) throw new Error("Erro ao remover colaborador.");
      setStores(prev =>
        prev.map(store =>
          store._id === colabToRemove.storeId
            ? { ...store, collaborators: (store.collaborators || []).filter(id => id !== colabToRemove.collaboratorId) }
            : store
        )
      );
      setShowRemoveColabModal(false);
      setColabToRemove(null);
    } catch (err: any) {
      setRemoveColabError(err.message || "Erro ao remover colaborador.");
    }
  };

  return (
    <div className="bg-gradient-to-br from-[#1E2328] via-[#24292D] to-[#2B3036] min-h-screen text-white py-10 px-2">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <StoreIcon size={32} className="text-teal-400" />
            <h1 className="text-3xl font-bold tracking-tight">Minhas Lojas</h1>
          </div>
          <button
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-400 hover:from-teal-500 hover:to-teal-300 text-white font-semibold shadow-lg transition-all duration-200 hover:scale-105 border border-teal-400/40"
            onClick={() => setShowCreateModal(true)}
          >
            <UserPlus size={18} /> Nova Loja
          </button>
        </div>

        {/* Error/Loading */}
        {error && (
          <div className="mb-4 text-red-400 bg-red-900/30 rounded-lg px-4 py-2 text-center">{error}</div>
        )}
        {loading ? (
          <div className="flex flex-col items-center py-16 text-gray-300">
            <Loader2 className="animate-spin mb-2" size={32} />
            Carregando lojas...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {stores.map((store) => (
              <StoreCard
                key={store._id}
                store={store}
                onEdit={handleEditStore}
                onDelete={handleDeleteStore}
                onAddColab={handleOpenAddColab}
                onRemoveColab={handleOpenRemoveColab}
              />
            ))}
            {stores.length === 0 && (
              <div className="col-span-full text-gray-400 text-center py-12 text-lg">Nenhuma loja cadastrada.</div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal open={showCreateModal} title="Cadastrar Nova Loja" onClose={() => setShowCreateModal(false)}>
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
      </Modal>

      <Modal open={showEditModal} title="Editar Loja" onClose={() => setShowEditModal(false)} borderColor="border-blue-400/30">
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
      </Modal>

      <Modal open={showDeleteModal} title="Excluir Loja" onClose={() => setShowDeleteModal(false)} borderColor="border-red-400/30">
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
      </Modal>

      <Modal open={showAddColabModal} title="Editar Colaboradores" onClose={() => setShowAddColabModal(false)} borderColor="border-emerald-400/30">
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

          {/* Lista de colaboradores da loja selecionada */}
          {colabStoreId && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-emerald-300 mb-2">Colaboradores atuais</h4>
              <div className="flex flex-wrap gap-2">
                {(stores.find(s => s._id === colabStoreId)?.collaborators || []).length === 0 && (
                  <span className="text-xs text-gray-400">Nenhum colaborador adicionado.</span>
                )}
                {(stores.find(s => s._id === colabStoreId)?.collaborators || []).map(colabId => (
                  <span key={colabId} className="flex items-center gap-1 bg-emerald-900/30 px-2 py-1 rounded text-xs text-emerald-200">
                    {colabId}
                    <button
                      className="ml-1 text-red-400 hover:text-red-200"
                      title="Remover colaborador"
                      type="button"
                      onClick={() => handleOpenRemoveColab(colabStoreId, colabId)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </form>
      </Modal>

      <Modal open={showRemoveColabModal && !!colabToRemove} title="Remover Funcionário" onClose={() => setShowRemoveColabModal(false)} borderColor="border-red-400/30">
        <p className="mb-6 text-center text-gray-300">Tem certeza que deseja remover este colaborador?</p>
        <form onSubmit={handleRemoveColab}>
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-400 text-white font-semibold"
          >
            Remover
          </button>
          {removeColabError && <div className="mt-2 text-red-400">{removeColabError}</div>}
        </form>
      </Modal>
    </div>
  );
}