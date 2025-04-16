import { useState } from 'react';
import { FiSun, FiBell, FiLock, FiGlobe, FiHardDrive, FiDownload, FiTrash2 } from 'react-icons/fi';

// Temas existentes (mantido do código anterior)
const themes = {
  default: {
    name: 'Tema Escuro',
    colors: {
      '--color-bg-primary': '#19181D',
      '--color-bg-secondary': '#1F1E22',
      '--color-bg-tertiary': '#28272b',
      '--color-shadow': '#404040',
      '--color-text-primary': '#ffffff',
      '--color-text-secondary': '#a0aec0',
      '--color-accent': '#0f0f0f',
      '--color-accent-hover': '#0f0f0f',
      '--color-border': '#303030',
      
    },
  },
  Bluetheme: {
    name: 'Tema Azul',
    colors: {
      '--color-bg-primary': '#0f2540',
      '--color-bg-secondary': '#1a3a5f',
      '--color-bg-tertiary': '#1f3c63',
      '--color-shadow': '#2a91bf',
      '--color-text-primary': '#e0f2fe',
      '--color-text-secondary': '#94a3b8',
      '--color-accent': '#38bdf8',
      '--color-accent-hover': '#0ea5e9',
      '--color-border': '#244770',

    },
  },
  Greentheme: {
    name: 'Tema Verde',
    colors: {
      '--color-bg-primary': '#1F3E2F',
      '--color-bg-secondary': '#2A523A',
      '--color-bg-tertiary': '#356348',
      '--color-shadow': '#28a87a',
      '--color-text-primary': '#ffffff',
      '--color-text-secondary': '#9ca3af',
      '--color-accent': '#34d399',
      '--color-accent-hover': '#10b981',
      '--color-border': '#3c7553',
 
    },
  },
  Redtheme: {
    name: 'Tema Vermelho',
    colors: {
      '--color-bg-primary': '#371418',
      '--color-bg-secondary': '#62272D',
      '--color-bg-tertiary': '#502127',
      '--color-shadow': '#9e2f3e',
      '--color-text-primary': '#ffffff',
      '--color-text-secondary': '#d1d5db',
      '--color-accent': '#692f36',
      '--color-accent-hover': '#f97316',
      '--color-border': '#853941',

    },
  },
};

type ThemeKey = keyof typeof themes;

const applyTheme = (themeKey: ThemeKey) => {
  const theme = themes[themeKey];
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  localStorage.setItem('dashboardTheme', themeKey);
};

const loadTheme = (): ThemeKey => {
  const savedTheme = localStorage.getItem('dashboardTheme') as ThemeKey | null;
  const defaultThemeKey: ThemeKey = 'default';
  const themeKey = savedTheme && themes[savedTheme] ? savedTheme : defaultThemeKey;
  applyTheme(themeKey);
  return themeKey;
};

