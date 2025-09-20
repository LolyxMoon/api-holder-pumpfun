// src/services/Database.js - Servicio de Base de Datos
const fs = require('fs').promises;
const path = require('path');
const Logger = require('../utils/Logger');

class Database {
    constructor() {
        this.logger = new Logger();
        this.dataPath = process.env.DATABASE_PATH || './data/holders.json';
        this.backupPath = process.env.BACKUP_PATH || './data/backups';
        
        this.data = {
            wallets: [],
            currentWallet: null,
            history: [],
            stats: {
                totalRaces: 0,
                totalWalletsProcessed: 0,
                lastUpdate: null,
                createdAt: new Date().toISOString()
            },
            metadata: {
                tokenAddress: process.env.TOKEN_ADDRESS,
                tokenName: process.env.TOKEN_NAME || 'Unknown',
                version: '1.0.0'
            }
        };
        
        this.autoSaveInterval = null;
    }

    async initialize() {
        try {
            // Crear directorios si no existen
            await this.ensureDirectories();
            
            // Cargar datos existentes
            await this.load();
            
            // Configurar auto-guardado
            this.setupAutoSave();
            
            this.logger.info('✅ Base de datos inicializada');
            this.logger.info(`📊 ${this.data.wallets.length} wallets cargadas`);
            
        } catch (error) {
            this.logger.error('Error inicializando base de datos:', error);
            throw error;
        }
    }

