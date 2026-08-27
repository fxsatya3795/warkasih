const ADMIN_CONFIG = {
    dataSource: "manual",
    apiBaseUrl: "http://localhost:3000/api"
};

const STORAGE_KEYS = {
    products: "adminProducts",
    cashiers: "adminCashiers",
    orders: "adminOrders"
};

const defaultProducts = [
    { id: "product-1", name: "Nasi Ayam", category: "makanan", price: 15000, stock: 100, icon: "🍗" },
    { id: "product-2", name: "Es Teh", category: "minuman", price: 5000, stock: 100, icon: "🧋" }
];

const defaultCashiers = [];
const defaultOrders = [];

class ManualStorage {
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
        return this.read(STORAGE_KEYS.products, defaultProducts);
    }

    async saveProduct(product) {
        const products = await this.getProducts();
        const index = products.findIndex((item) => item.id === product.id);
        if (index >= 0) products[index] = product;
        else products.push(product);
        return this.write(STORAGE_KEYS.products, products);
    }

    async deleteProduct(id) {
        const products = (await this.getProducts()).filter((item) => item.id !== id);
        return this.write(STORAGE_KEYS.products, products);
    }

    async getCashiers() {
        return this.read(STORAGE_KEYS.cashiers, defaultCashiers);
    }

    async saveCashier(cashier) {
        const cashiers = await this.getCashiers();
        cashiers.push(cashier);
        return this.write(STORAGE_KEYS.cashiers, cashiers);
    }

    async deleteCashier(id) {
        const cashiers = (await this.getCashiers()).filter((item) => item.id !== id);
        return this.write(STORAGE_KEYS.cashiers, cashiers);
    }

    async getOrders() {
        return this.read(STORAGE_KEYS.orders, defaultOrders);
    }
}

class ApiStorage {
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
    async saveProduct(product) {
        const method = product.id ? "PUT" : "POST";
        const path = product.id ? `/products/${encodeURIComponent(product.id)}` : "/products";
        return this.request(path, { method, body: JSON.stringify(product) });
    }
    async deleteProduct(id) {
        return this.request(`/products/${encodeURIComponent(id)}`, { method: "DELETE" });
    }
    async getCashiers() { return this.request("/cashiers"); }
    async saveCashier(cashier) {
        return this.request("/cashiers", { method: "POST", body: JSON.stringify(cashier) });
    }
    async deleteCashier(id) {
        return this.request(`/cashiers/${encodeURIComponent(id)}`, { method: "DELETE" });
    }
    async getOrders() { return this.request("/orders"); }
}

const storage = ADMIN_CONFIG.dataSource === "api"
    ? new ApiStorage(ADMIN_CONFIG.apiBaseUrl)
    : new ManualStorage();

let products = [];
let cashiers = [];
let orders = [];

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatCurrency(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleDateString("id-ID");
}

function showAdminError(error) {
    console.error(error);
    window.alert("Data gagal diproses. Periksa koneksi atau konfigurasi penyimpanan.");
}

function showAdminSection(sectionName) {
    document.querySelectorAll(".admin-section").forEach((section) => {
        section.classList.toggle("active", section.id === `${sectionName}Section`);
    });

    document.querySelectorAll(".menu-button").forEach((button) => {
        button.classList.toggle("active", button.textContent.toLowerCase().includes(sectionName));
    });

    const titles = { dashboard: "Dashboard", produk: "Data Produk", kasir: "Data Kasir", histori: "Histori Pesanan" };
    const title = document.getElementById("pageTitle");
    if (title) title.textContent = titles[sectionName] || "Dashboard";
    closeSidebar();
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const isOpen = sidebar?.classList.toggle("open");
    overlay?.classList.toggle("show", Boolean(isOpen));
}

function closeSidebar() {
    document.getElementById("sidebar")?.classList.remove("open");
    document.getElementById("sidebarOverlay")?.classList.remove("show");
}

