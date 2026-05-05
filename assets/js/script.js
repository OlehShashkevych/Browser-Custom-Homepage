// =========================================
// 1. GLOBAL VARIABLES & DOM ELEMENTS
// =========================================
const API_URL = 'inc/api.php';

// Global State
let currentState = null;
let currentSlide = 0;
let totalSlides = 0;
let isScrolling = false;
let editMode = false;
let pressTimer;
let itemToDelete = null; // {wsId, itemId}
let dynamicAccents = ['168, 199, 250', '100, 180, 255', '255, 120, 180'];

const myWallpapers = [
    "/wallpapers/wallhaven-o37d1m.png", "/wallpapers/wallhaven-rrxz57.jpg",
    "/wallpapers/wallhaven-rd6rdm.png", "/wallpapers/wallhaven-y8kjek.jpg",
    "/wallpapers/wallhaven-zy7gew.png", "/wallpapers/wallhaven-z8987o.jpg",
    "/wallpapers/wallhaven-85kd91.jpg", "/wallpapers/wallhaven-kxx38q.png",
    "/wallpapers/wallhaven-72x61v.jpg", "/wallpapers/wallhaven-og5d8m.png",
    "/wallpapers/wallhaven-pkdol3.jpg", "/wallpapers/wallhaven-3z7y83.jpg"
];

