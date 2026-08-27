const CASHIER_CONFIG = {
    dataSource: "manual",
    apiBaseUrl: "http://localhost:3000/api"
};

const CASHIER_STORAGE_KEYS = {
    products: "adminProducts",
    orders: "adminOrders"
};

class CashierManualStorage {
    read(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            console.error(`Gagal membaca ${key}`, error);
            return fallback;
        }
    }

    write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
        return value;
    }

    async getProducts() {
        return this.read(CASHIER_STORAGE_KEYS.products, []);
    }

    async saveProducts(products) {
        return this.write(CASHIER_STORAGE_KEYS.products, products);
    }

    async getOrders() {
        return this.read(CASHIER_STORAGE_KEYS.orders, []);
    }

    async saveOrder(order) {
        const orders = await this.getOrders();
        const index = orders.findIndex((item) => item.id === order.id);
        if (index >= 0) orders[index] = order;
        else orders.push(order);
        return this.write(CASHIER_STORAGE_KEYS.orders, orders);
    }
}

class CashierApiStorage {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
    }

    async request(path, options = {}) {
        const token = sessionStorage.getItem("loginToken");
        const response = await fetch(`${this.baseUrl}${path}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(options.headers || {})
            }
        });
        if (!response.ok) throw new Error(`API ${response.status}: ${response.statusText}`);
        return response.status === 204 ? null : response.json();
    }

    async getProducts() { return this.request("/products"); }
    async saveProducts(products) {
        await Promise.all(products.map((product) => this.request(
            `/products/${encodeURIComponent(product.id)}`,
            { method: "PUT", body: JSON.stringify(product) }
        )));
        return products;
    }
    async getOrders() { return this.request("/orders"); }
    async saveOrder(order) {
        return this.request(`/orders/${encodeURIComponent(order.id)}`, {
            method: "PUT",
            body: JSON.stringify(order)
        });
    }
}

const cashierStorage = CASHIER_CONFIG.dataSource === "api"
    ? new CashierApiStorage(CASHIER_CONFIG.apiBaseUrl)
    : new CashierManualStorage();

let cashierProducts = [];
let cashierOrders = [];
let selectedOrder = null;

function escapeCashierHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function cashierCurrency(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency", currency: "IDR", maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function orderItems(order) {
    return order.items || order.products || order.detail || [];
}

function itemProductId(item) {
    return item.productId || item.product_id || item.id;
}

function itemQuantity(item) {
    return Number(item.quantity || item.qty || 1);
}

function itemPrice(item) {
    return Number(item.price || item.harga || 0);
}

function orderTotal(order) {
    if (order.total || order.amount) return Number(order.total || order.amount);
    return orderItems(order).reduce((total, item) => total + itemPrice(item) * itemQuantity(item), 0);
}

function isCompleted(order) {
    return ["selesai", "completed", "paid", "dibayar", "siapkan_pesanan"].includes(String(order.status).toLowerCase());
}

function isPaymentReceived(order) {
    return ["selesai", "completed", "paid", "dibayar", "siapkan_pesanan"].includes(String(order.status).toLowerCase());
}

function showCashierSection(sectionName) {
    const sections = {
        pesanan: "pesananCashierSection",
        selesai: "selesaiCashierSection",
        histori: "historiCashierSection"
    };
    Object.entries(sections).forEach(([name, id]) => {
        document.getElementById(id)?.classList.toggle("active", name === sectionName);
    });
    document.querySelectorAll(".cashier-menu-item").forEach((button) => {
        button.classList.toggle("active", button.textContent.toLowerCase().includes(sectionName));
    });
    closeCashierSidebar();
}

function toggleCashierSidebar() {
    const sidebar = document.querySelector(".cashier-sidebar");
    const overlay = document.getElementById("cashierSidebarOverlay");
    const isOpen = sidebar?.classList.toggle("open");
    overlay?.classList.toggle("show", Boolean(isOpen));
}

function closeCashierSidebar() {
    document.querySelector(".cashier-sidebar")?.classList.remove("open");
    document.getElementById("cashierSidebarOverlay")?.classList.remove("show");
}

function orderCard(order, completed = false) {
    const items = orderItems(order).map((item) => `
        <div class="order-product">
            <span>${escapeCashierHtml(item.name || item.productName || "Produk")}</span>
            <strong>${itemQuantity(item)} x ${cashierCurrency(itemPrice(item))}</strong>
        </div>
    `).join("");
    const action = completed
        ? `<span class="order-ready">✅ Siapkan pesanan</span>`
        : `<button class="process-button" onclick="openPOS('${escapeCashierHtml(order.id)}')">Buka Tagihan Pay Kasir</button>`;
    return `
        <article class="cashier-order-card">
            <div class="order-card-header">
                <div><strong>${escapeCashierHtml(order.number || order.id || "Pesanan")}</strong><small>${escapeCashierHtml(order.customer || "Pelanggan")}</small></div>
                <span>${escapeCashierHtml(order.type || "-" )}</span>
            </div>
            <div class="order-products">${items || "Tidak ada rincian produk."}</div>
            <div class="order-card-footer"><strong>Total ${cashierCurrency(orderTotal(order))}</strong>${action}</div>
        </article>
    `;
}

function renderCashierOrders() {
    const incoming = cashierOrders.filter((order) => !isCompleted(order));
    const completed = cashierOrders.filter(isCompleted);
    document.getElementById("cashierOrderList").innerHTML = incoming.length
        ? incoming.map((order) => orderCard(order)).join("")
        : "<p>Belum ada pesanan masuk.</p>";
    document.getElementById("completedOrderList").innerHTML = completed.length
        ? completed.map((order) => orderCard(order, true)).join("")
        : "<p>Belum ada pesanan selesai.</p>";
    renderCashierHistory(completed);
    renderNotifications(incoming);
}

function renderCashierHistory(completedOrders) {
    const body = document.getElementById("cashierHistoryTable");
    body.innerHTML = completedOrders.length ? completedOrders.map((order) => `
        <tr>
            <td>${escapeCashierHtml(order.number || order.id)}</td>
            <td>${cashierCurrency(order.paidTotal || order.total || order.amount)}</td>
            <td>${escapeCashierHtml(order.payment || "Tunai")}</td>
            <td>${cashierCurrency(order.change || 0)}</td>
            <td>${new Date(order.paidAt || order.createdAt || Date.now()).toLocaleString("id-ID")}</td>
        </tr>
    `).join("") : "<tr><td colspan=\"5\">Belum ada histori transaksi.</td></tr>";
}

function renderNotifications(incoming) {
    const activeOrders = cashierOrders.filter((order) => !isPaymentReceived(order));
    const readyOrders = cashierOrders.filter(isPaymentReceived).filter((order) => order.status === "siapkan_pesanan");
    document.getElementById("notificationBadge").textContent = activeOrders.length + readyOrders.length;
    document.getElementById("notificationList").innerHTML = activeOrders.length || readyOrders.length
        ? activeOrders.map((order) => `<p>Tagihan menunggu pembayaran: ${escapeCashierHtml(order.number || order.id)}</p>`).join("") +
          readyOrders.map((order) => `<p>✅ Siapkan pesanan: ${escapeCashierHtml(order.number || order.id)}</p>`).join("")
        : "<p>Tidak ada pesanan baru.</p>";
}

function toggleCashierNotification() {
    document.getElementById("notificationPanel")?.classList.toggle("show");
}

function openPOS(orderId) {
    selectedOrder = cashierOrders.find((order) => order.id === orderId);
    if (!selectedOrder) return;
    const subtotal = orderTotal(selectedOrder);
    document.getElementById("posOrderInfo").innerHTML = `<strong>${escapeCashierHtml(selectedOrder.number || selectedOrder.id)}</strong><br>${escapeCashierHtml(selectedOrder.customer || "Pelanggan")}`;
    document.getElementById("paymentBill").style.display = isPaymentReceived(selectedOrder) ? "none" : "block";
    document.getElementById("paymentReceipt").classList.toggle("show", isPaymentReceived(selectedOrder));
    document.getElementById("discountInput").value = 0;
    document.getElementById("paymentInput").value = "";
    document.getElementById("posSubtotal").textContent = cashierCurrency(subtotal);
    document.getElementById("posModal").classList.add("show");
    calculatePOS();
    if (isPaymentReceived(selectedOrder)) renderReceipt(selectedOrder);
}

function closePOS() {
    document.getElementById("posModal")?.classList.remove("show");
    selectedOrder = null;
}

function renderReceipt(order) {
    const content = document.getElementById("receiptContent");
    if (!content) return;
    content.innerHTML = `
        <div class="receipt-row"><span>No. Pesanan</span><strong>${escapeCashierHtml(order.number || order.id)}</strong></div>
        <div class="receipt-row"><span>Pelanggan</span><strong>${escapeCashierHtml(order.customer || "-")}</strong></div>
        <div class="receipt-row"><span>Total</span><strong>${cashierCurrency(order.paidTotal || order.total)}</strong></div>
        <div class="receipt-row"><span>Pembayaran</span><strong>Pay Kasir</strong></div>
        <div class="receipt-row"><span>Kembalian</span><strong>${cashierCurrency(order.change || 0)}</strong></div>
    `;
}

function printCashierReceipt() {
    window.print();
}

function calculatePOS() {
    if (!selectedOrder) return;
    const subtotal = orderTotal(selectedOrder);
    const discountRate = Math.min(100, Math.max(0, Number(document.getElementById("discountInput").value) || 0));
    const discount = subtotal * discountRate / 100;
    const total = subtotal - discount;
    const payment = Number(document.getElementById("paymentInput").value) || 0;
    document.getElementById("posDiscount").textContent = cashierCurrency(discount);
    document.getElementById("posTotal").textContent = cashierCurrency(total);
    document.getElementById("posChange").textContent = cashierCurrency(Math.max(0, payment - total));
    return { subtotal, discount, total, payment };
}

async function processCashierPayment() {
    if (!selectedOrder) return;
    const calculation = calculatePOS();
    if (calculation.payment < calculation.total) {
        window.alert("Nominal uang pelanggan belum mencukupi.");
        return;
    }
    const quantities = new Map();
    orderItems(selectedOrder).forEach((item) => {
        const id = itemProductId(item);
        quantities.set(id, (quantities.get(id) || 0) + itemQuantity(item));
    });
    const changedProducts = cashierProducts.map((product) => {
        if (!quantities.has(product.id) || typeof product.stock !== "number") return product;
        const quantity = quantities.get(product.id);
        if (product.stock < quantity) throw new Error(`Stok ${product.name} tidak mencukupi`);
        return { ...product, stock: product.stock - quantity };
    });
    try {
        await cashierStorage.saveProducts(changedProducts);
        const updatedOrder = {
            ...selectedOrder,
            status: "siapkan_pesanan",
            paidTotal: calculation.total,
            discount: calculation.discount,
            payment: "Tunai",
            paidAmount: calculation.payment,
            change: calculation.payment - calculation.total,
            paidAt: new Date().toISOString()
        };
        await cashierStorage.saveOrder(updatedOrder);
        cashierProducts = changedProducts;
        cashierOrders = cashierOrders.map((order) => order.id === updatedOrder.id ? updatedOrder : order);
        document.getElementById("paymentBill").style.display = "none";
        document.getElementById("paymentReceipt").classList.add("show");
        renderReceipt(updatedOrder);
        renderCashierOrders();
        window.alert("Pembayaran diterima. Struk dibuat dan notifikasi berubah menjadi: Siapkan pesanan.");
    } catch (error) {
        console.error(error);
        window.alert(error.message || "Pembayaran gagal diproses.");
    }
}

function cashierLogout() {
    sessionStorage.removeItem("loginToken");
    sessionStorage.removeItem("userData");
    window.location.href = "index.html";
}

function updateCashierClock() {
    const now = new Date();
    document.getElementById("cashierTime").textContent = now.toLocaleTimeString("id-ID");
    document.getElementById("cashierDate").textContent = now.toLocaleDateString("id-ID", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
}

async function loadCashierData() {
    try {
        [cashierProducts, cashierOrders] = await Promise.all([
            cashierStorage.getProducts(), cashierStorage.getOrders()
        ]);
        renderCashierOrders();
    } catch (error) {
        console.error(error);
        window.alert("Data kasir gagal dimuat. Periksa koneksi atau penyimpanan.");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const userData = JSON.parse(sessionStorage.getItem("userData") || "null");
    if (!sessionStorage.getItem("loginToken") || userData?.role !== "kasir") {
        window.location.href = "index.html";
        return;
    }
    document.getElementById("cashierName").textContent = userData.email.split("@")[0];
    document.getElementById("cashierEmail").textContent = userData.email;
    loadCashierData();
    updateCashierClock();
    setInterval(updateCashierClock, 1000);
});

window.showCashierSection = showCashierSection;
window.toggleCashierSidebar = toggleCashierSidebar;
window.closeCashierSidebar = closeCashierSidebar;
window.toggleCashierNotification = toggleCashierNotification;
window.renderCashierOrders = renderCashierOrders;
window.openPOS = openPOS;
window.closePOS = closePOS;
window.calculatePOS = calculatePOS;
window.processCashierPayment = processCashierPayment;
window.printCashierReceipt = printCashierReceipt;
window.cashierLogout = cashierLogout;
