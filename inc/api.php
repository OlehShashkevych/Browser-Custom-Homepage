<?php
// api.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'config.php';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'Error connecting to the database']);
    exit;
}

// Читаем JSON, который пришлет наш JS
$request = json_decode(file_get_contents('php://input'), true);
$action = $request['action'] ?? '';

// Вспомогательная функция: достает ID юзера по токену из заголовков
function getUserId($pdo) {
    $headers = apache_request_headers();
    $authHeader = $headers['Authorization'] ?? '';
    $token = trim(str_replace('Bearer', '', $authHeader));

    if (!$token) return null;

    $stmt = $pdo->prepare("SELECT id FROM users WHERE token = ?");
    $stmt->execute([$token]);
    return $stmt->fetchColumn();
}

// Простой роутинг
switch ($action) {
    case 'register':
        $username = trim($request['username'] ?? '');
        $password = $request['password'] ?? '';

        if (strlen($username) < 3 || strlen($password) < 6) {
            echo json_encode(['status' => 'error', 'message' => 'Login must be at least 3 characters, password must be at least 6 characters']);
            exit;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $token = bin2hex(random_bytes(32)); // Generate a reliable token

        try {
            $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, token) VALUES (?, ?, ?)");
            $stmt->execute([$username, $hash, $token]);
            
            // Create empty state for new user
            $userId = $pdo->lastInsertId();
            $pdo->prepare("INSERT INTO workspaces (user_id, state_json) VALUES (?, ?)")
                ->execute([$userId, json_encode(['workspaces' => []])]);

            echo json_encode(['status' => 'success', 'token' => $token]);
        } catch (PDOException $e) {
            echo json_encode(['status' => 'error', 'message' => 'User already exists']);
        }
        break;

    case 'login':
        $username = trim($request['username'] ?? '');
        $password = $request['password'] ?? '';

        $stmt = $pdo->prepare("SELECT id, password_hash, token FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password_hash'])) {
            echo json_encode(['status' => 'success', 'token' => $user['token']]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Invalid username or password']);
        }
        break;

    case 'get_state':
        $userId = getUserId($pdo);
        if (!$userId) {
            echo json_encode(['status' => 'error', 'message' => 'Not authorized']);
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
            echo json_encode(['status' => 'error', 'message' => 'Not authorized']);
            exit;
        }

        $state = json_encode($request['data'] ?? []);
        $stmt = $pdo->prepare("UPDATE workspaces SET state_json = ? WHERE user_id = ?");
        $stmt->execute([$state, $userId]);

        echo json_encode(['status' => 'success']);
        break;

    default:
        echo json_encode(['status' => 'error', 'message' => 'Unknown action']);
}