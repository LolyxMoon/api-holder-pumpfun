// src/test-all-holders.js - Test para obtener TODOS los holders de Solscan
const axios = require('axios');
require('dotenv').config();

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
const SOLSCAN_API_KEY = process.env.SOLSCAN_API_KEY;

console.log('═══════════════════════════════════════════');
console.log('   TEST: OBTENER TODOS LOS HOLDERS');
console.log('═══════════════════════════════════════════\n');
console.log('Token:', TOKEN_ADDRESS);
console.log('Solscan API Key:', SOLSCAN_API_KEY ? '✅ Configurada' : '❌ No configurada');
console.log('');

async function getAllHoldersFromSolscan() {
    if (!SOLSCAN_API_KEY) {
        console.log('❌ No hay Solscan API key. No se puede continuar.');
        return [];
    }
    
    console.log('🔍 Obteniendo TODOS los holders de Solscan...\n');
    
    const allHolders = [];
    let page = 1;
    let hasMore = true;
    const pageSize = 100;
    
    while (hasMore) {
        try {
            console.log(`📄 Descargando página ${page}...`);
            
            const response = await axios.get(
                'https://api.solscan.io/v2/token/holders',
                {
                    params: {
                        address: TOKEN_ADDRESS,
                        page: page,
                        page_size: pageSize,
                        sort_by: 'amount',
                        sort_order: 'desc'
                    },
                    headers: {
                        'Accept': 'application/json',
                        'token': SOLSCAN_API_KEY
                    },
                    timeout: 15000
                }
            );
            
            if (response.data?.data?.items && response.data.data.items.length > 0) {
                const pageHolders = response.data.data.items;
                allHolders.push(...pageHolders);
                
                console.log(`   ✅ ${pageHolders.length} holders en esta página`);
                console.log(`   📊 Total acumulado: ${allHolders.length} holders`);
                
                // Info del primer holder de esta página
                if (pageHolders[0]) {
                    const first = pageHolders[0];
                    console.log(`   👑 Mayor holder página ${page}: ${first.owner.slice(0,8)}...${first.owner.slice(-6)}`);
                    console.log(`      Balance: ${first.amount} (${first.percentage}%)`);
                }
                
                // Verificar si hay más páginas
                const total = response.data.data.total || 0;
                console.log(`   📈 Total holders en el token: ${total}`);
                
                if (allHolders.length >= total || pageHolders.length < pageSize) {
                    hasMore = false;
                    console.log(`\n✅ DESCARGA COMPLETA!`);
                } else {
                    page++;
                    // Pausa para no saturar la API
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } else {
                hasMore = false;
                console.log('   ℹ️ No hay más holders');
            }
        } catch (error) {
            console.error(`\n❌ Error en página ${page}:`, error.response?.data || error.message);
            
            if (error.response?.status === 429) {
                console.log('⚠️ Rate limit alcanzado. Esperando 5 segundos...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                // Reintentar la misma página
                continue;
            }
            
            hasMore = false;
        }
    }
    
    return allHolders;
}

async function analyzeHolders(holders) {
    console.log('\n═══════════════════════════════════════════');
    console.log('📊 ANÁLISIS DE HOLDERS');
    console.log('═══════════════════════════════════════════');
    
    console.log(`\n✅ TOTAL HOLDERS: ${holders.length}`);
    
    // Top 10 holders
    console.log('\n👑 TOP 10 HOLDERS:');
    holders.slice(0, 10).forEach((h, i) => {
        console.log(`  ${i + 1}. ${h.owner.slice(0,8)}...${h.owner.slice(-6)}: ${h.amount} tokens (${h.percentage}%)`);
    });
    
    // Distribución
    const whales = holders.filter(h => parseFloat(h.percentage) > 1).length;
    const dolphins = holders.filter(h => parseFloat(h.percentage) > 0.1 && parseFloat(h.percentage) <= 1).length;
    const fish = holders.filter(h => parseFloat(h.percentage) > 0.01 && parseFloat(h.percentage) <= 0.1).length;
    const shrimp = holders.filter(h => parseFloat(h.percentage) <= 0.01).length;
    
    console.log('\n🐋 DISTRIBUCIÓN:');
    console.log(`  Whales (>1%): ${whales} holders`);
    console.log(`  Dolphins (0.1-1%): ${dolphins} holders`);
    console.log(`  Fish (0.01-0.1%): ${fish} holders`);
    console.log(`  Shrimp (<0.01%): ${shrimp} holders`);
    
    // Concentración
    const top10Percentage = holders.slice(0, 10).reduce((sum, h) => sum + parseFloat(h.percentage), 0);
    console.log(`\n📈 CONCENTRACIÓN:`);
    console.log(`  Top 10 holders controlan: ${top10Percentage.toFixed(2)}% del supply`);
}

// Ejecutar test
async function runTest() {
    const startTime = Date.now();
    
    const holders = await getAllHoldersFromSolscan();
    
    if (holders.length > 0) {
        await analyzeHolders(holders);
        
        const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n⏱️ Tiempo total: ${timeElapsed} segundos`);
        console.log('\n✅ TEST EXITOSO - Todos los holders obtenidos');
    } else {
        console.log('\n❌ No se pudieron obtener holders');
        console.log('\nPosibles razones:');
        console.log('1. El token no existe');
        console.log('2. El token no tiene holders');
        console.log('3. La API key es incorrecta');
        console.log('4. Problema de conexión');
    }
}

runTest().catch(console.error);