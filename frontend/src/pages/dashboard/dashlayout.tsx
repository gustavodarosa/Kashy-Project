import {
    Search, ChevronRight, ChevronLeft, LayoutDashboard, ChartNoAxesCombined, ShoppingBasket,
    NotepadText, Wallet, Users, Package, Megaphone, Settings, UserCircle, LogOut, Edit, UserPlus, Bell, X, Pencil
} from 'lucide-react';
import { FiMessageCircle, FiSend, FiX } from "react-icons/fi"; // Import icons for the chatbot
import { useSidebar } from '../../hooks/usersidebar';
import { useState, useEffect } from 'react';
import { DashboardTab, WalletTab, PedidosTab, ClientesTab, ProdutosTab, RelatoriosTab, OfertasTab, SettingsTab, TransacoesTab } from './tabs';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../context/NotificationContext'; // Import the Notification type


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
        const fetchUsername = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    console.error('Usuário não autenticado.');
                    return;
                }

                const response = await fetch('http://localhost:3000/api/user/username', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    setUsername(data.username);
                } else {
                    console.error('Erro ao obter username:', response.statusText);
                }
            } catch (error) {
                console.error('Erro ao conectar ao servidor:', error);
            }
        };

        fetchUsername();
    }, []);

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
                    setSavedImage(data.profileImage); // Atualiza a imagem salva no estado
                    setUsername(data.username); // Atualiza o username no estado
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
                    console.log('Dados do usuário:', data);
                    setEmail(data.email);
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
        const fetchUserPhone = async () => {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');
            if (!token || !userId) return;
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
                    setPhone(data.phone || null);
                }
            } catch {}
        };
        fetchUserPhone();
    }, []);

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
                    setPhone(data.phone || null); // <-- Adicione esta linha
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
        { id: 'carteira', label: 'Wallet', icon: <Wallet /> },
        { id: 'produtos', label: 'Produtos', icon: <Package /> },
        { id: 'pedidos', label: 'Pedidos', icon: <ShoppingBasket /> },
        { id: 'transacoes', label: 'Transações', icon: <ChartNoAxesCombined /> },
        { id: 'clientes', label: 'Clientes', icon: <Users /> },
        { id: 'relatorios', label: 'Relatórios', icon: <NotepadText /> },
        { id: 'ofertas', label: 'Ofertas', icon: <Megaphone /> },
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
            case 'ofertas': return <OfertasTab />;
            case 'settings': return <SettingsTab />;
            default: return <DashboardTab />;
        }
    };

    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <div className={`${isOpen ? 'w-36 sm:w-72' : 'w-20 sm:w-24'} bg-[var(--color-bg-primary)] shadow-sm text-white transition-all duration-300 flex-shrink-0 flex flex-col`}>

                <div className="flex items-center gap-4 justify-center h-16 px-2 flex-shrink-0">
                    {isOpen ? (
                        <>
                            <div className="text-lg ml- sm:ml-17 sm:text-xl font-bold">
                        <img
                            src="/logokashy.svg"
                            alt="Kashy Logo Header"
                            className="h-14 w-36"
                        /></div>
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

                {/* Sidebar Navigation */}
                <nav className="flex flex-col p-2 sm:p-4 gap-2 overflow-y-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            title={isOpen ? '' : tab.label}
                            className={`py-3 px-2 sm:px-4 hover:bg-[var(--color-bg-tertiary)] rounded-md flex items-center text-sm ${isOpen ? 'justify-start gap-3' : 'justify-center'} ${activeTab === tab.id ? 'bg-[var(--color-bg-tertiary)] font-semibold' : ''} transition-colors duration-200`}
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

                    <div className="relative flex-1 min-w-0 max-w-xs sm:max-w-sm md:max-w-xl">
                        <input
                            type="text"
                            id="search"
                            placeholder="Pesquisar..."
                            className="w-full pl-10 pr-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-tertiary)] text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white text-sm sm:text-base"
                        />
                        <Search className='text-white absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 pointer-events-none' />
                    </div>

                      
                      
                    <div className="flex items-center gap-4">
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
                                        className="h-10 w-10 sm:h-12 md:h-14 sm:w-12 md:w-14 rounded-full object-cover border-2 border-transparent group-hover:border-white transition-colors"
                                    />
                                ) : (
                                    <UserCircle className="h-10 w-10 sm:h-12 md:h-14 sm:w-12 md:w-14 text-gray-400 group-hover:text-white transition-colors" />
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
                                                        className="h-28 w-28 rounded-full object-cover mb-2 border-2 border-white hover:opacity-50"
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
                </header>

                {/* Main Content */}
                <main className="flex-1 p-4 sm:p-6 bg-[var(--color-bg-secondary)] overflow-y-auto">
                    {renderTab()}
                </main>
            </div>

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
                                            className="w-44 h-44 object-cover rounded-full border-4 border-[#232428] group-hover:opacity-50 transition"
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
                        className="bg-[var(--color-bg-primary)] bg-opacity-80 rounded-lg p-6 w-full max-w-md shadow-xl border border-[var(--color-border)]"
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

                        <div className="space-y-4 max-h-80 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <p className="text-gray-400 text-center">Nenhuma notificação encontrada.</p>
                            ) : (
                                notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className="bg-[var(--color-bg-secondary)] p-4 rounded-lg shadow-md border border-[var(--color-border)]"
                                    >
                                        <p className="text-sm text-gray-300">{notification.message}</p>
                                        <p className="text-xs text-gray-400 mt-1">{notification.timestamp}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Chatbot Button */}
            <button
                onClick={() => setIsChatbotOpen(true)}
                className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg z-50"
                title="Abrir Chatbot"
            >
                <FiMessageCircle size={24} />
            </button>

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