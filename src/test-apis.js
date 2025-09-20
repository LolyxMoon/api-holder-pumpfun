// src/test-apis.js - Test SOLO con APIs REALES
const axios = require('axios');
require('dotenv').config();

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const SOLSCAN_API_KEY = process.env.SOLSCAN_API_KEY;

console.log('═══════════════════════════════════════════');
console.log('   TEST DE APIs REALES - NO FAKE DATA');
console.log('═══════════════════════════════════════════\n');
console.log('Token:', TOKEN_ADDRESS);
console.log('Helius API Key:', HELIUS_API_KEY ? '✅ Configurada' : '❌ No configurada');
console.log('Solscan API Key:', SOLSCAN_API_KEY ? '✅ Configurada' : '❌ No configurada');
console.log('');

async function testHelius() {
    console.log('🔍 Probando Helius API...');
    
    if (!HELIUS_API_KEY) {
        console.log('❌ No hay Helius API key configurada');
        return null;
    }
    
    try {
        const response = await axios.post(
            `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
            {
                jsonrpc: '2.0',
                id: 'test',
                method: 'getTokenLargestAccounts',
                params: [TOKEN_ADDRESS]
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }
        );
        
        if (response.data?.result?.value) {
            const holders = response.data.result.value;
            console.log(`✅ HELIUS FUNCIONA! ${holders.length} holders encontrados`);
            
            // Mostrar top 5
            console.log('\nTop 5 holders:');
            holders.slice(0, 5).forEach((h, i) => {
                const amount = h.uiAmount || (h.amount / 1000000000);
                console.log(`  ${i + 1}. ${h.address.slice(0, 8)}...${h.address.slice(-6)}: ${amount.toFixed(2)}`);
            });
            
            return holders;
        }
    } catch (error) {
        console.log(`❌ Helius falló: ${error.response?.data?.error?.message || error.message}`);
    }
    
    return null;
}

async function testSolscan() {
    console.log('\n🔍 Probando Solscan API...');
    
    if (!SOLSCAN_API_KEY) {
        console.log('❌ No hay Solscan API key configurada');
        return null;
    }
    
    try {
        const response = await axios.get(
            'https://api.solscan.io/v2/token/holders',
            {
                params: {
                    address: TOKEN_ADDRESS,
                    page: 1,
                    page_size: 20
                },
                headers: {
                    'Accept': 'application/json',
                    'token': SOLSCAN_API_KEY
                },
                timeout: 10000
            }
        );
        
        if (response.data?.data?.items) {
            const holders = response.data.data.items;
            console.log(`✅ SOLSCAN FUNCIONA! ${holders.length} holders encontrados`);
            console.log(`   Total holders del token: ${response.data.data.total || 'N/A'}`);
            
            // Mostrar top 5
            console.log('\nTop 5 holders:');
            holders.slice(0, 5).forEach((h, i) => {
                console.log(`  ${i + 1}. ${h.owner.slice(0, 8)}...${h.owner.slice(-6)}: ${h.amount} (${h.percentage}%)`);
            });
            
            return holders;
        }
    } catch (error) {
        console.log(`❌ Solscan falló: ${error.response?.data?.message || error.message}`);
        if (error.response?.status === 401) {
            console.log('   → El API key puede estar mal o expirado');
        }
    }
    
    return null;
}

async function testDexScreener() {
    console.log('\n🔍 Probando DexScreener (info del token)...');
    
    try {
        const response = await axios.get(
            `https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESS}`,
            { timeout: 10000 }
        );
        
        if (response.data?.pairs?.[0]) {
            const pair = response.data.pairs[0];
            console.log(`✅ Token encontrado en DexScreener:`);
            console.log(`   Nombre: ${pair.baseToken.name}`);
            console.log(`   Symbol: ${pair.baseToken.symbol}`);
            console.log(`   Precio: $${pair.priceUsd || 'N/A'}`);
            console.log(`   Market Cap: $${pair.marketCap || 'N/A'}`);
            console.log(`   Liquidez: $${pair.liquidity?.usd || 'N/A'}`);
            return true;
        } else {
            console.log('❌ Token no encontrado en DexScreener');
        }
    } catch (error) {
        console.log(`❌ DexScreener falló: ${error.message}`);
    }
    
    return false;
}

// Ejecutar todos los tests
async function runAllTests() {
    const heliusResult = await testHelius();
    const solscanResult = await testSolscan();
    const dexResult = await testDexScreener();
    
    console.log('\n═══════════════════════════════════════════');
    console.log('RESUMEN:');
    console.log('═══════════════════════════════════════════');
    
    if (heliusResult || solscanResult) {
        console.log('✅ Al menos una API funciona correctamente');
        console.log('✅ Puedes obtener HOLDERS REALES');
        
        const totalHolders = heliusResult?.length || solscanResult?.length || 0;
        console.log(`\n📊 Total de holders disponibles: ${totalHolders}`);
        console.log('\n🎯 Tu app debería funcionar correctamente con estos datos REALES');
    } else {
        console.log('❌ Ninguna API está funcionando');
        console.log('\nPosibles soluciones:');
        console.log('1. Verifica que el TOKEN_ADDRESS sea correcto');
        console.log('2. Verifica las API keys en el .env');
        console.log('3. El token puede no existir o no tener holders aún');
    }
    
    console.log('\n💡 Para usar estos datos en tu app:');
    console.log('1. Asegúrate de que el .env tenga las API keys');
    console.log('2. Reinicia la app: npm run dev');
    console.log('3. Los holders REALES deberían aparecer');
}

runAllTests().catch(console.error);