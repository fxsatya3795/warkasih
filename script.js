/* =========================================
   KONFIGURASI LOGIN
========================================= */

const LOGIN_USERS = [
    {
        email: "admin@gmail.com",
        password: "1234",
        role: "admin",
        redirect: "admin.html"
    },
    {
        email: "dimas@gmail.com",
        password: "1234",
        role: "admin",
        redirect: "admin.html"
    },
    {
        email: "kasir@gmail.com",
        password: "1234",
        role: "kasir",
        redirect: "kasir.html"
    },
    {
        email: "agus@gmail.com",
        password: "1234",
        role: "kasir",
        redirect: "kasir.html"
    }
];

const TOKEN_STORAGE_KEY = "loginToken";


/* =========================================
   ELEMENT HTML
========================================= */

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const rememberMe = document.getElementById("rememberMe");

const loginAlert = document.getElementById("loginAlert");
const loginButton = document.getElementById("loginButton");

const togglePassword = document.getElementById("togglePassword");
const eyeIcon = document.getElementById("eyeIcon");


/* =========================================
   MEMBUAT TOKEN
========================================= */

function generateToken() {

    const randomPart = Math.random()
        .toString(36)
        .substring(2);

    const timePart = Date.now();

    return `TOKEN-${timePart}-${randomPart}`;
}


/* =========================================
   MENAMPILKAN ALERT BOOTSTRAP
========================================= */

function showAlert(message, type) {

    loginAlert.className = `alert alert-${type}`;
    loginAlert.innerHTML = message;

    loginAlert.classList.remove("d-none");

    // Hilangkan alert otomatis setelah 4 detik
    setTimeout(() => {

        loginAlert.classList.add("d-none");

    }, 4000);
}


/* =========================================
   TOGGLE PASSWORD
========================================= */

if (togglePassword) togglePassword.addEventListener("click", function () {

    if (passwordInput.type === "password") {

        passwordInput.type = "text";

        eyeIcon.classList.remove("bi-eye");
        eyeIcon.classList.add("bi-eye-slash");

    } else {

        passwordInput.type = "password";

        eyeIcon.classList.remove("bi-eye-slash");
        eyeIcon.classList.add("bi-eye");

    }

});


/* =========================================
   PROSES LOGIN
========================================= */

if (loginForm) loginForm.addEventListener("submit", function (event) {

    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    /* -------------------------------------
       Validasi input kosong
    ------------------------------------- */

    if (email === "" || password === "") {

        showAlert(
            '<i class="bi bi-exclamation-triangle-fill me-2"></i>' +
            'Email dan password wajib diisi.',
            "warning"
        );

        return;
    }


    /* -------------------------------------
       Cek email dan password
    ------------------------------------- */

    const user = LOGIN_USERS.find((item) =>
        item.email === email && item.password === password
    );

    if (user) {

        /* ---------------------------------
           Buat token
        --------------------------------- */

        const token = generateToken();


        /* ---------------------------------
           Data user
        --------------------------------- */

        const userData = {
            email: email,
            role: user.role,
            token: token,
            loginTime: new Date().toISOString()
        };


        /* ---------------------------------
           Simpan session
        --------------------------------- */

        sessionStorage.setItem(
            TOKEN_STORAGE_KEY,
            token
        );

        sessionStorage.setItem(
            "userData",
            JSON.stringify(userData)
        );


        /* ---------------------------------
           Jika Ingat Saya aktif
        --------------------------------- */

        if (rememberMe.checked) {

            localStorage.setItem(
                "rememberEmail",
                email
            );

        } else {

            localStorage.removeItem("rememberEmail");

        }


        /* ---------------------------------
           Alert Login Berhasil
        --------------------------------- */

        showAlert(
            '<i class="bi bi-check-circle-fill me-2"></i>' +
            `<strong>Login berhasil!</strong> Selamat datang ${user.role === "kasir" ? "Kasir" : "Admin"}.`,
            "success"
        );


        /* ---------------------------------
           Ubah tombol
        --------------------------------- */

        loginButton.innerHTML =
            '<span class="spinner-border spinner-border-sm me-2"></span>' +
            'Memproses...';

        loginButton.disabled = true;


        /* ---------------------------------
           Redirect halaman
           
           Ganti dashboard.html sesuai
           nama halaman dashboard Anda.
        --------------------------------- */

        setTimeout(() => {

            window.location.href = user.redirect;

        }, 1500);


    } else {

        /* ---------------------------------
           Login gagal
        --------------------------------- */

        showAlert(
            '<i class="bi bi-x-circle-fill me-2"></i>' +
            '<strong>Login gagal!</strong> Email atau password salah.',
            "danger"
        );


        passwordInput.value = "";

        passwordInput.focus();

    }

});


/* =========================================
   CEK EMAIL YANG DISIMPAN
========================================= */

document.addEventListener("DOMContentLoaded", function () {

    const savedEmail =
        localStorage.getItem("rememberEmail");

    if (savedEmail && emailInput && rememberMe) {

        emailInput.value = savedEmail;

        rememberMe.checked = true;

    }

});