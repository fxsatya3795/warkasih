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
    { id: "product-1", name: "Nasi Ayam", category: "makanan", price: 15000, stock: 100, image: "img/images.png" },
    { id: "product-2", name: "Es Teh", category: "minuman", price: 5000, stock: 100, image: "img/images.png" }
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

    async deleteOrder(id) {
        const orders = (await this.getOrders()).filter((item) => String(item.id) !== String(id));
        return this.write(STORAGE_KEYS.orders, orders);
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
    async deleteOrder(id) {
        return this.request(`/orders/${encodeURIComponent(id)}`, { method: "DELETE" });
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
let selectedSalesDate = new Date().toISOString().slice(0, 10);

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

function resolveProductImage(value, fallback = "img/images.png") {
    const rawValue = String(value ?? "").trim();
    if (!rawValue) return fallback;
    if (/^(https?:)?\/\//i.test(rawValue) || rawValue.startsWith("data:")) {
        return rawValue;
    }
    const normalized = rawValue.replace(/\\/g, "/").replace(/^\/+/, "");
    const cleaned = normalized.startsWith("img/") || normalized.startsWith("image/")
        ? normalized
        : normalized.startsWith("./") ? normalized.slice(2) : normalized;
    const candidates = [
        cleaned,
        `img/${cleaned.replace(/^.*\//, "")}`,
        `image/${cleaned.replace(/^.*\//, "")}`,
        `img/${cleaned}`,
        `image/${cleaned}`,
        fallback
    ];
    return candidates.find((candidate) => Boolean(candidate && candidate.trim()));
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
    body.innerHTML = products.length ? products.map((product) => {
        const imageSrc = resolveProductImage(product.image || "", "img/images.png");
        return `
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:12px;">
                    <img src="${imageSrc}" alt="${escapeHtml(product.name)}" style="width:44px;height:44px;object-fit:cover;border-radius:12px;background:#eaf6ff;" onerror="this.onerror=null;this.src='img/images.png';" />
                    <span>${escapeHtml(product.name)}</span>
                </div>
            </td>
            <td>${escapeHtml(product.category)}</td>
            <td>${formatCurrency(product.price)}</td>
            <td>${Number(product.stock) || 0}</td>
            <td>
                <button class="secondary-button" onclick="editProduct('${escapeHtml(product.id)}')">Edit</button>
                <button class="delete-button" onclick="deleteProduct('${escapeHtml(product.id)}')">Hapus</button>
            </td>
        </tr>
    `;
    }).join("") : `<tr><td colspan="5">Belum ada produk.</td></tr>`;
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
            <td>${escapeHtml(cashier.password)}</td>
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
            <td>
                <button class="delete-button" onclick="deleteHistoryOrder('${escapeHtml(order.id)}')">Hapus</button>
            </td>
        </tr>
    `).join("") : `<tr><td colspan="6">Belum ada histori pesanan.</td></tr>`;
}

function getOrderDateKey(order) {
    return String(order.date || order.createdAt || "").slice(0, 10);
}

function getSalesDateOptions() {
    const dates = [...new Set(orders.map((order) => getOrderDateKey(order)).filter(Boolean))].sort().reverse();
    if (dates.length) {
        const options = dates.slice(0, 7);
        if (!options.includes(selectedSalesDate)) selectedSalesDate = options[0] || new Date().toISOString().slice(0, 10);
        return options;
    }

    const fallback = [];
    for (let index = 6; index >= 0; index -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - index);
        fallback.push(date.toISOString().slice(0, 10));
    }
    if (!fallback.includes(selectedSalesDate)) selectedSalesDate = fallback[fallback.length - 1];
    return fallback;
}

function setSelectedSalesDate(date) {
    selectedSalesDate = date;
    renderSalesDateButtons();
    renderStats();
    renderCharts();
}

function renderSalesDateButtons() {
    const container = document.getElementById("salesDateFilters");
    if (!container) return;
    const dates = getSalesDateOptions();
    container.innerHTML = dates.map((date) => {
        const label = new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
        return `<button class="date-filter-button ${date === selectedSalesDate ? "active" : ""}" data-date="${date}" onclick="setSelectedSalesDate('${date}')">${label}</button>`;
    }).join("");
}

function renderStats() {
    const selectedOrders = orders.filter((order) => getOrderDateKey(order) === selectedSalesDate);
    const sales = selectedOrders.reduce((total, order) => total + Number(order.total || order.amount || 0), 0);
    document.getElementById("todaySales").textContent = formatCurrency(sales);
    document.getElementById("todayOrders").textContent = selectedOrders.length;
    document.getElementById("totalProducts").textContent = products.length;
    document.getElementById("totalCashiers").textContent = cashiers.length;
    const categoryTitle = document.getElementById("categoryChartTitle");
    if (categoryTitle) {
        const label = new Date(`${selectedSalesDate}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
        categoryTitle.textContent = `Pembelian ${label}`;
    }
}

function getCategoryTotalsForDate(dateKey) {
    const grouped = { makanan: 0, camilan: 0, minuman: 0, lainnya: 0 };
    orders.filter((order) => getOrderDateKey(order) === dateKey).forEach((order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        if (!items.length) {
            grouped.lainnya += Number(order.total || order.amount || 0);
            return;
        }

        items.forEach((item) => {
            const product = products.find((entry) => String(entry.id) === String(item.productId || item.product_id || item.id));
            const category = product?.category || item.category || item.productCategory || "lainnya";
            const amount = Number(item.price || item.harga || 0) * Number(item.quantity || item.qty || 1);
            if (category in grouped) grouped[category] += amount;
            else grouped.lainnya += amount;
        });
    });
    return grouped;
}

function renderCategoryChart() {
    const chart = document.getElementById("categoryChart");
    if (!chart) return;
    const totals = getCategoryTotalsForDate(selectedSalesDate);
    const categories = [
        { key: "makanan", label: "Makanan" },
        { key: "camilan", label: "Camilan" },
        { key: "minuman", label: "Minuman" },
        { key: "lainnya", label: "Lainnya" }
    ];
    const maximum = Math.max(...categories.map(({ key }) => totals[key]), 1);

    chart.innerHTML = categories.map(({ key, label }) => {
        const value = totals[key] || 0;
        const height = maximum ? Math.max((value / maximum) * 100, value > 0 ? 12 : 0) : 0;
        return `
            <div class="category-column">
                <div class="category-value">${value ? formatCurrency(value) : "Rp0"}</div>
                <div class="category-bar" style="height:${height}%"></div>
                <div class="category-label">${label}</div>
            </div>
        `;
    }).join("");
}

function renderCharts() {
    const canvas = document.getElementById("salesChart");
    if (!canvas || !canvas.getContext) return;
    const context = canvas.getContext("2d");
    const width = canvas.clientWidth || 600;
    const height = 240;
    const selectedDates = getSalesDateOptions();
    const values = selectedDates.map((date) => orders.filter((order) => getOrderDateKey(order) === date)
        .reduce((total, order) => total + Number(order.total || order.amount || 0), 0));
    const maximum = Math.max(...values, 1);
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.strokeStyle = "#72bce8";
    context.lineWidth = 3;
    context.beginPath();
    values.forEach((value, index) => {
        const x = 20 + index * ((width - 40) / Math.max(selectedDates.length - 1, 1));
        const y = height - 25 - ((height - 50) * value / maximum);
        index ? context.lineTo(x, y) : context.moveTo(x, y);
    });
    context.stroke();
    renderCategoryChart();
}

function updateProductImagePreview(value) {
    const preview = document.getElementById("productImagePreview");
    if (!preview) return;
    const source = resolveProductImage(value || document.getElementById("productImage")?.value || "", "img/images.png");
    preview.src = source;
}

function openProductModal(product = null) {
    document.getElementById("productModalTitle").textContent = product ? "Edit Produk" : "Tambah Produk";
    document.getElementById("productId").value = product?.id || "";
    document.getElementById("productName").value = product?.name || "";
    document.getElementById("productCategory").value = product?.category || "";
    document.getElementById("productPrice").value = product?.price || "";
    document.getElementById("productStock").value = product?.stock ?? "";
    document.getElementById("productImage").value = product?.image || "";
    updateProductImagePreview(product?.image || "");
    document.getElementById("productModal").classList.add("show");
}

function closeProductModal() {
    document.getElementById("productModal")?.classList.remove("show");
    document.getElementById("productForm")?.reset();
    updateProductImagePreview("");
    const fileInput = document.getElementById("productImageFile");
    if (fileInput) fileInput.value = "";
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

function getProfileStorageKey(email) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const safeKey = cleanEmail.replace(/[^a-z0-9]+/g, "_");
    return safeKey ? `profile_image_${safeKey}` : "profile_image_default";
}

function updateProfileAvatar(type, imageSource) {
    const avatar = document.getElementById(type === "admin" ? "adminProfileAvatar" : "cashierProfileAvatar");
    const img = avatar?.querySelector("img");
    if (!avatar || !img) return;
    img.src = imageSource || "img/images.png";
}

function triggerProfileUpload(type) {
    const input = document.getElementById(type === "admin" ? "adminProfileInput" : "cashierProfileInput");
    input?.click();
}

function bindProfileUpload(type, userEmail = null) {
    const sessionUser = JSON.parse(sessionStorage.getItem("userData") || "null");
    const email = userEmail || sessionUser?.email || "";
    const key = getProfileStorageKey(email);
    const input = document.getElementById(type === "admin" ? "adminProfileInput" : "cashierProfileInput");
    if (!input) return;
    input.addEventListener("change", (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const imageData = String(reader.result || "");
            updateProfileAvatar(type, imageData);
            localStorage.setItem(key, imageData);
        };
        reader.readAsDataURL(file);
    });

    const savedImage = localStorage.getItem(key);
    if (savedImage) {
        updateProfileAvatar(type, savedImage);
    }
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
        renderSalesDateButtons();
        renderProducts();
        renderCashiers();
        renderHistory();
        renderStats();
        renderCharts();
    } catch (error) { showAdminError(error); }
}

