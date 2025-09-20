// public/dashboard.js - JavaScript del Dashboard
const API_URL = 'http://localhost:3001/api';
let allHolders = [];
let holdersHistory = [];
let currentTab = 'all';

// Inicializar
async function init() {
    console.log('Iniciando dashboard...');
    await loadHolders();
    await loadStats();
    setInterval(loadStats, 30000); // Actualizar cada 30 segundos
    setInterval(loadHolders, 60000); // Recargar holders cada minuto
}

// Cargar holders
async function loadHolders() {
    try {
        console.log('Cargando holders...');
        const response = await fetch(`${API_URL}/all-wallets?limit=1000`);
        const data = await response.json();
        
        if (data.success) {
            allHolders = data.data;
            console.log(`Cargados ${allHolders.length} holders`);
            
            // Cargar historial si existe
            loadHoldersHistory();
            
            // Actualizar vista
            updateHoldersView();
            updateDiamondHands();
            calculateStats();
        } else {
            console.error('Error en respuesta:', data);
        }
    } catch (error) {
        console.error('Error cargando holders:', error);
    }
}

// Cargar historial de holders (para comparar)
function loadHoldersHistory() {
    const saved = localStorage.getItem('holdersHistory');
    if (saved) {
        holdersHistory = JSON.parse(saved);
    }
    
    // Guardar snapshot actual
    const currentSnapshot = {
        timestamp: new Date().toISOString(),
        holders: allHolders.map(h => h.address)
    };
    
    if (!holdersHistory.length) {
        holdersHistory = [currentSnapshot];
    } else {
        // Solo guardar si han pasado más de 10 minutos
        const lastSnapshot = holdersHistory[holdersHistory.length - 1];
        const timeDiff = new Date() - new Date(lastSnapshot.timestamp);
        if (timeDiff > 600000) { // 10 minutos
            holdersHistory.push(currentSnapshot);
            // Mantener solo últimos 100 snapshots
            if (holdersHistory.length > 100) {
                holdersHistory = holdersHistory.slice(-100);
            }
        }
    }
    
    localStorage.setItem('holdersHistory', JSON.stringify(holdersHistory));
}

// Calcular estadísticas
function calculateStats() {
    const totalHolders = allHolders.length;
    
    // Obtener primer snapshot (holders originales)
    const firstSnapshot = holdersHistory[0];
    const originalHolders = firstSnapshot ? firstSnapshot.holders : [];
    
    // Calcular OG holders (están desde el principio)
    const ogHolders = allHolders.filter(h => 
        originalHolders.includes(h.address)
    ).length;
    
    // Diamond hands (top 20% holders)
    const diamondHands = Math.ceil(totalHolders * 0.2);
    
    // Wallets que vendieron (estaban antes pero ya no)
    const currentAddresses = allHolders.map(h => h.address);
    const soldWallets = originalHolders.filter(addr => 
        !currentAddresses.includes(addr)
    ).length;
    
    // Actualizar UI
    document.getElementById('totalHolders').textContent = totalHolders || '0';
    document.getElementById('soldWallets').textContent = soldWallets || '0';
    document.getElementById('ogHolders').textContent = ogHolders || '0';
    document.getElementById('diamondHands').textContent = diamondHands || '0';
    
    // Porcentajes
    if (totalHolders > 0) {
        document.getElementById('ogPercentage').textContent = 
            `${((ogHolders / totalHolders) * 100).toFixed(1)}% del total`;
        document.getElementById('diamondPercentage').textContent = 
            `${((diamondHands / totalHolders) * 100).toFixed(1)}% del total`;
    }
    
    // Cambios
    if (holdersHistory.length > 1) {
        const prevSnapshot = holdersHistory[holdersHistory.length - 2];
        const change = totalHolders - prevSnapshot.holders.length;
        const changeElement = document.getElementById('holdersChange');
        if (changeElement) {
            changeElement.textContent = change >= 0 ? `+${change} nuevos` : `${change} menos`;
            changeElement.className = change >= 0 ? 'stat-change positive' : 'stat-change negative';
        }
    }
}

// Actualizar vista de holders
function updateHoldersView() {
    let filteredHolders = [...allHolders];
    
    // Filtrar según tab activa
    if (currentTab === 'diamond') {
        // Top 20% holders
        filteredHolders = filteredHolders.slice(0, Math.ceil(allHolders.length * 0.2));
    } else if (currentTab === 'og') {
        const firstSnapshot = holdersHistory[0];
        if (firstSnapshot) {
            filteredHolders = filteredHolders.filter(h => 
                firstSnapshot.holders.includes(h.address)
            );
        }
    } else if (currentTab === 'new') {
        const firstSnapshot = holdersHistory[0];
        if (firstSnapshot) {
            filteredHolders = filteredHolders.filter(h => 
                !firstSnapshot.holders.includes(h.address)
            );
        }
    }
    
    // Generar tabla
    let html = `
        <table class="holders-table">
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Dirección</th>
                    <th>Balance</th>
                    <th>%</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    filteredHolders.slice(0, 50).forEach(holder => {
        const badges = getBadges(holder);
        
        html += `
            <tr>
                <td>#${holder.rank}</td>
                <td class="address" onclick="copyAddress('${holder.address}')">
                    ${holder.address.slice(0, 6)}...${holder.address.slice(-4)}
                </td>
                <td class="balance">${formatNumber(holder.balance)}</td>
                <td>${holder.percentage ? holder.percentage.toFixed(2) : '0.00'}%</td>
                <td>${badges}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    document.getElementById('holdersContent').innerHTML = html;
}

