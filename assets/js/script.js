const API_URL = 'inc/api.php';

// Universal function for API requests
async function apiRequest(action, data = {}) {
    const token = localStorage.getItem('homepage_token');
    const headers = {
        'Content-Type': 'application/json'
    };

    // Attach token if the user is authenticated
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const payload = { action, ...data };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        return await response.json();
    } catch (error) {
        console.error('Network or server error:', error);
        return { status: 'error', message: 'Connection failed' };
    }
}

// Authentication handlers (under the hood)
const Auth = {
    async register(username, password) {
        const res = await apiRequest('register', { username, password });
        if (res.status === 'success') {
            localStorage.setItem('homepage_token', res.token);
            console.log('✅ Registration successful, token saved!');
        } else {
            console.error('❌ Registration failed:', res.message);
        }
        return res;
    },

    async login(username, password) {
        const res = await apiRequest('login', { username, password });
        if (res.status === 'success') {
            localStorage.setItem('homepage_token', res.token);
            console.log('✅ Login successful, token saved!');
        } else {
            console.error('❌ Login failed:', res.message);
        }
        return res;
    },

    logout() {
        localStorage.removeItem('homepage_token');
        console.log('👋 Logged out successfully');
        // UI re-render logic will go here later
    }
};

// Workspace data management
const DashboardData = {
    async load() {
        const res = await apiRequest('get_state');
        if (res.status === 'success') {
            console.log('📦 Data loaded:', res.data);
            return res.data;
        } else {
            console.error('❌ Failed to load data:', res.message);
            return null;
        }
    },

    async save(stateObj) {
        const res = await apiRequest('save_state', { data: stateObj });
        if (res.status === 'success') {
            console.log('💾 State successfully saved to DB!');
        } else {
            console.error('❌ Failed to save state:', res.message);
        }
        return res;
    }
};

// =========================================
// INIT & AUTH LOGIC
// =========================================
const authOverlay = document.getElementById('authOverlay');
const authForm = document.getElementById('authForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const authMessage = document.getElementById('authMessage');
const btnRegister = document.getElementById('btnRegister');

async function initApp() {
    const token = localStorage.getItem('homepage_token');
    const authHeading = authOverlay.querySelector('h2');

    if (!token) {
        // No token, show normal login form
        authOverlay.classList.add('active');
    } else {
        // Token exists! Instantly hide the form while we verify with the server
        authForm.style.display = 'none';
        authHeading.textContent = 'Loading workspace...';

        await loadAndRenderWorkspace();
    }
}

async function loadAndRenderWorkspace() {
    const data = await DashboardData.load();
    const authHeading = authOverlay.querySelector('h2');

    if (data) {
        // Token is valid and data loaded! Hide the overlay completely
        authOverlay.classList.remove('active');
        console.log("Ready to build UI with:", data);

        // Restore the form state in the background for future logouts
        setTimeout(() => {
            authForm.style.display = 'block';
            authHeading.textContent = 'Workspace';
        }, 500);

        // HERE WE WILL CALL buildWorkspaces(data)

    } else {
        // Token is invalid or expired
        localStorage.removeItem('homepage_token');
        authForm.style.display = 'block';
        authHeading.textContent = 'Workspace';
        authOverlay.classList.add('active');
    }

    buildWorkspaces(data);
}

// Слушатель на кнопку Login (срабатывает и по Enter в инпуте)
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authMessage.textContent = 'Logging in...';
    authMessage.style.color = 'var(--text-muted)';

    const res = await Auth.login(usernameInput.value, passwordInput.value);

    if (res.status === 'success') {
        authMessage.textContent = '';
        usernameInput.value = '';
        passwordInput.value = '';
        await loadAndRenderWorkspace();
    } else {
        authMessage.style.color = '#ff6b6b';
        authMessage.textContent = res.message;
    }
});

// Слушатель на кнопку Register
btnRegister.addEventListener('click', async () => {
    if (!usernameInput.value || passwordInput.value.length < 6) {
        authMessage.style.color = '#ff6b6b';
        authMessage.textContent = 'Username required, password min 6 chars';
        return;
    }

    authMessage.textContent = 'Registering...';
    authMessage.style.color = 'var(--text-muted)';

    const res = await Auth.register(usernameInput.value, passwordInput.value);

    if (res.status === 'success') {
        authMessage.textContent = '';
        await loadAndRenderWorkspace();
    } else {
        authMessage.style.color = '#ff6b6b';
        authMessage.textContent = res.message;
    }
});

// Запускаем проверку при загрузке страницы
initApp();

// =========================================
// STATE MANAGEMENT & RENDER
// =========================================

