// Skooli E-commerce Frontend JavaScript
// This file contains the main client-side logic for the application.

// State management
let cart = { items: [], summary: { total: 0, subtotal: 0, tax: 0, shipping: 0, itemCount: 0 } };
let authToken = localStorage.getItem('authToken') || null;
let currentUser = null;
let currentPage = 'home';
let isSignUpMode = false;

// API Base URL - use the one set in HTML or default to /api
const API_BASE = window.API_BASE_URL ? `${window.API_BASE_URL}/api` : '/api';

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing Skooli app...');
    setupEventHandlers();
    await loadCategories();
    await loadFeaturedProducts();
    
    if (authToken) {
        await checkAuth();
    }
    
    await loadCart();
    updateCartUI();
    updateAuthUI();
});

// Authentication functions
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data;
            updateAuthUI();
        } else {
            logout();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        logout();
    }
}

async function login(email, password) {
    try {
        showLoadingSpinner(true);
        const response = await fetch(`${API_BASE}/auth/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.session.access_token;
            localStorage.setItem('authToken', authToken);
            currentUser = data;
            updateAuthUI();
            hideAuthModal();
            showNotification('Login successful!', 'success');
            await loadCart();
        } else {
            showNotification(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login failed:', error);
        showNotification('Login failed. Please try again.', 'error');
    } finally {
        showLoadingSpinner(false);
    }
}

async function signup(name, email, password) {
    try {
        showLoadingSpinner(true);
        // Split name into first and last name
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        const response = await fetch(`${API_BASE}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                first_name: firstName, 
                last_name: lastName,
                email, 
                password,
                user_type: 'parent'
            })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Account created successfully! Please check your email to verify your account.', 'success');
            hideAuthModal();
            // Switch to login mode for the user to sign in
            isSignUpMode = false;
        } else {
            showNotification(data.error || 'Signup failed', 'error');
        }
    } catch (error) {
        console.error('Signup failed:', error);
        showNotification('Signup failed. Please try again.', 'error');
    } finally {
        showLoadingSpinner(false);
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    cart = { items: [], summary: { total: 0, subtotal: 0, tax: 0, shipping: 0, itemCount: 0 } };
    updateAuthUI();
    updateCartUI();
    showNotification('Logged out successfully', 'success');
}

function updateAuthUI() {
    const authBtn = document.getElementById('authBtn');
    const authText = document.getElementById('authText');
    
    if (authBtn && authText) {
        if (currentUser && currentUser.user) {
            const profile = currentUser.user.profile;
            const displayName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : currentUser.user.email;
            authText.textContent = displayName;
            authBtn.onclick = () => logout();
        } else {
            authText.textContent = 'Sign In';
            authBtn.onclick = () => showAuthModal();
        }
    }
}

