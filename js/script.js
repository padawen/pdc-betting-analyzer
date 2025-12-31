let matchesData = null;
let allMatchesData = null; // Store all matches for filtering
let currentYear = 2026;
let selectedRounds = new Set(); // Store multiple selected rounds

// Format number with animation
function formatNumber(num, decimals = 0) {
    return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Load year data
async function loadYear(year) {
    currentYear = year;

    // Update active button
    document.querySelectorAll('.year-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`year-${year}`).classList.add('active');

    // Load data
    await loadMatchData(`data/matches_${year}.json`);
}

// Load matches data
async function loadMatchData(filename) {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const errorMessageEl = document.getElementById('error-message');

    loadingEl.classList.remove('hidden');
    errorEl.classList.add('hidden');

    try {
        const response = await fetch(filename);
        if (!response.ok) {
            throw new Error(`A ${filename} fájl nem található`);
        }
        const data = await response.json();
        allMatchesData = data.matches; // Save all matches
        matchesData = allMatchesData;  // Initial state

        // Update footer
        document.getElementById('footer-info').textContent = `Verseny: ${data.tournament || 'PDC ' + currentYear}`;

        // Initialize Round Selector
        initRoundSelector();
        // Reset filter
        selectedRounds.clear();
        updateRoundButtonsUI();

        // Calculate initial stats
        calculateAndDisplayStats();
        updateSurprise();

        loadingEl.classList.add('hidden');
    } catch (error) {
        loadingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
        errorMessageEl.textContent = `Nem sikerült betölteni a(z) PDC ${currentYear} adatokat: ${error.message}`;
    }
}

// --- ÚJ: Forduló szűrés logika (Multi-select) ---

function initRoundSelector() {
    const selector = document.getElementById('round-selector');
    const container = document.getElementById('round-container');

    // Define logical order
    const roundOrder = [
        '1/64 döntő',
        '1/32 döntő',
        '1/16 döntő',
        '1/8 döntő',
        'Negyeddöntők',
        'Elődöntők',
        'Döntő'
    ];

    // Get unique rounds and sort by custom order
    const rounds = [...new Set(allMatchesData.map(m => m.round))]
        .filter(r => r && r !== 'Unknown')
        .sort((a, b) => {
            const indexA = roundOrder.indexOf(a);
            const indexB = roundOrder.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });

    if (!selector) return;

    if (rounds.length === 0) {
        selector.classList.add('hidden');
        if (container) container.classList.add('hidden');
        return;
    }

    selector.classList.remove('hidden');
    if (container) container.classList.remove('hidden');

    let html = `
        <button onclick="filterByRound('all')" id="round-all" 
            class="round-btn px-6 py-3 rounded-xl font-bold bg-[#2a2a2a] border-2 border-gray-700 transition-all text-gray-300 text-base active">
            Összes
        </button>
    `;

    rounds.forEach(round => {
        const id = getRoundButtonId(round);
        html += `
            <button onclick="filterByRound('${round}')" id="${id}" 
                class="round-btn px-6 py-3 rounded-xl font-bold bg-[#2a2a2a] border-2 border-gray-700 transition-all text-gray-300 text-base">
                ${round}
            </button>
        `;
    });

    selector.innerHTML = html;
}

function getRoundButtonId(round) {
    return 'round-' + btoa(unescape(encodeURIComponent(round))).replace(/=/g, '').substring(0, 10);
}

function filterByRound(round) {
    if (round === 'all') {
        selectedRounds.clear();
    } else {
        if (selectedRounds.has(round)) {
            selectedRounds.delete(round);
        } else {
            selectedRounds.add(round);
        }
    }

    updateRoundButtonsUI();

    // Filter logic
    if (selectedRounds.size === 0) {
        matchesData = allMatchesData;
    } else {
        matchesData = allMatchesData.filter(m => selectedRounds.has(m.round));
    }

    calculateAndDisplayStats();
    updateSurprise();
}

function updateRoundButtonsUI() {
    // Reset all buttons
    document.querySelectorAll('.round-btn').forEach(btn => btn.classList.remove('active'));

    if (selectedRounds.size === 0) {
        // If no selection, 'All' is active
        const allBtn = document.getElementById('round-all');
        if (allBtn) allBtn.classList.add('active');
    } else {
        // Highlight selected rounds
        selectedRounds.forEach(round => {
            const id = getRoundButtonId(round);
            const btn = document.getElementById(id);
            if (btn) btn.classList.add('active');
        });
    }
}

function updateSurprise() {
    const card = document.getElementById('surprise-card');
    const content = document.getElementById('surprise-content');

    if (!card || !content) return; // Safety check

    // Find biggest underdog win in CURRENT filtered matches
    const wins = matchesData.filter(m => m.underdogWon);

    if (wins.length === 0) {
        card.classList.add('hidden');
        return;
    }

    const biggest = wins.reduce((prev, curr) => (prev.underdogOdds > curr.underdogOdds) ? prev : curr);

    card.classList.remove('hidden');
    content.innerHTML = `
        <div class="flex items-center justify-center gap-4 flex-wrap">
            <div class="text-3xl font-black text-white">${biggest.underdogOdds.toFixed(2)}</div>
            <div class="text-lg font-bold text-yellow-400">${biggest.underdog}</div>
            <div class="text-sm text-gray-400">vs ${biggest.favorite}</div>
            <div class="text-xs text-gray-500 bg-black/40 px-2 py-1 rounded ml-2">${biggest.round}</div>
        </div>
    `;
}

// ---------------------------------

// Calculate strategy statistics
function calculateStrategy(matches, stake, type) {
    const totalMatches = matches.length;
    let wins = 0;
    let losses = 0;
    let totalProfit = 0;

    matches.forEach(match => {
        let betOdds, won;

        if (type === 'underdog') {
            betOdds = match.underdogOdds;
            won = match.underdogWon;
        } else {
            const favoriteOdds = Math.min(match.oddsA, match.oddsB);
            betOdds = favoriteOdds;
            won = !match.underdogWon;
        }

        if (won) {
            wins++;
            totalProfit += (betOdds * stake) - stake;
        } else {
            losses++;
            totalProfit -= stake;
        }
    });

    const totalStaked = stake * totalMatches;
    const roi = totalStaked > 0 ? ((totalProfit / totalStaked) * 100) : 0;
    const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100) : 0;

    return { winRate, wins, losses, totalProfit, roi };
}

// Display statistics
function calculateAndDisplayStats() {
    if (!matchesData || matchesData.length === 0) return;

    const stake = parseFloat(document.getElementById('stake').value) || 0;

    // Calculate both strategies
    const underdogStats = calculateStrategy(matchesData, stake, 'underdog');
    const favoriteStats = calculateStrategy(matchesData, stake, 'favorite');

    // Update Underdog stats
    document.getElementById('underdog-winrate').textContent = formatNumber(underdogStats.winRate, 1);
    document.getElementById('underdog-wins').textContent = underdogStats.wins;
    document.getElementById('underdog-losses').textContent = underdogStats.losses;

    const underdogProfitEl = document.getElementById('underdog-profit');
    underdogProfitEl.textContent = `${underdogStats.totalProfit >= 0 ? '+' : ''}Ft ${formatNumber(underdogStats.totalProfit, 0)}`;
    underdogProfitEl.className = `text-3xl font-bold number-animate ${underdogStats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`;

    const underdogRoiEl = document.getElementById('underdog-roi');
    underdogRoiEl.textContent = `${underdogStats.roi >= 0 ? '+' : ''}${formatNumber(underdogStats.roi, 1)}%`;
    underdogRoiEl.className = `text-4xl font-bold number-animate ${underdogStats.roi >= 0 ? 'text-green-400' : 'text-red-400'}`;

    // Update Favorite stats
    document.getElementById('favorite-winrate').textContent = formatNumber(favoriteStats.winRate, 1);
    document.getElementById('favorite-wins').textContent = favoriteStats.wins;
    document.getElementById('favorite-losses').textContent = favoriteStats.losses;

    const favoriteProfitEl = document.getElementById('favorite-profit');
    favoriteProfitEl.textContent = `${favoriteStats.totalProfit >= 0 ? '+' : ''}Ft ${formatNumber(favoriteStats.totalProfit, 0)}`;
    favoriteProfitEl.className = `text-3xl font-bold number-animate ${favoriteStats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`;

    const favoriteRoiEl = document.getElementById('favorite-roi');
    favoriteRoiEl.textContent = `${favoriteStats.roi >= 0 ? '+' : ''}${formatNumber(favoriteStats.roi, 1)}%`;
    favoriteRoiEl.className = `text-4xl font-bold number-animate ${favoriteStats.roi >= 0 ? 'text-green-400' : 'text-red-400'}`;

    // Update Chart
    renderChart(matchesData, stake);
}

// Event listener
document.getElementById('stake').addEventListener('input', () => {
    if (matchesData) {
        calculateAndDisplayStats();
    }
});

// Initialize - load 2026 by default
loadYear(2026);

// Modal Logic
function showWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Show modal on load
window.addEventListener('load', () => {
    // Optional: Check if already shown in session if needed, but for now show always as requested
    setTimeout(showWelcomeModal, 500); // Small delay for animation effect
});

