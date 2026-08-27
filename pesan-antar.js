const DELIVERY_CONFIG = {
    deliveryRatePerKm: 3000,
    defaultDistanceKm: 2
};

let deliveryCheckout = JSON.parse(localStorage.getItem("visitorCheckout") || "null");

function deliveryCurrency(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency", currency: "IDR", maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function calculateDelivery() {
    const distance = Math.max(1, Number(document.getElementById("distanceInput")?.value) || DELIVERY_CONFIG.defaultDistanceKm);
    const cost = distance * DELIVERY_CONFIG.deliveryRatePerKm;
    const distanceElement = document.getElementById("distance");
    const costElement = document.getElementById("deliveryCost");
    if (distanceElement) distanceElement.textContent = `${distance} km`;
    if (costElement) costElement.textContent = deliveryCurrency(cost);
    return { distance, cost };
}

function submitDelivery(event) {
    event.preventDefault();
    if (!deliveryCheckout?.items?.length) {
        window.alert("Keranjang pesanan tidak ditemukan.");
        window.location.href = "pengunjung.html";
        return;
    }
    const delivery = calculateDelivery();
    deliveryCheckout = {
        ...deliveryCheckout,
        type: "delivery",
        receiverName: document.getElementById("receiverName").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        address: document.getElementById("address").value.trim(),
        district: document.getElementById("district").value.trim(),
        city: document.getElementById("city").value.trim(),
        distance: delivery.distance,
        deliveryCost: delivery.cost
    };
    localStorage.setItem("visitorCheckout", JSON.stringify(deliveryCheckout));
    window.location.href = "pembayaran.html";
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("deliveryForm");
    if (!form) return;
    const distance = document.createElement("input");
    distance.type = "hidden";
    distance.id = "distanceInput";
    distance.value = deliveryCheckout?.distance || DELIVERY_CONFIG.defaultDistanceKm;
    form.appendChild(distance);
    calculateDelivery();
    form.addEventListener("submit", submitDelivery);
});
