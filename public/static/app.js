// Skooli E-commerce Frontend JavaScript

// State management
let cart = { items: [], totalAmount: 0 };
let sessionId = localStorage.getItem('sessionId') || null;
let authToken = localStorage.getItem('authToken') || null;
let currentUser = null;

// API Base URL - use the one set in HTML or default to /api
const API_BASE = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : '/api';

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    await loadProducts();

    if (authToken) {
        await checkAuth();
    }
    await loadCart();
    updateCartUI();
    setupFormHandlers();
});

// Authentication
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            currentUser = await response.json();
            updateAuthUI();
        } else {
            logout();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

function updateAuthUI() {
    const loginBtn = document.querySelector('button[onclick="showLogin()"]');
    const nav = loginBtn ? loginBtn.parentElement : null;

    if (loginBtn && currentUser && currentUser.user.profile) {
        // Update login button to show user name and a dropdown menu
        loginBtn.innerHTML = `<i class="fas fa-user mr-2"></i>${currentUser.user.profile.first_name} <i class="fas fa-chevron-down ml-2"></i>`;

        // Create dropdown menu
        const dropdown = document.createElement('div');
        dropdown.id = 'user-menu';
        dropdown.className = 'hidden absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50';

        let menuItems = `
            <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">My Account</a>
            <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Order History</a>
        `;

        if (currentUser.user.profile.user_type === 'admin') {
            menuItems += `<a href="/admin" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Admin Dashboard</a>`;
        }

        menuItems += `<button onclick="logout()" class="block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100">Logout</button>`;

        dropdown.innerHTML = menuItems;

        // The user button will now toggle this menu
        loginBtn.onclick = () => {
            dropdown.classList.toggle('hidden');
        };

        // Add dropdown to nav
        if (nav) {
            nav.classList.add('relative'); // For positioning the dropdown
            nav.appendChild(dropdown);
        }

    }
}

function showUserMenu() {
    const menu = document.getElementById('user-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

async function login(email, password) {
    try {
        const response = await fetch(`${API_BASE}/auth/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.session.access_token;
            currentUser = data;
            localStorage.setItem('authToken', authToken);
            updateAuthUI();
            closeLogin();
            await loadCart();
            updateCartUI();
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed');
    }
}

async function register(userData) {
    try {
        const response = await fetch(`${API_BASE}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            // Switch to login tab after successful registration
            document.getElementById('login-tab').click();
        } else {
            alert(data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed');
    }
}

function logout() {
    authToken = null;
    sessionId = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('sessionId');
    location.reload();
}

// Categories
async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/products/categories`);
        const { categories } = await response.json();
        
        const container = document.getElementById('categories');
        if (container) {
            container.innerHTML = categories.map(cat => `
                <div onclick="filterByCategory('${cat.slug}')" class="bg-white p-4 rounded-lg shadow hover:shadow-lg cursor-pointer transition-shadow">
                    <i class="fas fa-box text-3xl text-green-600 mb-2"></i>
                    <h4 class="font-semibold">${cat.name}</h4>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
}

// Products
async function loadProducts(category = null, search = null) {
    try {
        let url = `${API_BASE}/products?limit=20`;
        if (category) url += `&category=${category}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        const container = document.getElementById('products');
        if (container) {
            container.innerHTML = data.products.map(product => `
                <div class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                    <img src="${product.image_url || '/static/placeholder.svg'}" alt="${product.name}" class="w-full h-48 object-cover rounded-t-lg">
                    <div class="p-4">
                        <h4 class="font-semibold mb-2">${product.name}</h4>
                        <div class="flex justify-between items-center">
                            <span class="text-xl font-bold text-green-600">UGX ${formatNumber(product.price)}</span>
                            <button onclick="addToCart('${product.id}')" class="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600">
                                <i class="fas fa-cart-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load products:', error);
    }
}

// Cart functions
async function loadCart() {
    if (!authToken) return;
    try {
        const headers = {
            'Authorization': `Bearer ${authToken}`
        };
        
        const response = await fetch(`${API_BASE}/cart`, { headers });
        const data = await response.json();

        cart = data;
        updateCartUI();
    } catch (error) {
        console.error('Failed to load cart:', error);
    }
}

async function addToCart(productId) {
    if (!authToken) {
        showLogin();
        return;
    }
    try {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        };
        
        const response = await fetch(`${API_BASE}/cart/add`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ productId, quantity: 1 })
        });

        const data = await response.json();

        if (response.ok) {
            await loadCart();
            showNotification('Item added to cart!');
        } else {
            alert(data.error || 'Failed to add to cart');
        }
    } catch (error) {
        console.error('Failed to add to cart:', error);
    }
}