// Default state for new users
const defaultState = {
    workspaces: [
        {
            id: "ws-1",
            title: "Base / Life",
            items: [
                {
                    id: "item-wp",
                    type: "icon",
                    title: "Wikipedia",
                    url: "https://wikipedia.org",
                    icon: "https://icon.horse/icon/wikipedia.org"
                },
                {
                    id: "item-ff",
                    type: "single",
                    title: "Firefox",
                    url: "https://firefox.com",
                    icon: "https://icon.horse/icon/firefox.com"
                },
                {
                    id: "group-1", type: "group", title: "Google Apps",
                    links: [
                        { id: "sub-1", title: "Gmail", url: "https://mail.google.com", icon: "https://icon.horse/icon/mail.google.com" },
                        { id: "sub-2", title: "Calendar", url: "https://calendar.google.com", icon: "https://icon.horse/icon/calendar.google.com" }
                    ]
                }
            ]
        },
        {
            id: "ws-2",
            title: "Dev / Projects",
            items: [
                { id: "item-github", type: "single", title: "GitHub", url: "https://github.com", icon: "https://icon.horse/icon/github.com" }
            ]
        }
    ]
};

function buildWorkspaces(state) {
    const slider = document.getElementById('slider');
    slider.innerHTML = ''; // Clear current content

    // Fallback to default state if DB is completely empty
    const workspacesData = (state && state.workspaces && state.workspaces.length > 0)
        ? state.workspaces
        : defaultState.workspaces;

    workspacesData.forEach((ws, index) => {
        // Create Section
        const section = document.createElement('section');
        section.className = 'workspace';
        section.dataset.id = ws.id;

        // Title
        const title = document.createElement('div');
        title.className = 'workspace-title';
        title.textContent = ws.title;
        section.appendChild(title);

        // Grid
        const grid = document.createElement('div');
        grid.className = 'layout-grid';
        grid.id = `grid-${index + 1}`;

        // Populate Items
        ws.items.forEach(item => {
            if (item.type === 'icon') {
                // Только иконка (как Wikipedia в примере)
                grid.innerHTML += `
            <a href="${item.url}" class="draggable-item card-icon" title="${item.title}" data-id="${item.id}">
                <img src="${item.icon}" alt="${item.title}">
            </a>
        `;
            } else if (item.type === 'single') {
                // Иконка + Текст (как Firefox в примере)
                grid.innerHTML += `
            <a href="${item.url}" class="draggable-item card-single" title="${item.title}" data-id="${item.id}">
                <img src="${item.icon}" alt="${item.title}"> ${item.title}
            </a>
        `;
            } else if (item.type === 'group') {
                const subLinksHTML = item.links.map(sub => `
                    <a href="${sub.url}" class="sub-link" data-id="${sub.id}">
                        <img src="${sub.icon}" alt="${sub.title}"> ${sub.title}
                    </a>
                `).join('');

                const urlsArrayStr = `['${item.links.map(sub => sub.url).join("','")}']`;

                grid.innerHTML += `
                    <div class="draggable-item card-group" data-id="${item.id}">
                        <div class="group-header" onclick="toggleGroup(this)">
                            <div class="group-title">${item.title}</div>
                            <button class="btn-open-all" title="Open All" onclick="openAll(event, ${urlsArrayStr})">
                                <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                </svg>
                            </button>
                        </div>
                        <div class="group-dropdown">
                            ${subLinksHTML}
                        </div>
                    </div>
                `;
            }
        });

        section.appendChild(grid);
        slider.appendChild(section);
    });

    // Re-bind drag events to the newly created DOM elements
    bindDragEvents();

    // Update global variables for scrolling logic
    totalSlides = workspacesData.length;
}

// Глобальный массив для хранения вычисленных цветов (по умолчанию синий, голубой, розовый)
let dynamicAccents = ['168, 199, 250', '100, 180, 255', '255, 120, 180'];

// --- ВЫЧИСЛЕНИЕ СРЕДНЕГО ЦВЕТА (Canvas 1x1 Hack) ---
function getAverageRGB(src) {
    return new Promise((resolve) => {
        const img = new Image();
        // crossOrigin больше не нужен для локальных файлов через Live Server
        img.src = src;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(img, 0, 0, 1, 1);
            const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

            const adjust = (color) => Math.min(255, color + 40);
            resolve(`${adjust(r)}, ${adjust(g)}, ${adjust(b)}`);
        };

        img.onerror = () => resolve('168, 199, 250');
    });
}

