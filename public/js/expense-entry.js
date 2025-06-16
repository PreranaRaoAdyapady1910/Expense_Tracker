// Initialize date picker
flatpickr("#date", {
    dateFormat: "Y-m-d",
    defaultDate: "today"
});

let groupMembers = [];
let currentGroupId = sessionStorage.getItem('currentGroupId');

// Fetch group members for the current group
async function fetchGroupMembers() {
    if (!currentGroupId) {
        alert('No group selected. Please create a group first.');
        window.location.href = '/dashboard.html';
        return;
    }
    try {
        const response = await fetch(`/api/group-members?groupId=${currentGroupId}`, { credentials: 'include' });
        const data = await response.json();

        if (response.ok && data.members && data.members.length > 0) {
            groupMembers = data.members;
        } else {
            alert('No members found for this group. Please create a group with members.');
            window.location.href = '/dashboard.html';
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while fetching group members');
        window.location.href = '/dashboard.html';
    }
}

// Populate member selects
function populateMemberSelects() {
    const paidBySelect = document.getElementById('paidBy');
    paidBySelect.innerHTML = '<option value="">Select member</option>';
    
    groupMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member.name;
        option.textContent = member.name;
        paidBySelect.appendChild(option);
    });
}

// Handle split type change
document.getElementById('splitType').addEventListener('change', (e) => {
    const splitType = e.target.value;
    const container = document.getElementById('splitDetailsContainer');
    container.innerHTML = '';

    if (!splitType) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    if (splitType === 'equal') {
        // No additional inputs needed for equal split
        return;
    }

    const totalAmount = parseFloat(document.getElementById('totalAmount').value) || 0;

    groupMembers.forEach(member => {
        const div = document.createElement('div');
        div.className = 'flex items-center space-x-4';

        const label = document.createElement('label');
        label.className = 'block text-sm font-medium text-light w-1/3';
        label.textContent = member.name;

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = splitType === 'percentage' ? '100' : totalAmount;
        input.step = splitType === 'percentage' ? '0.01' : '0.01';
        input.required = true;
        input.className = 'mt-1 block w-full rounded-md bg-accent border-accent text-light placeholder-gray-400 focus:border-light focus:ring-light';
        input.dataset.memberName = member.name;

        const span = document.createElement('span');
        span.className = 'text-sm text-gray-400';
        span.textContent = splitType === 'percentage' ? '%' : '$';

        div.appendChild(label);
        div.appendChild(input);
        div.appendChild(span);
        container.appendChild(div);
    });
});

// Validate split inputs
function validateSplitInputs() {
    const splitType = document.getElementById('splitType').value;
    const totalAmount = parseFloat(document.getElementById('totalAmount').value);

    if (splitType === 'equal') {
        return true;
    }

    const inputs = document.querySelectorAll('#splitDetailsContainer input');
    let total = 0;

    inputs.forEach(input => {
        const value = parseFloat(input.value) || 0;
        total += value;
    });

    if (splitType === 'percentage') {
        // Round to 2 decimal places for percentage comparison
        total = Math.round(total * 100) / 100;
        if (total !== 100) {
            alert('Total percentage must equal exactly 100%');
            return false;
        }
    } else if (splitType === 'amount') {
        // Round to 2 decimal places for amount comparison
        total = Math.round(total * 100) / 100;
        const roundedTotalAmount = Math.round(totalAmount * 100) / 100;
        if (total !== roundedTotalAmount) {
            alert('Total split amount must equal the total expense amount');
            return false;
        }
    }

    return true;
}

// Handle form submission
document.getElementById('expenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateSplitInputs()) {
        return;
    }

    const formData = {
        groupId: currentGroupId,
        date: document.getElementById('date').value,
        transactionType: document.getElementById('transactionType').value,
        totalAmount: parseFloat(document.getElementById('totalAmount').value),
        splitType: document.getElementById('splitType').value,
        currency: document.getElementById('currency').value,
        splits: []
    };

    if (formData.splitType === 'equal') {
        const equalShare = Math.round((formData.totalAmount / groupMembers.length) * 100) / 100;
        formData.splits = groupMembers.map(member => ({
            member: member.name,
            amount: equalShare
        }));
    } else {
        const inputs = document.querySelectorAll('#splitDetailsContainer input');
        let remainingAmount = formData.totalAmount;
        
        inputs.forEach((input, index) => {
            let amount = parseFloat(input.value);
            if (formData.splitType === 'percentage') {
                // Convert percentage to actual amount and round to 2 decimal places
                amount = Math.round((amount * formData.totalAmount / 100) * 100) / 100;
            }
            
            // For the last input, use the remaining amount to avoid rounding errors
            if (index === inputs.length - 1) {
                amount = remainingAmount;
            } else {
                remainingAmount -= amount;
            }
            
            formData.splits.push({
                member: input.dataset.memberName,
                amount: amount
            });
        });
    }

    // Check budget preferences after calculating all splits
    const budgetWarnings = [];
    groupMembers.forEach(member => {
        if (member.budget_preference) {
            const [min, max] = member.budget_preference.split('-').map(Number);
            const memberShare = formData.splits.find(split => split.member === member.name)?.amount || 0;
            
            console.log(`Checking budget for ${member.name}:`, {
                budgetPreference: member.budget_preference,
                min,
                max,
                memberShare
            });

            if (memberShare > max) {
                budgetWarnings.push(`${member.name}'s share (${memberShare.toFixed(2)}) exceeds their budget preference (${min}-${max})`);
            }
        }
    });

    if (budgetWarnings.length > 0) {
        const warningMessage = `Budget Warning:\n${budgetWarnings.join('\n')}\n\nDo you want to proceed anyway?`;
        console.log('Budget warnings:', warningMessage);
        const proceed = confirm(warningMessage);
        if (!proceed) {
            return;
        }
    }

    try {
        const response = await fetch('/api/expenses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            // Show success message and Add another transaction button
            const container = document.querySelector('.bg-secondary.rounded-lg.shadow-xl.p-6');
            container.innerHTML = `
                <div class="text-center space-y-4">
                    <h2 class="text-xl font-semibold text-light">Expense added successfully!</h2>
                    <button id="addAnotherBtn" class="bg-accent text-light py-2 px-4 rounded-md hover:bg-opacity-80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-light focus:ring-offset-2 focus:ring-offset-secondary">Add another transaction</button>
                    <button id="viewReportBtn" class="ml-4 bg-accent text-light py-2 px-4 rounded-md hover:bg-opacity-80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-light focus:ring-offset-2 focus:ring-offset-secondary">View report</button>
                </div>
            `;
            document.getElementById('addAnotherBtn').onclick = () => {
                window.location.href = '/expense-entry.html';
            };
            document.getElementById('viewReportBtn').onclick = () => {
                window.location.href = '/report.html';
            };
        } else {
            if (response.status === 401) {
                alert('Your session has expired. Please login again.');
                window.location.href = '/index.html';
            } else {
                alert(data.error || 'Failed to add expense');
            }
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while adding the expense. Please try again.');
    }
});

// Initialize the page
fetchGroupMembers(); 