const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info', // Define o nível mínimo de log (info, warn, error, etc.)
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, level, message }) => `[${timestamp}] [${level.toUpperCase()}]: ${message}`)
  ),
  transports: [
    new transports.Console(), // Exibe os logs no console
    new transports.File({ filename: 'logs/server.log' }) // Salva os logs em um arquivo
  ]
});

module.exports = logger;