    async ensureDirectories() {
        const dataDir = path.dirname(this.dataPath);
        
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir, { recursive: true });
            this.logger.debug('📁 Directorio de datos creado');
        }
        
        try {
            await fs.access(this.backupPath);
        } catch {
            await fs.mkdir(this.backupPath, { recursive: true });
            this.logger.debug('📁 Directorio de backups creado');
        }
    }

    async load() {
        try {
            const fileContent = await fs.readFile(this.dataPath, 'utf8');
            const loadedData = JSON.parse(fileContent);
            
            // Merge con datos actuales preservando la estructura
            this.data = {
                ...this.data,
                ...loadedData,
                metadata: {
                    ...this.data.metadata,
                    ...loadedData.metadata
                }
            };
            
            this.logger.debug('📂 Datos cargados desde archivo');
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.logger.info('📁 No hay datos previos, iniciando nueva base de datos');
                await this.save();
            } else {
                this.logger.error('Error cargando datos:', error);
                throw error;
            }
        }
    }

    async save() {
        try {
            const jsonContent = JSON.stringify(this.data, null, 2);
            await fs.writeFile(this.dataPath, jsonContent, 'utf8');
            this.logger.debug('💾 Datos guardados');
            
            // Crear backup cada hora
            const now = new Date();
            if (!this.lastBackup || (now - this.lastBackup) > 3600000) {
                await this.createBackup();
                this.lastBackup = now;
            }
        } catch (error) {
            this.logger.error('Error guardando datos:', error);
            throw error;
        }
    }

    async createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(this.backupPath, `backup_${timestamp}.json`);
            const jsonContent = JSON.stringify(this.data, null, 2);
            await fs.writeFile(backupFile, jsonContent, 'utf8');
            this.logger.debug(`📦 Backup creado: ${backupFile}`);
            
            // Limpiar backups antiguos (mantener últimos 10)
            await this.cleanOldBackups();
        } catch (error) {
            this.logger.error('Error creando backup:', error);
        }
    }

    async cleanOldBackups() {
        try {
            const files = await fs.readdir(this.backupPath);
            const backupFiles = files
                .filter(f => f.startsWith('backup_'))
                .sort()
                .reverse();
            
            if (backupFiles.length > 10) {
                const toDelete = backupFiles.slice(10);
                for (const file of toDelete) {
                    await fs.unlink(path.join(this.backupPath, file));
                    this.logger.debug(`🗑️ Backup antiguo eliminado: ${file}`);
                }
            }
        } catch (error) {
            this.logger.error('Error limpiando backups:', error);
        }
    }

    setupAutoSave() {
        // Auto-guardar cada 5 minutos
        this.autoSaveInterval = setInterval(() => {
            this.save().catch(error => {
                this.logger.error('Error en auto-guardado:', error);
            });
        }, 5 * 60 * 1000);
        
        this.logger.debug('⏰ Auto-guardado configurado (cada 5 minutos)');
    }

    updateHolders(holders) {
        const now = new Date().toISOString();
        
        // REEMPLAZAR todos los holders con los nuevos del CSV
        // Guardar historial de los anteriores antes de reemplazar
        const previousHolders = this.data.wallets.map(w => w.address);
        
        // LIMPIAR y reemplazar con los nuevos holders
        this.data.wallets = holders.map((holder, index) => ({
            address: holder.address,
            balance: holder.balance,
            percentage: holder.percentage,
            rank: holder.rank || index + 1,
            addedAt: now,
            lastSeen: now,
            updateCount: 1
        }));
        
        // Actualizar estadísticas
        this.data.stats.totalWalletsProcessed = holders.length;
        
        // Guardar holders que vendieron (estaban antes pero ya no están)
        if (!this.data.soldWallets) {
            this.data.soldWallets = [];
        }
        
        const currentAddresses = holders.map(h => h.address);
        const soldInThisUpdate = previousHolders.filter(addr => 
            !currentAddresses.includes(addr)
        );
        
        soldInThisUpdate.forEach(addr => {
            if (!this.data.soldWallets.includes(addr)) {
                this.data.soldWallets.push(addr);
            }
        });
        
        // Ordenar por balance
        this.data.wallets.sort((a, b) => b.balance - a.balance);
        
        // Actualizar ranks
        this.data.wallets.forEach((w, i) => {
            w.rank = i + 1;
        });
        
        // Actualizar estadísticas
        this.data.stats.lastUpdate = now;
        
        this.logger.info(`✅ Base de datos actualizada: ${this.data.wallets.length} wallets totales`);
        
        // Guardar cambios
        this.save().catch(error => {
            this.logger.error('Error guardando después de actualización:', error);
        });
    }

    selectRandomWallet() {
        if (this.data.wallets.length === 0) {
            this.logger.warn('⚠️ No hay wallets disponibles para seleccionar');
            return null;
        }
        
        // Selección ponderada por balance (opcional)
        const useWeightedSelection = process.env.WEIGHTED_SELECTION === 'true';
        
        let selected;
        if (useWeightedSelection) {
            // Selección ponderada: más balance = más probabilidad
            const totalBalance = this.data.wallets.reduce((sum, w) => sum + w.balance, 0);
            let random = Math.random() * totalBalance;
            
            for (const wallet of this.data.wallets) {
                random -= wallet.balance;
                if (random <= 0) {
                    selected = wallet;
                    break;
                }
            }
        } else {
            // Selección completamente aleatoria
            const randomIndex = Math.floor(Math.random() * this.data.wallets.length);
            selected = this.data.wallets[randomIndex];
        }
        
        if (selected) {
            // Actualizar wallet actual
            this.data.currentWallet = {
                ...selected,
                selectedAt: new Date().toISOString()
            };
            
            // Agregar al historial
            this.addToHistory(selected);
            
            // Incrementar contador de carreras
            this.data.stats.totalRaces++;
        }
        
        return selected;
    }

    addToHistory(wallet) {
        const historyEntry = {
            address: wallet.address,
            balance: wallet.balance,
            percentage: wallet.percentage,
            rank: wallet.rank,
            timestamp: new Date().toISOString()
        };
        
        // Agregar al principio del historial
        this.data.history.unshift(historyEntry);
        
        // Limitar tamaño del historial
        const maxHistory = parseInt(process.env.MAX_HISTORY_ENTRIES) || 1000;
        if (this.data.history.length > maxHistory) {
            this.data.history = this.data.history.slice(0, maxHistory);
        }
    }

    getCurrentWallet() {
        return this.data.currentWallet;
    }

    getAllWallets() {
        return this.data.wallets;
    }

    getHistory(limit = 50) {
        return this.data.history.slice(0, limit);
    }

    getStats() {
        return {
            ...this.data.stats,
            currentWalletsCount: this.data.wallets.length,
            topHolder: this.data.wallets[0] || null,
            distribution: this.calculateDistribution()
        };
    }

    calculateDistribution() {
        if (this.data.wallets.length === 0) return null;
        
        const distribution = {
            whales: 0,      // > 1%
            dolphins: 0,    // 0.1% - 1%
            fish: 0,        // 0.01% - 0.1%
            shrimp: 0       // < 0.01%
        };
        
        this.data.wallets.forEach(w => {
            if (w.percentage > 1) distribution.whales++;
            else if (w.percentage > 0.1) distribution.dolphins++;
            else if (w.percentage > 0.01) distribution.fish++;
            else distribution.shrimp++;
        });
        
        return distribution;
    }

    async exportData(format = 'json') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const exportFile = path.join(this.backupPath, `export_${timestamp}.${format}`);
        
        if (format === 'json') {
            await fs.writeFile(exportFile, JSON.stringify(this.data, null, 2));
        } else if (format === 'csv') {
            const csv = this.convertToCSV(this.data.wallets);
            await fs.writeFile(exportFile, csv);
        }
        
        this.logger.info(`📤 Datos exportados: ${exportFile}`);
        return exportFile;
    }

    convertToCSV(wallets) {
        const headers = 'Rank,Address,Balance,Percentage,Added At,Last Seen\n';
        const rows = wallets.map(w => 
            `${w.rank},${w.address},${w.balance},${w.percentage},${w.addedAt},${w.lastSeen}`
        ).join('\n');
        
        return headers + rows;
    }

    async cleanup() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        await this.save();
        this.logger.debug('🧹 Base de datos cerrada correctamente');
    }
}

module.exports = Database;