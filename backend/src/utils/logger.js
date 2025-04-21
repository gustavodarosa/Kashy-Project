// logger.js
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  // Cores de texto
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Cores de fundo
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

class CustomLogger {
  constructor(options = {}) {
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      http: 3,
      debug: 4
    };
    
    this.defaultLevel = options.level || 'debug';
    this.level = this.logLevels[this.defaultLevel];
    this.timestampFormat = options.timestampFormat || 'YYYY-MM-DD HH:mm:ss';
    this.showTimestamp = options.showTimestamp !== false;
    this.colorsEnabled = options.colors !== false;
    
    // Configurações personalizadas para cada nível
    this.levelConfig = {
      error: {
        color: 'red',
        label: 'ERROR'
      },
      warn: {
        color: 'yellow',
        label: 'WARN'
      },
      info: {
        color: 'green',
        label: 'INFO'
      },
      http: {
        color: 'magenta',
        label: 'HTTP'
      },
      debug: {
        color: 'blue',
        label: 'DEBUG'
      },
      ...options.levelConfig
    };
  }
  
  setLevel(level) {
    if (this.logLevels[level] !== undefined) {
      this.level = this.logLevels[level];
    } else {
      this.error(`Nível de log inválido: ${level}`);
    }
  }
  
  getTimestamp() {
    const date = new Date();
    const pad = (num) => num.toString().padStart(2, '0');
    
    return this.timestampFormat
      .replace('YYYY', date.getFullYear())
      .replace('MM', pad(date.getMonth() + 1))
      .replace('DD', pad(date.getDate()))
      .replace('HH', pad(date.getHours()))
      .replace('mm', pad(date.getMinutes()))
      .replace('ss', pad(date.getSeconds()));
  }
  
  formatMessage(level, message) {
    const config = this.levelConfig[level];
    let formattedMessage = '';
    
    if (this.showTimestamp) {
      formattedMessage += `[${this.getTimestamp()}] `;
    }
    
    if (this.colorsEnabled) {
      formattedMessage += `${colors[config.color]}[${config.label}]${colors.reset} ${message}`;
    } else {
      formattedMessage += `[${config.label}] ${message}`;
    }
    
    return formattedMessage;
  }
  
  log(level, message) {
    if (this.logLevels[level] <= this.level) {
      console.log(this.formatMessage(level, message));
    }
  }
  
  error(message) {
    this.log('error', message);
  }
  
  warn(message) {
    this.log('warn', message);
  }
  
  info(message) {
    this.log('info', message);
  }
  
  http(message) {
    this.log('http', message);
  }
  
  debug(message) {
    this.log('debug', message);
  }
}

// Exporta uma instância singleton por padrão
const logger = new CustomLogger({
  level: 'debug', 
  timestampFormat: 'YYYY-MM-DD HH:mm:ss',
  showTimestamp: true,
  colors: true,
  
  // Personalização adicional por nível
  levelConfig: {
    
     info: {
     color: 'cyan',
       label: 'INFO'
    }
  }
});

module.exports = logger;