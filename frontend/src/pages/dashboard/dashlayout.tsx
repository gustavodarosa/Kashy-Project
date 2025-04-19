import { Search, ChevronRight, ChevronLeft, LayoutDashboard, ChartNoAxesCombined,  ShoppingBasket,
    NotepadText,Wallet, Users, Package, Megaphone, Settings, UserCircle, LogOut, Edit, UserPlus, Bell, X} from 'lucide-react';
import { useSidebar } from '../../hooks/usersidebar'; 
import { useState, useEffect } from 'react';
import { DashboardTab, WalletTab, PedidosTab, ClientesTab, ProdutosTab, RelatoriosTab , OfertasTab, SettingsTab, TransacoesTab } from './tabs'; 
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
   const { isOpen, toggleSidebar } = useSidebar();
   const [activeTab, setActiveTab] = useState('dashboard');
   const [showUserDropdown, setShowUserDropdown] = useState(false);
   const [showProfileModal, setShowProfileModal] = useState(false);
   const [selectedImage, setSelectedImage] = useState<string | null>(null);
   const [savedImage, setSavedImage] = useState<string | null>(null);
   const [username, setUsername] = useState<string | null>(null);
   const [email, setEmail] = useState<string | null>(null);

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
           if (!userId) {
               console.error('ID do usuário não encontrado no localStorage.');
               return; // Exit early if userId is missing
           }
       
           try {
               const response = await fetch(`http://localhost:3000/api/user/${userId}`);
               if (response.ok) {
                   const data = await response.json();
                   setSavedImage(data.profileImage);
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

       const token = localStorage.getItem('token'); // Certifique-se de que o token está armazenado
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
                   profileImage: selectedImage, // Envia a imagem como base64
               }),
           });

           if (response.ok) {
               const data = await response.json();
               setSavedImage(data.profileImage); // Atualiza a imagem salva no estado
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
           const token = localStorage.getItem('token'); // Certifique-se de que o token está armazenado
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
          const token = localStorage.getItem('token'); // Certifique-se de que o token está armazenado
          const userId = localStorage.getItem('userId'); // Certifique-se de que o ID do usuário está armazenado
      
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

   const tabs = [
       { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
       { id: 'carteira', label: 'Wallet', icon: <Wallet /> },
       { id: 'produtos', label: 'Produtos', icon: <Package /> },
       { id: 'pedidos', label: 'pedidos', icon: <ShoppingBasket /> },
       { id: 'transacoes', label: 'Transações', icon: <ChartNoAxesCombined /> },
       { id: 'clientes', label: 'Clientes', icon: <Users /> },
       { id: 'relatorios', label: 'Relatórios', icon: <NotepadText /> },
       { id: 'ofertas', label: 'Ofertas', icon: <Megaphone /> },
       { id: 'settings', label: 'Settings', icon: <Settings /> }
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
                          <h1 className="text-lg ml- sm:ml-17 sm:text-xl font-bold">Dashboard</h1>
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
                           <span className="text-sm sm:text-base font-medium hidden sm:inline">{username || "Usuário"}</span>
                       </button>

                       {/* User Dropdown */}
                       {showUserDropdown && (
                            <div className="absolute right-0 mt-2 w-64 text-white bg-[var(--color-bg-primary)] rounded-md shadow-lg py-1 z-50 border border-[var(--color-border)]">

                                <div className="flex justify-end px-2 pt-2">
                                    <button
                                        onClick={() => setShowUserDropdown(false)}
                                        className="text-white border-transparent border-2 hover:border-zinc-600 hover:bg-zinc-700 rounded-full p-2 transition-colors"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="flex flex-col items-center px-4 py-3 border-b border-[var(--color-border)]">
                                    {savedImage ? (
                                        <img
                                            src={savedImage}
                                            alt="User Preview"
                                            className="h-28 w-28 rounded-full object-cover mb-2 border-2 border-amber-500"
                                        />
                                    ) : (
                                        <UserCircle className="h-16 w-16 text-gray-400 mb-2" />
                                    )}
                                    <span className="font-medium text-center">{username || "Usuário"}</span>
                                    
                                    <span className="text-xs ">{email || "Conta padrão"}</span>
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
                                        setShowProfileModal(true);
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
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Trocar de conta
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center w-full px-4 py-2 text-sm hover:bg-[var(--color-bg-tertiary)] transition-colors"
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Sair
                                </button>
                            </div>
                       )}
                   </div>
               </header>

               {/* Main Content */}
               <main className="flex-1 p-4 sm:p-6 bg-[var(--color-bg-secondary)] overflow-y-auto">
                   {renderTab()}
               </main>
           </div>

           {/* Profile Edit Modal */}
           {showProfileModal && (
               <div className="fixed inset-0  bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300 p-4">
                   <div className="bg-[var(--color-bg-primary)] text-white border border-gray-700 p-5 sm:p-6 rounded-lg shadow-xl w-full max-w-md transform transition-all duration-300 scale-100">
                       <h2 className="text-xl font-semibold mb-6 text-center text-amber-400">Editar Perfil</h2>
                       <div className="mb-5">
                           <label htmlFor="profileImageInput" className="block text-sm font-medium mb-2 text-white">Selecionar Nova Imagem</label>
                           <input
                               id="profileImageInput"
                               type="file"
                               accept="image/jpeg, image/png, image/webp, image/gif" 
                               onChange={handleFileChange}
                               className="block w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
                           />
                       </div>
                       {selectedImage && (
                           <div className="mb-6 border border-gray-600 rounded-lg p-3 bg-[var(--color-bg-tertiary)]">
                               <p className="text-sm mb-2 text-white">Preview:</p>
                               <div className="flex justify-center items-center flex-col gap-2">
                                   <img
                                       src={selectedImage}
                                       alt="Preview"
                                       className="w-28 h-28 sm:w-32 sm:h-32 object-cover rounded-full border-2 border-gray-500"
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
                       <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 mt-8">
                           <button
                               onClick={() => {
                                   setShowProfileModal(false);
                                   setSelectedImage(null); 
                               }}
                               className="bg-red-700 hover:bg-red-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1f2141] focus:ring-gray-500 w-full sm:w-auto"
                           >
                               Cancelar
                           </button>
                           <button
                               onClick={handleSaveImage}
                               disabled={!selectedImage} 
                               className={`bg-green-700 hover:bg-green-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1f2141] focus:ring-green-500 ${!selectedImage ? 'opacity-50 cursor-not-allowed' : ''} w-full sm:w-auto`}
                           >
                               Salvar Imagem
                           </button>
                       </div>
                   </div>
               </div>
           )}
       </div>
   );
}

export default Dashboard;
