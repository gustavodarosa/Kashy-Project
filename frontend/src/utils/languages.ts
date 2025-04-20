// src/utils/languages.ts
export type LanguageKey = 'pt-BR' | 'es-ES' | 'en-US';

type TranslationKeys = {
  dashboard: string;
  settings: string;
  logout: string;
  editProfile: string;
  notifications: string;
  welcome: (name: string) => string;
  settingsTitle: string;
  appearance: {
    title: string;
    colorTheme: string;
    description: string;
    themes: {
      default: string;
      Bluetheme: string;
      Greentheme: string;
      Redtheme: string;
    };
  };
  notificationsSection: {
    title: string;
    email: string;
    emailDesc: string;
    push: string;
    pushDesc: string;
    promotions: string;
    promotionsDesc: string;
  };
  language: {
    title: string;
    language: string;
    timezone: string;
    timezones: {
      [key: string]: string;
    };
  };
  security: {
    title: string;
    twoFactor: string;
    twoFactorDesc: string;
    passwordChange: string;
    passwordChangeDesc: string;
    changePassword: string;
    changeUsernamePassword?: string;
    newUsername?: string;
    enterNewUsername?: string;
    updateUsername?: string;
    currentPassword?: string;
    newPassword?: string;
    enterCurrentPassword?: string;
    enterNewPassword?: string;
    updatePassword?: string;
  };
  data: {
    title: string;
    backup: string;
    backupDesc: string;
    analytics: string;
    analyticsDesc: string;
    export: string;
    delete: string;
  };
};

