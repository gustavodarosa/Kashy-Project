import {
    Search, ChevronRight, ChevronLeft, LayoutDashboard, ChartNoAxesCombined, ShoppingBasket,
    NotepadText, Wallet, Users, Package, Megaphone, Settings, UserCircle, LogOut, Edit, Bell, X, Pencil // Removido UserPlus
} from 'lucide-react';
 
import { useSidebar } from '../../hooks/usersidebar';
import { useState, useEffect } from 'react';
import { DashboardTab, WalletTab, PedidosTab, ClientesTab, ProdutosTab, RelatoriosTab, OfertasTab, SettingsTab, TransacoesTab } from './tabs';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../context/NotificationContext';
import { AIPredictionsMock } from '../../components/AIPredictionsMock'; // <-- Importação do Mock
 
export function Dashboard() {
    const { isOpen, toggleSidebar } = useSidebar();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [savedImage, setSavedImage] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [email, setEmail] = useState<string | null>(null);
    const [notificationModalOpen, setNotificationModalOpen] = useState(false);
    const { notifications } = useNotification();
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
 
    const navigate = useNavigate();
 
    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        localStorage.removeItem("email");
        localStorage.removeItem("userId");
        navigate('/');
    };
 
    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        const storedEmail = localStorage.getItem('email');
        const userId = localStorage.getItem('userId');
        setUsername(storedUsername);
        setEmail(storedEmail);
 
        if (!userId) {
            console.error('ID do usuário não encontrado no localStorage.');
            // Opcional: Redirecionar para login se o userId não for encontrado
            // navigate('/');
            return;
        }
 
        const fetchUserImage = async () => {
            const userId = localStorage.getItem('userId');
            const token = localStorage.getItem('token');
 
            if (!userId || !token) {
                console.error('Usuário não autenticado ou ID do usuário não encontrado.');
                localStorage.clear();
                navigate('/');
                return;
            }
 
            try {
                const response = await fetch(`http://localhost:3000/api/user/${userId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
 
                if (response.ok) {
                    const data = await response.json();
                    setSavedImage(data.profileImage);
                } else if (response.status === 401) {
                    console.error('Token inválido ou expirado. Redirecionando para login.');
                    localStorage.clear();
                    navigate('/');
                } else {
                    console.error('Erro ao buscar dados do usuário:', response.statusText);
                }
            } catch (error) {
                console.error('Erro ao carregar a imagem do usuário:', error);
            }
        };
 
        fetchUserImage();
    }, [navigate]); // Adicionado navigate às dependências, pois é usado dentro do efeito
 
    const handleSaveImage = async () => {
        if (!selectedImage) return;
 
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Usuário não autenticado.');
            return;
        }
 
        try {
            const response = await fetch('http://localhost:3000/api/update-profile-image', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    profileImage: selectedImage,
                }),
            });
 
            if (response.ok) {
                const data = await response.json();
                setSavedImage(data.profileImage);
                setShowProfileModal(false);
                setSelectedImage(null);
                alert('Imagem salva com sucesso!');
            } else {
                const errorData = await response.json();
                alert(`Erro ao salvar a imagem: ${errorData.message || response.statusText}`);
            }
        } catch (error) {
            console.error('Erro ao salvar a imagem:', error);
            alert('Erro de conexão ao salvar a imagem.');
        }
    };
 
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setSelectedImage(reader.result as string);
            };
            reader.onerror = (error) => {
                console.error("Erro ao ler arquivo:", error);
                alert("Erro ao carregar a imagem.");
            }
            reader.readAsDataURL(file);
        }
    };
 
    useEffect(() => {
        // Verifica se há alguma notificação não lida
        if (notifications.length > 0) {
            // Idealmente, verificar um campo 'read: false'
            setHasUnreadNotifications(true);
        } else {
            setHasUnreadNotifications(false);
        }
    }, [notifications]);
 
    const handleOpenNotificationModal = () => {
        setNotificationModalOpen(true);
        // Marcar notificações como lidas no backend aqui, se necessário
        setHasUnreadNotifications(false);
    };
 
    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
        { id: 'carteira', label: 'Wallet', icon: <Wallet /> },
        { id: 'produtos', label: 'Produtos', icon: <Package /> },
        { id: 'pedidos', label: 'Pedidos', icon: <ShoppingBasket /> },
        { id: 'transacoes', label: 'Transações', icon: <ChartNoAxesCombined /> },
        { id: 'clientes', label: 'Clientes', icon: <Users /> },
        { id: 'relatorios', label: 'Relatórios', icon: <NotepadText /> },
        { id: 'ofertas', label: 'Ofertas', icon: <Megaphone /> },
        { id: 'settings', label: 'Settings', icon: <Settings /> }
    ];
 
    const renderTab = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <>
                        <DashboardTab /> {/* Seu conteúdo original da aba Dashboard */}
                        <div className="mt-6"> {/* Espaçamento antes do mock */}
                           <AIPredictionsMock /> {/* <-- Mock de IA adicionado aqui */}
                        </div>
                    </>
                );
            case 'carteira': return <WalletTab />;
            case 'produtos': return <ProdutosTab />;
            case 'pedidos': return <PedidosTab />;
            case 'transacoes': return <TransacoesTab />;
            case 'clientes': return <ClientesTab />;
            case 'relatorios': return <RelatoriosTab />;
            case 'ofertas': return <OfertasTab />;
            case 'settings': return <SettingsTab />;
            default: return <DashboardTab />; // Fallback
        }
    };
 
    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <div className={`${isOpen ? 'w-36 sm:w-72' : 'w-20 sm:w-24'} bg-[var(--color-bg-primary)] shadow-sm text-white transition-all duration-300 flex-shrink-0 flex flex-col`}>
 
                {/* Header da Sidebar */}
                <div className="flex items-center gap-4 justify-center h-16 px-2 flex-shrink-0">
                    {isOpen ? (
                        <>
                            <h1 className="text-lg ml- sm:ml-17 sm:text-xl font-bold">Menu</h1>
                            <button onClick={toggleSidebar} className="sm:ml-auto flex-shrink-0">
                                <ChevronLeft className="text-white h-7 w-7 sm:h-8 sm:w-8" />
                            </button>
                        </>
                    ) : (
                        <div className="flex justify-center w-full">
                            <button onClick={toggleSidebar} className="flex-shrink-0">
                                <ChevronRight className="text-white h-7 w-7 sm:h-8 sm:w-8" />
                            </button>
                        </div>
                    )}
                </div>
 
                {/* Navegação da Sidebar */}
                <nav className="flex flex-col p-2 sm:p-4 gap-2 overflow-y-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            title={isOpen ? '' : tab.label}
                            className={`py-3 px-2 sm:px-4 border-2 rounded-md flex items-center text-sm
                                       ${isOpen ? 'justify-start gap-3' : 'justify-center'}
                                       ${activeTab === tab.id
                                         ? 'bg-[rgb(112,255,189)] text-black font-semibold border-[rgb(112,255,189)]'
                                         : 'text-white border-transparent hover:bg-[var(--color-bg-tertiary)] hover:border-[rgb(112,255,189)]'
                                       }
                                       transition-colors duration-200`}
                        >
                            <div className="w-5 h-5 sm:w-auto sm:h-auto flex-shrink-0">{tab.icon}</div>
                            {isOpen && <span className="whitespace-nowrap overflow-hidden text-ellipsis">{tab.label}</span>}
                        </button>
                    ))}
                </nav>
 
            </div>
 
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
 
                <header className="bg-[var(--color-bg-primary)] py-3 px-4 sm:px-6 text-white shadow-sm flex items-center justify-between sticky top-0 z-20 gap-4">
 
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-0 max-w-xs sm:max-w-sm md:max-w-xl">
                        <input
                            type="text"
                            id="search"
                            placeholder="Pesquisar..."
                            className="w-full pl-10 pr-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-tertiary)] text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white text-sm sm:text-base"
                        />
                        <Search className='text-white absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 pointer-events-none' />
                    </div>
 
                    {/* Right side icons: Logo, Notifications, User Menu */}
                    <div className="flex items-center gap-3 sm:gap-4">
 
                        {/* Logo */}
                        <img
                            src="/logokashy.svg"
                            alt="Kashy Logo Header"
                            className="h-14 w-36"
                        />
 
                        {/* Ícone de Notificações */}
                        <button
                            onClick={handleOpenNotificationModal}
                            className="relative flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                            title="Notificações"
                        >
                            <Bell className="h-6 w-6 text-white" />
                            {hasUnreadNotifications && (
                                <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[var(--color-bg-tertiary)]"></span>
                            )}
                        </button>
 
                        {/* User Menu */}
                        <div className="relative text-white flex-shrink-0">
                            <button
                                onClick={() => setShowUserDropdown(!showUserDropdown)}
                                className="flex items-center space-x-2 sm:space-x-3 focus:outline-none rounded-full group"
                            >
                                {savedImage ? (
                                    <img
                                        src={savedImage}
                                        alt="User"
                                        className="h-10 w-10 sm:h-12 md:h-14 sm:w-12 md:w-14 rounded-full object-cover border-2 border-transparent group-hover:border-amber-500 transition-colors"
                                    />
                                ) : (
                                    <UserCircle className="h-10 w-10 sm:h-12 md:h-14 sm:w-12 md:w-14 text-gray-400 group-hover:text-amber-500 transition-colors" />
                                )}
                            </button>
 
                            {/* User Dropdown Menu */}
                            {showUserDropdown && (
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowUserDropdown(false)}
                                >
                                    <div
                                        className="absolute right-0 mt-2 w-64 text-white bg-[var(--color-bg-primary)] rounded-md shadow-lg py-1 z-50 border border-[var(--color-border)]"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex justify-end px-2 pt-2">
                                            <button
                                                onClick={() => setShowUserDropdown(false)}
                                                className="text-white border-transparent border-2 hover:border-zinc-600 hover:bg-zinc-700 rounded-full p-2 transition-colors"
                                            >
                                                <X className="h-5 w-5" />
                                            </button>
                                        </div>
                                        <div className="flex flex-col items-center px-4 py-3 border-b border-[var(--color-border)]">
                                            <div
                                                className="relative group cursor-pointer"
                                                onClick={() => {
                                                    setShowProfileModal(true);
                                                    setShowUserDropdown(false);
                                                }}
                                            >
                                                {savedImage ? (
                                                    <img
                                                        src={savedImage}
                                                        alt="User Preview"
                                                        className="h-28 w-28 rounded-full object-cover mb-2 border-2 border-amber-500 group-hover:opacity-50 transition-opacity"
                                                    />
                                                ) : (
                                                    <UserCircle className="h-28 w-28 text-gray-400 mb-2 group-hover:opacity-50 transition-opacity" />
                                                )}
                                                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                    <Pencil
                                                        className="h-8 w-8 text-white"
                                                    />
                                                </div>
                                            </div>
                                            <span className="font-medium text-center mt-2">{username || "Usuário"}</span>
                                            <span className="text-xs text-gray-400">{email || "Conta padrão"}</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setShowProfileModal(true);
                                                setShowUserDropdown(false);
                                            }}
                                            className="flex items-center w-full px-4 py-2 text-sm hover:bg-[var(--color-bg-tertiary)] transition-colors"
                                        >
                                            <Edit className="mr-2 h-4 w-4" />
                                            Editar Perfil
                                        </button>
                                        <button
                                            onClick={() => {
                                                setActiveTab('settings');
                                                setShowUserDropdown(false);
                                            }}
                                            className="flex items-center w-full px-4 py-2 text-sm hover:bg-[var(--color-bg-tertiary)] transition-colors"
                                        >
                                            <Settings className="mr-2 h-4 w-4" />
                                            Configurações
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleOpenNotificationModal();
                                                setShowUserDropdown(false);
                                            }}
                                            className="flex items-center w-full px-4 py-2 text-sm hover:bg-[var(--color-bg-tertiary)] transition-colors"
                                        >
                                            <Bell className="mr-2 h-4 w-4" />
                                            Notificações
                                        </button>
                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center w-full px-4 py-2 text-sm hover:bg-[var(--color-bg-tertiary)] transition-colors text-red-400 hover:text-red-300"
                                        >
                                            <LogOut className="mr-2 h-4 w-4" />
                                            Sair
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>
 
                {/* Main Content */}
                <main className="flex-1 p-4 sm:p-6 bg-[var(--color-bg-secondary)] overflow-y-auto">
                    {renderTab()}
                </main>
            </div>
 
            {/* Profile Edit Modal */}
            {showProfileModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300 p-4"
                    onClick={() => setShowProfileModal(false)}
                >
                    <div
                        className="bg-[var(--color-bg-primary)] text-white border border-[var(--color-border)] p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-100 animate-fade-in-scale"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-2xl font-bold mb-6 text-center text-amber-400">Editar Perfil</h2>
                        <div className="mb-6">
                            <label htmlFor="profileImageInput" className="block text-sm font-medium mb-3 text-gray-300">
                                Selecionar Nova Imagem
                            </label>
                            <input
                                id="profileImageInput"
                                type="file"
                                accept="image/jpeg, image/png, image/webp, image/gif"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                        {selectedImage && (
                            <div className="mb-6 border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-bg-tertiary)]">
                                <p className="text-sm mb-3 text-gray-300">Preview:</p>
                                <div className="flex justify-center items-center flex-col gap-3">
                                    <img
                                        src={selectedImage}
                                        alt="Preview"
                                        className="w-32 h-32 sm:w-36 sm:h-36 object-cover rounded-full border-4 border-amber-500 shadow-lg"
                                    />
                                    <button
                                        onClick={() => setSelectedImage(null)}
                                        className="text-xs text-red-400 hover:text-red-300 hover:underline"
                                    >
                                        Remover Seleção
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="flex flex-col sm:flex-row justify-end gap-4 mt-8">
                            <button
                                onClick={() => {
                                    setShowProfileModal(false);
                                    setSelectedImage(null);
                                }}
                                className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-bg-primary)] focus:ring-red-500 w-full sm:w-auto"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveImage}
                                disabled={!selectedImage}
                                className={`bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-bg-primary)] focus:ring-green-500 ${
                                    !selectedImage ? 'opacity-50 cursor-not-allowed' : ''
                                } w-full sm:w-auto`}
                            >
                                Salvar Imagem
                            </button>
                        </div>
                    </div>
                </div>
            )}
 
            {/* Notification Modal */}
            {notificationModalOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 animate-fade-in"
                    onClick={() => setNotificationModalOpen(false)}
                >
                    <div
                        className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg p-6 w-full max-w-md shadow-xl text-white transform transition-all duration-300 scale-100 animate-fade-in-scale"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-[var(--color-border)]">
                            <h3 className="text-xl font-bold text-white">Histórico de Notificações</h3>
                            <button
                                onClick={() => setNotificationModalOpen(false)}
                                className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-[var(--color-bg-tertiary)] transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
 
                        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                            {notifications.length === 0 ? (
                                <p className="text-gray-400 text-center py-4">Nenhuma notificação encontrada.</p>
                            ) : (
                                notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className="bg-[var(--color-bg-secondary)] p-4 rounded-lg shadow-md border border-transparent hover:border-amber-500 transition-colors"
                                    >
                                        <p className="text-sm text-gray-200 mb-1">{notification.message}</p>
                                        <p className="text-xs text-gray-400">{new Date(notification.timestamp).toLocaleString()}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
 
export default Dashboard;