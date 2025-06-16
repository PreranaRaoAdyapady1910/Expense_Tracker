const budgetRanges = [
    { text: 'Under Rs 500', value: '0-500' },
    { text: 'Rs 500 - Rs 1000', value: '500-1000' },
    { text: 'Rs 1000 - Rs 2000', value: '1000-2000' },
    { text: 'Rs 2000 - Rs 5000', value: '2000-5000' },
    { text: 'Over Rs 5000', value: '5000-10000' }
];

// Step 1 to Step 2
document.getElementById('nextToStep2').addEventListener('click', () => {
    const memberCount = parseInt(document.getElementById('memberCount').value);
    if (memberCount < 2) {
        alert('Please enter at least 2 members');
        return;
    }

    const container = document.getElementById('memberNamesContainer');
    container.innerHTML = '';

    for (let i = 0; i < memberCount; i++) {
        const div = document.createElement('div');
        div.innerHTML = `
            <label class="block text-sm font-medium text-light">Member ${i + 1} Name</label>
            <input type="text" required
                class="mt-1 block w-full rounded-md bg-accent border-accent text-light placeholder-gray-400 focus:border-light focus:ring-light"
                data-member-name>
        `;
        container.appendChild(div);
    }

    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');

    // Reset payer and Next button
    const payerSelect = document.getElementById('defaultPayer');
    payerSelect.value = '';
    document.getElementById('nextToStep3').disabled = true;
});

// Add logic for Next button after member names
// Step 2: After entering member names, click Next to show payer dropdown
const nextToPayerBtn = document.getElementById('nextToPayer');
if (nextToPayerBtn) {
    nextToPayerBtn.onclick = () => {
        const memberInputs = document.querySelectorAll('[data-member-name]');
        const names = Array.from(memberInputs).map(input => input.value.trim());
        if (names.some(name => !name)) {
            alert('Please fill in all member names');
            return;
        }
        // Show and populate payer dropdown
        const payerContainer = document.getElementById('payerContainer');
        const payerSelect = document.getElementById('defaultPayer');
        payerSelect.innerHTML = '<option value="">Select member</option>';
        names.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            payerSelect.appendChild(option);
        });
        payerContainer.classList.remove('hidden');
        document.getElementById('nextToStep3').disabled = true;
        payerSelect.onchange = () => {
            document.getElementById('nextToStep3').disabled = !payerSelect.value;
        };
    };
}

// Only proceed to step 3 when Next after payer is clicked and a payer is selected
const nextToStep3Btn = document.getElementById('nextToStep3');
if (nextToStep3Btn) {
    nextToStep3Btn.onclick = () => {
        const payerSelect = document.getElementById('defaultPayer');
        if (payerSelect.value) {
            // Show budget preferences dropdowns for each member
            const memberInputs = document.querySelectorAll('[data-member-name]');
            const names = Array.from(memberInputs).map(input => input.value.trim());
            const container = document.getElementById('budgetPreferencesContainer');
            container.innerHTML = '';
            names.forEach((name, index) => {
                const div = document.createElement('div');
                div.innerHTML = `
                    <label class="block text-sm font-medium text-light">${name}'s Budget Preference</label>
                    <select required
                        class="mt-1 block w-full rounded-md bg-accent border-accent text-light focus:border-light focus:ring-light"
                        data-budget-preference>
                        <option value="">Select a range</option>
                        ${budgetRanges.map(range => `<option value="${range.value}">${range.text}</option>`).join('')}
                    </select>
                `;
                container.appendChild(div);
            });
            document.getElementById('step2').classList.add('hidden');
            document.getElementById('step3').classList.remove('hidden');
        }
    };
}

// Form submission
document.getElementById('groupForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const memberCount = parseInt(document.getElementById('memberCount').value);
    const memberInputs = document.querySelectorAll('[data-member-name]');
    const budgetInputs = document.querySelectorAll('[data-budget-preference]');

    const members = Array.from(memberInputs).map(input => input.value.trim());
    const budgetPreferences = Array.from(budgetInputs).map(select => select.value);

    if (budgetPreferences.some(pref => !pref)) {
        alert('Please select budget preferences for all members');
        return;
    }

    const payerSelect = document.getElementById('defaultPayer');
    const defaultPayer = payerSelect ? payerSelect.value : '';
    if (!defaultPayer) {
        alert('Please select who will pay the amount among the members');
        return;
    }

    try {
        const response = await fetch('/api/groups', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: `Group ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
                members,
                budgetPreferences,
                defaultPayer
            }),
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            // Store group ID in sessionStorage
            if (data.id) {
                sessionStorage.setItem('currentGroupId', data.id);
            }
            // Show success message briefly and then redirect
            const container = document.querySelector('.bg-secondary.rounded-lg.shadow-xl.p-6');
            container.innerHTML = `
                <div class="text-center space-y-4">
                    <h2 class="text-xl font-semibold text-light">Group created successfully!</h2>
                    <p class="text-gray-400">Redirecting to expense entry...</p>
                </div>
            `;
            setTimeout(() => {
                window.location.href = '/expense-entry.html';
            }, 1500);
        } else {
            if (response.status === 401) {
                alert('Your session has expired. Please login again.');
                window.location.href = '/index.html';
            } else {
                alert(data.error || 'Failed to create group');
            }
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while creating the group. Please try again.');
    }
});

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', () => {
    window.location.href = '/index.html';
}); 