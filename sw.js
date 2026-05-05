const CACHE_NAME = 'workspace-cache-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './assets/css/normalize.css',
    './assets/css/style.css',
    './assets/css/drag-drop.css',
    './assets/js/script.js',
    './assets/js/drag-drop.js',
    './assets/js/scroll-behaviour.js',
];

// Установка Service Worker и кэширование файлов
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
    );
});

// Перехват запросов (если нет сети — отдаем из кэша)
self.addEventListener('fetch', event => {
    // API запросы не кэшируем, их обрабатывает сам script.js
    if (event.request.url.includes('api.php')) return;

    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        }).catch(() => {
            // Если совсем нет сети и файла нет в кэше — молчим
        })
    );
});