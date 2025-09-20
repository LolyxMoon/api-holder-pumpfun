// src/utils/helpers.js
function validateToken(address) {
    return address && address.length >= 32 && address.length <= 44;
}

function formatWallet(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

module.exports = {
    validateToken,
    formatWallet
};