async function updateCartItem(itemId, quantity) {
    if (quantity <= 0) {
        await removeFromCart(itemId);
        return;
    }
    try {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        };
        
        const response = await fetch(`${API_BASE}/cart/${itemId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ quantity })
        });
        
        if (response.ok) {
            await loadCart();
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to update cart');
        }
    } catch (error) {
        console.error('Failed to update cart:', error);
    }
}

async function removeFromCart(itemId) {
    try {
        const headers = {
            'Authorization': `Bearer ${authToken}`
        };

        const response = await fetch(`${API_BASE}/cart/${itemId}`, {
            method: 'DELETE',
            headers
        });

        if (response.ok) {
            await loadCart();
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to remove item');
        }
    } catch (error) {
        console.error('Failed to remove item:', error);
    }
}


function updateCartUI() {
    // Update cart count
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        const itemCount = cart.items ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
        cartCount.textContent = itemCount;
    }
    
    // Update cart modal
    const cartItemsContainer = document.getElementById('cart-items');
    if (cartItemsContainer) {
        if (cart.items && cart.items.length > 0) {
            cartItemsContainer.innerHTML = cart.items.map(item => `
                <div class="flex items-center justify-between py-2 border-b">
                    <div class="flex items-center">
                        <img src="${item.products.image_url || '/static/placeholder.svg'}" alt="${item.products.name}" class="w-12 h-12 object-cover rounded mr-4">
                        <div>
                            <h5 class="font-semibold">${item.products.name}</h5>
                            <p class="text-sm text-gray-600">UGX ${formatNumber(item.products.price)}</p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <button onclick="updateCartItem('${item.id}', ${item.quantity - 1})" class="px-2 py-1 bg-gray-200 rounded">-</button>
                        <span class="mx-2">${item.quantity}</span>
                        <button onclick="updateCartItem('${item.id}', ${item.quantity + 1})" class="px-2 py-1 bg-gray-200 rounded">+</button>
                        <button onclick="removeFromCart('${item.id}')" class="ml-4 text-red-500">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            cartItemsContainer.innerHTML = '<p class="text-center text-gray-500 py-4">Your cart is empty</p>';
        }
    }

    // Update total
    const cartTotal = document.getElementById('cart-total');
    if (cartTotal && cart.summary) {
        cartTotal.textContent = `UGX ${formatNumber(cart.summary.total || 0)}`;
    }
}

// Helper functions
function formatNumber(num) {
    return new Intl.NumberFormat('en-UG').format(num);
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Modal functions
function openCart() {
    document.getElementById('cart-modal').classList.remove('hidden');
}

function closeCart() {
    document.getElementById('cart-modal').classList.add('hidden');
}

function showLogin() {
    document.getElementById('login-modal').classList.remove('hidden');
}

function closeLogin() {
    document.getElementById('login-modal').classList.add('hidden');
}

function showUploadList() {
    if (!currentUser) {
        showLogin();
        return;
    }
    document.getElementById('upload-modal').classList.remove('hidden');
}

function closeUploadModal() {
    document.getElementById('upload-modal').classList.add('hidden');
}

// Search products
function searchProducts() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        loadProducts(null, searchInput.value);
    }
}

function filterByCategory(category) {
    loadProducts(category);
    scrollToProducts();
}

function scrollToProducts() {
    document.getElementById('products-section').scrollIntoView({ behavior: 'smooth' });
}

// Checkout
async function proceedToCheckout() {
    if (!currentUser) {
        alert('Please login to checkout');
        showLogin();
        return;
    }
    
    if (!cart.items || cart.items.length === 0) {
        alert('Your cart is empty');
        return;
    }
    
    // In a real app, this would navigate to a checkout page
    // For now, we'll just show an alert
    alert('Checkout functionality is not fully implemented yet.');
}

// Form handlers
function setupFormHandlers() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            await login(email, password);
        });
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const first_name = document.getElementById('register-firstname').value;
            const last_name = document.getElementById('register-lastname').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            await register({ first_name, last_name, email, password, user_type: 'parent' });
        });
    }

    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginFormContainer = document.getElementById('login-form-container');
    const registerFormContainer = document.getElementById('register-form-container');

    if (loginTab && registerTab) {
        loginTab.addEventListener('click', () => {
            loginTab.classList.add('border-green-600', 'text-green-600');
            loginTab.classList.remove('text-gray-500', 'border-transparent');
            registerTab.classList.remove('border-green-600', 'text-green-600');
            registerTab.classList.add('text-gray-500', 'border-transparent');
            loginFormContainer.classList.remove('hidden');
            registerFormContainer.classList.add('hidden');
        });

        registerTab.addEventListener('click', () => {
            registerTab.classList.add('border-green-600', 'text-green-600');
            registerTab.classList.remove('text-gray-500', 'border-transparent');
            loginTab.classList.remove('border-green-600', 'text-green-600');
            loginTab.classList.add('text-gray-500', 'border-transparent');
            registerFormContainer.classList.remove('hidden');
            loginFormContainer.classList.add('hidden');
        });
    }
}