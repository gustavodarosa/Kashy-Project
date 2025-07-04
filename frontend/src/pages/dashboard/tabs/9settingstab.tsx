import { useState, useEffect } from 'react';
import React from 'react'; 
import { Bell, Lock, Globe, HardDrive, Download, Trash2, Settings, Palette } from 'lucide-react';
import { useLanguage } from '../../../hooks/useLanguage';
import { t, LanguageKey, translations } from '../../../utils/languages';
import { ThemeKey, themes } from '../../../utils/themes';

type ThemeColorKey = keyof typeof themes.default.colors;

const TABS = [
  { key: 'appearance', label: 'Aparência', icon: Palette },
  { key: 'notifications', label: 'Notificações', icon: Bell },
  { key: 'language', label: 'Idioma & Região', icon: Globe },
  { key: 'security', label: 'Segurança', icon: Lock },
  { key: 'data', label: 'Dados & Privacidade', icon: HardDrive },
];

export function SettingsTab() {
  const { language, changeLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState('appearance');
  const [activeTheme, setActiveTheme] = useState<ThemeKey>(loadTheme());
  const [notifications, setNotifications] = useState({ email: true, push: true, promotions: false });
  const [dataPreferences, setDataPreferences] = useState({ autoBackup: true, analytics: true });
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<'sms' | 'email' | 'device'>('sms');
  const [newEmail, setNewEmail] = useState('');
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('');

  useEffect(() => { applyTheme(activeTheme); }, [activeTheme]);

  function loadTheme(): ThemeKey {
    const savedTheme = localStorage.getItem('dashboardTheme') as ThemeKey | null;
    return savedTheme && themes[savedTheme] ? savedTheme : 'default';
  }

  function applyTheme(themeKey: ThemeKey) {
    const theme = themes[themeKey];
    if (!theme) return;
    const root = document.documentElement;
    (Object.entries(theme.colors) as [ThemeColorKey, string][]).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    localStorage.setItem('dashboardTheme', themeKey);
  }

  const handleThemeChange = (themeKey: ThemeKey) => { applyTheme(themeKey); setActiveTheme(themeKey); };
  const handleNotificationChange = (type: keyof typeof notifications) => setNotifications(prev => ({ ...prev, [type]: !prev[type] }));
  const handleDataPreferenceChange = (type: keyof typeof dataPreferences) => setDataPreferences(prev => ({ ...prev, [type]: !prev[type] }));

  const timezonesForCurrentLanguage = translations[language]?.language?.timezones || translations['pt-BR'].language.timezones;
  const themeColorKeys: ThemeColorKey[] = ['--color-bg-primary', '--color-accent', '--color-text-primary', '--color-border'];

  useEffect(() => {
    if (activeTab === 'security') {
      const fetch2FA = async () => {
        console.log('[SettingsTab] Fetching 2FA status...');
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('[SettingsTab] No token found. Cannot fetch 2FA status.');
          
          return;
        }

        try {
          const res = await fetch('http://localhost:3000/api/user/me', {
            method: 'GET', 
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json', 
              'Accept': 'application/json'        
            }
          });

          if (res.ok) {
            const data = await res.json();
            console.log('[SettingsTab] 2FA status fetched:', data);
            setTwoFactorEnabled(data.twoFactorEnabled);
            setTwoFactorMethod(data.twoFactorMethod || 'sms');
          } else {
            const errorData = await res.json().catch(() => ({ message: "Failed to parse error response from server." }));
            console.error(`[SettingsTab] Error fetching 2FA status: ${res.status} - ${res.statusText}`, errorData);
          
          }
        } catch (error) {
          console.error('[SettingsTab] Network error or other issue fetching 2FA status:', error);
          
        }
      };
      fetch2FA();
    }
  }, [activeTab]);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#1E2328] via-[#24292D] to-[#2B3036] text-white">
      {/* Sidebar */}
      <aside className="w-70 bg-[#24292D]/70 backdrop-blur-lg border-r border-white/10 py-8 px- flex flex-col gap-2 shadow-2xl">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="p-2 bg-gradient-to-br from-slate-500/20 to-slate-700/20 backdrop-blur-sm rounded-full">
            <Settings size={24} className="text-slate-300" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100">Configurações</h2>
        </div>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-3 px-3 flex items-center justify-start gap-4 w-full relative
              ${activeTab === tab.key
                ? 'bg-gradient-to-r from-[rgb(20,143,122)] to-transparent text-white font-semibold'
                : 'text-white hover:bg-[rgba(20,143,122,0.1)]'}
              transition-colors duration-200`}
          >
            <tab.icon size={18} className={activeTab === tab.key ? 'text-white' : 'text-slate-400'} />
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute top-0 right-0 h-full w-1 bg-[rgb(20,143,122)] rounded-l-md"></div>
            )}
          </button>
        ))}
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <div className="mb-8">
          <div className="p-6 bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl">
            <div className="flex items-center gap-3">
              {TABS.find(t => t.key === activeTab)?.icon && (
                React.createElement(TABS.find(t => t.key === activeTab)!.icon, { size: 28, className: "text-slate-300" })
              )}
              <h1 className="text-3xl font-bold text-slate-100">
                {TABS.find(t => t.key === activeTab)?.label}
              </h1>
            </div>
            <p className="text-slate-400 mt-1 text-sm">
              {activeTab === 'appearance' && t('appearance.description', language)}
              {activeTab === 'notifications' && "Gerencie suas preferências de notificação."}
              {activeTab === 'language' && "Ajuste o idioma e fuso horário da plataforma."}
              {activeTab === 'security' && "Configure as opções de segurança da sua conta."}
              {activeTab === 'data' && "Gerencie seus dados e preferências de privacidade."}
            </p>
          </div>
        </div>

        {activeTab === 'appearance' && (
          <section className="p-6 bg-[#2F363E]/60 backdrop-blur-xl border border-white/10 shadow-xl">
            <h3 className="text-xl font-semibold mb-6 text-slate-200">Temas Disponíveis</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {(Object.keys(themes) as ThemeKey[]).map((key) => {
                const theme = themes[key];
                const isActive = activeTheme === key;
                return (
                  <div
                    key={key}
                    onClick={() => handleThemeChange(key)}
                    className={`p-5 cursor-pointer border-2 transition-all duration-300 transform hover:scale-105
                      ${isActive ? `border-slate-400 scale-105 shadow-2xl bg-opacity-80` : 'border-transparent hover:border-slate-500/70 bg-opacity-60'}`}
                    style={{ backgroundColor: theme.colors['--color-bg-secondary'] }}
                  >
                    <p className="font-semibold mb-4 text-center text-sm" style={{ color: theme.colors['--color-text-primary'] }}>
                      {t(`appearance.themes.${key}`, language)}
                    </p>
                    <div className="flex justify-center space-x-2">
                      {themeColorKeys.map((colorKey) => (
                        <div
                          key={colorKey}
                          className="w-5 h-5 border border-white/20"
                          style={{ backgroundColor: theme.colors[colorKey] }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === 'notifications' && (
          <section className="p-6 bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl">
            <h3 className="text-xl font-semibold mb-6 text-slate-200">Preferências de Notificação</h3>
            <div className="space-y-5">
              {[
                { key: 'email', label: t('notificationsSection.email', language), desc: t('notificationsSection.emailDesc', language) },
                { key: 'push', label: t('notificationsSection.push', language), desc: t('notificationsSection.pushDesc', language) },
                { key: 'promotions', label: t('notificationsSection.promotions', language), desc: t('notificationsSection.promotionsDesc', language) }
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-[#24292D]/50 rounded-lg border border-white/10">
                  <div>
                    <p className="font-medium text-slate-200">{item.label}</p>
                    <p className="text-xs text-slate-400 max-w-md">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => handleNotificationChange(item.key as keyof typeof notifications)}
                    className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none
                      ${notifications[item.key as keyof typeof notifications]
                        ? 'bg-slate-500'
                        : 'bg-slate-700'}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out
                        ${notifications[item.key as keyof typeof notifications] ? 'translate-x-[1.1rem]' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'language' && (
          <section className="p-6 bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl">
            <h3 className="text-xl font-semibold mb-6 text-slate-200">Configurações Regionais</h3>
            <div className="space-y-5">
              <div>
                <label htmlFor="language" className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t('language.language', language)}
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => changeLanguage(e.target.value as LanguageKey)}
                  className="w-full px-3 py-2.5 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500/50 transition-all text-sm"
                >
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="es-ES">Español</option>
                  <option value="en-US">English</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="timezone" className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t('language.timezone', language)}
                </label>
                <select
                  id="timezone"
                  className="w-full px-3 py-2.5 bg-[#24292D]/80 backdrop-blur-sm border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500/50 transition-all text-sm"
                >
                  {Object.entries(timezonesForCurrentLanguage).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'security' && (
          <section className="p-6 bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl space-y-8">
            <h3 className="text-xl font-semibold text-slate-200">Opções de Segurança</h3>
            {/* 2FA Switch */}
            <div className="flex items-center justify-between p-4 bg-[#24292D]/50 rounded-lg border border-white/10">
              <div>
                <p className="font-medium text-slate-200">Autenticação em Dois Fatores (2FA)</p>
                <p className="text-xs text-slate-400 max-w-md">
                  Adicione uma camada extra de segurança à sua conta.
                </p>
              </div>
              <button
                onClick={async () => {
                  const newValue = !twoFactorEnabled;
                  setTwoFactorEnabled(newValue);
                  try {
                    const token = localStorage.getItem('token');
                    const res = await fetch('http://localhost:3000/api/user/two-factor', {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ enabled: newValue, method: twoFactorMethod }),
                    });
                    if (!res.ok) {
                      setTwoFactorEnabled(!newValue); // Reverte se falhar
                      alert('Erro ao atualizar 2FA.');
                    }
                  } catch {
                    setTwoFactorEnabled(!newValue);
                    alert('Erro ao conectar ao servidor.');
                  }
                }}
                className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none
                  ${twoFactorEnabled
                    ? 'bg-slate-500'
                    : 'bg-slate-700'}`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out
                    ${twoFactorEnabled ? 'translate-x-[1.1rem]' : 'translate-x-1'}`}
                />
              </button>
            </div>

            {/* Username */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const response = await fetch('http://localhost:3000/api/user/update-username', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                    body: JSON.stringify({ username: newUsername }),
                  });
                  if (response.ok) {
                    const data = await response.json();
                    alert(data.message);
                  } else {
                    alert('Erro ao atualizar username.');
                  }
                } catch (error) {
                  console.error('Erro ao conectar ao servidor:', error);
                }
              }}
              className="p-4 bg-[#24292D]/50 rounded-lg border border-white/10"
            >
              <label className="block text-xs font-medium text-slate-300 mb-1.5">{t('security.newUsername', language)}</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="flex-grow px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500/50 transition-all text-sm"
                  placeholder={t('security.enterNewUsername', language)}
                />
                <button type="submit" className="px-5 py-2 bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-400 hover:to-slate-500 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg text-sm">
                  {t('security.updateUsername', language)}
                </button>
              </div>
            </form>

            {/* Email */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setEmailMessage(null);
                setEmailError(null);
                if (!currentPasswordForEmail) {
                  setEmailError('Digite sua senha atual para atualizar o email.');
                  return;
                }
                try {
                  const response = await fetch('http://localhost:3000/api/user/update-email', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                    body: JSON.stringify({ email: newEmail, currentPassword: currentPasswordForEmail }),
                  });
                  const data = await response.json();
                  if (response.ok) {
                    setEmailMessage(data.message || 'Email atualizado com sucesso.');
                  } else if (response.status === 409) {
                    setEmailError('Este email já está em uso por outro usuário.');
                  } else if (response.status === 400 && data.message?.toLowerCase().includes('senha')) {
                    setEmailError('Senha atual incorreta.');
                  } else {
                    setEmailError(data.message || 'Erro ao atualizar email.');
                  }
                } catch (error) {
                  setEmailError('Erro ao conectar ao servidor.');
                }
              }}
              className="p-4 bg-[#24292D]/50 rounded-lg border border-white/10 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Novo Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500/50 transition-all text-sm"
                  placeholder="Digite seu novo email..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Senha Atual</label>
                <input
                  type="password"
                  value={currentPasswordForEmail}
                  onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500/50 transition-all text-sm"
                  placeholder="Digite sua senha atual..."
                />
              </div>
              
              {emailMessage && <div className="text-sm text-emerald-400">{emailMessage}</div>}
              {emailError && <div className="text-sm text-red-400">{emailError}</div>}
              
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-400 hover:to-slate-500 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg text-sm"
                >
                  Atualizar Email
                </button>
              </div>
            </form>

            {/* Password */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPasswordMessage(null);
                setPasswordError(null);
                try {
                  const response = await fetch('http://localhost:3000/api/user/update-password', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                    body: JSON.stringify({ currentPassword, newPassword }),
                  });
                  const data = await response.json();
                  if (response.ok) {
                    setPasswordMessage(data.message || 'Senha atualizada com sucesso.');
                    setCurrentPassword('');
                    setNewPassword('');
                  } else {
                    setPasswordError(data.message || 'Erro ao atualizar senha.');
                  }
                } catch (error) {
                  setPasswordError('Erro ao conectar ao servidor.');
                  console.error('Erro ao conectar ao servidor:', error);
                }
              }}
              className="p-4 bg-[#24292D]/50 rounded-lg border border-white/10 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">{t('security.currentPassword', language)}</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500/50 transition-all text-sm"
                  placeholder={t('security.enterCurrentPassword', language)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">{t('security.newPassword', language)}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500/50 transition-all text-sm"
                  placeholder={t('security.enterNewPassword', language)}
                />
              </div>

              {passwordMessage && <div className="text-sm text-emerald-400">{passwordMessage}</div>}
              {passwordError && <div className="text-sm text-red-400">{passwordError}</div>}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-400 hover:to-slate-500 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg text-sm"
                >
                  {t('security.updatePassword', language)}
                </button>
              </div>
            </form>
            {/* Phone */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPhoneMessage(null);
                setPhoneError(null);
                try {
                  const response = await fetch('http://localhost:3000/api/user/update-phone', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                    body: JSON.stringify({ phone }),
                  });
                  const data = await response.json();
                  if (response.ok) {
                    setPhoneMessage(data.message || 'Telefone atualizado com sucesso.');
                  } else {
                    setPhoneError(data.message || 'Erro ao atualizar telefone.');
                  }
                } catch (error) {
                  setPhoneError('Erro ao conectar ao servidor.');
                }
              }}
              className="p-4 bg-[#24292D]/50 rounded-lg border border-white/10 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Telefone (celular)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d+]/g, '');
                    setPhone(raw);
                  }}
                  pattern="^\+[1-9]\d{1,14}$"
                  className="w-full px-3 py-2 bg-[#2F363E]/80 backdrop-blur-sm border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500/50 transition-all text-sm"
                  placeholder="+5511912345678"
                  maxLength={16}
                />
              </div>

              {phoneMessage && <div className="text-sm text-emerald-400">{phoneMessage}</div>}
              {phoneError && <div className="text-sm text-red-400">{phoneError}</div>}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-400 hover:to-slate-500 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg text-sm"
                >
                  Atualizar Telefone
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === 'data' && (
          <section className="p-6 bg-[#2F363E]/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl">
            <h3 className="text-xl font-semibold mb-6 text-slate-200">Gerenciamento de Dados</h3>
            <div className="space-y-5">
              {[
                { key: 'autoBackup', label: t('data.backup', language), desc: t('data.backupDesc', language) },
                { key: 'analytics', label: t('data.analytics', language), desc: t('data.analyticsDesc', language) }
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-[#24292D]/50 rounded-lg border border-white/10">
                  <div>
                    <p className="font-medium text-slate-200">{item.label}</p>
                    <p className="text-xs text-slate-400 max-w-md">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => handleDataPreferenceChange(item.key as keyof typeof dataPreferences)}
                    className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none
                      ${dataPreferences[item.key as keyof typeof dataPreferences]
                        ? 'bg-slate-500' // Active color
                        : 'bg-slate-700' // Inactive color
                      }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out
                        ${dataPreferences[item.key as keyof typeof dataPreferences] ? 'translate-x-[1.1rem]' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
              ))}
              <div className="pt-6 space-y-3 border-t border-white/10 mt-6">
                <button className="flex items-center gap-2 px-4 py-2 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 rounded-lg border border-sky-500/30 text-sm font-medium transition-colors">
                  <Download size={16} /> {t('data.export', language)}
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg border border-red-500/30 text-sm font-medium transition-colors">
                  <Trash2 size={16} /> {t('data.delete', language)}
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}