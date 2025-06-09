import {
    Search, ChevronRight, ChevronLeft, LayoutDashboard, ChartNoAxesCombined, ShoppingBasket,
    NotepadText, Wallet, Users, Package, Megaphone, Settings, UserCircle, LogOut, Edit, UserPlus, Bell, X, Pencil,
    Sun, Moon, Globe
} from 'lucide-react';
import { FiMessageCircle, FiSend, FiX } from "react-icons/fi"; // Import icons for the chatbot
import { useState, useEffect, useMemo } from 'react';
import { DashboardTab, WalletTab, PedidosTab, ClientesTab, ProdutosTab, RelatoriosTab, SettingsTab, TransacoesTab } from './tabs';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../context/NotificationContext'; // Import the Notification type


export function Dashboard() {
    const isOpen = true;

    // Tipos e constantes para categorias de notificação
    type NotificationCategory = "todas" | "transacoes" | "produtos" | "pedidos" | "relatorios";

    const notificationCategoryTabs: Array<{ id: NotificationCategory; label: string }> = [
        { id: "todas", label: "Todas" },
        { id: "transacoes", label: "Transações" },
        { id: "produtos", label: "Produtos" },
        { id: "pedidos", label: "Pedidos" },
        { id: "relatorios", label: "Relatórios" },
    ];

    const [activeNotificationTab, setActiveNotificationTab] = useState<NotificationCategory>("todas");

    const [activeTab, setActiveTab] = useState('dashboard');
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [savedImage, setSavedImage] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [email, setEmail] = useState<string | null>(null);
    const [notificationModalOpen, setNotificationModalOpen] = useState(false);
    const { notifications, clearNotifications, addNotification } = useNotification();
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
    const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('');
    const [emailEditError, setEmailEditError] = useState<string | null>(null);
    const [emailEditSuccess, setEmailEditSuccess] = useState<string | null>(null);
    const [phone, setPhone] = useState<string | null>(null);

    // Chatbot state
    const [isChatbotOpen, setIsChatbotOpen] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [chatMessages, setChatMessages] = useState<{ sender: string; message: string }[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState<{role: "user"|"bot", message: string}[]>([]);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [language, setLanguage] = useState<'pt-BR' | 'en-US'>('pt-BR');

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
    }, []);

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
        const fetchUserData = async () => {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');

            if (!token || !userId) {
                console.error('Usuário não autenticado ou ID do usuário não encontrado.');
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
                    setUsername(data.username);
                    setEmail(data.email);
                    setPhone(data.phone || null);
                } else {
                    console.error('Erro ao buscar dados do usuário:', response.statusText);
                }
            } catch (error) {
                console.error('Erro ao carregar os dados do usuário:', error);
            }
        };

        fetchUserData();
    }, []);

    useEffect(() => {
        if (notifications.length > 0) {
            setHasUnreadNotifications(true);
        }
    }, [notifications]);

    const handleOpenNotificationModal = () => {
        setNotificationModalOpen(true);
        setHasUnreadNotifications(false);
    };

    // Filtra as notificações com base na aba ativa
    // IMPORTANTE: Isso assume que seus objetos de 'notification' (do useNotification hook)
    // possuem uma propriedade 'category' do tipo NotificationCategory.
    // Ex: { id: '1', message: '...', timestamp: '...', category: 'transacoes' }
    // Se não, apenas a aba "Todas" funcionará corretamente, e as outras ficarão vazias.
    // Você precisará adaptar seu NotificationContext para incluir essa propriedade.
    const filteredNotifications = useMemo(() => {
        return notifications.filter(notification => {
            if (activeNotificationTab === "todas") {
                return true;
            }
            // @ts-ignore A propriedade 'category' pode não estar definida no tipo Notification do contexto.
            return notification.category === activeNotificationTab;
        });
    }, [notifications, activeNotificationTab]);
    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;

        const newHistory = [
            ...chatHistory,
            { role: "user" as "user" | "bot", message: chatInput }
        ];
        setChatHistory(newHistory);
        setChatMessages((prev) => [...prev, { sender: "user", message: chatInput }]);
        setChatInput("");
        setIsChatLoading(true);

        try {
            const response = await fetch("http://localhost:3000/api/reports/generate-ai-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: chatInput, history: newHistory }),
            });

            if (!response.ok) {
                throw new Error("Erro ao obter resposta do chatbot.");
            }

            const data = await response.json();
            setChatMessages((prev) => [...prev, { sender: "bot", message: data.insights || "Resposta não disponível." }]);
        } catch (error) {
            console.error("Erro no chatbot:", error);
            setChatMessages((prev) => [...prev, { sender: "bot", message: "Desculpe, ocorreu um erro ao processar sua mensagem." }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    function renderChatMessage(message: string) {
        // Suporte a negrito, itálico, sublinhado, riscado, código, links, alinhamento, parágrafos e quebras de linha
        let html = message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')           // **negrito**
            .replace(/__(.*?)__/g, '<u>$1</u>')                         // __sublinhado__
            .replace(/~~(.*?)~~/g, '<del>$1</del>')                     // ~~riscado~~
            .replace(/`([^`]+)`/g, '<code>$1</code>')                   // `código`
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-blue-400 hover:text-blue-300">$1</a>') // [link](url)
            .replace(/_(.*?)_/g, '<em>$1</em>')                         // _itálico_
            .replace(/\*(.*?)\*\*/g, '<strong>$1</strong>')             // **negrito**
            .replace(/\*(.*?)\*\*/g, '<strong>$1</strong>')             // **negrito**
            .replace(/\*(.*?)\*\*/g, '<strong>$1</strong>')             // **negrito**
            .replace(/\*(.*?)\*/g, '<em>$1</em>');                      // *itálico*

        // Alinhamento: :::center ... :::, :::right ... :::, :::left ... :::
        html = html.replace(/:::center([\s\S]*?):::/g, '<div style="text-align:center;">$1</div>');
        html = html.replace(/:::right([\s\S]*?):::/g, '<div style="text-align:right;">$1</div>');
        html = html.replace(/:::left([\s\S]*?):::/g, '<div style="text-align:left;">$1</div>');

        // Parágrafos e quebras de linha
        html = html
            .replace(/\r\n|\r|\n/g, '<br>') // Quebra de linha simples
            .replace(/(<br>\s*){2,}/g, '</p><p>'); // 2 ou mais quebras de linha viram novo parágrafo

        // Garante que tudo fique dentro de um <p>...</p>
        html = `<p>${html}</p>`;

        return <span dangerouslySetInnerHTML={{ __html: html }} />;
    }

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
        { id: 'carteira', label: 'Carteira', icon: <Wallet /> },
        { id: 'produtos', label: 'Produtos', icon: <Package /> },
        { id: 'pedidos', label: 'Pedidos', icon: <ShoppingBasket /> },
        { id: 'transacoes', label: 'Transações', icon: <ChartNoAxesCombined /> },
        { id: 'clientes', label: 'Clientes', icon: <Users /> },
        { id: 'relatorios', label: 'Relatórios', icon: <NotepadText /> },
        { id: 'settings', label: 'Configurações', icon: <Settings /> }
    ];

    const renderTab = () => {
        switch (activeTab) {
            case 'dashboard': return <DashboardTab />;
            case 'carteira': return <WalletTab />;
            case 'produtos': return <ProdutosTab />;
            case 'pedidos': return <PedidosTab />;
            case 'transacoes': return <TransacoesTab />;
            case 'clientes': return <ClientesTab />;
            case 'relatorios': return <RelatoriosTab />;
            case 'settings': return <SettingsTab />;
            default: return <DashboardTab />;
        }
    };

    // Troca tema
    const toggleTheme = () => {
        setTheme((prev) => {
            const next = prev === 'dark' ? 'light' : 'dark';
            document.documentElement.classList.toggle('dark', next === 'dark');
            return next;
        });
    };

    // Troca idioma
    const toggleLanguage = () => {
        setLanguage((prev) => (prev === 'pt-BR' ? 'en-US' : 'pt-BR'));
    };

    return (
        <div className="flex min-h-screen">
            {/* Sidebar Desktop */}
            <div className="fixed top-0 left-0 h-screen z-30 border-r border-[var(--color-border)] hidden sm:flex w-72 bg-[var(--color-bg-primary)] shadow-sm text-white transition-all duration-300 flex-shrink-0 flex-col">

                <div className="flex items-center gap-4 justify-center h-20 px-2  flex-shrink-0">

                    <div>
                        <img
                            src="/logokashy.svg"
                            alt="Kashy Logo Header"
                            className="h-24 w-auto max-w-[9rem] sm:max-w-[12rem]" // Ajustado para melhor responsividade do logo na sidebar
                        />
                    </div>
                </div>

                {/* Sidebar Navigation */}
                <nav className="flex flex-col p-0 sm:p-0 gap-0 overflow-y-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            title={tab.label}
                            className={`py-5 px-4 flex items-center justify-start gap-6 w-full relative
                                       ${activeTab === tab.id
                                         ? 'bg-gradient-to-r from-[rgb(112,254,192)] to-black text-white font-semibold'
                                         : 'text-white hover:bg-[rgba(112,254,192,0.1)]'
                                       }
                                       transition-colors duration-200`}
                        >
                            <div className="w-5 h-5 sm:w-auto sm:h-auto flex-shrink-0">{tab.icon}</div>
                            <span className="whitespace-nowrap overflow-hidden text-ellipsis">{tab.label}</span>
                            {activeTab === tab.id && (
                                <div className="absolute right-0 top-0 h-full w-1 bg-[rgb(112,254,192)] rounded-l-[10px]"></div>
                            )}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Navbar Area */}
            <div className="flex-1 flex flex-col min-w-0 pb-16 sm:pb-0 sm:ml-72">

                <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] py-3 px-4 sm:px-6 text-white shadow-sm flex items-center justify-between sticky top-0 z-20 gap-4">

                    <div className="relative flex-1 min-w-0 max-w-xs sm:max-w-sm md:max-w-xl">
                        <input
                            type="text"
                            id="search"
                            placeholder="Pesquisar..."
                            className="w-full pl-10 pr-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-tertiary)] text-white focus:outline-none focus:border-[rgb(112,254,192)] focus:ring-1 focus:ring-[rgb(112,254,192)] text-sm sm:text-base"
                        />
                        <Search className='text-white absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 pointer-events-none' />
                    </div>



                    <div className="flex items-center gap-4">
                         {/* Chatbot Button */}
                        <button
                            onClick={() => setIsChatbotOpen(true)}
                            className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-[rgba(112,254,192,0.1)] hover:bg-[rgba(112,254,192,0.2)] text-[rgb(112,254,192)] transition-colors shadow"
                            title="Abrir Chatbot"
                        >
                            <FiMessageCircle size={22} />
                        </button>
                        {/* Notification Button */}
                        <button
                            onClick={handleOpenNotificationModal}
                            className="relative flex items-center justify-center w-10 h-10 rounded-[10px] bg-[rgba(112,254,192,0.1)] hover:bg-[rgba(112,254,192,0.2)] text-[rgb(112,254,192)] transition-colors"
                            title="Notificações"
                        >
                            <Bell className="h-6 w-6" />
                            {hasUnreadNotifications && (
                                <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[rgba(112,254,192,0.1)]"></span>
                            )}
                        </button>

                           <div className="flex items-center gap-2">
                            {/* User Icon/Button */}
                            <div className="relative text-white flex-shrink-0">
                                <button
                                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                                    className="flex items-center space-x-2 sm:space-x-3 focus:outline-none rounded-full group"
                                >
                                    {savedImage ? (
                                        <img
                                            src={savedImage}
                                            alt="User"
                                            className="h-8 w-8 sm:h-10 sm:w-10 rounded-[10px] object-cover border-2 border-[rgb(112,254,192)] group-hover:border-white transition-colors"
                                        />
                                    ) : (
                                        <UserCircle className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400 group-hover:text-white transition-colors" />
                                    )}
                                </button>
                                {showUserDropdown && (
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowUserDropdown(false)} // Fecha o dropdown ao clicar fora
                                    >
                                        <div
                                            className="absolute right-0 mt-2 w-64 text-white bg-[var(--color-bg-primary)] rounded-md shadow-lg py-1 z-50 border border-[var(--color-border)]"
                                            onClick={(e) => e.stopPropagation()} // Impede o clique dentro do dropdown de fechá-lo
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
                                                    className="relative group"
                                                    onClick={() => {
                                                        setShowProfileModal(true);
                                                        setShowUserDropdown(false);
                                                    }}
                                                >
                                                    {savedImage ? (
                                                        <img
                                                            src={savedImage}
                                                            alt="User Preview"
                                                            className="h-24 w-24 rounded-[10px] object-cover mb-2 border-2 border-[rgb(112,254,192)] hover:opacity-50"
                                                        />
                                                    ) : (
                                                        <UserCircle className="h-16 w-16 text-gray-400 mb-2" />
                                                    )}
                                                    <Pencil
                                                        className="absolute inset-0 m-auto h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                                                    />
                                                </div>
                                                <span className="font-medium text-center">{username || "Usuário"}</span>
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
                                                    setNotificationModalOpen(true);
                                                    setShowUserDropdown(false);
                                                }}
                                                className="flex items-center w-full px-4 py-2 text-sm hover:bg-[var(--color-bg-tertiary)] transition-colors"
                                            >
                                                <Bell className="mr-2 h-4 w-4" />
                                                Notificações
                                            </button>

                                            <button
                                                onClick={handleLogout}
                                                className="flex items-center w-full px-4 py-2 text-sm hover:bg-[var(--color-bg-tertiary)] transition-colors"
                                            >
                                                <LogOut className="mr-2 h-4 w-4" />
                                                Sair
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main>
                    {renderTab()}
                </main>
            </div>

            {/* Mobile Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-[var(--color-bg-primary)] border-t border-[var(--color-border)] shadow-lg">
                <div className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-blue-700 scrollbar-track-transparent"
                     style={{ WebkitOverflowScrolling: 'touch' }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}

                            className={`flex flex-col items-center justify-center px-4 py-5 flex-shrink-0 ${activeTab === tab.id ? 'text-gray-600' : 'text-white'} transition-colors`}
                            style={{ minWidth: 64 }}
                        >
                            <span className="w-6 h-6 flex items-center justify-center">{tab.icon}</span>

                        </button>
                    ))}
                </div>
            </nav>

            {/* Profile Edit Modal */}
            {showProfileModal && (
                <div
                    className="fixed inset-0 backdrop-blur-md backdrop-filter flex items-center justify-center z-50 p-4"
                    onClick={() => setShowProfileModal(false)}
                >
                    <div
                        className="relative w-full max-w-md rounded-2xl shadow-2xl bg-[#313338] border border-[#232428] overflow-hidden animate-fadeIn"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 bg-[#232428] border-b border-[#232428]">
                            <h2 className="text-xl font-bold text-white tracking-tight">Perfil</h2>
                            <button
                                onClick={() => setShowProfileModal(false)}
                                className="text-gray-400 hover:text-red-500 transition-colors rounded-full p-2"
                                aria-label="Fechar"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        {/* Body */}
                        <div className="px-8 py-8 flex flex-col gap-8">
                            {/* Imagem de Perfil */}
                            <div className="flex flex-col items-center gap-3">
                                <div className="relative group">
                                    <label
                                        htmlFor="profileImageInput"
                                        className="cursor-pointer"
                                        title="Alterar Imagem"
                                    >
                                        <img
                                            src={selectedImage || savedImage || "/default-avatar.png"}
                                            alt="Preview"
                                            className="w-40 h-40 object-cover rounded-[10px] border-4 border-[rgb(112,254,192)] group-hover:opacity-50 transition"
                                        />
                                        <div className="absolute bottom-2 right-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-full p-2 shadow-lg transition pointer-events-none">
                                            <Pencil className="h-5 w-5" />
                                        </div>
                                        <input
                                            id="profileImageInput"
                                            type="file"
                                            accept="image/jpeg, image/png, image/webp, image/gif"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                                <span className="text-xs text-gray-400">Clique na imagem para alterar</span>
                                {selectedImage && (
                                    <button
                                        onClick={() => setSelectedImage(null)}
                                        className="text-xs text-red-400 hover:text-red-300 underline mt-2"
                                    >
                                        Remover Seleção
                                    </button>
                                )}
                            </div>
                            {/* Preview de dados */}
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <label className="text-xs font-semibold text-[#b5bac1] mb-1 uppercase tracking-wide">Nome de Usuário</label>
                                        <div className="bg-[#232428] border border-[#232428] rounded px-4 py-2 text-white font-semibold">{username || "Usuário"}</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowProfileModal(false);
                                            setActiveTab('settings');
                                            setTimeout(() => {
                                                const el = document.getElementById('settings-security-tab');
                                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                                            }, 100);
                                        }}
                                        className="ml-2 px-4 py-2 rounded bg-[#393c41] hover:bg-[#5865F2] text-gray-300 hover:text-white transition-colors text-sm font-medium"
                                    >
                                        Editar
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <label className="text-xs font-semibold text-[#b5bac1] mb-1 uppercase tracking-wide">Email</label>
                                        <div className="bg-[#232428] border border-[#232428] rounded px-4 py-2 text-white font-semibold">{email || "Conta padrão"}</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowProfileModal(false);
                                            setActiveTab('settings');
                                            setTimeout(() => {
                                                const el = document.getElementById('settings-security-tab');
                                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                                            }, 100);
                                        }}
                                        className="ml-2 px-4 py-2 rounded bg-[#393c41] hover:bg-[#5865F2] text-gray-300 hover:text-white transition-colors text-sm font-medium"
                                    >
                                        Editar
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <label className="text-xs font-semibold text-[#b5bac1] mb-1 uppercase tracking-wide">Telefone</label>
                                        <div className="bg-[#232428] border border-[#232428] rounded px-4 py-2 text-white font-semibold">{phone || "Não cadastrado"}</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowProfileModal(false);
                                            setActiveTab('settings');
                                            setTimeout(() => {
                                                const el = document.getElementById('settings-security-tab');
                                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                                            }, 100);
                                        }}
                                        className="ml-2 px-4 py-2 rounded bg-[#393c41] hover:bg-[#5865F2] text-gray-300 hover:text-white transition-colors text-sm font-medium"
                                    >
                                        Editar
                                    </button>
                                </div>
                            </div>
                        </div>
                        {/* Footer */}
                        <div className="flex justify-end gap-4 px-8 py-5 bg-[#232428] border-t border-[#232428]">
                            <button
                                onClick={() => {
                                    setShowProfileModal(false);
                                    setSelectedImage(null);
                                }}
                                className="bg-[#232428] hover:bg-[#232428]/80 text-white px-6 py-2 rounded-lg text-sm font-medium border border-[#393c41] transition-colors"
                            >
                                Fechar
                            </button>
                            <button
                                onClick={handleSaveImage}
                                disabled={!selectedImage}
                                className={`bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors ${
                                    !selectedImage ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                            >
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notification Modal */}
            {notificationModalOpen && (
                <div
                    className="fixed inset-0 backdrop-blur-md backdrop-filter flex items-center justify-center p-4 z-50"
                    onClick={() => setNotificationModalOpen(false)} // Fecha o modal ao clicar fora
                >
                    <div
                        className="bg-[var(--color-bg-primary)] bg-opacity-80 rounded-lg p-6 w-full max-w-lg shadow-xl border border-[var(--color-border)]"
                        onClick={(e) => e.stopPropagation()} // Impede o clique dentro do modal de fechá-lo
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-white">Histórico de Notificações</h3>
                            <button
                                onClick={clearNotifications}
                                className="text-sm text-red-400 hover:text-red-300 hover:underline"
                            >
                                Limpar Histórico
                            </button>
                            <button
                                onClick={() => setNotificationModalOpen(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Abas de Categoria de Notificação */}
                        <div className="flex border-b border-[var(--color-border)] mb-4">
                            {notificationCategoryTabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveNotificationTab(tab.id)}
                                    className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors ${
                                        activeNotificationTab === tab.id
                                            ? 'border-b-2 border-blue-500 text-blue-400'
                                            : 'text-gray-400 hover:text-gray-200 border-b-2 border-transparent hover:border-gray-600'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                            {filteredNotifications.length === 0 ? (
                                <p className="text-gray-400 text-center">Nenhuma notificação encontrada.</p>
                            ) : (
                                filteredNotifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className="bg-[var(--color-bg-secondary)] p-4 rounded-lg shadow-md border border-[var(--color-border)]"
                                    >
                                        <p className="text-sm text-gray-300">{notification.message}</p>
                                        <p className="text-xs text-gray-400 mt-1">{notification.timestamp}</p>
                                        {/* Opcional: Mostrar categoria para depuração */}
                                        {/* @ts-ignore */}
                                        {/* <p className="text-xs text-purple-400 mt-1">Cat: {notification.category || 'N/A'}</p> */}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Chatbot Modal */}
            {isChatbotOpen && (
                <div
                    className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
                    onClick={() => setIsChatbotOpen(false)} // Fecha o modal ao clicar fora
                >
                    <div
                        className="bg-gradient-to-b from-gray-900 to-gray-800 text-white rounded-2xl shadow-2xl w-full max-w-3xl min-h-[60vh] max-h-[90vh] flex flex-col animate-slideUp overflow-hidden border border-gray-700/50"
                        onClick={(e) => e.stopPropagation()} // Impede o clique dentro do modal de fechá-lo
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                <h2 className="text-xl font-semibold">Support Chat</h2>
                            </div>
                            <button
                                onClick={() => setIsChatbotOpen(false)}
                                className="text-white/80 hover:text-white transition-colors duration-200 hover:bg-white/10 p-2 rounded-full"
                                aria-label="Close chat"
                            >
                                <FiX size={20} />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar min-h-[300px] max-h-[50vh] space-y-4">
                            {chatMessages.length === 0 ? (
                                <div className="text-center py-12 px-6">
                                    <div className="bg-blue-500/10 rounded-2xl p-6 backdrop-blur-sm">
                                        <h3 className="text-xl font-semibold text-blue-400 mb-2">
                                            Welcome to Support Chat! 👋
                                        </h3>
                                        <p className="text-gray-400">
                                            How can we assist you today? Feel free to ask any questions.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {chatMessages.map((msg, index) => (
                                        <div
                                            key={index}
                                            className={`flex animate-fadeIn ${
                                                msg.sender === "user" ? "justify-end" : "justify-start"
                                            }`}
                                        >
                                            <div
                                                className={`px-6 py-3 rounded-2xl max-w-[80%] backdrop-blur-sm ${
                                                    msg.sender === "user"
                                                        ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-tr-none"
                                                        : "bg-gray-700/50 text-gray-200 rounded-tl-none"
                                                }`}
                                            >
                                                {renderChatMessage(msg.message)}
                                                <div
                                                    className={`text-xs mt-2 ${
                                                        msg.sender === "user" ? "text-blue-200/70" : "text-gray-400"
                                                    }`}
                                                >
                                                    {new Date().toLocaleTimeString([], {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                        hour12: true,
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {isChatLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-gray-700/50 backdrop-blur-sm text-gray-200 px-6 py-3 rounded-2xl rounded-tl-none flex items-center space-x-2">
                                                <div className="typing-indicator">
                                                    <span></span>
                                                    <span></span>
                                                    <span></span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="p-6 bg-gray-900/50 backdrop-blur-sm border-t border-gray-700/50">
                            <div className="flex items-center gap-3">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    placeholder="Type your message..."
                                    className="flex-1 px-6 py-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
                                    disabled={isChatLoading}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    className={`p-3 rounded-xl ${
                                        isChatLoading || !chatInput.trim()
                                            ? "bg-gray-800/50 text-gray-500 cursor-not-allowed"
                                            : "bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400"
                                    } transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
                                    disabled={isChatLoading || !chatInput.trim()}
                                    aria-label="Send message"
                                >
                                    <FiSend size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;