// src/services/HolderScraper.js - Con SmartProxy integrado
const fs = require('fs').promises;
const path = require('path');
const Papa = require('papaparse');
const Logger = require('../utils/Logger');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
console.log('SMARTPROXY_USER:', process.env.SMARTPROXY_USER);
console.log('SMARTPROXY_PASS:', process.env.SMARTPROXY_PASS ? '***configurado***' : 'NO configurado');

class HolderScraper {
    constructor(database) {
        this.database = database;
        this.logger = new Logger();
        this.browser = null;
        this.lastScrapeTime = null;
        this.scrapeCount = 0;
        this.errorCount = 0;
        
        // Usar /tmp en servidor o Downloads en local
        const userHome = process.env.HOME || process.env.USERPROFILE || '/tmp';
        
        this.config = {
            tokenAddress: process.env.TOKEN_ADDRESS,
            downloadPath: process.env.NODE_ENV === 'production' ? '/tmp' : path.join(userHome, 'Downloads'),
            maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
            timeout: parseInt(process.env.TIMEOUT_MS) || 60000,
            headless: process.env.HEADLESS_MODE !== 'false' // true por defecto
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
        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ];
        
        // Lista de proxies de Webshare
        const webshareProxies = [
            '142.111.48.253:7030',
            '198.23.239.134:6540',
            '45.38.107.97:6014',
            '107.172.163.27:6543',
            '64.137.96.74:6641',
            '154.203.43.247:5536',
            '84.247.60.125:6095',
            '216.10.27.159:6837',
            '142.111.67.146:5611',
            '142.147.128.93:6593'
        ];
        
        // Seleccionar proxy aleatorio
        const randomProxy = webshareProxies[Math.floor(Math.random() * webshareProxies.length)];
        args.push(`--proxy-server=${randomProxy}`);
        this.logger.info(`🌐 Usando Webshare proxy: ${randomProxy}`);
        
        // Guardar el proxy usado para autenticación posterior
        this.currentProxy = randomProxy;
        
        this.browser = await puppeteer.launch({
            headless: this.config.headless,
            args: args,
            defaultViewport: null,
            ignoreHTTPSErrors: true
        });
        
        this.logger.debug('🌐 Browser iniciado con proxy rotativo');
    } catch (error) {
        this.logger.error('Error iniciando browser:', error);
        throw error;
    }
}

    async scrapeHolders() {
        // Verificar cooldown de 8 minutos
        const now = Date.now();
        const eightMinutes = 8 * 60 * 1000;
        
        if (this.lastScrapeTime) {
            const timeSinceLastScrape = now - new Date(this.lastScrapeTime).getTime();
            
            if (timeSinceLastScrape < eightMinutes) {
                const waitTime = Math.ceil((eightMinutes - timeSinceLastScrape) / 1000);
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
    if (!this.browser) throw new Error('Browser no inicializado');
    
    const page = await this.browser.newPage();
    
    try {
        // Autenticación Webshare (siempre con las mismas credenciales)
        await page.authenticate({
            username: 'trtgcawq',
            password: 'hdaep8j470gu'
        });
        this.logger.info(`✅ Autenticación completada para proxy: ${this.currentProxy || 'default'}`);
        
        // VERIFICAR SI EL PROXY ESTÁ FUNCIONANDO
        try {
            await page.goto('https://ipinfo.io/json', { timeout: 10000 });
            const ipInfo = await page.evaluate(() => {
                const text = document.body.innerText;
                return JSON.parse(text);
            });
            
            this.logger.info(`✅ Proxy activo - IP: ${ipInfo.ip}`);
            this.logger.info(`📍 Ubicación: ${ipInfo.city}, ${ipInfo.country}`);
            
            // Si no es Argentina, el proxy funciona
            if (ipInfo.country !== 'AR') {
                this.logger.info('🔄 Proxy funcionando correctamente');
            } else {
                this.logger.warn('⚠️ Usando IP local (Argentina)');
            }
        } catch (e) {
            this.logger.warn('No se pudo verificar IP del proxy');
        }
        
        // CONFIGURACIÓN CRÍTICA PARA DESCARGAS - usar ruta absoluta
        const client = await page.target().createCDPSession();
        const downloadPath = path.resolve(this.config.downloadPath);
        
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath
        });
        
        this.logger.info(`📁 Configurado para descargar en: ${downloadPath}`);
        
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
            const buttons = document.querySelectorAll('button, a');
            
            for (const btn of buttons) {
                const text = (btn.textContent || '').toLowerCase();
                
                if (text.includes('export') && text.includes('csv')) {
                    console.log('Botón encontrado por texto:', btn.textContent);
                    btn.click();
                    return true;
                }
                
                if (btn.querySelector('svg') && text.includes('csv')) {
                    console.log('Botón encontrado con icono');
                    btn.click();
                    return true;
                }
            }
            
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
            const buttons = document.querySelectorAll('button');
            
            for (const btn of buttons) {
                const text = (btn.textContent || '').toLowerCase();
                
                if (text.includes('download')) {
                    console.log('Botón Download encontrado:', btn.textContent);
                    btn.click();
                    return true;
                }
            }
            
            const primaryButtons = document.querySelectorAll('.ant-btn-primary, .btn-primary, [class*="primary"], [class*="download"]');
            for (const btn of primaryButtons) {
                if (btn.tagName === 'BUTTON' && btn.offsetParent !== null) {
                    console.log('Botón primario encontrado');
                    btn.click();
                    return true;
                }
            }
            
            return false;
        });
        
        if (!downloadStarted) {
            this.logger.warn('⚠️ No se encontró el botón Download, intentando Enter...');
            await page.keyboard.press('Enter');
        } else {
            this.logger.info('✅ Click en Download realizado');
        }
        
        // ESPERAR A QUE SE DESCARGUE
        this.logger.info('⏳ Esperando descarga del archivo...');
        
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
        const maxWaitTime = 30000;
        const checkInterval = 1000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            try {
                const files = await fs.readdir(this.config.downloadPath);
                
                for (const file of files) {
                    if (file.endsWith('.csv') && 
                        (file.includes('holder') || file.includes(this.config.tokenAddress.substring(0, 8)))) {
                        
                        const filePath = path.join(this.config.downloadPath, file);
                        const stats = await fs.stat(filePath);
                        
                        if (Date.now() - stats.mtimeMs < 60000) {
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
                            let address = '';
                            let balance = 0;
                            let percentage = 0;
                            
                            for (const key in row) {
                                const value = row[key];
                                
                                if (typeof value === 'string' && value.length === 44) {
                                    address = value;
                                    break;
                                }
                            }
                            
                            if (!address) {
                                address = row.Owner || row.Address || row.Wallet || '';
                            }
                            
                            balance = row.Quantity || row.Amount || row.Balance || 0;
                            percentage = row.Percentage || row.Percent || 0;
                            
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