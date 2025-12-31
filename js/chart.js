// Chart instance
let dbChart = null;
let currentChartMatchesLength = 0; // Create global to track length for steps

function renderChart(matches, stake) {
    const ctx = document.getElementById('balanceChart').getContext('2d');

    // Define logical order for sorting
    const roundOrder = [
        '1/64 döntő',
        '1/32 döntő',
        '1/16 döntő',
        '1/8 döntő',
        'Negyeddöntők',
        'Elődöntők',
        'Döntő'
    ];

    // Sort matches by round order
    const sortedMatches = [...matches].sort((a, b) => {
        const indexA = roundOrder.indexOf(a.round);
        const indexB = roundOrder.indexOf(b.round);
        if (indexA !== -1 && indexB !== -1) {
            if (indexA !== indexB) return indexA - indexB;
            return 0;
        }
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return 0;
    });

    // Update global for stepper
    currentChartMatchesLength = sortedMatches.length + 1; // +1 for Start point

    // Prepare data
    let underdogBalance = 0;
    let favoriteBalance = 0;

    const labels = [];
    const underdogData = [];
    const favoriteData = [];

    // Initial point
    labels.push('Start');
    underdogData.push(0);
    favoriteData.push(0);

    sortedMatches.forEach((match, index) => {
        if (match.underdogWon) {
            underdogBalance += (match.underdogOdds * stake) - stake;
        } else {
            underdogBalance -= stake;
        }

        const favoriteOdds = Math.min(match.oddsA, match.oddsB);
        if (!match.underdogWon) {
            favoriteBalance += (favoriteOdds * stake) - stake;
        } else {
            favoriteBalance -= stake;
        }

        labels.push(`${index + 1}.`);
        underdogData.push(underdogBalance);
        favoriteData.push(favoriteBalance);
    });

    if (dbChart) {
        dbChart.destroy();
    }

    Chart.defaults.color = '#9ca3af';
    Chart.defaults.font.family = 'sans-serif';

    dbChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Underdog stratégia',
                    data: underdogData,
                    borderColor: '#c084fc',
                    backgroundColor: 'rgba(192, 132, 252, 0.1)',
                    borderWidth: 3,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    tension: 0.1,
                    fill: true
                },
                {
                    label: 'Favorit stratégia',
                    data: favoriteData,
                    borderColor: '#60a5fa',
                    backgroundColor: 'rgba(96, 165, 250, 0.05)',
                    borderWidth: 3,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    tension: 0.1,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: { size: 14, weight: 'bold' },
                        padding: 20,
                        generateLabels: function (chart) {
                            const datasets = chart.data.datasets;
                            return datasets.map((dataset, i) => {
                                const isHidden = !chart.isDatasetVisible(i);
                                return {
                                    text: dataset.label,
                                    fillStyle: isHidden ? 'transparent' : dataset.borderColor,
                                    strokeStyle: dataset.borderColor,
                                    lineWidth: 2,
                                    hidden: isHidden,
                                    index: i,
                                    pointStyle: 'circle',
                                    fontColor: '#9ca3af',
                                    datasetIndex: i
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(20, 20, 20, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#e5e7eb',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        title: function (context) {
                            const index = context[0].dataIndex;
                            if (index === 0) return 'Kezdeti egyenleg';
                            const match = sortedMatches[index - 1];
                            return match ? `${match.underdog} vs ${match.favorite}` : '';
                        },
                        afterTitle: function (context) {
                            const index = context[0].dataIndex;
                            if (index === 0) return '';
                            const match = sortedMatches[index - 1];
                            if (!match) return '';
                            const winner = match.underdogWon ? match.underdog : match.favorite;
                            const odds = match.underdogWon ? match.underdogOdds : Math.min(match.oddsA, match.oddsB);
                            const type = match.underdogWon ? "Underdog győzelem" : "Favorit győzelem";
                            return [
                                `${match.round}`,
                                `-------------------`,
                                `${type}`,
                                `Nyertes: ${winner}`,
                                `Szorzó: ${odds.toFixed(2)}`,
                                `-------------------`
                            ];
                        },
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) label += formatNumber(context.parsed.y, 0) + ' Ft';
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', borderColor: 'transparent' },
                    ticks: { maxTicksLimit: 20 }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', borderColor: 'transparent' },
                    beginAtZero: true,
                    ticks: { callback: function (value) { return formatNumber(value, 0) + ' Ft'; } }
                }
            }
        }
    });
}

// Fullscreen Logic
function toggleChartFullscreen() {
    const chartContainer = document.querySelector('#balanceChart').parentElement.parentElement;
    const rotationOverlay = document.getElementById('rotation-overlay');

    // Toggle Fullscreen Class
    const isFullscreen = chartContainer.classList.toggle('chart-fullscreen');

    if (isFullscreen) {
        document.body.style.overflow = 'hidden';
        // Initial check
        checkOrientationForOverlay();
    } else {
        document.body.style.overflow = '';
        rotationOverlay.classList.add('hidden');
        rotationOverlay.classList.remove('flex');
    }
}

function checkOrientationForOverlay() {
    const rotationOverlay = document.getElementById('rotation-overlay');
    if (window.matchMedia("(orientation: portrait)").matches) {
        rotationOverlay.classList.remove('hidden');
        rotationOverlay.classList.add('flex');
    } else {
        rotationOverlay.classList.add('hidden');
        rotationOverlay.classList.remove('flex');
    }
}

// Button navigation logic
function stepChart(direction) {
    if (!dbChart) return;

    // Find currently active element
    const activeElements = dbChart.getActiveElements();
    let currentIndex = -1;

    if (activeElements.length > 0) {
        currentIndex = activeElements[0].index;
    } else {
        // If nothing selected, start from:
        // direction 1 (next) -> start at -1 so next is 0
        // direction -1 (prev) -> start at length so prev is last
        currentIndex = direction === 1 ? -1 : currentChartMatchesLength;
    }

    let newIndex = currentIndex + direction;

    // Boundaries
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= currentChartMatchesLength) newIndex = currentChartMatchesLength - 1;

    // Trigger tooltip
    const datasetsCount = dbChart.data.datasets.length;
    const activePoints = [];
    for (let i = 0; i < datasetsCount; i++) {
        if (dbChart.isDatasetVisible(i)) {
            activePoints.push({ datasetIndex: i, index: newIndex });
        }
    }

    dbChart.tooltip.setActiveElements(activePoints);
    dbChart.setActiveElements(activePoints);
    dbChart.update();
}


// Listen for orientation change to handle overlay AND auto-trigger fullscreen
window.matchMedia("(orientation: landscape)").addEventListener("change", e => {
    const chartContainer = document.querySelector('#balanceChart').parentElement.parentElement;
    const rotationOverlay = document.getElementById('rotation-overlay');

    if (e.matches) {
        // Rotated to landscape
        // If not already fullscreen, make it fullscreen?
        // User said: "ha elforgatom, csak a chartot nyissuk meg fullscreenbe"
        if (!chartContainer.classList.contains('chart-fullscreen')) {
            toggleChartFullscreen();
        }
        // Ensure overlay is hidden
        rotationOverlay.classList.add('hidden');
        rotationOverlay.classList.remove('flex');
    } else {
        // Rotated to portrait
        if (chartContainer.classList.contains('chart-fullscreen')) {
            // Show overlay "Please rotate back"
            rotationOverlay.classList.remove('hidden');
            rotationOverlay.classList.add('flex');
        }
    }
});
