// src/services/HolderScraper.js - Versión COMPLETA con Puppeteer
const fs = require('fs').promises;
const path = require('path');
const Papa = require('papaparse');
const Logger = require('../utils/Logger');
const puppeteer = require('puppeteer'); // SIEMPRE cargar Puppeteer

class HolderScraper {
    constructor(database) {
        this.database = database;
        this.logger = new Logger();
        this.browser = null;
        this.lastScrapeTime = null;
        this.scrapeCount = 0;
        this.errorCount = 0;
        
        // Usar /tmp en Render
        const userHome = process.env.HOME || process.env.USERPROFILE || '/tmp';
        
        this.config = {
            tokenAddress: process.env.TOKEN_ADDRESS,
            downloadPath: '/tmp', // Siempre /tmp en Render
            maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
            timeout: parseInt(process.env.TIMEOUT_MS) || 60000,
            headless: true // Siempre headless en servidor
        };
    }

    async initialize() {
        try {
            await this.launchBrowser();
            this.logger.info('✅ Scraper automático CSV inicializado');
            this.logger.info(`📁 Carpeta de descarga: ${this.config.downloadPath}`);
        } catch (error) {
            this.logger.error('Error inicializando scraper:', error);
            throw error;
        }
    }

async launchBrowser() {
    try {
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--disable-extensions',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=IsolateOrigins',
                '--disable-site-isolation-trials'
            ],
            defaultViewport: null,
            ignoreHTTPSErrors: true,
            dumpio: true // Para ver más logs
        });
        
        this.logger.debug('🌐 Browser iniciado para descarga automática');
    } catch (error) {
        this.logger.error('Error iniciando browser:', error);
        throw error;
    }
}

    async scrapeHolders() {
        // QUITAR todas las verificaciones de producción
        // El scraper SIEMPRE debe intentar obtener datos nuevos
        
        // Verificar cooldown de 3 minutos
        const now = Date.now();
        const threeMinutes = 3 * 60 * 1000;
        
        if (this.lastScrapeTime) {
            const timeSinceLastScrape = now - new Date(this.lastScrapeTime).getTime();
            
            if (timeSinceLastScrape < threeMinutes) {
                const waitTime = Math.ceil((threeMinutes - timeSinceLastScrape) / 1000);
                this.logger.info(`⏳ Esperando ${waitTime} segundos antes de la próxima descarga`);
                return this.database.getAllWallets ? this.database.getAllWallets() : [];
            }
        }
        
        let holders = [];
        let lastError = null;
        
        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                this.logger.info(`🔍 Intento ${attempt}/${this.config.maxRetries} - Descarga automática de CSV...`);
                
                await this.cleanOldCSVs();
                holders = await this.downloadAndProcessCSV();
                
                if (holders.length > 0) {
                    this.updateDatabase(holders);
                    return holders;
                }
            } catch (error) {
                lastError = error;
                this.logger.warn(`⚠️ Intento ${attempt} falló: ${error.message}`);
                
                if (attempt < this.config.maxRetries) {
                    await this.delay(5000);
                }
            }
        }
        
        this.logger.error('❌ No se pudo descargar el CSV automáticamente');
        this.errorCount++;
        return this.database.getAllWallets ? this.database.getAllWallets() : [];
    }

    async cleanOldCSVs() {
        try {
            const files = await fs.readdir(this.config.downloadPath);
            for (const file of files) {
                if (file.includes('holders') && file.endsWith('.csv')) {
                    const filePath = path.join(this.config.downloadPath, file);
                    const stats = await fs.stat(filePath);
                    
                    if (Date.now() - stats.mtimeMs > 3600000) {
                        await fs.unlink(filePath);
                        this.logger.debug(`🗑️ CSV antiguo eliminado: ${file}`);
                    }
                }
            }
        } catch (error) {
            // No es crítico si falla
        }
    }

    async downloadAndProcessCSV() {
        // QUITAR la verificación de producción
        if (!this.browser) {
            throw new Error('Browser no inicializado');
        }
        
        const page = await this.browser.newPage();
        
        try {
            // CONFIGURACIÓN CRÍTICA PARA DESCARGAS
            const client = await page.target().createCDPSession();
            await client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: this.config.downloadPath
            });
            
            // User agent y bypass detección
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            });
            
            // Navegar DIRECTAMENTE a holders
            const url = `https://solscan.io/token/${this.config.tokenAddress}#holders`;
            this.logger.info(`📍 Navegando a: ${url}`);
            
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: this.config.timeout
            });
            
            // Esperar carga completa
            this.logger.info('⏳ Esperando que cargue Solscan...');
            await this.delay(10000);
            
            // Verificar si hay Cloudflare
            const hasCloudflare = await page.evaluate(() => {
                return document.title.includes('Cloudflare') || 
                       document.body.textContent.includes('Checking your browser');
            });
            
            if (hasCloudflare) {
                this.logger.info('⏳ Cloudflare detectado, esperando bypass...');
                await this.delay(15000);
            }
            
            // Asegurar que estamos en la pestaña de holders
            this.logger.info('🔍 Activando pestaña de holders...');
            await page.evaluate(() => {
                // Buscar y clickear el tab de holders
                const tabs = document.querySelectorAll('a, button, div[role="tab"]');
                for (const tab of tabs) {
                    if (tab.textContent && tab.textContent.toLowerCase().includes('holder')) {
                        tab.click();
                        return true;
                    }
                }
            });
            
            await this.delay(3000);
            
            // BUSCAR Y CLICKEAR EL BOTÓN EXPORT CSV
            this.logger.info('🎯 Buscando botón Export CSV...');
            
            const exportClicked = await page.evaluate(() => {
                // Buscar el botón de varias formas
                const buttons = document.querySelectorAll('button, a');
                
                for (const btn of buttons) {
                    const text = (btn.textContent || '').toLowerCase();
                    
                    // Buscar por texto
                    if (text.includes('export') && text.includes('csv')) {
                        console.log('Botón encontrado por texto:', btn.textContent);
                        btn.click();
                        return true;
                    }
                    
                    // Buscar por icono de descarga
                    if (btn.querySelector('svg') && text.includes('csv')) {
                        console.log('Botón encontrado con icono');
                        btn.click();
                        return true;
                    }
                }
                
                // Buscar por clase o atributos
                const exportBtn = document.querySelector('[aria-label*="Export"], [title*="Export"], .export-btn');
                if (exportBtn) {
                    exportBtn.click();
                    return true;
                }
                
                return false;
            });
            
            if (!exportClicked) {
                throw new Error('No se pudo encontrar el botón Export CSV');
            }
            
            this.logger.info('✅ Click en Export CSV realizado');
            
            // ESPERAR AL POPUP Y HACER CLICK EN DOWNLOAD
            this.logger.info('⏳ Esperando popup de confirmación...');
            await this.delay(2000);
            
            this.logger.info('🎯 Buscando botón Download en el popup...');
            
            const downloadStarted = await page.evaluate(() => {
                // Buscar el botón Download en el popup (suele ser rosa/morado)
                const buttons = document.querySelectorAll('button');
                
                for (const btn of buttons) {
                    const text = (btn.textContent || '').toLowerCase();
                    
                    // Buscar botón que diga "download"
                    if (text.includes('download')) {
                        console.log('Botón Download encontrado:', btn.textContent);
                        btn.click();
                        return true;
                    }
                }
                
                // Buscar por clases que sugieran que es el botón principal del popup
                const primaryButtons = document.querySelectorAll('.ant-btn-primary, .btn-primary, [class*="primary"], [class*="download"]');
                for (const btn of primaryButtons) {
                    if (btn.tagName === 'BUTTON' && btn.offsetParent !== null) { // Verificar que sea visible
                        console.log('Botón primario encontrado');
                        btn.click();
                        return true;
                    }
                }
                
                // Buscar botones con colores típicos de "acción principal"
                const allButtons = document.querySelectorAll('button');
                for (const btn of allButtons) {
                    const styles = window.getComputedStyle(btn);
                    const bgColor = styles.backgroundColor;
                    
                    // Buscar botones rosa/morado/azul (colores típicos de acción principal)
                    if (bgColor.includes('rgb') && btn.offsetParent !== null) {
                        const isColorful = bgColor.includes('255') || bgColor.includes('254') || bgColor.includes('253');
                        if (isColorful) {
                            console.log('Botón colorido encontrado');
                            btn.click();
                            return true;
                        }
                    }
                }
                
                return false;
            });
            
            if (!downloadStarted) {
                this.logger.warn('⚠️ No se encontró el botón Download en el popup, intentando alternativas...');
                
                // Intentar presionar Enter como alternativa
                await page.keyboard.press('Enter');
                this.logger.info('⏎ Presionado Enter como alternativa');
            } else {
                this.logger.info('✅ Click en Download realizado');
            }
            
            // ESPERAR A QUE SE DESCARGUE
            this.logger.info('⏳ Esperando descarga del archivo...');
            
            // Esperar a que aparezca el archivo
            const csvPath = await this.waitForDownload();
            
            if (!csvPath) {
                throw new Error('El archivo CSV no se descargó');
            }
            
            this.logger.info(`✅ CSV descargado: ${path.basename(csvPath)}`);
            
            // PARSEAR EL CSV
            const holders = await this.parseDownloadedCSV(csvPath);
            
            this.logger.info(`✅ ${holders.length} holders obtenidos del CSV`);
            
            return holders;
            
        } catch (error) {
            this.logger.error('Error en descarga automática:', error);
            
            // Tomar screenshot para debug
            if (!this.config.headless) {
                await page.screenshot({ path: 'error-download.png' });
                this.logger.info('📸 Screenshot de error: error-download.png');
            }
            
            throw error;
            
        } finally {
            await page.close();
        }
    }

    async waitForDownload() {
        const maxWaitTime = 30000; // 30 segundos máximo
        const checkInterval = 1000; // Verificar cada segundo
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            try {
                const files = await fs.readdir(this.config.downloadPath);
                
                // Buscar archivos CSV recientes
                for (const file of files) {
                    if (file.endsWith('.csv') && 
                        (file.includes('holder') || file.includes(this.config.tokenAddress.substring(0, 8)))) {
                        
                        const filePath = path.join(this.config.downloadPath, file);
                        const stats = await fs.stat(filePath);
                        
                        // Si el archivo fue creado en los últimos 60 segundos
                        if (Date.now() - stats.mtimeMs < 60000) {
                            // Esperar un poco para asegurar que terminó de descargarse
                            await this.delay(2000);
                            return filePath;
                        }
                    }
                }
            } catch (error) {
                // Continuar esperando
            }
            
            await this.delay(checkInterval);
        }
        
        return null;
    }

    async parseDownloadedCSV(csvPath) {
        try {
            const csvContent = await fs.readFile(csvPath, 'utf8');
            
            return new Promise((resolve, reject) => {
                Papa.parse(csvContent, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        const holders = [];
                        
                        results.data.forEach((row, index) => {
                            // El CSV descargado tiene estas columnas típicamente:
                            // Owner, Quantity, Percentage, Value
                            
                            let address = '';
                            let balance = 0;
                            let percentage = 0;
                            
                            // Buscar la dirección (puede estar en diferentes columnas)
                            for (const key in row) {
                                const value = row[key];
                                
                                // Si es una dirección de Solana (44 caracteres)
                                if (typeof value === 'string' && value.length === 44) {
                                    address = value;
                                    break;
                                }
                            }
                            
                            // Si no encontramos por longitud, buscar por nombre de columna
                            if (!address) {
                                address = row.Owner || row.Address || row.Wallet || '';
                            }
                            
                            // Obtener balance y porcentaje
                            balance = row.Quantity || row.Amount || row.Balance || 0;
                            percentage = row.Percentage || row.Percent || 0;
                            
                            // Limpiar porcentaje si viene con %
                            if (typeof percentage === 'string') {
                                percentage = parseFloat(percentage.replace('%', ''));
                            }
                            
                            if (address && address.length === 44) {
                                holders.push({
                                    rank: index + 1,
                                    address: address,
                                    balance: parseFloat(balance) || 0,
                                    percentage: parseFloat(percentage) || 0
                                });
                            }
                        });
                        
                        // Mostrar info de los primeros holders
                        if (holders.length > 0) {
                            this.logger.info('🏆 Top 5 holders del CSV:');
                            holders.slice(0, 5).forEach((h, i) => {
                                this.logger.info(`   ${i + 1}. ${h.address.slice(0, 8)}... Balance: ${h.balance.toLocaleString()}`);
                            });
                        }
                        
                        resolve(holders);
                    },
                    error: (error) => {
                        reject(error);
                    }
                });
            });
            
        } catch (error) {
            this.logger.error('Error parseando CSV:', error);
            throw error;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    updateDatabase(holders) {
        if (holders.length === 0) {
            this.logger.warn('⚠️ No hay holders para actualizar');
            return;
        }
        
        this.database.updateHolders(holders);
        this.lastScrapeTime = new Date().toISOString();
        this.scrapeCount++;
        
        this.logger.info(`✅ Base de datos actualizada con ${holders.length} holders REALES desde CSV`);
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.logger.debug('🧹 Browser cerrado');
        }
    }

    getStats() {
        return {
            lastScrapeTime: this.lastScrapeTime,
            totalScrapes: this.scrapeCount,
            errors: this.errorCount,
            successRate: this.scrapeCount > 0 
                ? ((this.scrapeCount / (this.scrapeCount + this.errorCount)) * 100).toFixed(2) + '%'
                : '0%'
        };
    }
}

module.exports = HolderScraper;