export function SettingsTab() {
  const [activeTheme, setActiveTheme] = useState<ThemeKey>(loadTheme);
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    promotions: false,
  });
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'pt-BR');
  const [security, setSecurity] = useState({
    twoFactorAuth: false,
    passwordChangeRequired: false,
  });
  const [dataPreferences, setDataPreferences] = useState({
    autoBackup: true,
    analytics: true,
  });

  const handleThemeChange = (themeKey: ThemeKey) => {
    applyTheme(themeKey);
    setActiveTheme(themeKey);
  };

 

  const handleNotificationChange = (type: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
    // Implemente a lógica para mudar o idioma da aplicação
  };

  const handleSecurityChange = (type: keyof typeof security) => {
    setSecurity(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const handleDataPreferenceChange = (type: keyof typeof dataPreferences) => {
    setDataPreferences(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  return (
    <div className="space-y-8 p-6">
      <h2 className="text-2xl text-[var(--color-text-primary)] font-bold">Configurações</h2>

      {/* Seção de Aparência */}
      <div className="bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow-lg shadow-[color:var(--color-shadow)] ">
        <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2 flex items-center gap-2">
          <FiSun /> Aparência
        </h3>
          <div>
            <p className="font-medium text-[var(--color-text-primary)] mb-3">Tema de Cores</p>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">Escolha uma paleta de cores para personalizar a aparência do dashboard.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {(Object.keys(themes) as ThemeKey[]).map((key) => {
                const theme = themes[key];
                const isActive = activeTheme === key;
                return (
                  <div
                    key={key}
                    onClick={() => handleThemeChange(key)}
                    className={`p-4 rounded-lg cursor-pointer border-2 transition-all duration-200 ${
                      isActive
                        ? 'border-[var(--color-accent)] scale-105 shadow-lg'
                        : 'border-transparent hover:border-[var(--color-accent)] hover:scale-105'
                    }`}
                    style={{ backgroundColor: theme.colors['--color-bg-tertiary'] }}
                  >
                    <p className="font-medium mb-3 text-center text-[var(--color-text-primary)]" style={{ color: theme.colors['--color-text-primary'] }}>{theme.name}</p>
                    <div className="flex justify-center space-x-2">
                      <div className="w-6 h-6 rounded-full border-1 " style={{ backgroundColor: theme.colors['--color-bg-primary'] }}></div>
                      <div className="w-6 h-6 rounded-full border-1 " style={{ backgroundColor: theme.colors['--color-bg-secondary'] }}></div>
                      <div className="w-6 h-6 rounded-full border-1 " style={{ backgroundColor: theme.colors['--color-accent'] }}></div>
                      <div className="w-6 h-6 rounded-full border-1 " style={{ backgroundColor: theme.colors['--color-border'] }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
     

      {/* Seção de Notificações */}
      <div className="bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow-lg shadow-[color:var(--color-shadow)]">
        <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2 flex items-center gap-2">
          <FiBell /> Notificações
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[var(--color-text-primary)]">Notificações por Email</p>
              <p className="text-sm text-[var(--color-text-secondary)]">Receber alertas importantes por email</p>
            </div>
            <button
              onClick={() => handleNotificationChange('email')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                notifications.email ? 'bg-[var(--color-accent)]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifications.email ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[var(--color-text-primary)]">Notificações Push</p>
              <p className="text-sm text-[var(--color-text-secondary)]">Receber alertas no dispositivo</p>
            </div>
            <button
              onClick={() => handleNotificationChange('push')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                notifications.push ? 'bg-[var(--color-accent)]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifications.push ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[var(--color-text-primary)]">Promoções e Ofertas</p>
              <p className="text-sm text-[var(--color-text-secondary)]">Receber comunicações de marketing</p>
            </div>
            <button
              onClick={() => handleNotificationChange('promotions')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                notifications.promotions ? 'bg-[var(--color-accent)]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifications.promotions ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Seção de Idioma e Região */}
      <div className="bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow-lg shadow-[color:var(--color-shadow)]">
        <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2 flex items-center gap-2">
          <FiGlobe /> Idioma e Região
        </h3>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Idioma
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] block w-full p-2.5"
            >
              <option value="pt-BR">Português (Brasil)</option>
              <option value="es-ES">Español</option>
              <option value="en-US">English</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Fuso Horário
            </label>
            <select
              id="timezone"
              className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] block w-full p-2.5"
            >
              <option value="America/Sao_Paulo">(GMT-03:00) Brasília</option>
              <option value="America/New_York">(GMT-05:00) Nova York</option>
              <option value="Europe/London">(GMT+00:00) Londres</option>
            </select>
          </div>
        </div>
      </div>

      {/* Seção de Segurança */}
      <div className="bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow-lg shadow-[color:var(--color-shadow)]">
        <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2 flex items-center gap-2">
          <FiLock /> Segurança
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[var(--color-text-primary)]">Autenticação de Dois Fatores (2FA)</p>
              <p className="text-sm text-[var(--color-text-secondary)]">Adicione uma camada extra de segurança à sua conta</p>
            </div>
            <button
              onClick={() => handleSecurityChange('twoFactorAuth')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                security.twoFactorAuth ? 'bg-[var(--color-accent)]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  security.twoFactorAuth ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[var(--color-text-primary)]">Alteração Obrigatória de Senha</p>
              <p className="text-sm text-[var(--color-text-secondary)]">Exigir alteração de senha a cada 90 dias</p>
            </div>
            <button
              onClick={() => handleSecurityChange('passwordChangeRequired')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                security.passwordChangeRequired ? 'bg-[var(--color-accent)]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  security.passwordChangeRequired ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          <div className="pt-4">
            <button className="text-white hover:underline flex items-center gap-2">
              <FiLock /> Alterar Senha
            </button>
          </div>
        </div>
      </div>

      {/* Seção de Dados e Privacidade */}
      <div className="bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow-lg shadow-[color:var(--color-shadow)]">
        <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2 flex items-center gap-2">
          <FiHardDrive /> Dados e Privacidade
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[var(--color-text-primary)]">Backup Automático</p>
              <p className="text-sm text-[var(--color-text-secondary)]">Salvar automaticamente cópias de segurança dos seus dados</p>
            </div>
            <button
              onClick={() => handleDataPreferenceChange('autoBackup')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                dataPreferences.autoBackup ? 'bg-[var(--color-accent)]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  dataPreferences.autoBackup ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[var(--color-text-primary)]">Compartilhar Dados para Análise</p>
              <p className="text-sm text-[var(--color-text-secondary)]">Ajudar a melhorar a plataforma com dados anônimos</p>
            </div>
            <button
              onClick={() => handleDataPreferenceChange('analytics')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                dataPreferences.analytics ? 'bg-[var(--color-accent)]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  dataPreferences.analytics ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          <div className="pt-4 space-y-3">
            <button className="text-white hover:underline flex items-center gap-2">
              <FiDownload /> Exportar Meus Dados
            </button>
            <button className="text-[var(--color-danger)] hover:underline flex items-center gap-2">
              <FiTrash2 /> Excluir Minha Conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}