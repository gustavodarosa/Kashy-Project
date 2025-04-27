import { useState, useEffect } from 'react';
import { FiSun, FiBell, FiLock, FiGlobe, FiHardDrive, FiDownload, FiTrash2 } from 'react-icons/fi';
import { useLanguage } from '../../../hooks/useLanguage';
import { t, LanguageKey, translations } from '../../../utils/languages';
import { ThemeKey, themes } from '../../../utils/themes';
 
// Tipo auxiliar para as chaves de cores
type ThemeColorKey = keyof typeof themes.default.colors;
 
export function SettingsTab() {
  const { language, changeLanguage } = useLanguage();
  const [activeTheme, setActiveTheme] = useState<ThemeKey>(loadTheme());
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    promotions: false,
  });
  const [security, setSecurity] = useState({
    twoFactorAuth: false,
    passwordChangeRequired: false,
  });
  const [dataPreferences, setDataPreferences] = useState({
    autoBackup: true,
    analytics: true,
  });
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
 
  useEffect(() => {
    applyTheme(activeTheme);
  }, [activeTheme]);
 
  function loadTheme(): ThemeKey {
    const savedTheme = localStorage.getItem('dashboardTheme') as ThemeKey | null;
    return savedTheme && themes[savedTheme] ? savedTheme : 'default';
  }
 
  function applyTheme(themeKey: ThemeKey) {
    const theme = themes[themeKey];
    if (!theme) {
      console.error(`Tema "${themeKey}" não encontrado.`);
      return;
    }
    const root = document.documentElement;
    (Object.entries(theme.colors) as [ThemeColorKey, string][]).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    localStorage.setItem('dashboardTheme', themeKey);
  }
 
  const handleThemeChange = (themeKey: ThemeKey) => {
    applyTheme(themeKey);
    setActiveTheme(themeKey);
  };
 
  const handleNotificationChange = (type: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [type]: !prev[type] }));
  };
 
  const handleSecurityChange = (type: keyof typeof security) => {
    setSecurity(prev => ({ ...prev, [type]: !prev[type] }));
  };
 
  const handleDataPreferenceChange = (type: keyof typeof dataPreferences) => {
    setDataPreferences(prev => ({ ...prev, [type]: !prev[type] }));
  };
 
  const timezonesForCurrentLanguage = translations[language]?.language?.timezones || translations['pt-BR'].language.timezones;
 
  // Chaves de cores para mostrar nos temas
  const themeColorKeys: ThemeColorKey[] = [
    '--color-bg-primary',
    '--color-accent',
    '--color-text-primary',
    '--color-border'
  ];
 
  return (
    <div className="space-y-8 p-6 bg-[var(--color-bg-primary)] min-h-screen">
      <h2 className="text-2xl text-[var(--color-text-primary)] font-bold">
        {t('settingsTitle', language)}
      </h2>
 
      {/* Seção de Aparência */}
      <div className="bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow-lg shadow-[color:var(--color-shadow)]">
        <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2 flex items-center gap-2">
          <FiSun /> {t('appearance.title', language)}
        </h3>
        <div>
          <p className="font-medium text-[var(--color-text-primary)] mb-3">
            {t('appearance.colorTheme', language)}
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            {t('appearance.description', language)}
          </p>
 
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
                      ? 'border-[var(--color-accent)] scale-105 shadow-md shadow-[color:var(--color-shadow)]'
                      : 'border-transparent hover:border-[var(--color-accent)] hover:scale-105'
                  }`}
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
        </div>
      </div>
 
      {/* Seção de Notificações */}
      <div className="bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow-lg shadow-[color:var(--color-shadow)]">
        <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2 flex items-center gap-2">
          <FiBell /> {t('notificationsSection.title', language)}
        </h3>
 
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
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-secondary)] ${
                  notifications[item.key as keyof typeof notifications]
                    ? 'bg-[var(--color-accent)]'
                    : 'bg-gray-400 dark:bg-gray-600'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    notifications[item.key as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
 
      {/* Seção de Idioma */}
      <div className="bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow-lg shadow-[color:var(--color-shadow)]">
        <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2 flex items-center gap-2">
          <FiGlobe /> {t('language.title', language)}
        </h3>
 
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
      </div>
 
      {/* Seção de Segurança */}
      <div className="bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow-lg shadow-[color:var(--color-shadow)]">
        <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2 flex items-center gap-2">
          <FiLock /> {t('security.title', language)}
        </h3>
 
        <div className="space-y-4">
          {[
            {
              key: 'twoFactorAuth',
              label: t('security.twoFactor', language),
              desc: t('security.twoFactorDesc', language)
            },
            {
              key: 'passwordChangeRequired',
              label: t('security.passwordChange', language),
              desc: t('security.passwordChangeDesc', language)
            }
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">{item.label}</p>
                <p className="text-sm text-[var(--color-text-secondary)] max-w-md">{item.desc}</p>
              </div>
              <button
                onClick={() => handleSecurityChange(item.key as keyof typeof security)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-secondary)] ${
                  security[item.key as keyof typeof security]
                    ? 'bg-[var(--color-accent)]'
                    : 'bg-gray-400 dark:bg-gray-600'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    security[item.key as keyof typeof security] ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
 
 
        </div>
      </div>
 
      <div className="bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow-lg shadow-[color:var(--color-shadow)]">
        <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2 flex items-center gap-2">
          <FiLock /> {t('security.changeUsernamePassword', language)}
        </h3>
 
        {/* Formulário para alterar o username */}
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
 
        {/* Formulário para alterar a senha */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const response = await fetch('http://localhost:3000/api/user/update-password', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({ currentPassword, newPassword }),
              });
 
              if (response.ok) {
                const data = await response.json();
                alert(data.message);
              } else {
                alert('Erro ao atualizar senha.');
              }
            } catch (error) {
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
          <button
            type="submit"
            className="bg-[var(--color-accent)] text-white py-2 px-4 rounded-lg hover:bg-[var(--color-accent-hover)] mt-4"
          >
            {t('security.updatePassword', language)}
          </button>
        </form>
      </div>
 
      {/* Seção de Dados */}
      <div className="bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow-lg shadow-[color:var(--color-shadow)]">
        <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2 flex items-center gap-2">
          <FiHardDrive /> {t('data.title', language)}
        </h3>
 
        <div className="space-y-4">
          {[
            {
              key: 'autoBackup',
              label: t('data.backup', language),
              desc: t('data.backupDesc', language)
            },
            {
              key: 'analytics',
              label: t('data.analytics', language),
              desc: t('data.analyticsDesc', language)
            }
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">{item.label}</p>
                <p className="text-sm text-[var(--color-text-secondary)] max-w-md">{item.desc}</p>
              </div>
              <button
                onClick={() => handleDataPreferenceChange(item.key as keyof typeof dataPreferences)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-secondary)] ${
                  dataPreferences[item.key as keyof typeof dataPreferences]
                    ? 'bg-[var(--color-accent)]'
                    : 'bg-gray-400 dark:bg-gray-600'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    dataPreferences[item.key as keyof typeof dataPreferences] ? 'translate-x-6' : 'translate-x-1'
                  }`}
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
      </div>
    </div>
  );
}