// --- ФЕТЧИНГ АНИМЕ ФОНОВ ---
function fetchAnimeBackgrounds() {
    const bgElements = [
        document.getElementById('bg-1'),
        document.getElementById('bg-2'),
        document.getElementById('bg-3')
    ];

    const myWallpapers = [
        "/wallpapers/wallhaven-o37d1m.png",
        "/wallpapers/wallhaven-rrxz57.jpg",
        "/wallpapers/wallhaven-rd6rdm.png",
        "/wallpapers/wallhaven-y8kjek.jpg",
        "/wallpapers/wallhaven-zy7gew.png",
        "/wallpapers/wallhaven-z8987o.jpg",
        "/wallpapers/wallhaven-85kd91.jpg",
        "/wallpapers/wallhaven-kxx38q.png",
        "/wallpapers/wallhaven-72x61v.jpg",
        "/wallpapers/wallhaven-og5d8m.png",
        "/wallpapers/wallhaven-pkdol3.jpg",
        "/wallpapers/wallhaven-3z7y83.jpg",
    ];

    const pool = [...myWallpapers];
    const selected = [];

    for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        selected.push(pool.splice(randomIndex, 1)[0]);
    }

    bgElements[0].style.backgroundImage = `url('${selected[0]}')`;
    bgElements[1].style.backgroundImage = `url('${selected[1]}')`;
    bgElements[2].style.backgroundImage = `url('${selected[2]}')`;

    Promise.all([
        getAverageRGB(selected[0]),
        getAverageRGB(selected[1]),
        getAverageRGB(selected[2])
    ]).then(colors => {
        dynamicAccents = colors;
        document.body.style.setProperty('--accent-rgb', dynamicAccents[currentSlide]);
    });
}

// Вызываем при загрузке
fetchAnimeBackgrounds();

// --- Дропдауны ---
function toggleGroup(headerElement) {
    if (document.body.classList.contains('edit-mode')) return;
    const group = headerElement.parentElement;
    const isActive = group.classList.contains('active');

    document.querySelectorAll('.card-group').forEach(g => g.classList.remove('active'));
    if (!isActive) group.classList.add('active');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.card-group')) {
        document.querySelectorAll('.card-group').forEach(g => g.classList.remove('active'));
    }
});

function openAll(event, urls) {
    event.stopPropagation();
    if (document.body.classList.contains('edit-mode')) return;
    urls.forEach((url, index) => {
        setTimeout(() => window.open(url, '_blank'), index * 150);
    });
}

// Выход из режима D&D
function exitEditMode() {
    if (editMode) {
        editMode = false;
        document.body.classList.remove('edit-mode');
        document.querySelectorAll('.draggable-item').forEach(i => {
            i.removeAttribute('draggable');
            i.classList.remove('dragging');
        });
    }
}

// --- ТЕМЫ И СКРОЛЛ ---
const themeAccents = ['168, 199, 250', '100, 180, 255', '255, 120, 180'];
const slider = document.getElementById('slider');
const backgrounds = document.querySelectorAll('.bg-layer');
let currentSlide = 0;
const totalSlides = 3;
let isScrolling = false;

window.addEventListener('wheel', (e) => {
    if (isScrolling || document.getElementById('searchOverlay').classList.contains('active')) return;

    document.querySelectorAll('.card-group').forEach(g => g.classList.remove('active'));
    exitEditMode();

    if (e.deltaY > 0) {
        if (currentSlide < totalSlides - 1) { currentSlide++; moveSlider(); }
        else triggerBounce(1);
    } else if (e.deltaY < 0) {
        if (currentSlide > 0) { currentSlide--; moveSlider(); }
        else triggerBounce(-1);
    }
});

function moveSlider() {
    isScrolling = true;
    slider.style.transform = `translateX(-${currentSlide * 100}vw)`;
    backgrounds.forEach((bg, index) => { bg.classList.toggle('active', index === currentSlide); });

    // Убираем классы тем и просто меняем CSS переменную динамически
    document.body.style.setProperty('--accent-rgb', dynamicAccents[currentSlide]);

    setTimeout(() => { isScrolling = false; }, 800);
}

function triggerBounce(direction) {
    isScrolling = true;
    const bounceOffset = direction * 4;
    slider.style.transform = `translateX(calc(-${currentSlide * 100}vw - ${bounceOffset}vw))`;
    setTimeout(() => {
        slider.style.transform = `translateX(-${currentSlide * 100}vw)`;
        setTimeout(() => { isScrolling = false; }, 500);
    }, 300);
}

// --- DRAG AND DROP ---
let editMode = false;
let pressTimer;

const bindDragEvents = () => {
    const items = document.querySelectorAll('.draggable-item');
    items.forEach(item => {
        item.addEventListener('mousedown', startPress);
        item.addEventListener('mouseup', cancelPress);
        item.addEventListener('mouseleave', cancelPress);

        item.addEventListener('click', (e) => { if (editMode) e.preventDefault(); });

        item.addEventListener('dragstart', (e) => {
            if (editMode) {
                item.classList.add('dragging');
                e.dataTransfer.setData('text/plain', '');
            } else {
                e.preventDefault();
            }
        });
        item.addEventListener('dragend', () => item.classList.remove('dragging'));
    });
};

