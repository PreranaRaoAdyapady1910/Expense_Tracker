let currentGroupId = sessionStorage.getItem('currentGroupId');
let groupMembers = [];
let transactions = [];

// Chart.js configuration
const chartColors = {
    blue: {
        light: '#60A5FA',  // Light blue
        medium: '#3B82F6', // Medium blue
        dark: '#1D4ED8',   // Dark blue
        darker: '#1E40AF', // Darker blue
        darkest: '#1E3A8A' // Darkest blue
    }
};

// Fetch all transactions and splits for the current group
async function fetchReportData() {
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
            renderTable();
            renderCharts();
        } else {
            alert('Failed to fetch report data');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while fetching report data');
    }
}

function renderTable() {
    const headerRow = document.getElementById('reportHeader');
    const body = document.getElementById('reportBody');
    headerRow.innerHTML = '';
    body.innerHTML = '';

    // Table columns: Date, Transaction, Amount, Paid By, Split Type, ...member names
    const columns = [
        'DATE', 'TRANSACTION', 'AMOUNT', 'PAID BY', 'SPLIT TYPE', ...groupMembers.map(m => m.name)
    ];
    columns.forEach(col => {
        const th = document.createElement('th');
        th.className = 'px-4 py-2 text-left text-xs font-medium text-light uppercase tracking-wider';
        th.textContent = col;
        headerRow.appendChild(th);
    });

    transactions.forEach(tx => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-accent transition-colors duration-200';
        
        // Basic columns (remove category)
        [tx.date, tx.transaction_type, tx.total_amount, tx.paid_by, tx.split_type].forEach(val => {
            const td = document.createElement('td');
            td.className = 'px-4 py-2 whitespace-nowrap text-light';
            td.textContent = val;
            tr.appendChild(td);
        });
        
        // Member splits
        groupMembers.forEach(member => {
            const td = document.createElement('td');
            td.className = 'px-4 py-2 whitespace-nowrap text-light';
            td.textContent = tx.splits[member.name] !== undefined ? tx.splits[member.name] : '';
            tr.appendChild(td);
        });
        body.appendChild(tr);
    });
}

function renderCharts() {
    renderMemberDistributionChart();
    renderCategoryDistributionChart();
}

function renderMemberDistributionChart() {
    const ctx = document.getElementById('memberDistributionChart').getContext('2d');
    
    // Calculate total expenses per member
    const memberTotals = {};
    transactions.forEach(transaction => {
        Object.entries(transaction.splits).forEach(([member, amount]) => {
            if (!memberTotals[member]) {
                memberTotals[member] = 0;
            }
            memberTotals[member] += parseFloat(amount);
        });
    });

    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(memberTotals),
            datasets: [{
                data: Object.values(memberTotals),
                backgroundColor: [
                    chartColors.blue.light,
                    chartColors.blue.medium,
                    chartColors.blue.dark,
                    chartColors.blue.darker,
                    chartColors.blue.darkest
                ],
                borderColor: '#1a1a1a',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#f5f5f5'
                    }
                },
                title: {
                    display: true,
                    text: 'Expense Distribution by Member',
                    color: '#f5f5f5',
                    font: {
                        size: 16
                    }
                }
            }
        }
    });
}

function renderCategoryDistributionChart() {
    const ctx = document.getElementById('categoryDistributionChart').getContext('2d');
    
    // Calculate total expenses per category
    const categoryTotals = {};
    transactions.forEach(transaction => {
        const category = transaction.transaction_type;
        if (!categoryTotals[category]) {
            categoryTotals[category] = 0;
        }
        categoryTotals[category] += parseFloat(transaction.total_amount);
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                label: 'Total Amount',
                data: Object.values(categoryTotals),
                backgroundColor: chartColors.blue.medium,
                borderColor: chartColors.blue.dark,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Expense Distribution by Category',
                    color: '#f5f5f5',
                    font: {
                        size: 16
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#404040'
                    },
                    ticks: {
                        color: '#f5f5f5'
                    }
                },
                x: {
                    grid: {
                        color: '#404040'
                    },
                    ticks: {
                        color: '#f5f5f5'
                    }
                }
            }
        }
    });
}

// Download as XLSX
function downloadReport() {
    try {
        console.log('Starting download process...');
        console.log('Transactions:', transactions);
        console.log('Group members:', groupMembers);

        if (!transactions || transactions.length === 0) {
            alert('No data available to download');
            return;
        }

        // Prepare data for SheetJS
        const columns = [
            'DATE', 'TRANSACTION', 'AMOUNT', 'PAID BY', 'SPLIT TYPE', ...groupMembers.map(m => m.name)
        ];
        const data = [columns];
        
        transactions.forEach(tx => {
            const row = [
                tx.date,
                tx.transaction_type,
                parseFloat(tx.total_amount).toFixed(2),
                tx.paid_by,
                tx.split_type,
                ...groupMembers.map(m => {
                    const amount = tx.splits[m.name];
                    return amount !== undefined ? parseFloat(amount).toFixed(2) : '';
                })
            ];
            data.push(row);
        });

        console.log('Prepared data:', data);

        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(data);
        console.log('Worksheet created');
        
        // Set column widths
        const colWidths = columns.map(() => ({ wch: 15 }));
        ws['!cols'] = colWidths;

        // Add some styling
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; R++) {
            for (let C = range.s.c; C <= range.e.c; C++) {
                const cell_address = { c: C, r: R };
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                if (!ws[cell_ref]) continue;
                
                // Style header row
                if (R === 0) {
                    ws[cell_ref].s = {
                        font: { bold: true },
                        fill: { fgColor: { rgb: "4F4F4F" } },
                        alignment: { horizontal: "center" }
                    };
                }
            }
        }

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Expense Report');
        console.log('Workbook created');

        // Generate filename with date
        const date = new Date().toISOString().split('T')[0];
        const filename = `expense_report_${date}.xlsx`;
        console.log('Attempting to save file:', filename);

        // Save the file
        XLSX.writeFile(wb, filename);
        console.log('File saved successfully');
    } catch (error) {
        console.error('Error downloading report:', error);
        alert('Failed to download report. Please try again.');
    }
}

// Add event listener for download button
document.getElementById('downloadBtn').addEventListener('click', downloadReport);

document.getElementById('calculateBtn').addEventListener('click', () => {
    window.location.href = '/calculate.html';
});
document.getElementById('logoutBtn').addEventListener('click', () => {
    window.location.href = '/index.html';
});

// Initialize the page
fetchReportData(); 