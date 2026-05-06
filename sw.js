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

// Install Service Worker and cache files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
    );
});

// Intercept requests
self.addEventListener('fetch', event => {
    if (event.request.url.includes('api.php')) return;

    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        }).catch(() => {
        })
    );
});