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
    headless: process.env.HEADLESS_MODE === 'true' // CAMBIAR A ===
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
        
const webshareProxies = [
  '45.61.121.43:6642',
  '94.176.212.120:6636',
  '107.172.163.79:6595',
  '154.6.126.213:6184',
  '149.57.17.230:5698',
  '50.114.243.114:6355',
  '84.247.60.36:6006',
  '92.112.171.145:6113',
  '38.225.2.126:5909',
  '216.173.122.142:5869',
  '198.37.116.78:6037',
  '45.43.82.236:6230',
  '64.64.110.80:6603',
  '92.113.119.175:6123',
  '173.211.30.194:6628',
  '45.41.173.151:6518',
  '82.21.221.174:7004',
  '209.242.204.236:5977',
  '23.27.93.179:5758',
  '23.27.184.21:5622',
  '166.88.235.183:5811',
  '216.74.114.44:6327',
  '64.64.110.253:6776',
  '37.44.218.23:5706',
  '172.245.157.17:6602',
  '45.131.95.60:5724',
  '46.203.159.235:6836',
  '82.21.218.8:6360',
  '64.137.89.139:6212',
  '103.99.34.218:6833',
  '82.23.221.25:6355',
  '82.23.225.70:7921',
  '92.112.82.3:5238',
  '142.147.129.4:5613',
  '104.239.40.210:6829',
  '45.61.123.28:5707',
  '136.0.194.16:6753',
  '140.99.196.175:7053',
  '216.173.72.152:6771',
  '45.115.195.72:6050',
  '64.137.48.238:6445',
  '84.247.60.150:6120',
  '192.186.176.100:8150',
  '145.223.58.208:6477',
  '23.229.19.241:8836',
  '82.23.239.29:6366',
  '23.26.95.89:5571',
  '82.24.238.31:6838',
  '140.99.200.24:6401',
  '154.6.126.89:6060',
  '140.99.202.3:5881',
  '184.174.56.203:5215',
  '46.202.71.70:6065',
  '82.29.236.72:7885',
  '104.168.118.168:6124',
  '140.99.191.65:7942',
  '191.101.25.195:6592',
  '69.58.9.29:7099',
  '140.99.206.111:5489',
  '45.39.125.115:6523',
  '45.131.92.206:6817',
  '64.137.89.212:6285',
  '82.27.246.36:7360',
  '154.30.252.119:5250',
  '82.22.245.96:5920',
  '82.24.224.221:5577',
  '82.27.214.248:6590',
  '154.6.126.18:5989',
  '185.171.254.192:6224',
  '38.154.205.231:5499',
  '23.129.252.161:6429',
  '45.61.123.188:5867',
  '82.23.220.71:7410',
  '166.88.217.177:6510',
  '206.206.73.46:6662',
  '23.129.253.244:6862',
  '45.131.101.54:6321',
  '82.21.244.29:5352',
  '104.239.42.3:6028',
  '149.57.85.192:6160',
  '38.170.176.42:5437',
  '45.61.123.181:5860',
  '154.29.235.180:6521',
  '64.137.60.178:5242',
  '82.29.210.53:7896',
  '45.43.93.34:7283',
  '82.24.233.135:5457',
  '107.173.36.140:5595',
  '216.173.104.161:6298',
  '38.153.133.243:9647',
  '82.25.245.81:7404',
  '89.249.195.29:6784',
  '108.165.197.181:6420',
  '145.223.45.201:7235',
  '166.88.83.126:6783',
  '206.206.124.179:6760',
  '155.254.34.231:6211',
  '45.38.111.11:5926',
  '104.252.20.129:6061',
  '82.29.210.68:7911'
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
            ignoreHTTPSErrors: true,
            // AGREGAR ESTO PARA RENDER:
executablePath: process.env.NODE_ENV === 'production' 
    ? '/opt/render/project/.cache/puppeteer/chrome/linux-*/chrome-linux/chrome'
    : undefined
        });
        
        this.logger.debug('🌐 Browser iniciado con proxy rotativo');
    } catch (error) {
        this.logger.error('Error iniciando browser:', error);
        throw error;
    }
}

    async scrapeHolders() {
        // Verificar cooldown de 5 minutos
        const now = Date.now();
       const fiveMinutes = 5 * 60 * 1000;
        
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