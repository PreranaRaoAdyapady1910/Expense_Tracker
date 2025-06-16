let currentGroupId = sessionStorage.getItem('currentGroupId');
let groupMembers = [];
let transactions = [];
let selectedCurrency = 'INR'; // Default currency

// Static exchange rates relative to INR
const exchangeRates = {
    'INR': 1,
    'USD': 0.012,
    'EUR': 0.011,
    'GBP': 0.0099,
    'JPY': 1.63,
    'AUD': 0.018,
    'CAD': 0.016,
    'CHF': 0.011,
    'CNY': 0.086
};

// Fetch all transactions and splits for the current group
async function fetchCalculationData() {
    if (!currentGroupId) {
        alert('No group selected. Please create a group first.');
        window.location.href = '/dashboard.html';
        return;
    }
    try {
        const response = await fetch(`/api/report?groupId=${currentGroupId}`, { credentials: 'include' });
        const data = await response.json();
        if (response.ok) {
            groupMembers = data.members;
            transactions = data.transactions;
            calculateAndDisplayAmounts();
        } else {
            alert('Failed to fetch calculation data');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while fetching calculation data');
    }
}

// Add currency selector to the page
function addCurrencySelector() {
    const currencySelector = document.createElement('div');
    currencySelector.className = 'mb-6';
    currencySelector.innerHTML = `
        <label for="currencySelector" class="block text-sm font-medium text-light mb-2">Display Currency</label>
        <select id="currencySelector" class="mt-1 block w-full rounded-md bg-accent border-accent text-light focus:border-light focus:ring-light">
            <option value="INR">INR - Indian Rupee</option>
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="JPY">JPY - Japanese Yen</option>
            <option value="AUD">AUD - Australian Dollar</option>
            <option value="CAD">CAD - Canadian Dollar</option>
            <option value="CHF">CHF - Swiss Franc</option>
            <option value="CNY">CNY - Chinese Yuan</option>
        </select>
    `;
    
    const container = document.querySelector('.bg-secondary.rounded-lg.shadow-xl.p-6');
    container.insertBefore(currencySelector, container.firstChild);
    
    // Add event listener for currency change
    document.getElementById('currencySelector').addEventListener('change', (e) => {
        selectedCurrency = e.target.value;
        calculateAndDisplayAmounts();
    });
}

async function convertAmount(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    // Convert from 'fromCurrency' to INR first if needed
    let amountInINR = amount;
    if (fromCurrency !== 'INR') {
        amountInINR = amount / (exchangeRates[fromCurrency] || 1);
    }
    // Then convert from INR to 'toCurrency'
    const rate = exchangeRates[toCurrency] || 1;
    return parseFloat((amountInINR * rate).toFixed(2));
}

async function calculateAndDisplayAmounts() {
    const resultsContainer = document.getElementById('calculationResults');
    resultsContainer.innerHTML = '';

    // Calculate total amount from report (sum of transaction total_amounts)
    let totalAmountFromReport = 0;
    for (const transaction of transactions) {
        const transactionCurrency = transaction.currency || 'INR';
        let amount = parseFloat(transaction.total_amount);
        if (transactionCurrency !== selectedCurrency) {
            amount = await convertAmount(amount, transactionCurrency, selectedCurrency);
        }
        totalAmountFromReport += amount;
    }
    const averageAmount = totalAmountFromReport / groupMembers.length;

    // Calculate total expenses per member (for settlements)
    const memberOwes = {};
    groupMembers.forEach(member => {
        memberOwes[member.name] = {};
    });

    // For each transaction, add the split amount to the owed member for the payer
    for (const transaction of transactions) {
        const payer = transaction.paid_by;
        const transactionCurrency = transaction.currency || 'INR';
        for (const member of groupMembers) {
            if (transaction.splits[member.name] !== undefined) {
                // Convert split amount if needed
                let splitAmount = parseFloat(transaction.splits[member.name]);
                if (transactionCurrency !== selectedCurrency) {
                    splitAmount = await convertAmount(splitAmount, transactionCurrency, selectedCurrency);
                }
                if (member.name !== payer) {
                    if (!memberOwes[member.name][payer]) memberOwes[member.name][payer] = 0;
                    memberOwes[member.name][payer] += splitAmount;
                }
            }
        }
    }

    // Prepare settlements: for each member, show what they owe to each payer
    const settlements = [];
    for (const [from, owesObj] of Object.entries(memberOwes)) {
        for (const [to, amount] of Object.entries(owesObj)) {
            if (amount > 0.009) { // ignore tiny floating point errors
                settlements.push({ from, to, amount });
            }
        }
    }

    // Update stats cards
    document.getElementById('totalExpenses').textContent = `${selectedCurrency} ${totalAmountFromReport.toFixed(2)}`;
    document.getElementById('averagePerPerson').textContent = `${selectedCurrency} ${averageAmount.toFixed(2)}`;
    document.getElementById('pendingSettlements').textContent = settlements.length;

    // Display results
    if (settlements.length === 0) {
        resultsContainer.innerHTML = `
            <div class="text-center py-8">
                <div class="bg-accent bg-opacity-50 rounded-full p-4 inline-block mb-4">
                    <svg class="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>
                <p class="text-light text-lg">No settlements needed. All expenses are balanced.</p>
            </div>
        `;
        return;
    }

    // Create settlements section with enhanced styling
    const settlementsSection = document.createElement('div');
    settlementsSection.className = 'space-y-4';
    settlementsSection.innerHTML = `
        <div class="grid grid-cols-1 gap-4">
            ${settlements.map((settlement, index) => `
                <div class="bg-accent rounded-lg p-6 transform transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-4">
                            <div class="bg-blue-500 bg-opacity-20 p-3 rounded-full">
                                <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                </svg>
                            </div>
                            <div>
                                <div class="text-light font-medium">${settlement.from}</div>
                                <div class="text-gray-400 text-sm">owes</div>
                            </div>
                        </div>
                        <div class="flex items-center space-x-4">
                            <div class="text-2xl font-bold text-blue-400">${selectedCurrency} ${settlement.amount.toFixed(2)}</div>
                            <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path>
                            </svg>
                            <div class="text-right">
                                <div class="text-light font-medium">${settlement.to}</div>
                                <div class="text-gray-400 text-sm">will receive</div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    resultsContainer.appendChild(settlementsSection);
}

// Add event listeners
document.getElementById('logoutBtn').addEventListener('click', () => {
    window.location.href = '/index.html';
});

// Download summary as PNG
function downloadSummaryAsImage() {
    const mainContent = document.querySelector('main');
    if (!mainContent) return;
    html2canvas(mainContent, { backgroundColor: null }).then(canvas => {
        const link = document.createElement('a');
        link.download = `settlement_summary_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

document.getElementById('downloadBtn').addEventListener('click', downloadSummaryAsImage);

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    addCurrencySelector();
    fetchCalculationData();
}); 