function bindAdminForms() {
    const productImagePicker = document.getElementById("productImagePicker");
    const productImageFile = document.getElementById("productImageFile");
    const productImageInput = document.getElementById("productImage");

    productImagePicker?.addEventListener("click", () => productImageFile?.click());
    productImagePicker?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            productImageFile?.click();
        }
    });

    productImageFile?.addEventListener("change", (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const imageData = String(reader.result || "");
            if (productImageInput) productImageInput.value = imageData;
            updateProductImagePreview(imageData);
        };
        reader.readAsDataURL(file);
    });

    productImageInput?.addEventListener("input", (event) => {
        updateProductImagePreview(event.target.value);
    });

    document.getElementById("productForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const imageValue = document.getElementById("productImage").value.trim();
        const product = {
            id: document.getElementById("productId").value || createId("product"),
            name: document.getElementById("productName").value.trim(),
            category: document.getElementById("productCategory").value,
            price: Number(document.getElementById("productPrice").value),
            stock: Number(document.getElementById("productStock").value),
            image: imageValue ? resolveProductImage(imageValue, "img/images.png") : "img/images.png"
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

async function deleteHistoryOrder(id) {
    if (!window.confirm("Hapus histori transaksi ini?")) return;
    try {
        await storage.deleteOrder(id);
        orders = orders.filter((item) => String(item.id) !== String(id));
        localStorage.setItem("adminOrders", JSON.stringify(orders));
        renderHistory();
        renderStats();
        renderCharts();
        window.dispatchEvent(new CustomEvent("adminOrdersUpdated", { detail: { orders } }));
    } catch (error) { showAdminError(error); }
}

document.addEventListener("DOMContentLoaded", () => {
    const userData = JSON.parse(sessionStorage.getItem("userData") || "null");
    if (!sessionStorage.getItem("loginToken") || userData?.role !== "admin") {
        window.location.href = "pengunjung.html";
        return;
    }
    document.getElementById("adminName").textContent = userData.email.split("@")[0];
    document.getElementById("adminEmail").textContent = userData.email;
    bindAdminForms();
    bindProfileUpload("admin", userData.email);
    loadAdminData();
    updateClock();
    setInterval(updateClock, 1000);
    window.addEventListener("resize", renderCharts);
});

window.resolveProductImage = resolveProductImage;
window.showAdminSection = showAdminSection;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.deleteHistoryOrder = deleteHistoryOrder;
window.openCashierModal = openCashierModal;
window.closeCashierModal = closeCashierModal;
window.deleteCashier = deleteCashier;
window.printReport = printReport;
window.adminLogout = adminLogout;