function renderProducts() {
    const body = document.getElementById("productTableBody");
    if (!body) return;
    body.innerHTML = products.length ? products.map((product) => `
        <tr>
            <td>${escapeHtml(product.icon || "📦")} ${escapeHtml(product.name)}</td>
            <td>${escapeHtml(product.category)}</td>
            <td>${formatCurrency(product.price)}</td>
            <td>${Number(product.stock) || 0}</td>
            <td>
                <button class="secondary-button" onclick="editProduct('${escapeHtml(product.id)}')">Edit</button>
                <button class="delete-button" onclick="deleteProduct('${escapeHtml(product.id)}')">Hapus</button>
            </td>
        </tr>
    `).join("") : `<tr><td colspan="5">Belum ada produk.</td></tr>`;
}

function renderCashiers() {
    const body = document.getElementById("cashierTableBody");
    if (!body) return;
    body.innerHTML = cashiers.length ? cashiers.map((cashier) => `
        <tr>
            <td>${escapeHtml(cashier.name)}</td>
            <td>${escapeHtml(cashier.email)}</td>
            <td>${escapeHtml(cashier.status || "Aktif")}</td>
            <td><button class="delete-button" onclick="deleteCashier('${escapeHtml(cashier.id)}')">Hapus</button></td>
        </tr>
    `).join("") : `<tr><td colspan="4">Belum ada kasir.</td></tr>`;
}

function renderHistory() {
    const body = document.getElementById("historyTableBody");
    if (!body) return;
    body.innerHTML = orders.length ? orders.map((order) => `
        <tr>
            <td>${escapeHtml(order.number || order.id)}</td>
            <td>${escapeHtml(order.customer || "-")}</td>
            <td>${escapeHtml(order.type || "-")}</td>
            <td>${escapeHtml(order.payment || "-")}</td>
            <td>${formatDate(order.date || order.createdAt)}</td>
        </tr>
    `).join("") : `<tr><td colspan="5">Belum ada histori pesanan.</td></tr>`;
}

function renderStats() {
    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = orders.filter((order) => String(order.date || order.createdAt || "").slice(0, 10) === today);
    const sales = todayOrders.reduce((total, order) => total + Number(order.total || order.amount || 0), 0);
    document.getElementById("todaySales").textContent = formatCurrency(sales);
    document.getElementById("todayOrders").textContent = todayOrders.length;
    document.getElementById("totalProducts").textContent = products.length;
    document.getElementById("totalCashiers").textContent = cashiers.length;
}

function renderCharts() {
    const canvas = document.getElementById("salesChart");
    if (!canvas || !canvas.getContext) return;
    const context = canvas.getContext("2d");
    const width = canvas.clientWidth || 600;
    const height = 240;
    const values = Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        const key = date.toISOString().slice(0, 10);
        return orders.filter((order) => String(order.date || order.createdAt || "").slice(0, 10) === key)
            .reduce((total, order) => total + Number(order.total || order.amount || 0), 0);
    });
    const maximum = Math.max(...values, 1);
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.strokeStyle = "#72bce8";
    context.lineWidth = 3;
    context.beginPath();
    values.forEach((value, index) => {
        const x = 20 + index * ((width - 40) / 6);
        const y = height - 25 - ((height - 50) * value / maximum);
        index ? context.lineTo(x, y) : context.moveTo(x, y);
    });
    context.stroke();
}

function openProductModal(product = null) {
    document.getElementById("productModalTitle").textContent = product ? "Edit Produk" : "Tambah Produk";
    document.getElementById("productId").value = product?.id || "";
    document.getElementById("productName").value = product?.name || "";
    document.getElementById("productCategory").value = product?.category || "";
    document.getElementById("productPrice").value = product?.price || "";
    document.getElementById("productStock").value = product?.stock ?? "";
    document.getElementById("productIcon").value = product?.icon || "";
    document.getElementById("productModal").classList.add("show");
}