const defaultState = {
    settings: {
        showClock: true,
        showWeather: true,
        showF1: true
    },
    workspaces: [
        {
            id: "ws-1",
            title: "Base / Life",
            items: [
                { id: "item-wp", type: "icon", title: "Wikipedia", url: "https://wikipedia.org", icon: "https://icon.horse/icon/wikipedia.org" },
                { id: "item-ff", type: "single", title: "Firefox", url: "https://firefox.com", icon: "https://icon.horse/icon/firefox.com" },
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

// DOM Elements - Auth
const authOverlay = document.getElementById('authOverlay');
const authForm = document.getElementById('authForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const authMessage = document.getElementById('authMessage');
const btnRegister = document.getElementById('btnRegister');

// DOM Elements - Main UI
const slider = document.getElementById('slider');
const btnEditMode = document.getElementById('btnEditMode');

// DOM Elements - Search
const searchTrigger = document.getElementById('searchTrigger');
const searchOverlay = document.getElementById('searchOverlay');
const searchInput = document.getElementById('searchInput');
const searchForm = document.getElementById('searchForm');

// DOM Elements - Item Modal
const itemModal = document.getElementById('itemModal');
const itemForm = document.getElementById('itemForm');
const modalWsId = document.getElementById('modalWsId');
const modalItemId = document.getElementById('modalItemId');
const modalItemType = document.getElementById('modalItemType');
const modalItemTitle = document.getElementById('modalItemTitle');
const modalItemUrl = document.getElementById('modalItemUrl');
const modalTitle = document.getElementById('modalTitle');
const modalUrlGroup = document.getElementById('modalUrlGroup');
const modalLinksGroup = document.getElementById('modalLinksGroup');
const modalSubLinks = document.getElementById('modalSubLinks');
const btnAddSubLink = document.getElementById('btnAddSubLink');
const btnCancelModal = document.getElementById('btnCancelModal');

// DOM Elements - Workspace Modal
const wsModal = document.getElementById('wsModal');
const wsForm = document.getElementById('wsForm');
const modalWsIdEdit = document.getElementById('modalWsIdEdit');
const modalWsTitle = document.getElementById('modalWsTitle');
const wsModalTitle = document.getElementById('wsModalTitle');
const btnDeleteWs = document.getElementById('btnDeleteWs');
const btnAddWorkspace = document.getElementById('btnAddWorkspace');

// DOM Elements - Delete Confirm Modal
const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const btnCancelDelete = document.getElementById('btnCancelDelete');
const btnConfirmDelete = document.getElementById('btnConfirmDelete');


// =========================================
// 2. API & DATA MANAGEMENT
// =========================================
async function apiRequest(action, data = {}) {
    const token = localStorage.getItem('homepage_token');
    const headers = { 'Content-Type': 'application/json' };

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
        location.reload();
    }
};

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
// 3. CORE INITIALIZATION & AUTH LOGIC
// =========================================
MobileDragDrop.polyfill({
    dragImageTranslateOverride: MobileDragDrop.scrollBehaviourDragImageTranslateOverride
});

window.addEventListener('touchmove', function () { }, { passive: false });

async function initApp() {
    const token = localStorage.getItem('homepage_token');
    const authHeading = authOverlay.querySelector('h2');

    if (!token) {
        authOverlay.classList.add('active');
    } else {
        authForm.style.display = 'none';
        authHeading.textContent = 'Loading workspace...';
        await loadAndRenderWorkspace();
    }
}

async function loadAndRenderWorkspace() {
    const data = await DashboardData.load();
    const authHeading = authOverlay.querySelector('h2');

    if (data && data.workspaces && data.workspaces.length > 0) {
        currentState = data;
        authOverlay.classList.remove('active');
    } else {
        currentState = JSON.parse(JSON.stringify(defaultState));

        if (localStorage.getItem('homepage_token')) {
            authOverlay.classList.remove('active');
            await DashboardData.save(currentState);
        } else {
            authOverlay.classList.add('active');
        }
    }

    setTimeout(() => {
        authForm.style.display = 'block';
        authHeading.textContent = 'Workspace';
    }, 500);

    buildWorkspaces(currentState);
    applyWidgetSettings();
}

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


// =========================================
// 4. RENDER ENGINE
// =========================================
function applyWidgetSettings() {
    const s = currentState.settings || { showClock: true, showWeather: true, showF1: true };

    document.querySelector('.time-widget').style.display = s.showClock ? 'flex' : 'none';

    // В info-widget первый элемент - погода, второй - Ф1
    const infoItems = document.querySelectorAll('.info-item');
    if (infoItems[0]) infoItems[0].style.display = s.showWeather ? 'flex' : 'none';
    if (infoItems[1]) infoItems[1].style.display = s.showF1 ? 'flex' : 'none';

    // Пересчитываем отступ шапки после скрытия/показа
    setTimeout(updateWorkspacePadding, 50);
}

function buildWorkspaces(state) {
    slider.innerHTML = '';
    if (!state || !state.workspaces) return;

    totalSlides = state.workspaces.length;
    slider.style.width = `${totalSlides * 100}vw`;

    if (document.querySelectorAll('.bg-layer').length !== totalSlides) {
        fetchAnimeBackgrounds(totalSlides);
    }

    state.workspaces.forEach((ws, index) => {
        const section = document.createElement('section');
        section.className = 'workspace';
        section.dataset.id = ws.id;

        const titleWrapper = document.createElement('div');
        titleWrapper.className = 'workspace-title-wrapper';
        titleWrapper.innerHTML = `
            <button class="ws-move-btn" onclick="moveWorkspace('${ws.id}', -1)" ${index === 0 ? 'disabled' : ''} title="Move Left">◀</button>
            <span class="workspace-title" onclick="if(editMode) openWsModal('${ws.id}')" title="Click to edit">${ws.title}</span>
            <button class="ws-move-btn" onclick="moveWorkspace('${ws.id}', 1)" ${index === state.workspaces.length - 1 ? 'disabled' : ''} title="Move Right">▶</button>
        `;
        section.appendChild(titleWrapper);

        const grid = document.createElement('div');
        grid.className = 'layout-grid';
        grid.id = `grid-${index + 1}`;

        ws.items.forEach(item => {
            const controlsHTML = `
                <div class="card-controls">
                    <button type="button" class="control-btn edit" onclick="openItemModal(event, '${ws.id}', '${item.id}')" title="Edit">✎</button>
                    <button type="button" class="control-btn delete" onclick="deleteItem(event, '${ws.id}', '${item.id}')" title="Delete">✖</button>
                </div>
            `;

            if (item.type === 'icon') {
                grid.innerHTML += `
                    <a href="${item.url}" class="draggable-item card-icon" title="${item.title}" data-id="${item.id}">
                        ${controlsHTML}
                        <img src="${item.icon}" alt="${item.title}">
                    </a>
                `;
            } else if (item.type === 'single') {
                grid.innerHTML += `
                    <a href="${item.url}" class="draggable-item card-single" title="${item.title}" data-id="${item.id}">
                        ${controlsHTML}
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
                        ${controlsHTML}
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

        const addBtn = document.createElement('div');
        addBtn.className = 'card-add';
        addBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
        `;

        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!editMode) return;
            openItemModal(e, ws.id, null);
        });

        grid.appendChild(addBtn);
        section.appendChild(grid);
        slider.appendChild(section);
    });

    bindDragEvents();
    totalSlides = state.workspaces.length;

    if (editMode) {
        document.querySelectorAll('.draggable-item').forEach(i => i.setAttribute('draggable', 'true'));
    }
}


// =========================================
// 5. BACKGROUNDS & THEMES
// =========================================
function getAverageRGB(src) {
    return new Promise((resolve) => {
        const img = new Image();
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

function fetchAnimeBackgrounds(count = 1) {
    document.querySelectorAll('.bg-layer').forEach(b => b.remove());

    const pool = [...myWallpapers];
    const selected = [];
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
        const ws = currentState.workspaces[i];
        let bgUrl = '';

        // Проверяем, есть ли у экрана свои обои
        if (ws && ws.customBg) {
            bgUrl = ws.customBg;
        } else {
            if (pool.length === 0) pool.push(...myWallpapers);
            const randomIndex = Math.floor(Math.random() * pool.length);
            bgUrl = pool.splice(randomIndex, 1)[0];
        }

        selected.push(bgUrl);
        const layer = document.createElement('div');
        layer.className = i === currentSlide ? 'bg-layer active' : 'bg-layer';
        layer.id = `bg-${i + 1}`;
        layer.style.backgroundImage = `url('${bgUrl}')`;

        fragment.appendChild(layer);
    }

    document.body.prepend(fragment);

    Promise.all(selected.map(src => getAverageRGB(src))).then(colors => {
        dynamicAccents = colors;
        document.body.style.setProperty('--accent-rgb', dynamicAccents[currentSlide] || '168, 199, 250');
    });
}

// =========================================
// 6. SLIDER & SCROLL LOGIC
// =========================================
window.addEventListener('wheel', (e) => {
    if (isScrolling ||
        document.getElementById('searchOverlay').classList.contains('active') ||
        document.querySelector('.modal-overlay.active')
    ) return;

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

// --- СВАЙПЫ ДЛЯ МОБИЛЬНЫХ УСТРОЙСТВ (ПРИЛИПАНИЕ К ПАЛЬЦУ) ---
let touchStartX = 0;
let touchStartY = 0;
let isSwiping = false;
let swipeDirectionDetermined = false;

document.addEventListener('touchstart', e => {
    // Блокируем свайп, если открыты модалки, поиск или включен режим редактирования (D&D)
    if (isScrolling ||
        document.getElementById('searchOverlay').classList.contains('active') ||
        document.querySelector('.modal-overlay.active') ||
        document.querySelector('.dragging') ||
        editMode
    ) return;

    touchStartX = e.touches[0].screenX;
    touchStartY = e.touches[0].screenY;
    isSwiping = true;
    swipeDirectionDetermined = false;

    // Добавляем класс, чтобы экран ехал ровно за пальцем без задержек
    slider.classList.add('swiping');
}, { passive: true });

document.addEventListener('touchmove', e => {
    if (!isSwiping) return;

    const touchCurrentX = e.touches[0].screenX;
    const touchCurrentY = e.touches[0].screenY;
    const diffX = touchStartX - touchCurrentX;
    const diffY = touchStartY - touchCurrentY;

    // В первые пиксели движения понимаем: свайпают вбок или скроллят вниз?
    if (!swipeDirectionDetermined) {
        if (Math.abs(diffX) > Math.abs(diffY)) {
            swipeDirectionDetermined = 'horizontal'; // Свайпаем экраны
        } else if (Math.abs(diffY) > Math.abs(diffX)) {
            swipeDirectionDetermined = 'vertical'; // Скроллим карточки
            isSwiping = false;
            slider.classList.remove('swiping');
            slider.style.transform = `translateX(-${currentSlide * 100}vw)`;
            return;
        } else {
            return; // Ждем более явного движения
        }
    }

    // Если движение горизонтальное — тащим экран за пальцем
    if (swipeDirectionDetermined === 'horizontal') {
        const baseTranslate = -(currentSlide * window.innerWidth);
        slider.style.transform = `translateX(calc(${baseTranslate}px - ${diffX}px))`;
    }
}, { passive: true });

document.addEventListener('touchend', e => {
    if (!isSwiping) return;
    isSwiping = false;

    // Возвращаем плавную анимацию для докрутки
    slider.classList.remove('swiping');

    const touchEndX = e.changedTouches[0].screenX;
    const diffX = touchStartX - touchEndX;

    // Если свайпнули больше чем на 70px по горизонтали — переключаем экран
    if (swipeDirectionDetermined === 'horizontal' && Math.abs(diffX) > 70) {
        document.querySelectorAll('.card-group').forEach(g => g.classList.remove('active'));

        if (diffX > 0 && currentSlide < totalSlides - 1) {
            currentSlide++;
        } else if (diffX < 0 && currentSlide > 0) {
            currentSlide--;
        } else {
            // Если пытаются уехать дальше последнего/первого экрана — пружиним
            triggerBounce(diffX > 0 ? 1 : -1);
            return;
        }
    }

    // Либо плавно едем на новый экран, либо возвращаемся на текущий (если свайп был слабым)
    moveSlider();
}, { passive: true });

function moveSlider() {
    isScrolling = true;
    slider.style.transform = `translateX(-${currentSlide * 100}vw)`;

    document.querySelectorAll('.bg-layer').forEach((bg, index) => {
        bg.classList.toggle('active', index === currentSlide);
    });

    document.body.style.setProperty('--accent-rgb', dynamicAccents[currentSlide] || '168, 199, 250');

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


// =========================================
// 7. DRAG AND DROP & EDIT MODE
// =========================================
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
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', 'drag');
            } else {
                e.preventDefault();
            }
        });

        item.addEventListener('dragend', async () => {
            item.classList.remove('dragging');
            if (!editMode) return;

            const grid = item.closest('.layout-grid');
            const section = item.closest('.workspace');
            if (!grid || !section) return;

            const wsId = section.dataset.id;
            const ws = currentState.workspaces.find(w => w.id === wsId);

            const domItems = [...grid.querySelectorAll('.draggable-item[data-id]')];
            const newItemsOrder = [];

            domItems.forEach(domItem => {
                const originalItem = ws.items.find(i => i.id === domItem.dataset.id);
                if (originalItem) newItemsOrder.push(originalItem);
            });

            ws.items = newItemsOrder;
            await DashboardData.save(currentState);
        });
    });

    // ВАЖНО: Добавляем слушатель "броска" (dragover) именно здесь, 
    // так как сетки пересоздаются при каждом рендере воркспейсов!
    document.querySelectorAll('.layout-grid').forEach(grid => {
        grid.addEventListener('dragover', e => {
            e.preventDefault(); // Это обязательно, чтобы разрешить "бросание" элементов
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

function getDragAfterElement(container, x, y) {
    const draggableElements = [...container.querySelectorAll('.draggable-item:not(.dragging)')];

    return draggableElements.find(child => {
        const box = child.getBoundingClientRect();
        const isSameRow = y >= box.top && y <= box.bottom;

        if (isSameRow) {
            return x < box.left + box.width / 2;
        }
        return y < box.top;
    });
}

document.addEventListener('click', (e) => {
    if (editMode &&
        !e.target.closest('.draggable-item') &&
        !e.target.closest('.card-add') &&
        !e.target.closest('.fab-edit') &&
        !e.target.closest('.modal-overlay') &&
        !e.target.closest('.ws-edit-btn') &&
        !e.target.closest('.fab-add-ws') &&
        !e.target.closest('.ws-move-btn') &&
        !e.target.closest('.workspace-title')
    ) {
        exitEditMode();
    }
});

btnEditMode.addEventListener('click', (e) => {
    e.stopPropagation();
    document.body.classList.toggle('edit-mode');
    editMode = document.body.classList.contains('edit-mode');
    document.querySelectorAll('.card-group').forEach(g => g.classList.remove('active'));

    document.querySelectorAll('.draggable-item').forEach(i => {
        if (editMode) {
            i.setAttribute('draggable', 'true');
        } else {
            i.removeAttribute('draggable');
        }
    });

    console.log("Edit mode:", editMode);
});

// Dropdowns functionality
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


// =========================================
// 8. SEARCH LOGIC
// =========================================
function toggleSearch(show) {
    searchOverlay.classList.toggle('active', show);
    if (show) setTimeout(() => searchInput.focus(), 50);
    else { searchInput.value = ''; searchInput.blur(); }
}

searchTrigger.addEventListener('click', () => toggleSearch(true));
searchOverlay.addEventListener('click', (e) => { if (e.target === searchOverlay) toggleSearch(false); });

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { toggleSearch(false); return; }

    const activeElemTag = document.activeElement.tagName;
    if (activeElemTag === 'INPUT' || activeElemTag === 'TEXTAREA' || activeElemTag === 'SELECT') return;
    if (document.querySelector('.auth-overlay.active')) return;
    if (document.querySelector('.modal-overlay.active')) return;

    if (!searchOverlay.classList.contains('active') && !editMode && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        toggleSearch(true);
        searchInput.value = e.key;
        e.preventDefault();
    }
});

searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (!q) return;

    if (q.toLowerCase().startsWith('c ')) {
        window.location.href = `https://chatgpt.com/?q=${encodeURIComponent(q.substring(2))}`;
    } else {
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    }
});


// =========================================
// 9. WIDGETS (CLOCK, F1, WEATHER)
// =========================================
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
        updateWorkspacePadding();
    });

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


// =========================================
// 10. CRUD & MODALS LOGIC
// =========================================

// --- Item Modal Logic ---
modalItemType.addEventListener('change', (e) => {
    if (e.target.value === 'group') {
        modalUrlGroup.style.display = 'none';
        modalItemUrl.removeAttribute('required');
        modalLinksGroup.style.display = 'block';
    } else {
        modalUrlGroup.style.display = 'block';
        modalItemUrl.setAttribute('required', 'true');
        modalLinksGroup.style.display = 'none';
    }
});

btnAddSubLink.addEventListener('click', () => {
    addSubLinkDOM('', '');
});

function addSubLinkDOM(title, url) {
    const div = document.createElement('div');
    div.className = 'sub-link-row';
    div.innerHTML = `
        <div class="sub-link-controls">
            <button type="button" class="btn-move-sub" onclick="moveSubLink(this, -1)" title="Move Up">▲</button>
            <button type="button" class="btn-move-sub" onclick="moveSubLink(this, 1)" title="Move Down">▼</button>
        </div>
        <input type="text" placeholder="Title" value="${title}" class="sub-link-title" required>
        <input type="url" placeholder="URL" value="${url}" class="sub-link-url" required>
        <button type="button" class="btn-danger btn-small" onclick="this.parentElement.remove()">✖</button>
    `;
    modalSubLinks.appendChild(div);
}

window.moveSubLink = function (btn, direction) {
    const row = btn.closest('.sub-link-row');
    const parent = row.parentElement;

    if (direction === -1 && row.previousElementSibling) {
        parent.insertBefore(row, row.previousElementSibling);
    } else if (direction === 1 && row.nextElementSibling) {
        parent.insertBefore(row.nextElementSibling, row);
    }
};

function openItemModal(e, wsId, itemId = null) {
    e.preventDefault();
    e.stopPropagation();

    itemForm.reset();
    modalSubLinks.innerHTML = '';
    modalWsId.value = wsId;
    modalItemId.value = itemId || '';

    if (itemId) {
        modalTitle.textContent = 'Edit Item';
        const ws = currentState.workspaces.find(w => w.id === wsId);
        const item = ws.items.find(i => i.id === itemId);

        modalItemType.value = item.type;
        modalItemTitle.value = item.title;

        if (item.type === 'group') {
            item.links.forEach(link => addSubLinkDOM(link.title, link.url));
        } else {
            modalItemUrl.value = item.url;
        }
    } else {
        modalTitle.textContent = 'Add New Item';
        modalItemType.value = 'single';
    }

    modalItemType.dispatchEvent(new Event('change'));
    itemModal.classList.add('active');
}

btnCancelModal.addEventListener('click', () => {
    itemModal.classList.remove('active');
});

itemForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const wsId = modalWsId.value;
    const itemId = modalItemId.value;
    const ws = currentState.workspaces.find(w => w.id === wsId);
    if (!ws) return;

    const type = modalItemType.value;
    const title = modalItemTitle.value;

    let newItem = { type, title };

    if (type === 'group') {
        const linkRows = modalSubLinks.querySelectorAll('.sub-link-row');
        newItem.links = [];
        linkRows.forEach((row, i) => {
            const t = row.querySelector('.sub-link-title').value;
            const u = row.querySelector('.sub-link-url').value;
            const domain = new URL(u).hostname;
            newItem.links.push({
                id: `sub-${Date.now()}-${i}`,
                title: t,
                url: u,
                icon: `https://icon.horse/icon/${domain}`
            });
        });
    } else {
        const url = modalItemUrl.value;
        const domain = new URL(url).hostname;
        newItem.url = url;
        newItem.icon = `https://icon.horse/icon/${domain}`;
    }

    if (itemId) {
        const index = ws.items.findIndex(i => i.id === itemId);
        if (index > -1) {
            newItem.id = itemId;
            ws.items[index] = newItem;
        }
    } else {
        newItem.id = 'item-' + Date.now();
        ws.items.push(newItem);
    }

    console.log("💾 Отправляем данные в БД:", currentState);
    const result = await DashboardData.save(currentState);

    if (result && result.status === 'success') {
        itemModal.classList.remove('active');
        buildWorkspaces(currentState);
    } else {
        alert("Ошибка сохранения в базу!");
    }
});

// --- Delete Item Confirm Logic ---
async function deleteItem(e, wsId, itemId) {
    e.preventDefault();
    e.stopPropagation();
    itemToDelete = { wsId, itemId };
    deleteConfirmModal.classList.add('active');
}

btnCancelDelete.addEventListener('click', () => {
    deleteConfirmModal.classList.remove('active');
    itemToDelete = null;
});

btnConfirmDelete.addEventListener('click', async () => {
    if (!itemToDelete) return;
    const ws = currentState.workspaces.find(w => w.id === itemToDelete.wsId);
    if (ws) {
        ws.items = ws.items.filter(i => i.id !== itemToDelete.itemId);
        await DashboardData.save(currentState);
        buildWorkspaces(currentState);
    }
    deleteConfirmModal.classList.remove('active');
    itemToDelete = null;
});

// --- Workspace CRUD Logic ---
btnAddWorkspace.addEventListener('click', () => openWsModal(null));

function openWsModal(wsId = null) {
    wsForm.reset();
    modalWsIdEdit.value = wsId || '';

    if (wsId) {
        wsModalTitle.textContent = 'Edit Workspace';
        const ws = currentState.workspaces.find(w => w.id === wsId);
        modalWsTitle.value = ws.title;
        document.getElementById('modalWsCustomBg').value = ws.customBg || '';
        btnDeleteWs.style.display = 'block';
    } else {
        wsModalTitle.textContent = 'Add New Workspace';
        btnDeleteWs.style.display = 'none';
    }
    wsModal.classList.add('active');
}

document.getElementById('btnCancelWs').addEventListener('click', () => wsModal.classList.remove('active'));

wsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const wsId = modalWsIdEdit.value;
    const title = modalWsTitle.value;
    const customBg = document.getElementById('modalWsCustomBg').value.trim();

    if (wsId) {
        const ws = currentState.workspaces.find(w => w.id === wsId);
        if (ws) {
            ws.title = title;
            ws.customBg = customBg; // Обновляем фон
        }
    } else {
        currentState.workspaces.push({
            id: 'ws-' + Date.now(),
            title: title,
            customBg: customBg, // Задаем фон для нового экрана
            items: []
        });
    }

    await DashboardData.save(currentState);
    wsModal.classList.remove('active');

    // НОВОЕ: Принудительно обновляем фоны (раньше они обновлялись только если менялось число экранов)
    fetchAnimeBackgrounds(currentState.workspaces.length);

    buildWorkspaces(currentState);

    if (!wsId) {
        currentSlide = currentState.workspaces.length - 1;
        moveSlider();
    }
});

btnDeleteWs.addEventListener('click', async () => {
    const wsId = modalWsIdEdit.value;
    if (!wsId) return;

    if (!confirm('Delete this entire workspace and ALL its links?')) return;

    currentState.workspaces = currentState.workspaces.filter(w => w.id !== wsId);

    if (currentState.workspaces.length === 0) {
        currentState.workspaces.push({ id: 'ws-base', title: 'Base', items: [] });
    }

    await DashboardData.save(currentState);
    wsModal.classList.remove('active');

    if (currentSlide >= currentState.workspaces.length) {
        currentSlide = currentState.workspaces.length - 1;
    }
    buildWorkspaces(currentState);
    moveSlider();
});

async function moveWorkspace(wsId, direction) {
    if (!editMode) return;

    const index = currentState.workspaces.findIndex(w => w.id === wsId);
    if (index < 0) return;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentState.workspaces.length) return;

    const temp = currentState.workspaces[index];
    currentState.workspaces[index] = currentState.workspaces[newIndex];
    currentState.workspaces[newIndex] = temp;

    await DashboardData.save(currentState);

    currentSlide = newIndex;

    // Перерисовываем интерфейс
    buildWorkspaces(currentState);
    moveSlider();
}

// --- Загрузка локальных обоев (Base64) ---
document.getElementById('btnUploadBg').addEventListener('click', () => {
    document.getElementById('inputUploadBg').click();
});

document.getElementById('inputUploadBg').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Ограничение в ~2.5 Мегабайта, чтобы JSON не стал слишком тяжелым для базы
    if (file.size > 2.5 * 1024 * 1024) {
        alert("File is too large! Please choose an image under 2.5 MB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        // Вставляем длинную Base64 строку прямо в инпут
        document.getElementById('modalWsCustomBg').value = event.target.result;
    };
    reader.readAsDataURL(file);
});

// =========================================
// ДИНАМИЧЕСКАЯ ВЫСОТА ШАПКИ
// =========================================
function updateWorkspacePadding() {
    const header = document.querySelector('.widgets');
    if (header) {
        // Берем высоту шапки + ее отступ сверху
        const headerHeight = header.offsetHeight + header.offsetTop;
        document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
    }
}