export const translations: Record<LanguageKey, TranslationKeys> = {
  'pt-BR': {
    dashboard: 'Dashboard',
    settings: 'Configurações',
    logout: 'Sair',
    editProfile: 'Editar Perfil',
    notifications: 'Notificações', 
    welcome: (name: string) => `Bem-vindo, ${name}!`,
    settingsTitle: 'Configurações',
    appearance: {
      title: 'Aparência',
      colorTheme: 'Tema de Cores',
      description: 'Escolha uma paleta de cores para personalizar a aparência do dashboard',
      themes: {
        default: 'Tema Escuro',
        Bluetheme: 'Tema Azul',
        Greentheme: 'Tema Verde',
        Redtheme: 'Tema Vermelho'
      }
    },
    notificationsSection: { 
      title: 'Notificações',
      email: 'Notificações por Email',
      emailDesc: 'Receber alertas importantes por email',
      push: 'Notificações Push',
      pushDesc: 'Receber alertas no dispositivo',
      promotions: 'Promoções e Ofertas',
      promotionsDesc: 'Receber comunicações de marketing'
    },
    language: {
      title: 'Idioma e Região',
      language: 'Idioma',
      timezone: 'Fuso Horário',
      timezones: {
        'America/Sao_Paulo': '(GMT-03:00) Brasília',
        'America/New_York': '(GMT-05:00) Nova York',
        'Europe/London': '(GMT+00:00) Londres'
      }
    },
    security: {
      title: 'Segurança',
      twoFactor: 'Autenticação de Dois Fatores (2FA)',
      twoFactorDesc: 'Adicione uma camada extra de segurança à sua conta',
      passwordChange: 'Alteração Obrigatória de Senha',
      passwordChangeDesc: 'Exigir alteração de senha a cada 90 dias',
      changePassword: 'Alterar Senha',
      changeUsernamePassword: 'Alterar Username e Senha',
      newUsername: 'Novo Username',
      enterNewUsername: 'Digite seu novo username...',
      updateUsername: 'Atualizar Username',
      currentPassword: 'Senha Atual',
      newPassword: 'Nova Senha',
      enterCurrentPassword: 'Digite sua senha atual...',
      enterNewPassword: 'Digite sua nova senha...',
      updatePassword: 'Atualizar Senha'
    },
    data: {
      title: 'Dados e Privacidade',
      backup: 'Backup Automático',
      backupDesc: 'Salvar automaticamente cópias de segurança dos seus dados',
      analytics: 'Compartilhar Dados para Análise',
      analyticsDesc: 'Ajudar a melhorar a plataforma com dados anônimos',
      export: 'Exportar Meus Dados',
      delete: 'Excluir Minha Conta'
    }
  },
  'es-ES': {
    dashboard: 'Tablero',
    settings: 'Configuraciones',
    logout: 'Salir',
    editProfile: 'Editar Perfil',
    notifications: 'Notificaciones',
    welcome: (name: string) => `¡Bienvenido ${name}!`,
    settingsTitle: 'Configuraciones',
    appearance: {
      title: 'Apariencia',
      colorTheme: 'Tema de Colores',
      description: 'Elija una paleta de colores para personalizar la apariencia del panel',
      themes: {
        default: 'Tema Oscuro',
        Bluetheme: 'Tema Azul',
        Greentheme: 'Tema Verde',
        Redtheme: 'Tema Rojo'
      }
    },
    notificationsSection: {
      title: 'Notificaciones',
      email: 'Notificaciones por Correo Electrónico',
      emailDesc: 'Recibir alertas importantes por correo electrónico',
      push: 'Notificaciones Push',
      pushDesc: 'Recibir alertas en el dispositivo',
      promotions: 'Promociones y Ofertas',
      promotionsDesc: 'Recibir comunicaciones de marketing'
    },
    language: {
      title: 'Idioma y Región',
      language: 'Idioma',
      timezone: 'Zona Horaria',
      timezones: {
        'America/Sao_Paulo': '(GMT-03:00) Brasilia',
        'America/New_York': '(GMT-05:00) Nueva York',
        'Europe/London': '(GMT+00:00) Londres'
      }
    },
    security: {
      title: 'Seguridad',
      twoFactor: 'Autenticación de Dos Factores (2FA)',
      twoFactorDesc: 'Añada una capa extra de seguridad a su cuenta',
      passwordChange: 'Cambio de Contraseña Obligatorio',
      passwordChangeDesc: 'Requerir cambio de contraseña cada 90 días',
      changePassword: 'Cambiar Contraseña'
    },
    data: {
      title: 'Datos y Privacidad',
      backup: 'Copia de Seguridad Automática',
      backupDesc: 'Guardar automáticamente copias de seguridad de sus datos',
      analytics: 'Compartir Datos para Análisis',
      analyticsDesc: 'Ayudar a mejorar la plataforma con datos anónimos',
      export: 'Exportar Mis Datos',
      delete: 'Eliminar Mi Cuenta'
    }
  },
  'en-US': {
    dashboard: 'Dashboard',
    settings: 'Settings',
    logout: 'Logout',
    editProfile: 'Edit Profile',
    notifications: 'Notifications',
    welcome: (name: string) => `Welcome, ${name}!`,
    settingsTitle: 'Settings',
    appearance: {
      title: 'Appearance',
      colorTheme: 'Color Theme',
      description: 'Choose a color palette to customize the dashboard appearance',
      themes: {
        default: 'Dark Theme',
        Bluetheme: 'Blue Theme',
        Greentheme: 'Green Theme',
        Redtheme: 'Red Theme'
      }
    },
    notificationsSection: {
      title: 'Notifications',
      email: 'Email Notifications',
      emailDesc: 'Receive important alerts via email',
      push: 'Push Notifications',
      pushDesc: 'Receive alerts on your device',
      promotions: 'Promotions and Offers',
      promotionsDesc: 'Receive marketing communications'
    },
    language: {
      title: 'Language and Region',
      language: 'Language',
      timezone: 'Time Zone',
      timezones: {
        'America/Sao_Paulo': '(GMT-03:00) Brasilia',
        'America/New_York': '(GMT-05:00) New York',
        'Europe/London': '(GMT+00:00) London'
      }
    },
    security: {
      title: 'Security',
      twoFactor: 'Two-Factor Authentication (2FA)',
      twoFactorDesc: 'Add an extra layer of security to your account',
      passwordChange: 'Mandatory Password Change',
      passwordChangeDesc: 'Require password change every 90 days',
      changePassword: 'Change Password'
    },
    data: {
      title: 'Data and Privacy',
      backup: 'Automatic Backup',
      backupDesc: 'Automatically save backup copies of your data',
      analytics: 'Share Data for Analysis',
      analyticsDesc: 'Help improve the platform with anonymous data',
      export: 'Export My Data',
      delete: 'Delete My Account'
    }
  }
};

export const t = (key: string, language: LanguageKey = 'pt-BR', params?: any): string => {
  const keys = key.split('.');
  let result: any = translations[language] || translations['pt-BR'];

  try {
    for (const k of keys) {
      if (result === undefined || result === null) {
        console.warn(`Translation key not found: "${key}" for language "${language}" (part: "${k}")`);
        return key;
      }
      result = result[k];
    }

    if (typeof result === 'function') {
      return result(params) || key;
    }

    return result !== undefined && result !== null ? String(result) : key;
  } catch (error) {
    console.error(`Error fetching translation for key "${key}" in language "${language}":`, error);
    return key;
  }
};