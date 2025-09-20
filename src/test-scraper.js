// src/test-scraper-fixed.js - Version corregida para Puppeteer nuevo
const puppeteer = require('puppeteer');
const axios = require('axios');
require('dotenv').config();

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || '9X2apRBS8GACA9nbP44GJt46Py6JjSNFGvB14SXmpump';

// Helper para esperar
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testScraping() {
    console.log('🔍 Iniciando prueba de scraping...');
    console.log('Token:', TOKEN_ADDRESS);
    console.log('URL Solscan:', `https://solscan.io/token/${TOKEN_ADDRESS}`);
    
    // Método 1: Probar API directa de Solscan
    console.log('\n📊 Método 1: API de Solscan...');
    try {
        const response = await axios.get(
            `https://api.solscan.io/token/holder/list`,
            {
                params: {
                    address: TOKEN_ADDRESS,
                    offset: 0,
                    size: 20
                },
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            }
        );
        
        if (response.data && response.data.data) {
            console.log(`✅ API funcionó! Holders encontrados: ${response.data.data.total}`);
            return response.data.data.result;
        }
    } catch (error) {
        console.log(`❌ API falló: ${error.message} (Esto es normal, Solscan requiere API key)`);
    }

    // Método 2: Probar con Helius RPC (necesita API key)
    console.log('\n⛓️ Método 2: Helius RPC...');
    try {
        // Helius con API key gratuita
        const HELIUS_API_KEY = process.env.HELIUS_API_KEY || 'tu-api-key-aqui';
        const response = await axios.post(
            `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
            {
                jsonrpc: '2.0',
                id: 'test-holders',
                method: 'getTokenLargestAccounts',
                params: [TOKEN_ADDRESS]
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }
        );
        
        if (response.data && response.data.result && response.data.result.value) {
            const holders = response.data.result.value;
            console.log(`✅ Helius funcionó! Holders encontrados: ${holders.length}`);
            return holders;
        }
    } catch (error) {
        console.log(`❌ Helius falló: ${error.message} (Necesita API key - obtén una gratis en helius.dev)`);
    }

    // Método 3: Scraping visual con Puppeteer
    console.log('\n🌐 Método 3: Scraping con Puppeteer (modo visible)...');
    console.log('⏳ Abriendo navegador...');
    
    const browser = await puppeteer.launch({
        headless: false, // Modo visible para debug
        defaultViewport: { width: 1920, height: 1080 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        
        // Configurar user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        const url = `https://solscan.io/token/${TOKEN_ADDRESS}`;
        console.log(`📍 Navegando a: ${url}`);
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        console.log('⏳ Esperando que cargue la página...');
        await delay(5000); // Esperar 5 segundos
        
        // Intentar hacer click en el tab de holders
        console.log('🔍 Buscando tab de holders...');
        
        const holdersTabClicked = await page.evaluate(() => {
            // Buscar el tab de holders con varios selectores
            const selectors = [
                'a[href="#holders"]',
                'a[href*="holders"]',
                '.ant-tabs-tab:contains("Holders")',
                'div[role="tab"]:contains("Holders")',
                '[data-node-key="holders"]'
            ];
            
            for (const selector of selectors) {
                try {
                    const element = document.querySelector(selector);
                    if (element) {
                        element.click();
                        return true;
                    }
                } catch (e) {}
            }
            
            // Buscar por texto
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
                if (el.textContent === 'Holders' && (el.tagName === 'A' || el.tagName === 'BUTTON' || el.role === 'tab')) {
                    el.click();
                    return true;
                }
            }
            
            return false;
        });
        
        if (holdersTabClicked) {
            console.log('✅ Tab de holders clickeado');
            await delay(3000);
        } else {
            console.log('⚠️ No se encontró tab de holders, continuando...');
        }
        
        // Hacer scroll para cargar más datos
        console.log('📜 Haciendo scroll para cargar más datos...');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await delay(2000);
        
        // Intentar extraer holders
        console.log('📊 Extrayendo holders...');
        
        const holders = await page.evaluate(() => {
            const results = [];
            
            // Debug: ver qué hay en la página
            console.log('Debug - Buscando elementos...');
            const tables = document.querySelectorAll('table');
            console.log(`Tablas encontradas: ${tables.length}`);
            
            // Buscar en todas las posibles ubicaciones
            let rows = [];
            
            // Opción 1: Tabla Ant Design
            rows = document.querySelectorAll('.ant-table-tbody tr');
            console.log(`Filas ant-table: ${rows.length}`);
            
            // Opción 2: Tabla normal
            if (rows.length === 0) {
                tables.forEach(table => {
                    const tableRows = table.querySelectorAll('tbody tr');
                    if (tableRows.length > 0) {
                        rows = tableRows;
                        console.log(`Filas en tabla: ${tableRows.length}`);
                    }
                });
            }
            
            // Opción 3: Divs con estructura de lista
            if (rows.length === 0) {
                rows = document.querySelectorAll('[class*="holder"], [class*="account"], .list-item');
                console.log(`Items de lista: ${rows.length}`);
            }
            
            // Procesar las filas encontradas
            rows.forEach((row, index) => {
                const text = row.textContent || '';
                
                // Buscar direcciones de Solana (32-44 caracteres base58)
                const addressMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
                
                if (addressMatch) {
                    // Buscar números que podrían ser balance
                    const numbers = text.match(/[\d,]+\.?\d*/g) || [];
                    let balance = 0;
                    
                    // Tomar el primer número grande como balance
                    for (const num of numbers) {
                        const parsed = parseFloat(num.replace(/,/g, ''));
                        if (parsed > 0) {
                            balance = parsed;
                            break;
                        }
                    }
                    
                    results.push({
                        rank: index + 1,
                        address: addressMatch[0],
                        balance: balance,
                        text: text.substring(0, 200) // Para debug
                    });
                }
            });
            
            // Si no encontramos nada, buscar de forma más agresiva
            if (results.length === 0) {
                console.log('Búsqueda agresiva de holders...');
                const allText = document.body.innerText;
                const addresses = allText.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];
                
                addresses.slice(0, 10).forEach((addr, i) => {
                    results.push({
                        rank: i + 1,
                        address: addr,
                        balance: 0,
                        text: 'Found in page text'
                    });
                });
            }
            
            return results;
        });
        
        console.log(`\n📊 Holders encontrados: ${holders.length}`);
        
        if (holders.length > 0) {
            console.log('\n🎯 Primeros 5 holders:');
            holders.slice(0, 5).forEach(h => {
                console.log(`  ${h.rank}. ${h.address.slice(0,8)}...${h.address.slice(-6)}`);
                console.log(`     Balance: ${h.balance || 'No detectado'}`);
            });
        } else {
            console.log('❌ No se encontraron holders');
            console.log('\n💡 Posibles razones:');
            console.log('  - El token no existe en Solscan');
            console.log('  - La página tiene una estructura diferente');
            console.log('  - El token no tiene holders aún');
        }
        
        // Tomar screenshot para debug
        await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
        console.log('\n📸 Screenshot guardado como debug-screenshot.png');
        
        // Esperar un poco antes de cerrar para que puedas ver
        console.log('\n⏳ Cerrando en 5 segundos...');
        await delay(5000);
        
        return holders;
        
    } catch (error) {
        console.error('❌ Error durante scraping:', error);
    } finally {
        await browser.close();
        console.log('✅ Browser cerrado');
    }
}