// Обновляем при загрузке и при повороте экрана
window.addEventListener('resize', updateWorkspacePadding);
updateWorkspacePadding();
setTimeout(updateWorkspacePadding, 1000); // На всякий случай, если шрифты подгрузятся позже

// =========================================
// НАСТРОЙКИ, БЭКАПЫ И ЛОГАУТ
// =========================================
const settingsModal = document.getElementById('settingsModal');

document.getElementById('btnSettings').addEventListener('click', () => {
    const s = currentState.settings || { showClock: true, showWeather: true, showF1: true };
    document.getElementById('settShowClock').checked = s.showClock;
    document.getElementById('settShowWeather').checked = s.showWeather;
    document.getElementById('settShowF1').checked = s.showF1;
    settingsModal.classList.add('active');
});

document.getElementById('btnCancelSettings').addEventListener('click', () => {
    settingsModal.classList.remove('active');
});

document.getElementById('btnSaveSettings').addEventListener('click', async () => {
    if (!currentState.settings) currentState.settings = {};
    currentState.settings.showClock = document.getElementById('settShowClock').checked;
    currentState.settings.showWeather = document.getElementById('settShowWeather').checked;
    currentState.settings.showF1 = document.getElementById('settShowF1').checked;

    applyWidgetSettings();
    await DashboardData.save(currentState);
    settingsModal.classList.remove('active');
});

// Экспорт JSON
document.getElementById('btnExportJson').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentState, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "workspace_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});

// Импорт JSON
document.getElementById('btnImportJsonTrigger').addEventListener('click', () => document.getElementById('inputImportJson').click());
document.getElementById('inputImportJson').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const importedState = JSON.parse(event.target.result);
            if (importedState.workspaces) {
                currentState = importedState;
                await DashboardData.save(currentState);
                location.reload();
            }
        } catch (err) { alert("Invalid JSON file. Please upload a valid backup."); }
    };
    reader.readAsText(file);
});

// Кнопка логаута
document.getElementById('btnLogout').addEventListener('click', () => {
    Auth.logout();
});

// INITIALIZE APP
initApp();
fetchAnimeBackgrounds();