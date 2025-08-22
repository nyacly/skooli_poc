// Skooli Admin Dashboard JavaScript

document.addEventListener('DOMContentLoaded', () => {
    const authToken = localStorage.getItem('authToken');

    if (!authToken) {
        // If not logged in, redirect to the main page's login
        window.location.href = '/?login=true';
        return;
    }

    // Fetch user data to verify admin status
    fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(res => {
        if (!res.ok) {
            window.location.href = '/?login=true';
            return;
        }
        return res.json();
    })
    .then(data => {
        if (data && data.user.profile.user_type === 'admin') {
            // User is an admin, load dashboard
            loadDashboard(data.user);
        } else {
            // Not an admin, redirect to home
            alert('You do not have permission to view this page.');
            window.location.href = '/';
        }
    })
    .catch(() => {
        window.location.href = '/?login=true';
    });
});

function loadDashboard(user) {
    const adminUserContainer = document.getElementById('admin-user');
    if (adminUserContainer) {
        adminUserContainer.innerHTML = `
            <span class="font-semibold mr-2">${user.profile.first_name} ${user.profile.last_name}</span>
            <button onclick="logout()" class="text-sm text-red-500 hover:text-red-700">Logout</button>
        `;
    }

    // Placeholder for loading dashboard data
    console.log('Admin dashboard loaded for:', user.email);
}

function logout() {
    localStorage.removeItem('authToken');
    window.location.href = '/';
}
