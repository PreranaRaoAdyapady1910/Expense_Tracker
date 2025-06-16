document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password }),
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            window.location.href = '/index.html';
            alert('Account created successfully! Please login.');
        } else {
            alert(data.error || 'Signup failed');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred during signup');
    }
}); 