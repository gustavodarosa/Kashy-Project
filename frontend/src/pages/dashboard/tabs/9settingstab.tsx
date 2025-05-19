import { useState, useEffect } from 'react';
import { FiSun, FiBell, FiLock, FiGlobe, FiHardDrive, FiDownload, FiTrash2 } from 'react-icons/fi';
import { useLanguage } from '../../../hooks/useLanguage';
import { t, LanguageKey, translations } from '../../../utils/languages';
import { ThemeKey, themes } from '../../../utils/themes';

type ThemeColorKey = keyof typeof themes.default.colors;

const TABS = [
  { key: 'appearance', label: 'Aparência', icon: <FiSun /> },
  { key: 'notifications', label: 'Notificações', icon: <FiBell /> },
  { key: 'language', label: 'Idioma & Região', icon: <FiGlobe /> },
  { key: 'security', label: 'Segurança', icon: <FiLock /> },
  { key: 'data', label: 'Dados & Privacidade', icon: <FiHardDrive /> },
];

export function SettingsTab() {
  const { language, changeLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState('appearance');
  const [activeTheme, setActiveTheme] = useState<ThemeKey>(loadTheme());
  const [notifications, setNotifications] = useState({ email: true, push: true, promotions: false });
  const [security, setSecurity] = useState({ twoFactorAuth: false, passwordChangeRequired: false });
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
  const handleSecurityChange = (type: keyof typeof security) => setSecurity(prev => ({ ...prev, [type]: !prev[type] }));
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
          // Optionally, set an error state here to inform the user or redirect to login
          return;
        }

        try {
          const res = await fetch('http://localhost:3000/api/user/me', {
            method: 'GET', // Explicitly state method
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json', // Align with other requests
              'Accept': 'application/json'        // Specify expected response type
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
            // Optionally, set an error state here to inform the user
          }
        } catch (error) {
          console.error('[SettingsTab] Network error or other issue fetching 2FA status:', error);
          // Optionally, set an error state here
        }
      };
      fetch2FA();
    }
  }, [activeTab]);

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-primary)]">
      {/* Sidebar */}
      <aside className="w-64 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] py-8 px-4 flex flex-col gap-2">
        <h2 className="text-xl font-bold mb-6 text-[var(--color-text-primary)]">Configurações</h2>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors font-medium
              ${activeTab === tab.key
                ? 'bg-[var(--color-accent)] text-white shadow'
                : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'appearance' && (
          <section>
            <h3 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-[var(--color-text-primary)]"><FiSun /> Aparência</h3>
            <p className="mb-2 text-[var(--color-text-secondary)]">{t('appearance.description', language)}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {(Object.keys(themes) as ThemeKey[]).map((key) => {
                const theme = themes[key];
                const isActive = activeTheme === key;
                return (
                  <div
                    key={key}
                    onClick={() => handleThemeChange(key)}
                    className={`p-4 rounded-lg cursor-pointer border-2 transition-all duration-200
                      ${isActive ? 'border-[var(--color-accent)] scale-105 shadow-md' : 'border-transparent hover:border-[var(--color-accent)] hover:scale-105'}`}
                    style={{ backgroundColor: theme.colors['--color-bg-secondary'] }}
                  >
                    <p className="font-medium mb-3 text-center" style={{ color: theme.colors['--color-text-primary'] }}>
                      {t(`appearance.themes.${key}`, language)}
                    </p>
                    <div className="flex justify-center space-x-2">
                      {themeColorKeys.map((colorKey) => (
                        <div
                          key={colorKey}
                          className="w-6 h-6 rounded-full border border-[var(--color-border)]"
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
          <section>
            <h3 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-[var(--color-text-primary)]"><FiBell /> Notificações</h3>
            <div className="space-y-4">
              {[
                { key: 'email', label: t('notificationsSection.email', language), desc: t('notificationsSection.emailDesc', language) },
                { key: 'push', label: t('notificationsSection.push', language), desc: t('notificationsSection.pushDesc', language) },
                { key: 'promotions', label: t('notificationsSection.promotions', language), desc: t('notificationsSection.promotionsDesc', language) }
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">{item.label}</p>
                    <p className="text-sm text-[var(--color-text-secondary)] max-w-md">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => handleNotificationChange(item.key as keyof typeof notifications)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200
                      ${notifications[item.key as keyof typeof notifications]
                        ? 'bg-[var(--color-accent)]'
                        : 'bg-gray-400 dark:bg-gray-600'}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200
                        ${notifications[item.key as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'language' && (
          <section>
            <h3 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-[var(--color-text-primary)]"><FiGlobe /> Idioma & Região</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="language" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  {t('language.language', language)}
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => changeLanguage(e.target.value as LanguageKey)}
                  className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] block w-full p-2.5"
                >
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="es-ES">Español</option>
                  <option value="en-US">English</option>
                </select>
              </div>
              <div>
                <label htmlFor="timezone" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  {t('language.timezone', language)}
                </label>
                <select
                  id="timezone"
                  className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] block w-full p-2.5"
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
          <section>
            <h3 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-[var(--color-text-primary)]"><FiLock /> Segurança</h3>
            
            {/* 2FA Switch */}
            <div className="flex items-center justify-between py-2 mb-6">
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">Autenticação em Dois Fatores (2FA)</p>
                <p className="text-sm text-[var(--color-text-secondary)] max-w-md">
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
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200
                  ${twoFactorEnabled
                    ? 'bg-[var(--color-accent)]'
                    : 'bg-gray-400 dark:bg-gray-600'}`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200
                    ${twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'}`}
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
              className="space-y-4"
            >
              <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                {t('security.newUsername', language)}
              </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg block w-full p-2.5"
                placeholder={t('security.enterNewUsername', language)}
              />
              <button
                type="submit"
                className="bg-[var(--color-accent)] text-white py-2 px-4 rounded-lg hover:bg-[var(--color-accent-hover)]"
              >
                {t('security.updateUsername', language)}
              </button>
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
              className="space-y-4 mt-6"
            >
              <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                {t('security.currentPassword', language)}
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg block w-full p-2.5"
                placeholder={t('security.enterCurrentPassword', language)}
              />
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mt-4">
                {t('security.newPassword', language)}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg block w-full p-2.5"
                placeholder={t('security.enterNewPassword', language)}
              />
              {passwordMessage && (
                <div className="text-green-500 text-sm">{passwordMessage}</div>
              )}
              {passwordError && (
                <div className="text-red-500 text-sm">{passwordError}</div>
              )}
              <button
                type="submit"
                className="bg-[var(--color-accent)] text-white py-2 px-4 rounded-lg hover:bg-[var(--color-accent-hover)] mt-4"
              >
                {t('security.updatePassword', language)}
              </button>
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
              className="space-y-4 mt-6"
            >
              <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                Telefone (celular)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  // Permite apenas números, +, e limita o tamanho
                  const raw = e.target.value.replace(/[^\d+]/g, '');
                  setPhone(raw);
                }}
                pattern="^\+[1-9]\d{1,14}$"
                className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg block w-full p-2.5"
                placeholder="+5511912345678"
                maxLength={16}
              />
              {phoneMessage && (
                <div className="text-green-500 text-sm">{phoneMessage}</div>
              )}
              {phoneError && (
                <div className="text-red-500 text-sm">{phoneError}</div>
              )}
              <button
                type="submit"
                className="bg-[var(--color-accent)] text-white py-2 px-4 rounded-lg hover:bg-[var(--color-accent-hover)] mt-4"
              >
                Atualizar Telefone
              </button>
            </form>
          
              
          </section>
        )}

        {activeTab === 'data' && (
          <section>
            <h3 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-[var(--color-text-primary)]"><FiHardDrive /> Dados & Privacidade</h3>
            <div className="space-y-4">
              {[
                { key: 'autoBackup', label: t('data.backup', language), desc: t('data.backupDesc', language) },
                { key: 'analytics', label: t('data.analytics', language), desc: t('data.analyticsDesc', language) }
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">{item.label}</p>
                    <p className="text-sm text-[var(--color-text-secondary)] max-w-md">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => handleDataPreferenceChange(item.key as keyof typeof dataPreferences)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200
                      ${dataPreferences[item.key as keyof typeof dataPreferences]
                        ? 'bg-[var(--color-accent)]'
                        : 'bg-gray-400 dark:bg-gray-600'}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200
                        ${dataPreferences[item.key as keyof typeof dataPreferences] ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
              ))}
              <div className="pt-4 space-y-3 border-t border-[var(--color-border)] mt-4">
                <button className="text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors flex items-center gap-2">
                  <FiDownload /> {t('data.export', language)}
                </button>
                <button className="text-red-500 hover:text-red-400 transition-colors flex items-center gap-2">
                  <FiTrash2 /> {t('data.delete', language)}
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}