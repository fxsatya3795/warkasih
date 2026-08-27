const PAYMENT_CONFIG = {
    dataSource: "manual",
    apiBaseUrl: "http://localhost:3000/api",
    apiToken: ""
};

const checkout = JSON.parse(localStorage.getItem("visitorCheckout") || "null");
const cartKey = "visitorCart";
const activeOrderKey = "visitorActiveOrder";

class PaymentStorage {
    constructor(config) {
        this.config = config;
    }

    async saveOrder(order) {
        if (this.config.dataSource === "manual") {
            const orders = JSON.parse(localStorage.getItem("adminOrders") || "[]");
            orders.push(order);
            localStorage.setItem("adminOrders", JSON.stringify(orders));
            return order;
        }
        const sessionToken = sessionStorage.getItem("loginToken");
        const response = await fetch(`${this.config.apiBaseUrl.replace(/\/$/, "")}/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(sessionToken || this.config.apiToken
                    ? { Authorization: `Bearer ${sessionToken || this.config.apiToken}` }
                    : {})
            },
            body: JSON.stringify(order)
        });
        if (!response.ok) throw new Error(`API ${response.status}`);
        return response.json();
    }
}

const paymentStorage = new PaymentStorage(PAYMENT_CONFIG);

function paymentCurrency(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency", currency: "IDR", maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function renderPayment() {
    if (!checkout || !checkout.items?.length) {
        document.querySelector(".payment-layout").innerHTML = "<section class=\"payment-card\"><h2>Keranjang kosong</h2><a href=\"pengunjung.html\">Kembali ke menu</a></section>";
        return;
    }
    const subtotal = Number(checkout.subtotal) || checkout.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const delivery = checkout.type === "delivery" ? Number(checkout.deliveryCost) || 0 : 0;
    const method = checkout.payment || (checkout.type === "delivery" ? "transfer" : "pay_kasir");
    const methodLabel = method === "transfer" ? "Transfer Bank" : "Bayar di Kasir";
    const methodAlert = document.getElementById("paymentMethodAlert");
    if (methodAlert) methodAlert.textContent = `Metode pembayaran: ${methodLabel}`;
    const paymentButton = document.querySelector(".order-button");
    if (paymentButton) paymentButton.textContent = method === "pay_kasir"
        ? "Kirim Tagihan ke Kasir"
        : "Bayar dengan Transfer";
    document.querySelectorAll("input[name=payment]").forEach((input) => {
        input.checked = input.value === method;
        input.disabled = input.value !== method;
    });
    document.getElementById("paymentItems").innerHTML = checkout.items.map((item) => `<div class="payment-item"><span>${item.icon || "📦"} ${item.name} x ${item.quantity}</span><strong>${paymentCurrency(item.price * item.quantity)}</strong></div>`).join("");
    document.getElementById("paymentSubtotal").textContent = paymentCurrency(subtotal);
    document.getElementById("paymentDelivery").textContent = paymentCurrency(delivery);
    document.getElementById("paymentTotal").textContent = paymentCurrency(subtotal + delivery);
}

async function processPayment() {
    if (!checkout?.items?.length) return window.alert("Tidak ada pesanan untuk dibayar.");
    const method = checkout.payment || (checkout.type === "delivery" ? "transfer" : "pay_kasir");
    const subtotal = Number(checkout.subtotal) || 0;
    const deliveryCost = Number(checkout.deliveryCost) || 0;
    const order = {
        id: `order-${Date.now()}`,
        number: `RB-${Date.now().toString().slice(-6)}`,
        customer: checkout.receiverName || JSON.parse(sessionStorage.getItem("userData") || "null")?.email || "Pengunjung",
        items: checkout.items,
        subtotal,
        deliveryCost,
        total: subtotal + deliveryCost,
        type: checkout.type || "dinein",
        payment: method,
        request: checkout.request || "",
        address: checkout.address || null,
        status: method === "pay_kasir" ? "menunggu" : "menunggu_verifikasi",
        createdAt: new Date().toISOString()
    };
    try {
        await paymentStorage.saveOrder(order);
        if (method === "cash") localStorage.setItem(activeOrderKey, order.id);
        localStorage.removeItem(cartKey);
        localStorage.removeItem("visitorCheckout");
        window.alert("Pesanan berhasil dikirim ke kasir.");
        window.location.href = method === "cash" ? "pengunjung.html" : "pengunjung.html";
    } catch (error) {
        console.error(error);
        window.alert("Pesanan gagal dikirim. Periksa koneksi API.");
    }
}

document.addEventListener("DOMContentLoaded", renderPayment);
window.processPayment = processPayment;
