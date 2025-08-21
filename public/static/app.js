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
    await loadCart();
    updateCartUI();
    
    if (authToken) {
        await checkAuth();
    }
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
    if (loginBtn && currentUser) {
        loginBtn.innerHTML = `<i class="fas fa-user mr-2"></i>${currentUser.firstName}`;
        loginBtn.setAttribute('onclick', 'showUserMenu()');
    }
}

async function login(email, password) {
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            sessionId = data.sessionId;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('sessionId', sessionId);
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
        const response = await fetch(`${API_BASE}/products/categories/all`);
        const categories = await response.json();
        
        const container = document.getElementById('categories');
        if (container) {
            container.innerHTML = categories.map(cat => `
                <div onclick="filterByCategory(${cat.id})" class="bg-white p-4 rounded-lg shadow hover:shadow-lg cursor-pointer transition-shadow">
                    <i class="fas ${cat.icon || 'fa-box'} text-3xl text-green-600 mb-2"></i>
                    <h4 class="font-semibold">${cat.name}</h4>
                    <p class="text-sm text-gray-600">${cat.description || ''}</p>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
}

// Products
async function loadProducts(categoryId = null, search = null) {
    try {
        let url = `${API_BASE}/products?limit=20`;
        if (categoryId) url += `&category=${categoryId}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        const container = document.getElementById('products');
        if (container) {
            container.innerHTML = data.products.map(product => `
                <div class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                    <img src="${product.image_url || '/static/placeholder.png'}" alt="${product.name}" class="w-full h-48 object-cover rounded-t-lg">
                    <div class="p-4">
                        <h4 class="font-semibold mb-2">${product.name}</h4>
                        <p class="text-gray-600 text-sm mb-2">${product.description || ''}</p>
                        <div class="flex justify-between items-center">
                            <span class="text-xl font-bold text-green-600">UGX ${formatNumber(product.price)}</span>
                            <button onclick="addToCart(${product.id})" class="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600">
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
    try {
        const headers = {};
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        if (sessionId) {
            headers['X-Session-Id'] = sessionId;
        }
        
        const response = await fetch(`${API_BASE}/cart`, { headers });
        const data = await response.json();
        
        cart = data;
        updateCartUI();
    } catch (error) {
        console.error('Failed to load cart:', error);
    }
}

async function addToCart(productId) {
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        if (sessionId) {
            headers['X-Session-Id'] = sessionId;
        }
        
        const response = await fetch(`${API_BASE}/cart/add`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ productId, quantity: 1 })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            cart = data.cart;
            if (data.sessionId && !sessionId) {
                sessionId = data.sessionId;
                localStorage.setItem('sessionId', sessionId);
            }
            updateCartUI();
            showNotification('Item added to cart!');
        } else {
            alert(data.error || 'Failed to add to cart');
        }
    } catch (error) {
        console.error('Failed to add to cart:', error);
    }
}

async function updateCartItem(productId, quantity) {
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        if (sessionId) {
            headers['X-Session-Id'] = sessionId;
        }
        
        const response = await fetch(`${API_BASE}/cart/update`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ productId, quantity })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            cart = data.cart;
            updateCartUI();
        }
    } catch (error) {
        console.error('Failed to update cart:', error);
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
    const cartItems = document.getElementById('cart-items');
    if (cartItems) {
        if (cart.items && cart.items.length > 0) {
            cartItems.innerHTML = cart.items.map(item => `
                <div class="flex items-center justify-between py-2 border-b">
                    <div class="flex items-center">
                        <img src="${item.imageUrl || '/static/placeholder.png'}" alt="${item.name}" class="w-12 h-12 object-cover rounded mr-4">
                        <div>
                            <h5 class="font-semibold">${item.name}</h5>
                            <p class="text-sm text-gray-600">UGX ${formatNumber(item.price)}</p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <button onclick="updateCartItem(${item.productId}, ${item.quantity - 1})" class="px-2 py-1 bg-gray-200 rounded">-</button>
                        <span class="mx-2">${item.quantity}</span>
                        <button onclick="updateCartItem(${item.productId}, ${item.quantity + 1})" class="px-2 py-1 bg-gray-200 rounded">+</button>
                        <button onclick="updateCartItem(${item.productId}, 0)" class="ml-4 text-red-500">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            cartItems.innerHTML = '<p class="text-center text-gray-500 py-4">Your cart is empty</p>';
        }
    }
    
    // Update total
    const cartTotal = document.getElementById('cart-total');
    if (cartTotal) {
        cartTotal.textContent = `UGX ${formatNumber(cart.totalAmount || 0)}`;
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

function filterByCategory(categoryId) {
    loadProducts(categoryId);
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
    // For now, we'll create an order directly
    try {
        const response = await fetch(`${API_BASE}/orders/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                shippingAddress: {
                    name: currentUser.firstName + ' ' + currentUser.lastName,
                    phone: '+256700000000',
                    address: 'Kampala, Uganda'
                }
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            closeCart();
            alert(`Order created successfully! Order number: ${data.order.orderNumber}`);
            
            // Initiate payment
            initiatePayment(data.order.id);
        } else {
            alert(data.error || 'Failed to create order');
        }
    } catch (error) {
        console.error('Checkout error:', error);
        alert('Failed to create order');
    }
}

// Payment
async function initiatePayment(orderId) {
    const phoneNumber = prompt('Enter your MoMo phone number (e.g., 0700000000):');
    
    if (!phoneNumber) return;
    
    try {
        const response = await fetch(`${API_BASE}/payments/initiate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                orderId,
                phoneNumber,
                paymentMethod: 'momo'
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(data.message);
            
            // Clear cart after successful order
            await fetch(`${API_BASE}/cart/clear`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            cart = { items: [], totalAmount: 0 };
            updateCartUI();
        } else {
            alert(data.error || 'Payment failed');
        }
    } catch (error) {
        console.error('Payment error:', error);
        alert('Payment failed');
    }
}

// File upload
async function uploadList() {
    const fileInput = document.getElementById('file-input');
    const schoolSelect = document.getElementById('school-select');
    
    if (!fileInput.files[0]) {
        alert('Please select a file');
        return;
    }
    
    if (!schoolSelect.value) {
        alert('Please select a school');
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        const fileContent = e.target.result;
        
        try {
            const response = await fetch(`${API_BASE}/school-lists/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    schoolId: parseInt(schoolSelect.value),
                    fileName: file.name,
                    fileContent
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert(`Successfully parsed ${data.parsedItems.length} items with ${data.matchRate.toFixed(0)}% match rate`);
                closeUploadModal();
                
                // Add matched items to cart
                if (data.matchedProducts.length > 0) {
                    for (const item of data.matchedProducts) {
                        if (item.matched_product_id) {
                            await addToCart(item.matched_product_id);
                        }
                    }
                }
            } else {
                alert(data.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload failed');
        }
    };
    
    reader.readAsText(file);
}

// Login form handler
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = e.target[0].value;
            const password = e.target[1].value;
            await login(email, password);
        });
    }
});