// Método 4: Generar holders de prueba
function generateTestHolders() {
    console.log('\n🎲 Generando holders de prueba para desarrollo...');
    
    const holders = [];
    for (let i = 0; i < 50; i++) {
        const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        let address = '';
        for (let j = 0; j < 44; j++) {
            address += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        holders.push({
            rank: i + 1,
            address: address,
            balance: Math.floor(Math.random() * 1000000) / (i + 1),
            percentage: (20 / (i + 1)).toFixed(2)
        });
    }
    
    console.log(`✅ Generados ${holders.length} holders de prueba`);
    console.log('\n📝 Para usar estos datos de prueba, agrega a tu .env:');
    console.log('   USE_MOCK_DATA=true');
    
    return holders;
}

// Ejecutar pruebas
console.log('═══════════════════════════════════════════');
console.log('   TEST DE SCRAPING DE HOLDERS');
console.log('═══════════════════════════════════════════\n');

testScraping()
    .then(() => {
        console.log('\n═══════════════════════════════════════════');
        console.log('✅ Test completado');
        console.log('\n💡 Recomendaciones:');
        console.log('1. Si ningún método funcionó, usa USE_MOCK_DATA=true en .env');
        console.log('2. Para Helius, obtén API key gratis en https://helius.dev');
        console.log('3. Revisa el screenshot para ver qué vio el scraper');
        console.log('═══════════════════════════════════════════');
        
        // Generar datos de prueba como alternativa
        generateTestHolders();
    })
    .catch(error => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });