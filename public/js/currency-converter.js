// Store conversion history
let conversionHistory = JSON.parse(localStorage.getItem('conversionHistory')) || [];

// API key for ExchangeRate-API
const API_KEY = 'YOUR_API_KEY'; // Replace this with your actual API key from https://www.exchangerate-api.com/
const API_URL = 'https://v6.exchangerate-api.com/v6/';

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    // Check if API key is set
    if (API_KEY === 'YOUR_API_KEY') {
        alert('Please set your ExchangeRate-API key in the currency-converter.js file to use the currency converter.');
        return;
    }

    // Load conversion history
    updateHistoryDisplay();
    
    // Add event listeners
    document.getElementById('convertBtn').addEventListener('click', handleConversion);
    document.getElementById('logoutBtn').addEventListener('click', () => {
        window.location.href = '/index.html';
    });
});

async function handleConversion() {
    const amount = parseFloat(document.getElementById('amount').value);
    const fromCurrency = document.getElementById('fromCurrency').value;
    const toCurrency = document.getElementById('toCurrency').value;

    if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }

    try {
        const result = await convertCurrency(amount, fromCurrency, toCurrency);
        displayResult(result);
        addToHistory(amount, fromCurrency, toCurrency, result);
    } catch (error) {
        console.error('Error:', error);
        if (error.message.includes('API key')) {
            alert('Invalid API key. Please check your ExchangeRate-API key configuration.');
        } else {
            alert('Failed to convert currency. Please try again.');
        }
    }
}

async function convertCurrency(amount, fromCurrency, toCurrency) {
    try {
        const response = await fetch(`${API_URL}${API_KEY}/pair/${fromCurrency}/${toCurrency}`);
        const data = await response.json();

        if (data.result === 'success') {
            const rate = data.conversion_rate;
            const convertedAmount = amount * rate;
            return {
                amount: convertedAmount,
                rate: rate
            };
        } else if (data.result === 'error') {
            if (data['error-type'] === 'invalid-key') {
                throw new Error('Invalid API key');
            }
            throw new Error(data['error-type'] || 'Failed to get exchange rate');
        } else {
            throw new Error('Failed to get exchange rate');
        }
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

function displayResult(result) {
    const resultElement = document.getElementById('result');
    const rateElement = document.getElementById('rate');
    const toCurrency = document.getElementById('toCurrency').value;

    resultElement.textContent = `${result.amount.toFixed(2)} ${toCurrency}`;
    rateElement.textContent = `Exchange Rate: ${result.rate.toFixed(4)}`;
}

function addToHistory(amount, fromCurrency, toCurrency, result) {
    const conversion = {
        timestamp: new Date().toISOString(),
        fromAmount: amount,
        fromCurrency,
        toAmount: result.amount,
        toCurrency,
        rate: result.rate
    };

    conversionHistory.unshift(conversion);
    if (conversionHistory.length > 5) {
        conversionHistory.pop();
    }

    localStorage.setItem('conversionHistory', JSON.stringify(conversionHistory));
    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const historyElement = document.getElementById('history');
    historyElement.innerHTML = '';

    conversionHistory.forEach(conversion => {
        const date = new Date(conversion.timestamp).toLocaleString();
        const div = document.createElement('div');
        div.className = 'text-sm text-gray-400 border-b border-accent pb-2';
        div.innerHTML = `
            <div class="flex justify-between">
                <span>${date}</span>
                <span>${conversion.fromAmount} ${conversion.fromCurrency} → ${conversion.toAmount.toFixed(2)} ${conversion.toCurrency}</span>
            </div>
            <div class="text-xs text-gray-500">Rate: ${conversion.rate.toFixed(4)}</div>
        `;
        historyElement.appendChild(div);
    });
}

// Add currency selection to expense entry form
function addCurrencySelectionToExpenseForm() {
    const expenseForm = document.getElementById('expenseForm');
    if (expenseForm) {
        const currencySelect = document.createElement('div');
        currencySelect.className = 'mb-4';
        currencySelect.innerHTML = `
            <label for="currency" class="block text-sm font-medium text-light">Currency</label>
            <select id="currency" name="currency"
                class="mt-1 block w-full rounded-md bg-accent border-accent text-light focus:border-light focus:ring-light">
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="JPY">JPY - Japanese Yen</option>
                <option value="AUD">AUD - Australian Dollar</option>
                <option value="CAD">CAD - Canadian Dollar</option>
                <option value="CHF">CHF - Swiss Franc</option>
                <option value="CNY">CNY - Chinese Yuan</option>
                <option value="INR">INR - Indian Rupee</option>
            </select>
        `;
        expenseForm.insertBefore(currencySelect, expenseForm.firstChild);
    }
} 