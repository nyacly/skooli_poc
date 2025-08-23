// Skooli Admin Dashboard JavaScript

document.addEventListener('DOMContentLoaded', () => {
    const authToken = localStorage.getItem('authToken');

    if (!authToken) {
        window.location.href = '/?login=true';
        return;
    }

    fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(res => {
        if (!res.ok) {
            window.location.href = '/?login=true';
            return Promise.reject('Not authenticated');
        }
        return res.json();
    })
    .then(data => {
        if (data && data.user.profile.user_type === 'admin') {
            loadDashboard(data.user);
            setupTabs();
            loadDashboardStats();
            setupProductModal();
        } else {
            alert('You do not have permission to view this page.');
            window.location.href = '/';
        }
    })
    .catch(err => {
        if (err !== 'Not authenticated') {
            console.error('Error during admin check:', err);
            window.location.href = '/?login=true';
        }
    });
});

function setupProductModal() {
    const addProductBtn = document.getElementById('addProductBtn');
    const productModal = document.getElementById('product-modal');
    const cancelProductModalBtn = document.getElementById('cancel-product-modal');
    const productForm = document.getElementById('product-form');

    addProductBtn.addEventListener('click', () => {
        productModal.classList.remove('hidden');
        document.getElementById('product-modal-title').textContent = 'Add Product';
        productForm.reset();
        document.getElementById('product-id').value = '';
    });

    cancelProductModalBtn.addEventListener('click', () => {
        productModal.classList.add('hidden');
    });

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const product = {
            name: document.getElementById('product-name').value,
            sku: document.getElementById('product-sku').value,
            price: parseFloat(document.getElementById('product-price').value),
            stock_quantity: parseInt(document.getElementById('product-stock').value),
            description: document.getElementById('product-description').value,
        };
        const productId = document.getElementById('product-id').value;

        if (productId) {
            await updateProduct(productId, product);
        } else {
            await createProduct(product);
        }

        productModal.classList.add('hidden');
        loadProducts();
    });
}

async function createProduct(product) {
    await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(product)
    });
}

async function updateProduct(productId, product) {
    await fetch(`/api/admin/products/${productId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(product)
    });
}

function editProduct(id, name, sku, price, stock, description) {
    const productModal = document.getElementById('product-modal');
    productModal.classList.remove('hidden');
    document.getElementById('product-modal-title').textContent = 'Edit Product';
    document.getElementById('product-id').value = id;
    document.getElementById('product-name').value = name;
    document.getElementById('product-sku').value = sku;
    document.getElementById('product-price').value = price;
    document.getElementById('product-stock').value = stock;
    document.getElementById('product-description').value = description;
}

async function deleteProduct(productId) {
    if (confirm('Are you sure you want to delete this product?')) {
        await fetch(`/api/admin/products/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        loadProducts();
    }
}

function loadDashboard(user) {
    const adminUserContainer = document.getElementById('admin-user');
    if (adminUserContainer) {
        adminUserContainer.innerHTML = `
            <span class="font-semibold mr-2">${user.profile.first_name} ${user.profile.last_name}</span>
            <button onclick="logout()" class="text-sm text-red-500 hover:text-red-700">Logout</button>
        `;
    }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Deactivate all tabs
            tabs.forEach(t => {
                t.classList.remove('border-green-600', 'text-green-600');
                t.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            });
            // Activate clicked tab
            tab.classList.add('border-green-600', 'text-green-600');
            tab.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');

            // Hide all content
            contents.forEach(content => {
                content.classList.add('hidden');
            });

            // Show content for clicked tab
            const targetId = `content-${tab.id.split('-')[1]}`;
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.remove('hidden');
            }

            // Load data for the active tab
            switch(tab.id) {
                case 'tab-dashboard':
                    loadDashboardStats();
                    break;
                case 'tab-products':
                    loadProducts();
                    break;
                case 'tab-orders':
                    loadOrders();
                    break;
            }
        });
    });
}

async function loadDashboardStats() {
    // These are placeholders. In a real app, you'd fetch this from an API.
    document.getElementById('stats-revenue').textContent = 'UGX 12,345,678';
    document.getElementById('stats-orders').textContent = '1,234';
    document.getElementById('stats-users').textContent = '56';
    document.getElementById('stats-products').textContent = '78';
}

async function loadProducts() {
    const response = await fetch('/api/products');
    const data = await response.json();
    const tableBody = document.getElementById('products-table-body');
    tableBody.innerHTML = data.products.map(p => `
        <tr>
            <td class="p-2">${p.name}</td>
            <td class="p-2">UGX ${p.price.toLocaleString()}</td>
            <td class="p-2">${p.stock_quantity}</td>
            <td class="p-2">
                <button onclick="editProduct('${p.id}', '${p.name}', '${p.sku}', ${p.price}, ${p.stock_quantity}, '${p.description}')" class="text-blue-500 hover:underline">Edit</button>
                <button onclick="deleteProduct('${p.id}')" class="text-red-500 hover:underline ml-2">Delete</button>
            </td>
        </tr>
    `).join('');
}

async function loadOrders() {
    const response = await fetch('/api/admin/orders', { headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` } });
    const data = await response.json();
    const tableBody = document.getElementById('orders-table-body');
    tableBody.innerHTML = data.map(o => `
        <tr>
            <td class="p-2">${o.id.substring(0, 8)}...</td>
            <td class="p-2">${o.first_name} ${o.last_name}</td>
            <td class="p-2">UGX ${o.total_amount.toLocaleString()}</td>
            <td class="p-2">${o.status}</td>
            <td class="p-2">${new Date(o.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
}


function logout() {
    localStorage.removeItem('authToken');
    window.location.href = '/';
}