function startPress(e) {
    if (editMode) return;
    pressTimer = setTimeout(() => {
        editMode = true;
        document.body.classList.add('edit-mode');
        document.querySelectorAll('.card-group').forEach(g => g.classList.remove('active'));
        document.querySelectorAll('.draggable-item').forEach(i => i.setAttribute('draggable', 'true'));
    }, 600);
}

function cancelPress() { clearTimeout(pressTimer); }

document.querySelectorAll('.layout-grid').forEach(grid => {
    grid.addEventListener('dragover', e => {
        e.preventDefault();
        if (!editMode) return;
        const afterElement = getDragAfterElement(grid, e.clientX, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (draggable && afterElement == null) {
            grid.appendChild(draggable);
        } else if (draggable) {
            grid.insertBefore(draggable, afterElement);
        }
    });
});

function getDragAfterElement(container, x, y) {
    const draggableElements = [...container.querySelectorAll('.draggable-item:not(.dragging)')];
    return draggableElements.find(child => {
        const box = child.getBoundingClientRect();
        return y <= box.bottom && x <= box.left + box.width / 2;
    });
}

document.addEventListener('click', (e) => {
    if (editMode && !e.target.closest('.draggable-item')) {
        exitEditMode();
    }
});

bindDragEvents();

// --- ПОИСК ---
const searchTrigger = document.getElementById('searchTrigger');
const searchOverlay = document.getElementById('searchOverlay');
const searchInput = document.getElementById('searchInput');

function toggleSearch(show) {
    searchOverlay.classList.toggle('active', show);
    if (show) setTimeout(() => searchInput.focus(), 50);
    else { searchInput.value = ''; searchInput.blur(); }
}

searchTrigger.addEventListener('click', () => toggleSearch(true));
searchOverlay.addEventListener('click', (e) => { if (e.target === searchOverlay) toggleSearch(false); });

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { toggleSearch(false); return; }

    if (!searchOverlay.classList.contains('active') && !editMode && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        toggleSearch(true);
        searchInput.value = e.key;
        e.preventDefault();
    }
});

document.getElementById('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (!q) return;

    // Если запрос начинается на 'c ' -> ищем в ChatGPT Search
    if (q.toLowerCase().startsWith('c ')) {
        window.location.href = `https://chatgpt.com/?q=${encodeURIComponent(q.substring(2))}`;
    } else {
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    }
});

// --- ВРЕМЯ И Ф1 И ПОГОДА ---
setInterval(() => {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}, 1000);

fetch('https://api.jolpi.ca/ergast/f1/current/next.json')
    .then(r => r.json())
    .then(d => {
        const race = d.MRData.RaceTable.Races[0];
        if (race) {
            document.getElementById('f1-name').textContent = race.raceName;
            const raceDate = new Date(`${race.date}T${race.time}`);

            setInterval(() => {
                const diff = raceDate - new Date();
                if (diff > 0) {
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
                    const mins = Math.floor((diff / 1000 / 60) % 60).toString().padStart(2, '0');
                    document.getElementById('f1-countdown').textContent = `In ${days}d ${hours}h ${mins}m`;
                } else {
                    document.getElementById('f1-countdown').textContent = 'Race is LIVE!';
                }
            }, 1000);
        }
    })
    .catch(() => {
        document.getElementById('f1-name').textContent = "API Offline";
        document.getElementById('f1-countdown').textContent = "--";
    });

// --- ПОГОДА ---
async function fetchWeather() {
    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=46.4825&longitude=30.7233&current_weather=true');
        const data = await res.json();
        const current = data.current_weather;

        const code = current.weathercode;
        let condition = "Cloudy";
        let icon = "☁️";

        if (code === 0) { condition = "Clear"; icon = "☀️"; }
        else if (code === 1 || code === 2 || code === 3) { condition = "Cloudy"; icon = "⛅"; }
        else if (code >= 45 && code <= 48) { condition = "Fog"; icon = "🌫️"; }
        else if (code >= 51 && code <= 67 || code >= 80 && code <= 82) { condition = "Rain"; icon = "🌧️"; }
        else if (code >= 71 && code <= 77 || code >= 85 && code <= 86) { condition = "Snow"; icon = "❄️"; }
        else if (code >= 95) { condition = "Storm"; icon = "⛈️"; }

        document.getElementById('weather-value').textContent = `${Math.round(current.temperature)}°C, ${condition} ${icon}`;
    } catch (e) {
        document.getElementById('weather-value').textContent = "Offline";
    }
}
fetchWeather();
setInterval(fetchWeather, 1000 * 60 * 30);