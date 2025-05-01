import { useState, useEffect } from 'react';
import { FiEdit, FiTrash2, FiPlus, FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

type User = {
  _id: string;
  email: string;
  role: 'user' | 'merchant';
  isActive: boolean;
  createdAt: string;
};

export function ClientesTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const itemsPerPage = 8;

  const [searchTerm, setSearchTerm] = useState<string>('');

  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    role: 'user' as 'user' | 'merchant',
    isActive: true,
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3000/api/users', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Erro ao buscar usuários');
        }

        const data: User[] = await response.json();

        const filteredUsers = data.filter(user =>
          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.role.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

        setUsers(paginatedUsers);
        setTotalPages(Math.ceil(filteredUsers.length / itemsPerPage));
        setError(null);
      } catch (err) {
        setError('Erro ao carregar usuários');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [currentPage, searchTerm]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = currentUser
        ? `http://localhost:3000/api/users/${currentUser._id}`
        : 'http://localhost:3000/api/users';
      const method = currentUser ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar usuário');
      }

      const updatedUser = await response.json();

      if (currentUser) {
        setUsers(prev => prev.map(u => (u._id === currentUser._id ? updatedUser : u)));
      } else {
        setUsers(prev => [updatedUser, ...prev]);
      }

      resetForm();
    } catch (err) {
      console.error('Erro ao salvar usuário:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      role: 'user',
      isActive: true,
    });
    setCurrentUser(null);
    setIsFormOpen(false);
  };

  const handleEdit = (user: User) => {
    setCurrentUser(user);
    setFormData({
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (userId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:3000/api/users/${userId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Erro ao excluir usuário');
        }

        setUsers(prev => prev.filter(u => u._id !== userId));
      } catch (err) {
        console.error('Erro ao excluir usuário:', err);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="p-6 bg-[var(--color-bg-primary)] text-white min-h-screen">
      <h2 className="text-2xl font-bold mb-6">Dashboard de CRUD Usuários</h2>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="relative w-full md:w-64">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar usuários..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors w-full md:w-auto justify-center"
        >
          <FiPlus /> Novo Usuário
        </button>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">
              {currentUser ? 'Editar Usuário' : 'Adicionar Usuário'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Tipo</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="user">Usuário</option>
                    <option value="merchant">Comerciante</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 rounded bg-[var(--color-bg-tertiary)] border-[var(--color-border)] focus:ring-blue-500"
                  />
                  <label htmlFor="isActive" className="ml-2 text-sm">
                    Ativo
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg border border-[var(--color-border)] hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  {currentUser ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-[var(--color-bg-tertiary)] rounded-lg overflow-hidden border border-[var(--color-border)]">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4">Carregando usuários...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400">
            <p>{error}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>Nenhum usuário encontrado</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--color-divide)]">
                <thead className="bg-gray-750">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tipo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Data de Criação</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--color-bg-tertiary)] divide-y divide-[var(--color-divide)]">
                  {users.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-750 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === 'merchant' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {user.role === 'merchant' ? 'Comerciante' : 'Usuário'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                            title="Editar"
                          >
                            <FiEdit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(user._id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            title="Excluir"
                          >
                            <FiTrash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}