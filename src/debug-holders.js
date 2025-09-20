// src/debug-holders.js - Script de Debug para ver qué está pasando
const puppeteer = require('puppeteer');
require('dotenv').config();

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || 'GSSPA5zDNqpmao8BFnUHnnQrc3tgUeoVSesXtHhxpump';

async function debugSolscan() {
    console.log('═══════════════════════════════════════════');
    console.log('   DEBUG: BUSCANDO HOLDERS EN SOLSCAN');
    console.log('═══════════════════════════════════════════');
    console.log('Token:', TOKEN_ADDRESS);
    console.log('');
    
    const browser = await puppeteer.launch({
        headless: false, // SIEMPRE visible para debug
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: null
    });
    
    const page = await browser.newPage();
    
    try {
        // URL directa a holders con 40 por página
        const url = `https://solscan.io/token/${TOKEN_ADDRESS}?page_size=40#holders`;
        console.log('📍 Navegando a:', url);
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        console.log('⏳ Esperando 10 segundos para que cargue todo...');
        await new Promise(r => setTimeout(r, 10000));
        
        // Verificar el título de la página
        const title = await page.title();
        console.log('📄 Título de la página:', title);
        
        // Buscar y hacer click en el tab de holders
        console.log('\n🔍 Buscando tab de holders...');
        const tabFound = await page.evaluate(() => {
            const tabs = document.querySelectorAll('a, div[role="tab"], button, span');
            let found = false;
            
            for (const tab of tabs) {
                const text = (tab.textContent || '').toLowerCase();
                if (text.includes('holder') && !text.includes('placeholder')) {
                    console.log('Tab encontrado:', tab.textContent, 'Tag:', tab.tagName);
                    tab.click();
                    found = true;
                    break;
                }
            }
            
            return found;
        });
        
        if (tabFound) {
            console.log('✅ Tab de holders clickeado!');
            await new Promise(r => setTimeout(r, 5000));
        } else {
            console.log('⚠️ No se encontró tab de holders');
        }
        
        // Buscar tablas en la página
        console.log('\n🔍 Analizando estructura de la página...');
        const pageInfo = await page.evaluate(() => {
            const info = {
                tables: document.querySelectorAll('table').length,
                antTables: document.querySelectorAll('.ant-table').length,
                tbodyRows: document.querySelectorAll('tbody tr').length,
                allRows: document.querySelectorAll('tr').length,
                holdersFound: []
            };
            
            // Buscar todas las direcciones de Solana en la página
            const pageText = document.body.innerText;
            const addresses = pageText.match(/[1-9A-HJ-NP-Za-km-z]{44}/g) || [];
            
            // Contar cuántas direcciones únicas hay
            const uniqueAddresses = [...new Set(addresses)];
            info.uniqueAddresses = uniqueAddresses.length;
            info.firstAddresses = uniqueAddresses.slice(0, 5);
            
            // Buscar específicamente en tablas
            const rows = document.querySelectorAll('tbody tr, .ant-table-tbody tr');
            rows.forEach((row, i) => {
                const text = row.textContent || '';
                const addr = text.match(/[1-9A-HJ-NP-Za-km-z]{44}/);
                if (addr) {
                    info.holdersFound.push({
                        row: i + 1,
                        address: addr[0].substring(0, 8) + '...',
                        fullText: text.substring(0, 100)
                    });
                }
            });
            
            return info;
        });
        
        console.log('\n📊 Estructura encontrada:');
        console.log('  Tablas HTML:', pageInfo.tables);
        console.log('  Tablas Ant:', pageInfo.antTables);
        console.log('  Filas en tbody:', pageInfo.tbodyRows);
        console.log('  Total filas:', pageInfo.allRows);
        console.log('  Direcciones únicas:', pageInfo.uniqueAddresses);
        
        if (pageInfo.firstAddresses && pageInfo.firstAddresses.length > 0) {
            console.log('\n✅ Primeras direcciones encontradas:');
            pageInfo.firstAddresses.forEach((addr, i) => {
                console.log(`  ${i + 1}. ${addr.substring(0, 8)}...${addr.substring(-6)}`);
            });
        }
        
        if (pageInfo.holdersFound.length > 0) {
            console.log('\n✅ Holders en filas de tabla:');
            pageInfo.holdersFound.slice(0, 5).forEach(h => {
                console.log(`  Fila ${h.row}: ${h.address}`);
                console.log(`    Texto: ${h.fullText}`);
            });
        } else {
            console.log('\n❌ No se encontraron holders en las tablas');
        }
        
        // Intentar extraer holders con el método del scraper
        console.log('\n🔧 Probando extracción de holders...');
        const holders = await page.evaluate(() => {
            const results = [];
            
            // Método 1: Buscar en todas las filas
            const rows = [
                ...document.querySelectorAll('.ant-table-tbody tr'),
                ...document.querySelectorAll('tbody tr'),
                ...document.querySelectorAll('tr')
            ];
            
            console.log('Filas encontradas:', rows.length);
            
            rows.forEach((row, index) => {
                const text = row.textContent || '';
                const addressMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{44}/);
                
                if (addressMatch) {
                    results.push({
                        index: index,
                        address: addressMatch[0],
                        textLength: text.length,
                        hasNumbers: /\d+/.test(text)
                    });
                }
            });
            
            return results;
        });
        
        console.log(`\n📊 Holders extraídos: ${holders.length}`);
        if (holders.length > 0) {
            console.log('Primeros 5:');
            holders.slice(0, 5).forEach((h, i) => {
                console.log(`  ${i + 1}. ${h.address.substring(0, 8)}...${h.address.substring(-6)}`);
            });
        }
        
        // Tomar screenshot
        await page.screenshot({ path: 'debug-solscan.png', fullPage: true });
        console.log('\n📸 Screenshot guardado: debug-solscan.png');
        
        // Verificar si necesitamos hacer scroll o cambiar de página
        console.log('\n🔍 Buscando controles de paginación...');
        const paginationInfo = await page.evaluate(() => {
            const info = {
                hasLoadMore: false,
                hasPagination: false,
                hasScroll: false
            };
            
            // Buscar botón "Load More"
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                if (btn.textContent && btn.textContent.toLowerCase().includes('load more')) {
                    info.hasLoadMore = true;
                    info.loadMoreText = btn.textContent;
                }
            }
            
            // Buscar paginación
            const pagination = document.querySelector('.ant-pagination, .pagination, [class*="pagination"]');
            if (pagination) {
                info.hasPagination = true;
                info.paginationClass = pagination.className;
            }
            
            // Verificar si hay scroll
            info.hasScroll = document.body.scrollHeight > window.innerHeight;
            info.scrollHeight = document.body.scrollHeight;
            
            return info;
        });
        
        console.log('Controles encontrados:');
        console.log('  Load More:', paginationInfo.hasLoadMore);
        console.log('  Paginación:', paginationInfo.hasPagination);
        console.log('  Scroll disponible:', paginationInfo.hasScroll);
        
        console.log('\n⏳ Esperando 10 segundos antes de cerrar...');
        await new Promise(r => setTimeout(r, 10000));
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        await page.screenshot({ path: 'error-debug.png' });
        console.log('📸 Screenshot de error: error-debug.png');
    } finally {
        console.log('\n🏁 Debug completado. Cerrando browser...');
        await browser.close();
    }
}

// Ejecutar debug
console.log('Iniciando debug...\n');
debugSolscan().catch(console.error);