// Actualizar Diamond Hands
function updateDiamondHands() {
    const diamondHolders = allHolders.slice(0, 10); // Top 10
    
    let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
    
    diamondHolders.forEach((holder, index) => {
        html += `
            <div style="padding: 15px; background: #2a2a2a; border-radius: 10px; border-left: 3px solid #00d4ff;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 20px; font-weight: bold; color: #00d4ff;">
                            #${index + 1}
                        </div>
                        <div class="address" style="margin: 5px 0; color: #667eea;">
                            ${holder.address.slice(0, 8)}...${holder.address.slice(-6)}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 18px; font-weight: bold; color: white;">
                            ${holder.percentage ? holder.percentage.toFixed(2) : '0.00'}%
                        </div>
                        <div style="font-size: 12px; color: #888;">
                            ${formatNumber(holder.balance)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    const diamondContent = document.getElementById('diamondContent');
    if (diamondContent) {
        diamondContent.innerHTML = html;
    }
}

// Obtener badges para un holder
function getBadges(holder) {
    let badges = [];
    
    // Diamond hand (top 10)
    if (holder.rank <= 10) {
        badges.push('<span class="badge diamond">💎 Diamond</span>');
    }
    
    // OG holder
    const firstSnapshot = holdersHistory[0];
    if (firstSnapshot && firstSnapshot.holders.includes(holder.address)) {
        badges.push('<span class="badge og">OG</span>');
    } else if (holdersHistory.length > 0) {
        badges.push('<span class="badge new">New</span>');
    }
    
    return badges.join(' ');
}

// Buscar wallet
async function searchWallet() {
    const address = document.getElementById('searchInput').value.trim();
    
    if (!address) {
        document.getElementById('searchResults').classList.remove('active');
        return;
    }
    
    const results = document.getElementById('searchResults');
    results.classList.add('active');
    
    // Buscar en holders actuales
    const holder = allHolders.find(h => 
        h.address.toLowerCase() === address.toLowerCase()
    );
    
    if (holder) {
        results.innerHTML = `
            <h4>✅ Wallet Encontrada</h4>
            <div style="margin-top: 15px;">
                <p><strong>Dirección:</strong> ${holder.address}</p>
                <p><strong>Rank:</strong> #${holder.rank}</p>
                <p><strong>Balance:</strong> ${formatNumber(holder.balance)}</p>
                <p><strong>Porcentaje:</strong> ${holder.percentage ? holder.percentage.toFixed(4) : '0.0000'}%</p>
                <p><strong>Status:</strong> ${getBadges(holder) || 'Holder activo'}</p>
            </div>
        `;
    } else {
        // Buscar en historial
        let wasHolder = false;
        for (const snapshot of holdersHistory) {
            if (snapshot.holders.includes(address)) {
                wasHolder = true;
                break;
            }
        }
        
        if (wasHolder) {
            results.innerHTML = `
                <h4>❌ Wallet No Es Holder Actual</h4>
                <div style="margin-top: 15px;">
                    <p>Esta wallet fue holder anteriormente pero ya vendió sus tokens.</p>
                    <p><span class="badge sold">Vendió</span></p>
                </div>
            `;
        } else {
            results.innerHTML = `
                <h4>⚠️ Wallet No Encontrada</h4>
                <div style="margin-top: 15px;">
                    <p>Esta dirección nunca ha sido holder de este token.</p>
                </div>
            `;
        }
    }
}

// Cambiar tab
function switchTab(tab) {
    currentTab = tab;
    
    // Actualizar tabs activas
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
    });
    
    // Encontrar el tab clickeado
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(t => {
        if (t.textContent.toLowerCase().includes(tab) || 
            (tab === 'all' && t.textContent === 'Todos') ||
            (tab === 'diamond' && t.textContent.includes('Diamond')) ||
            (tab === 'og' && t.textContent.includes('OG')) ||
            (tab === 'new' && t.textContent.includes('Nuevos'))) {
            t.classList.add('active');
        }
    });
    
    // Actualizar vista
    updateHoldersView();
}

// Copiar dirección
function copyAddress(address) {
    navigator.clipboard.writeText(address);
    alert('Dirección copiada!');
}

// Formatear números
function formatNumber(num) {
    if (!num) return '0';
    return new Intl.NumberFormat('en-US').format(num);
}

// Cargar estadísticas
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/stats`);
        const data = await response.json();
        
        if (data.success && data.data.lastUpdate) {
            const date = new Date(data.data.lastUpdate);
            const lastUpdateElement = document.getElementById('lastUpdate');
            if (lastUpdateElement) {
                lastUpdateElement.textContent = date.toLocaleTimeString();
            }
        }
    } catch (error) {
        console.error('Error cargando stats:', error);
    }
}

// Forzar actualización
async function forceUpdate() {
    if (confirm('¿Descargar nuevos holders ahora?')) {
        try {
            const response = await fetch(`${API_URL}/force-update`, {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                alert(`✅ ${data.holdersFound} holders actualizados`);
                await loadHolders();
            }
        } catch (error) {
            alert('Error actualizando holders');
        }
    }
}

// Iniciar cuando cargue la página
window.addEventListener('load', init);

document.addEventListener('DOMContentLoaded', function() {
    // Agregar event listeners
    document.getElementById('searchBtn')?.addEventListener('click', searchWallet);
    document.getElementById('searchInput')?.addEventListener('keypress', function(e) {
        if(e.key === 'Enter') searchWallet();
    });
    document.getElementById('updateBtn')?.addEventListener('click', forceUpdate);
    
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            if(tabName) switchTab(tabName);
        });
    });
});