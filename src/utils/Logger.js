// src/utils/Logger.js
const winston = require('winston');
const path = require('path');

class Logger {
    constructor() {
        const logDir = process.env.LOG_PATH || './logs';
        
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message }) => {
                    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
                })
            ),
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                }),
                ...(process.env.ENABLE_FILE_LOGGING === 'true' ? [
                    new winston.transports.File({ 
                        filename: path.join(logDir, 'error.log'), 
                        level: 'error' 
                    }),
                    new winston.transports.File({ 
                        filename: path.join(logDir, 'combined.log') 
                    })
                ] : [])
            ]
        });
    }

    info(message) { this.logger.info(message); }
    error(message, error) { this.logger.error(`${message} ${error ? error.stack || error : ''}`); }
    warn(message) { this.logger.warn(message); }
    debug(message) { this.logger.debug(message); }
}

module.exports = Logger;