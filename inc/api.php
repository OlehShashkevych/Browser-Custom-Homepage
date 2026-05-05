<?php
// api.php

// 1. НАСТРОЙКА CORS (БЕЗОПАСНОСТЬ ДОМЕНОВ)
// Укажи здесь свой реальный домен (например, 'https://myapp.com')
$allowed_origins = [
    'http://127.0.0.1:5500', // Для тестов на локалке (Live Server)
    'http://localhost:5500', 
    'https://home.shashkevych.com' // <-- ЗАМЕНИ НА СВОЙ ДОМЕН!
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
}

header('Content-Type: application/json');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

// Быстрый ответ на preflight-запросы браузера
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

require_once 'config.php';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false // Защита от сложных SQL инъекций
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed']);
    exit;
}

$request = json_decode(file_get_contents('php://input'), true);
$action = $request['action'] ?? '';

// 2. БЕЗОПАСНОЕ ПОЛУЧЕНИЕ ID И ПРОВЕРКА СРОКА ТОКЕНА
function getUserId($pdo) {
    // Получаем заголовки кросс-серверно (Apache + Nginx)
    $authHeader = '';
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = trim($_SERVER['HTTP_AUTHORIZATION']);
    } elseif (function_exists('apache_request_headers')) {
        $requestHeaders = apache_request_headers();
        $requestHeaders = array_combine(array_map('ucwords', array_keys($requestHeaders)), array_values($requestHeaders));
        if (isset($requestHeaders['Authorization'])) {
            $authHeader = trim($requestHeaders['Authorization']);
        }
    }

    $token = trim(str_replace('Bearer', '', $authHeader));
    if (!$token) return null;

    // Ищем токен И проверяем, что его время жизни больше текущего
    $stmt = $pdo->prepare("SELECT id FROM users WHERE token = ? AND token_expires_at > NOW()");
    $stmt->execute([$token]);
    return $stmt->fetchColumn();
}

// 3. РОУТИНГ И ЛОГИКА
switch ($action) {
    case 'register':
        $username = trim($request['username'] ?? '');
        $password = $request['password'] ?? '';

        // Жесткая валидация для публичного приложения!
        if (!preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username)) {
            echo json_encode(['status' => 'error', 'message' => 'Username must be 3-20 characters long and contain only English letters, numbers, or underscores.']);
            exit;
        }

        if (strlen($password) < 6) {
            echo json_encode(['status' => 'error', 'message' => 'Password must be at least 6 characters long.']);
            exit;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $token = bin2hex(random_bytes(32)); 
        $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days')); // Токен живет 30 дней

        try {
            $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, token, token_expires_at) VALUES (?, ?, ?, ?)");
            $stmt->execute([$username, $hash, $token, $expiresAt]);
            
            $userId = $pdo->lastInsertId();
            
            // Базовый стейт без хардкода, фронтенд сам разберется
            $pdo->prepare("INSERT INTO workspaces (user_id, state_json) VALUES (?, ?)")
                ->execute([$userId, json_encode(['workspaces' => []])]);

            echo json_encode(['status' => 'success', 'token' => $token]);
        } catch (PDOException $e) {
            // Ошибка 23000 в PDO означает нарушение уникальности (duplicate entry)
            if ($e->getCode() == 23000) {
                echo json_encode(['status' => 'error', 'message' => 'This username is already taken.']);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Registration failed due to a server error.']);
            }
        }
        break;

    case 'login':
        $username = trim($request['username'] ?? '');
        $password = $request['password'] ?? '';

        $stmt = $pdo->prepare("SELECT id, password_hash FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password_hash'])) {
            // Генерируем НОВЫЙ токен при каждом входе (для безопасности)
            $newToken = bin2hex(random_bytes(32));
            $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));

            $updateStmt = $pdo->prepare("UPDATE users SET token = ?, token_expires_at = ? WHERE id = ?");
            $updateStmt->execute([$newToken, $expiresAt, $user['id']]);

            echo json_encode(['status' => 'success', 'token' => $newToken]);
        } else {
            // Никогда не говорим, логин неверный или пароль, чтобы не помогать брутфорсерам
            echo json_encode(['status' => 'error', 'message' => 'Invalid username or password.']);
        }
        break;

    case 'get_state':
        $userId = getUserId($pdo);
        if (!$userId) {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Session expired or not authorized. Please log in again.']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT state_json FROM workspaces WHERE user_id = ?");
        $stmt->execute([$userId]);
        $state = $stmt->fetchColumn();

        echo json_encode(['status' => 'success', 'data' => json_decode($state, true)]);
        break;

    case 'save_state':
        $userId = getUserId($pdo);
        if (!$userId) {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Session expired or not authorized. Please log in again.']);
            exit;
        }

        // Ограничиваем размер входящего JSON (защита от переполнения БД)
        $rawJson = json_encode($request['data'] ?? []);
        if (strlen($rawJson) > 5 * 1024 * 1024) { // Максимум 5 Мегабайт
            echo json_encode(['status' => 'error', 'message' => 'Data is too large to save.']);
            exit;
        }

        $stmt = $pdo->prepare("UPDATE workspaces SET state_json = ? WHERE user_id = ?");
        $stmt->execute([$rawJson, $userId]);

        echo json_encode(['status' => 'success']);
        break;

    default:
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Unknown action']);
}