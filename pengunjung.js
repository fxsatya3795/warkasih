const VISITOR_CONFIG = {
    dataSource: "manual",
    apiBaseUrl: "http://localhost:3000/api",
    apiToken: ""
};

const VISITOR_KEYS = {
    products: "adminProducts",
    cart: "visitorCart",
    checkout: "visitorCheckout",
    activeOrder: "visitorActiveOrder",
    orders: "adminOrders"
};

class VisitorManualStorage {
    async getProducts() {
        try {
            return JSON.parse(localStorage.getItem(VISITOR_KEYS.products) || "[]");
        } catch (error) {
            console.error(error);
            return [];
        }
    }
}

class VisitorApiStorage {
    constructor(baseUrl, apiToken) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.apiToken = apiToken;
    }

    async getProducts() {
        const sessionToken = sessionStorage.getItem("loginToken");
        const response = await fetch(`${this.baseUrl}/products`, {
            headers: {
                "Content-Type": "application/json",
                ...(sessionToken || this.apiToken
                    ? { Authorization: `Bearer ${sessionToken || this.apiToken}` }
                    : {})
            }
        });
        if (!response.ok) throw new Error(`API ${response.status}`);
        return response.json();
    }
}

const visitorStorage = VISITOR_CONFIG.dataSource === "api"
    ? new VisitorApiStorage(VISITOR_CONFIG.apiBaseUrl, VISITOR_CONFIG.apiToken)
    : new VisitorManualStorage();

let visitorProducts = [];
let visitorCart = JSON.parse(localStorage.getItem(VISITOR_KEYS.cart) || "[]");
let activeCategory = "semua";

function visitorCurrency(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency", currency: "IDR", maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function visitorEscape(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function saveVisitorCart() {
    localStorage.setItem(VISITOR_KEYS.cart, JSON.stringify(visitorCart));
}

function filteredProducts() {
    return activeCategory === "semua"
        ? visitorProducts
        : visitorProducts.filter((product) => product.category === activeCategory);
}

function renderVisitorProducts() {
    const grid = document.getElementById("productGrid");
    const products = filteredProducts();
    if (!grid) return;
    document.getElementById("productCount").textContent = `${products.length} produk`;
    grid.innerHTML = products.length ? products.map((product) => {
        const stock = typeof product.stock === "number" ? product.stock : null;
        const unavailable = stock !== null && stock <= 0;
        return `<article class="product-card">
            <div class="product-image">${visitorEscape(product.icon || "📦")}</div>
            <div class="product-info">
                <span class="product-category">${visitorEscape(product.category || "produk")}</span>
                <h3 class="product-name">${visitorEscape(product.name)}</h3>
                <strong class="product-price">${visitorCurrency(product.price)}</strong>
                ${stock !== null ? `<small>Stok: ${stock}</small>` : ""}
                <button class="add-product" ${unavailable ? "disabled" : ""} onclick="addToCart('${visitorEscape(product.id)}')">
                    ${unavailable ? "Stok Habis" : "Tambah ke Pesanan"}
                </button>
            </div>
        </article>`;
    }).join("") : "<p>Belum ada produk yang tersedia.</p>";
}

function filterProduct(category) {
    activeCategory = category;
    document.querySelectorAll(".category").forEach((button) => {
        button.classList.toggle("active", button.textContent.toLowerCase().includes(category) || category === "semua" && button.textContent.trim() === "Semua");
    });
    renderVisitorProducts();
}

function addToCart(productId) {
    const product = visitorProducts.find((item) => item.id === productId);
    if (!product) return;
    const existing = visitorCart.find((item) => item.productId === productId);
    const stock = typeof product.stock === "number" ? product.stock : Infinity;
    if (existing) {
        if (existing.quantity >= stock) return window.alert("Jumlah pesanan melebihi stok.");
        existing.quantity += 1;
    } else {
        visitorCart.push({ productId, name: product.name, price: Number(product.price) || 0, icon: product.icon, quantity: 1 });
    }
    saveVisitorCart();
    renderCart();
    document.getElementById("orderPanel")?.classList.add("show");
}

function changeCartQuantity(productId, amount) {
    const item = visitorCart.find((cartItem) => cartItem.productId === productId);
    if (!item) return;
    item.quantity += amount;
    visitorCart = visitorCart.filter((cartItem) => cartItem.quantity > 0);
    saveVisitorCart();
    renderCart();
}

function visitorCartTotal() {
    return visitorCart.reduce((total, item) => total + item.price * item.quantity, 0);
}