// Categories functions
async function loadCategories() {
    try {
        console.log('Loading categories...');
        const response = await fetch(`${API_BASE}/products/categories`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Categories loaded:', data);
        
        const container = document.getElementById('categoriesGrid');
        if (container && data.categories) {
            container.innerHTML = data.categories.slice(0, 6).map(cat => `
                <div onclick="filterByCategory('${cat.slug}')" class="bg-white p-4 rounded-lg shadow hover:shadow-lg cursor-pointer transition-shadow text-center">
                    <i class="fas fa-${cat.icon || 'box'} text-3xl text-blue-600 mb-2"></i>
                    <h4 class="font-semibold">${cat.name}</h4>
                    ${cat.description ? `<p class="text-sm text-gray-600 mt-1">${cat.description}</p>` : ''}
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load categories:', error);
        showNotification('Failed to load categories', 'error');
    }
}

// Products functions
async function loadFeaturedProducts() {
    try {
        console.log('Loading featured products...');
        const response = await fetch(`${API_BASE}/products?featured=true`);
        
        if (!response.ok) {
            // If featured endpoint doesn't exist, load regular products
            return await loadProducts();
        }
        
        const data = await response.json();
        console.log('Featured products loaded:', data);
        
        const container = document.getElementById('featuredGrid');
        if (container && data.products) {
            container.innerHTML = data.products.map(product => `
                <div class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                    <img src="${product.image_url || '/static/placeholder.svg'}" alt="${product.name}" class="w-full h-48 object-cover rounded-t-lg">
                    <div class="p-4">
                        <h4 class="font-semibold mb-2">${product.name}</h4>
                        <p class="text-sm text-gray-600 mb-3 line-clamp-2">${product.description || ''}</p>
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-xl font-bold text-blue-600">UGX ${formatNumber(product.price)}</span>
                        </div>
                        <button onclick="addToCart('${product.id}')" class="w-full bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 transition-colors ${product.stock_quantity <= 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${product.stock_quantity <= 0 ? 'disabled' : ''}>
                            <i class="fas fa-cart-plus mr-1"></i>
                            ${product.stock_quantity > 0 ? 'Add to Cart' : 'Out of Stock'}
                        </button>
                        <p class="text-sm ${product.stock_quantity > 0 ? 'text-green-600' : 'text-red-600'} mt-1 text-center">
                            ${product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of stock'}
                        </p>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load featured products:', error);
        // Fallback to regular products
        await loadProducts();
    }
}

async function loadProducts(category = null, search = null) {
    try {
        console.log('Loading products...');
        let url = `${API_BASE}/products?limit=12`;
        if (category) url += `&category=${category}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Products loaded:', data);
        
        // Show products in featured grid if on home page, otherwise in products grid
        const container = document.getElementById('featuredGrid') || document.getElementById('productsGrid');
        if (container && data.products) {
            container.innerHTML = data.products.map(product => `
                <div class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                    <img src="${product.image_url || '/static/placeholder.svg'}" alt="${product.name}" class="w-full h-48 object-cover rounded-t-lg">
                    <div class="p-4">
                        <h4 class="font-semibold mb-2">${product.name}</h4>
                        <p class="text-sm text-gray-600 mb-3 line-clamp-2">${product.description || ''}</p>
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-xl font-bold text-blue-600">UGX ${formatNumber(product.price)}</span>
                        </div>
                        <button onclick="addToCart('${product.id}')" class="w-full bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 transition-colors ${product.stock_quantity <= 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${product.stock_quantity <= 0 ? 'disabled' : ''}>
                            <i class="fas fa-cart-plus mr-1"></i>
                            ${product.stock_quantity > 0 ? 'Add to Cart' : 'Out of Stock'}
                        </button>
                        <p class="text-sm ${product.stock_quantity > 0 ? 'text-green-600' : 'text-red-600'} mt-1 text-center">
                            ${product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of stock'}
                        </p>
                    </div>
                </div>
            `).join('');
        }
        
        // Show products section if searching/filtering
        if (category || search) {
            showProductsSection();
        }
    } catch (error) {
        console.error('Failed to load products:', error);
        showNotification('Failed to load products', 'error');
    }
}

// Cart functions
async function loadCart() {
    if (!authToken) {
        cart = { items: [], summary: { total: 0, subtotal: 0, tax: 0, shipping: 0, itemCount: 0 } };
        updateCartUI();
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/cart`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            cart = data;
        } else {
            cart = { items: [], summary: { total: 0, subtotal: 0, tax: 0, shipping: 0, itemCount: 0 } };
        }
    } catch (error) {
        console.error('Failed to load cart:', error);
        cart = { items: [], summary: { total: 0, subtotal: 0, tax: 0, shipping: 0, itemCount: 0 } };
    }
    
    updateCartUI();
}

async function addToCart(productId) {
    if (!authToken) {
        showAuthModal();
        return;
    }
    
    try {
        showLoadingSpinner(true);
        const response = await fetch(`${API_BASE}/cart/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ productId, quantity: 1 })
        });

        const data = await response.json();

        if (response.ok) {
            await loadCart();
            showNotification('Item added to cart!', 'success');
        } else {
            showNotification(data.error || 'Failed to add to cart', 'error');
        }
    } catch (error) {
        console.error('Failed to add to cart:', error);
        showNotification('Failed to add to cart', 'error');
    } finally {
        showLoadingSpinner(false);
    }
}

async function updateCartItem(itemId, quantity) {
    if (quantity <= 0) {
        await removeFromCart(itemId);
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/cart/${itemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ quantity })
        });
        
        if (response.ok) {
            await loadCart();
        } else {
            const data = await response.json();
            showNotification(data.error || 'Failed to update cart', 'error');
        }
    } catch (error) {
        console.error('Failed to update cart:', error);
        showNotification('Failed to update cart', 'error');
    }
}

async function removeFromCart(itemId) {
    try {
        const response = await fetch(`${API_BASE}/cart/${itemId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            await loadCart();
            showNotification('Item removed from cart', 'success');
        } else {
            const data = await response.json();
            showNotification(data.error || 'Failed to remove item', 'error');
        }
    } catch (error) {
        console.error('Failed to remove item:', error);
        showNotification('Failed to remove item', 'error');
    }
}

function updateCartUI() {
    // Update cart count
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        cartCount.textContent = cart.summary?.itemCount || 0;
    }

    // Update cart items
    const cartItems = document.getElementById('cartItems');
    if (cartItems) {
        if (!cart.items || cart.items.length === 0) {
            cartItems.innerHTML = '<p class="text-gray-500 text-center py-4">Your cart is empty</p>';
        } else {
            cartItems.innerHTML = cart.items.map(item => `
                <div class="flex items-center space-x-4 p-4 border-b">
                    <img src="${item.products?.image_url || '/static/placeholder.svg'}" alt="${item.products?.name}" class="w-16 h-16 object-cover rounded">
                    <div class="flex-1">
                        <h4 class="font-semibold">${item.products?.name}</h4>
                        <p class="text-sm text-gray-600">UGX ${formatNumber(item.products?.price || 0)}</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button onclick="updateCartItem('${item.id}', ${item.quantity - 1})" class="w-8 h-8 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300">-</button>
                        <span class="w-8 text-center">${item.quantity}</span>
                        <button onclick="updateCartItem('${item.id}', ${item.quantity + 1})" class="w-8 h-8 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300">+</button>
                    </div>
                    <button onclick="removeFromCart('${item.id}')" class="text-red-500 hover:text-red-700">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');
        }
    }

    // Update cart totals
    const cartSubtotal = document.getElementById('cartSubtotal');
    const cartTax = document.getElementById('cartTax');
    const cartTotal = document.getElementById('cartTotal');

    if (cartSubtotal) cartSubtotal.textContent = `UGX ${formatNumber(cart.summary?.subtotal || 0)}`;
    if (cartTax) cartTax.textContent = `UGX ${formatNumber(cart.summary?.tax || 0)}`;
    if (cartTotal) cartTotal.textContent = `UGX ${formatNumber(cart.summary?.total || 0)}`;
}

// UI Helper functions
function formatNumber(num) {
    return Number(num).toLocaleString();
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `p-4 rounded-lg shadow-lg text-white mb-2 transform transition-transform translate-x-full ${
        type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
    }`;
    toast.innerHTML = `
        <div class="flex items-center justify-between">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    container.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.classList.remove('translate-x-full');
    }, 100);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('translate-x-full');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

function showLoadingSpinner(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        if (show) {
            spinner.classList.remove('hidden');
        } else {
            spinner.classList.add('hidden');
        }
    }
}

// Modal functions
function showAuthModal() {
    const modal = document.getElementById('authModal');
    const title = document.getElementById('authTitle');
    const nameField = document.getElementById('nameField');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleLink = document.getElementById('authToggle');
    
    if (modal) {
        modal.classList.remove('hidden');
        
        if (isSignUpMode) {
            title.textContent = 'Sign Up';
            nameField.classList.remove('hidden');
            submitBtn.textContent = 'Sign Up';
            toggleLink.textContent = 'Already have an account? Sign In';
        } else {
            title.textContent = 'Sign In';
            nameField.classList.add('hidden');
            submitBtn.textContent = 'Sign In';
            toggleLink.textContent = "Don't have an account? Sign Up";
        }
    }
}

function hideAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.classList.add('hidden');
        // Clear form
        document.getElementById('authForm').reset();
    }
}

function showCartModal() {
    const modal = document.getElementById('cartModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function hideCartModal() {
    const modal = document.getElementById('cartModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Navigation functions
function showProductsSection() {
    const heroSection = document.getElementById('heroSection');
    const categoriesSection = document.getElementById('categoriesSection');
    const featuredSection = document.getElementById('featuredSection');
    const productsSection = document.getElementById('productsSection');
    
    if (heroSection) heroSection.classList.add('hidden');
    if (categoriesSection) categoriesSection.classList.add('hidden');
    if (featuredSection) featuredSection.classList.add('hidden');
    if (productsSection) productsSection.classList.remove('hidden');
    
    currentPage = 'products';
}

function showHomePage() {
    const heroSection = document.getElementById('heroSection');
    const categoriesSection = document.getElementById('categoriesSection');
    const featuredSection = document.getElementById('featuredSection');
    const productsSection = document.getElementById('productsSection');
    
    if (heroSection) heroSection.classList.remove('hidden');
    if (categoriesSection) categoriesSection.classList.remove('hidden');
    if (featuredSection) featuredSection.classList.remove('hidden');
    if (productsSection) productsSection.classList.add('hidden');
    
    currentPage = 'home';
}

function filterByCategory(category) {
    loadProducts(category);
}

function searchProducts() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        const query = searchInput.value.trim();
        if (query) {
            loadProducts(null, query);
        } else {
            showHomePage();
            loadFeaturedProducts();
        }
    }
}

// Event handlers setup
function setupEventHandlers() {
    // Auth modal events
    const closeAuthBtn = document.getElementById('closeAuthBtn');
    const authToggle = document.getElementById('authToggle');
    const authForm = document.getElementById('authForm');
    
    if (closeAuthBtn) {
        closeAuthBtn.onclick = hideAuthModal;
    }
    
    if (authToggle) {
        authToggle.onclick = (e) => {
            e.preventDefault();
            isSignUpMode = !isSignUpMode;
            showAuthModal();
        };
    }
    
    if (authForm) {
        authForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('emailInput').value;
            const password = document.getElementById('passwordInput').value;
            
            if (isSignUpMode) {
                const name = document.getElementById('nameInput').value;
                await signup(name, email, password);
            } else {
                await login(email, password);
            }
        };
    }
    
    // Cart modal events
    const cartBtn = document.getElementById('cartBtn');
    const closeCartBtn = document.getElementById('closeCartBtn');
    
    if (cartBtn) {
        cartBtn.onclick = showCartModal;
    }
    
    if (closeCartBtn) {
        closeCartBtn.onclick = hideCartModal;
    }
    
    // Navigation events
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            
            if (page === 'home') {
                showHomePage();
                loadFeaturedProducts();
            } else if (page === 'products') {
                showProductsSection();
                loadProducts();
            }
        };
    });
    
    // Search events
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    
    if (searchBtn) {
        searchBtn.onclick = searchProducts;
    }
    
    if (searchInput) {
        searchInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                searchProducts();
            }
        };
    }
    
    // Hero section buttons
    const shopNowBtn = document.getElementById('shopNowBtn');
    const uploadListBtn = document.getElementById('uploadListBtn');
    
    if (shopNowBtn) {
        shopNowBtn.onclick = () => {
            showProductsSection();
            loadProducts();
        };
    }
    
    if (uploadListBtn) {
        uploadListBtn.onclick = () => {
            showNotification('School list upload feature coming soon!', 'info');
        };
    }
    
    // Checkout button
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.onclick = () => {
            if (!authToken) {
                hideCartModal();
                showAuthModal();
                return;
            }
            
            if (!cart.items || cart.items.length === 0) {
                showNotification('Your cart is empty', 'error');
                return;
            }
            
            showNotification('Checkout feature coming soon!', 'info');
        };
    }
    
    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        const authModal = document.getElementById('authModal');
        const cartModal = document.getElementById('cartModal');
        
        if (authModal && !authModal.classList.contains('hidden') && e.target === authModal) {
            hideAuthModal();
        }
        
        if (cartModal && !cartModal.classList.contains('hidden') && e.target === cartModal) {
            hideCartModal();
        }
    });
}