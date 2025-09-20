// src/index.js - Aplicación Principal de Holders API
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cron = require('node-cron');
const path = require('path');
require('dotenv').config();

const HolderScraper = require('./services/holderscraper');
const Database = require('./services/database');
const Logger = require('./utils/Logger');
const { validateToken, formatWallet } = require('./utils/helpers');

class PumpFunHoldersAPI {
    constructor() {
        this.app = express();
        this.app.use((req, res, next) => {
    res.removeHeader('Content-Security-Policy');
    res.setHeader('X-Content-Security-Policy', 'unsafe-inline');
    next();
});
        this.port = process.env.PORT || 3001;
        this.database = new Database();
        this.scraper = new HolderScraper(this.database);
        this.logger = new Logger();
        this.isRunning = false;
        this.rotationInterval = null;
    }

    async initialize() {
        try {
            this.logger.info('🚀 Iniciando PumpFun Holders API...');
            
            // Validar configuración
            this.validateConfig();
            
            // Inicializar base de datos
            await this.database.initialize();
            
            // Configurar Express
            this.setupExpress();
            
            // Configurar rutas API
            this.setupRoutes();
            
            // Iniciar scraper
            await this.scraper.initialize();
            
            // Configurar tareas programadas
            this.setupScheduledTasks();
            
            // Iniciar servidor
            this.startServer();
            
            // Scraping inicial
            await this.performInitialScrape();
            
            this.isRunning = true;
            this.logger.info('✅ Sistema iniciado correctamente');
            
        } catch (error) {
            this.logger.error('❌ Error fatal durante inicialización:', error);
            process.exit(1);
        }
    }

    validateConfig() {
        if (!process.env.TOKEN_ADDRESS) {
            throw new Error('TOKEN_ADDRESS no está configurado en .env');
        }
        
        if (!validateToken(process.env.TOKEN_ADDRESS)) {
            throw new Error('TOKEN_ADDRESS no es válido');
        }
        
        this.logger.info('✅ Configuración validada');
    }