function renderCart() {
    const items = document.getElementById("cartItems");
    if (!items) return;
    const quantity = visitorCart.reduce((total, item) => total + item.quantity, 0);
    document.getElementById("cartCount").textContent = `${quantity} item`;
    document.getElementById("cartTotal").textContent = visitorCurrency(visitorCartTotal());
    items.innerHTML = visitorCart.length ? visitorCart.map((item) => `
        <div class="cart-item">
            <div><strong>${visitorEscape(item.icon || "📦")} ${visitorEscape(item.name)}</strong><small>${visitorCurrency(item.price)}</small></div>
            <div class="cart-controls">
                <button onclick="changeCartQuantity('${visitorEscape(item.productId)}', -1)">-</button>
                <span>${item.quantity}</span>
                <button onclick="changeCartQuantity('${visitorEscape(item.productId)}', 1)">+</button>
            </div>
        </div>
    `).join("") : "<p>Keranjang masih kosong.</p>";
}

function closeOrderPanel() {
    document.getElementById("orderPanel")?.classList.remove("show");
}

function showOrderType() {
    if (!visitorCart.length) return window.alert("Tambahkan produk terlebih dahulu.");
    document.getElementById("orderTypeModal")?.classList.add("show");
}

function closeOrderType() {
    document.getElementById("orderTypeModal")?.classList.remove("show");
}

function selectOrderType(type) {
    const paymentMethod = type === "delivery" ? "Transfer Bank" : "Bayar di Kasir";
    window.alert(`Metode pembayaran untuk pesanan ini: ${paymentMethod}`);
    const checkout = {
        items: visitorCart,
        subtotal: visitorCartTotal(),
        type,
        payment: type === "delivery" ? "transfer" : "pay_kasir",
        request: document.getElementById("orderRequest")?.value.trim() || "",
        createdAt: new Date().toISOString()
    };
    localStorage.setItem(VISITOR_KEYS.checkout, JSON.stringify(checkout));
    closeOrderType();
    window.location.href = type === "delivery" ? "pesan-antar.html" : "pembayaran.html";
}

function openFooterPage(type) {
    const pages = {
        media: "https://www.instagram.com/",
        profil: "index.html",
        kontak: "mailto:admin@gmail.com"
    };
    window.open(pages[type] || "index.html", "_blank");
}

function logout() {
    sessionStorage.removeItem("loginToken");
    sessionStorage.removeItem("userData");
    window.location.href = "index.html";
}

function renderVisitorOrderStatus(order) {
    const panel = document.getElementById("visitorOrderStatus");
    if (!panel || !order) return;
    const paid = ["siapkan_pesanan", "selesai", "paid", "dibayar"].includes(String(order.status).toLowerCase());
    panel.hidden = false;
    document.getElementById("visitorStatusIcon").textContent = paid ? "✅" : "⏳";
    document.getElementById("visitorStatusTitle").textContent = paid ? "Struk Pembelian" : "Menunggu Pembayaran";
    document.getElementById("visitorStatusMessage").textContent = paid
        ? "Pembayaran telah diterima kasir. Pesanan sedang disiapkan."
        : "Silakan lakukan pembayaran di kasir.";
    const receipt = document.getElementById("visitorReceipt");
    receipt.hidden = !paid;
    if (paid) receipt.innerHTML = `
        <div><span>No. Pesanan</span><strong>${visitorEscape(order.number || order.id)}</strong></div>
        <div><span>Total</span><strong>${visitorCurrency(order.paidTotal || order.total)}</strong></div>
        <div><span>Metode</span><strong>Pay Kasir</strong></div>
        <div><span>Waktu</span><strong>${new Date(order.paidAt || Date.now()).toLocaleString("id-ID")}</strong></div>
    `;
}

function checkVisitorOrderStatus() {
    const orderId = localStorage.getItem(VISITOR_KEYS.activeOrder);
    if (!orderId) return;
    let orders = [];
    try { orders = JSON.parse(localStorage.getItem(VISITOR_KEYS.orders) || "[]"); } catch (error) { return; }
    const order = orders.find((item) => item.id === orderId);
    if (order) renderVisitorOrderStatus(order);
}

async function loadVisitorProducts() {
    try {
        visitorProducts = await visitorStorage.getProducts();
        renderVisitorProducts();
        renderCart();
    } catch (error) {
        console.error(error);
        document.getElementById("productGrid").innerHTML = "<p>Menu gagal dimuat.</p>";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("userName").textContent = JSON.parse(sessionStorage.getItem("userData") || "null")?.email || "Pengunjung";
    loadVisitorProducts();
    checkVisitorOrderStatus();
    window.setInterval(checkVisitorOrderStatus, 2000);
});

window.filterProduct = filterProduct;
window.addToCart = addToCart;
window.changeCartQuantity = changeCartQuantity;
window.closeOrderPanel = closeOrderPanel;
window.showOrderType = showOrderType;
window.closeOrderType = closeOrderType;
window.selectOrderType = selectOrderType;
window.openFooterPage = openFooterPage;
window.logout = logout;