function closeProductModal() {
    document.getElementById("productModal")?.classList.remove("show");
    document.getElementById("productForm")?.reset();
}

function editProduct(id) {
    const product = products.find((item) => item.id === id);
    if (product) openProductModal(product);
}

async function deleteProduct(id) {
    if (!window.confirm("Hapus produk ini?")) return;
    try {
        await storage.deleteProduct(id);
        products = products.filter((item) => item.id !== id);
        renderProducts();
        renderStats();
    } catch (error) { showAdminError(error); }
}

function openCashierModal() {
    document.getElementById("cashierForm")?.reset();
    document.getElementById("cashierModal")?.classList.add("show");
}

function closeCashierModal() {
    document.getElementById("cashierModal")?.classList.remove("show");
    document.getElementById("cashierForm")?.reset();
}

async function printReport() {
    showAdminSection("histori");
    window.print();
}

function adminLogout() {
    sessionStorage.removeItem("loginToken");
    sessionStorage.removeItem("userData");
    window.location.href = "index.html";
}

function updateClock() {
    const now = new Date();
    document.getElementById("currentTime").textContent = now.toLocaleTimeString("id-ID");
    document.getElementById("currentDate").textContent = now.toLocaleDateString("id-ID", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
}

async function loadAdminData() {
    try {
        [products, cashiers, orders] = await Promise.all([
            storage.getProducts(), storage.getCashiers(), storage.getOrders()
        ]);
        renderProducts();
        renderCashiers();
        renderHistory();
        renderStats();
        renderCharts();
    } catch (error) { showAdminError(error); }
}

function bindAdminForms() {
    document.getElementById("productForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const product = {
            id: document.getElementById("productId").value || createId("product"),
            name: document.getElementById("productName").value.trim(),
            category: document.getElementById("productCategory").value,
            price: Number(document.getElementById("productPrice").value),
            stock: Number(document.getElementById("productStock").value),
            icon: document.getElementById("productIcon").value.trim() || "📦"
        };
        try {
            await storage.saveProduct(product);
            const index = products.findIndex((item) => item.id === product.id);
            if (index >= 0) products[index] = product;
            else products.push(product);
            closeProductModal();
            renderProducts();
            renderStats();
        } catch (error) { showAdminError(error); }
    });

    document.getElementById("cashierForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const cashier = {
            id: createId("cashier"),
            name: document.getElementById("cashierName").value.trim(),
            email: document.getElementById("cashierEmail").value.trim(),
            password: document.getElementById("cashierPassword").value,
            status: "Aktif"
        };
        try {
            await storage.saveCashier(cashier);
            cashiers.push(cashier);
            closeCashierModal();
            renderCashiers();
            renderStats();
        } catch (error) { showAdminError(error); }
    });
}

async function deleteCashier(id) {
    if (!window.confirm("Hapus akun kasir ini?")) return;
    try {
        await storage.deleteCashier(id);
        cashiers = cashiers.filter((item) => item.id !== id);
        renderCashiers();
        renderStats();
    } catch (error) { showAdminError(error); }
}

document.addEventListener("DOMContentLoaded", () => {
    const userData = JSON.parse(sessionStorage.getItem("userData") || "null");
    if (!sessionStorage.getItem("loginToken") || userData?.role !== "admin") {
        window.location.href = "index.html";
        return;
    }
    document.getElementById("adminName").textContent = userData.email.split("@")[0];
    document.getElementById("adminEmail").textContent = userData.email;
    bindAdminForms();
    loadAdminData();
    updateClock();
    setInterval(updateClock, 1000);
    window.addEventListener("resize", renderCharts);
});

window.showAdminSection = showAdminSection;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.openCashierModal = openCashierModal;
window.closeCashierModal = closeCashierModal;
window.deleteCashier = deleteCashier;
window.printReport = printReport;
window.adminLogout = adminLogout;