    setupExpress() {
        // Middlewares de seguridad y optimización
        this.app.use(helmet());
        this.app.use(compression());
this.app.use(cors({
    origin: '*', // Permitir todos por ahora
    credentials: true
}));
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '../public')));
        
        // Middleware de logging
        this.app.use((req, res, next) => {
            this.logger.debug(`${req.method} ${req.path}`);
            next();
        });
        
        // Rate limiting simple
        if (process.env.ENABLE_RATE_LIMIT === 'true') {
            const rateLimit = new Map();
            this.app.use((req, res, next) => {
                const ip = req.ip;
                const now = Date.now();
                const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000;
                const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
                
                if (!rateLimit.has(ip)) {
                    rateLimit.set(ip, { count: 1, resetTime: now + windowMs });
                } else {
                    const limit = rateLimit.get(ip);
                    if (now > limit.resetTime) {
                        limit.count = 1;
                        limit.resetTime = now + windowMs;
                    } else {
                        limit.count++;
                        if (limit.count > maxRequests) {
                            return res.status(429).json({
                                success: false,
                                error: 'Too many requests'
                            });
                        }
                    }
                }
                next();
            });
        }
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            });
        });

        // API Info
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'PumpFun Holders API',
                version: '1.0.0',
                token: process.env.TOKEN_NAME || 'Unknown',
                tokenAddress: formatWallet(process.env.TOKEN_ADDRESS),
                endpoints: {
                    current: '/api/current-wallet',
                    all: '/api/all-wallets',
                    stats: '/api/stats',
                    history: '/api/history',
                    rotate: '/api/rotate-wallet',
                    update: '/api/force-update',
                    topHolders: '/api/top-holders/:count'
                }
            });
        });

        // Obtener wallet actual
        this.app.get('/api/current-wallet', (req, res) => {
            const current = this.database.getCurrentWallet();
            if (!current) {
                return res.status(404).json({
                    success: false,
                    error: 'No hay wallet seleccionada'
                });
            }
            
            res.json({
                success: true,
                data: {
                    wallet: current.address,
                    balance: current.balance,
                    percentage: current.percentage,
                    rank: current.rank || null,
                    timestamp: current.selectedAt || new Date().toISOString()
                }
            });
        });

        // Obtener todas las wallets
        this.app.get('/api/all-wallets', (req, res) => {
            const wallets = this.database.getAllWallets();
            const { limit = 500, offset = 0, sort = 'balance' } = req.query;
            
            let sorted = [...wallets];
            if (sort === 'balance') {
                sorted.sort((a, b) => b.balance - a.balance);
            } else if (sort === 'percentage') {
                sorted.sort((a, b) => b.percentage - a.percentage);
            }
            
            const paginated = sorted.slice(
                parseInt(offset), 
                parseInt(offset) + parseInt(limit)
            );
            
            res.json({
                success: true,
                total: wallets.length,
                count: paginated.length,
                offset: parseInt(offset),
                data: paginated.map((w, i) => ({
                    rank: parseInt(offset) + i + 1,
                    address: w.address,
                    balance: w.balance,
                    percentage: w.percentage,
                    lastSeen: w.lastSeen
                }))
            });
        });

        // Top holders
        this.app.get('/api/top-holders/:count?', (req, res) => {
            const count = parseInt(req.params.count) || 10;
            const wallets = this.database.getAllWallets();
            
            const topHolders = wallets
                .sort((a, b) => b.balance - a.balance)
                .slice(0, count)
                .map((w, i) => ({
                    rank: i + 1,
                    address: w.address,
                    balance: w.balance,
                    percentage: w.percentage,
                    isWhale: i < 5
                }));
            
            res.json({
                success: true,
                count: topHolders.length,
                data: topHolders
            });
        });

        // Estadísticas
        this.app.get('/api/stats', (req, res) => {
            const stats = this.database.getStats();
            const wallets = this.database.getAllWallets();
            
            // Calcular estadísticas adicionales
            const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
            const avgBalance = wallets.length > 0 ? totalBalance / wallets.length : 0;
            const whaleCount = wallets.filter(w => w.percentage > 1).length;
            
            res.json({
                success: true,
                data: {
                    ...stats,
                    totalWallets: wallets.length,
                    totalBalance,
                    averageBalance: avgBalance,
                    whaleCount,
                    lastScrape: this.scraper.lastScrapeTime,
                    nextUpdate: this.getNextUpdateTime(),
                    isRunning: this.isRunning,
                    uptime: process.uptime()
                }
            });
        });

        // Historial
        this.app.get('/api/history', (req, res) => {
            const { limit = 50 } = req.query;
            const history = this.database.getHistory(parseInt(limit));
            
            res.json({
                success: true,
                count: history.length,
                data: history
            });
        });

        // Rotar wallet manualmente
        this.app.post('/api/rotate-wallet', (req, res) => {
            try {
                const newWallet = this.database.selectRandomWallet();
                if (!newWallet) {
                    return res.status(404).json({
                        success: false,
                        error: 'No hay wallets disponibles'
                    });
                }
                
                this.logger.info(`🎲 Wallet rotada manualmente: ${formatWallet(newWallet.address)}`);
                
                res.json({
                    success: true,
                    data: {
                        wallet: newWallet.address,
                        balance: newWallet.balance,
                        percentage: newWallet.percentage
                    }
                });
            } catch (error) {
                this.logger.error('Error rotando wallet:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Forzar actualización
        this.app.post('/api/force-update', async (req, res) => {
            try {
                this.logger.info('🔄 Actualización forzada iniciada');
                const result = await this.scraper.scrapeHolders();
                
                res.json({
                    success: true,
                    message: 'Actualización completada',
                    holdersFound: result.length
                });
            } catch (error) {
                this.logger.error('Error en actualización forzada:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Dashboard HTML
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/dashboard.html'));
        });

        // Webhook para notificaciones (opcional)
        this.app.post('/api/webhook', (req, res) => {
            const { event, data } = req.body;
            this.logger.info(`Webhook recibido: ${event}`);
            res.json({ success: true });
        });
    }

    setupScheduledTasks() {
        // Auto-actualización
        if (process.env.ENABLE_AUTO_UPDATE === 'true') {
            const minutes = parseInt(process.env.UPDATE_INTERVAL_MINUTES) || 10;
            
            // Usar cron para mayor precisión
            cron.schedule(`*/${minutes} * * * *`, async () => {
                try {
                    this.logger.info('⏰ Ejecutando actualización programada...');
                    await this.scraper.scrapeHolders();
                } catch (error) {
                    this.logger.error('Error en actualización programada:', error);
                }
            });
            
            this.logger.info(`⏰ Auto-actualización configurada cada ${minutes} minutos`);
        }

        // Auto-rotación
        if (process.env.ENABLE_AUTO_ROTATION === 'true') {
            const seconds = parseInt(process.env.ROTATION_INTERVAL_SECONDS) || 30;
            
            this.rotationInterval = setInterval(() => {
                const wallet = this.database.selectRandomWallet();
                if (wallet) {
                    this.logger.debug(`🎲 Auto-rotación: ${formatWallet(wallet.address)}`);
                }
            }, seconds * 1000);
            
            this.logger.info(`🎲 Auto-rotación configurada cada ${seconds} segundos`);
        }
    }

    async performInitialScrape() {
        try {
            this.logger.info('🔍 Realizando scraping inicial...');
            const holders = await this.scraper.scrapeHolders();
            this.logger.info(`✅ Scraping inicial completado: ${holders.length} holders encontrados`);
            
            // Seleccionar primera wallet
            if (process.env.ENABLE_AUTO_ROTATION === 'true') {
                this.database.selectRandomWallet();
            }
        } catch (error) {
            this.logger.error('Error en scraping inicial:', error);
            this.logger.info('⚠️ Continuando con datos existentes...');
        }
    }

    getNextUpdateTime() {
        const minutes = parseInt(process.env.UPDATE_INTERVAL_MINUTES) || 10;
        const lastUpdate = this.scraper.lastScrapeTime;
        if (!lastUpdate) return null;
        
        const next = new Date(lastUpdate);
        next.setMinutes(next.getMinutes() + minutes);
        return next.toISOString();
    }

    startServer() {
        this.app.listen(this.port, () => {
            this.logger.info(`🌐 Servidor API corriendo en http://localhost:${this.port}`);
            this.logger.info(`📊 Dashboard disponible en http://localhost:${this.port}`);
            console.log(`
╔══════════════════════════════════════════╗
║   PumpFun Holders API - v1.0.0          ║
║   Token: ${process.env.TOKEN_NAME || 'Unknown'}                        ║
║   API: http://localhost:${this.port}/api      ║
║   Dashboard: http://localhost:${this.port}       ║
╚══════════════════════════════════════════╝
            `);
        });
    }

    async cleanup() {
        this.logger.info('🧹 Limpiando recursos...');
        
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
        }
        
        await this.scraper.cleanup();
        await this.database.save();
        
        process.exit(0);
    }
}

// Crear e iniciar aplicación
const app = new PumpFunHoldersAPI();

// Manejar señales de cierre
process.on('SIGINT', () => app.cleanup());
process.on('SIGTERM', () => app.cleanup());
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    app.cleanup();
});

// Iniciar
app.initialize().catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});