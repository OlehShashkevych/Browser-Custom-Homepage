<?php
// api.php

// 1. CORS SETTINGS
$allowed_origins = [
    'http://127.0.0.1:5500',
    'http://localhost:5500', 
    'https://home.shashkevych.com'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
}

header('Content-Type: application/json');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');


if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

require_once 'config.php';

// 2. DATABASE CONNECTION
try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false 
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed']);
    exit;
}

// 3. HELPER FUNCTIONS

/**
 * Universal way to extract token from headers
 */
function getBearerToken() {
    $headers = '';
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER['HTTP_AUTHORIZATION']);
    } elseif (isset($_SERVER['Authorization'])) {
        $headers = trim($_SERVER['Authorization']);
    } elseif (function_exists('apache_request_headers')) {
        $requestHeaders = apache_request_headers();
        $requestHeaders = array_combine(array_map('ucwords', array_keys($requestHeaders)), array_values($requestHeaders));
        if (isset($requestHeaders['Authorization'])) {
            $headers = trim($requestHeaders['Authorization']);
        }
    }
    
    if (!empty($headers)) {
        if (preg_match('/Bearer\s(\S+)/i', $headers, $matches)) {
            return $matches[1];
        }
    }
    return null;
}

/**
 * Get user ID by token from sessions table
 */
function getUserId($pdo) {
    $token = getBearerToken();
    if (!$token) return null;

    $stmt = $pdo->prepare("SELECT user_id FROM user_sessions WHERE token = ? AND expires_at > NOW()");
    $stmt->execute([$token]);
    return $stmt->fetchColumn();
}

// 4. REQUEST HANDLING
$request = json_decode(file_get_contents('php://input'), true);
$action = $request['action'] ?? '';

switch ($action) {
    case 'register':
        $username = trim($request['username'] ?? '');
        $password = $request['password'] ?? '';

        if (!preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username)) {
            echo json_encode(['status' => 'error', 'message' => 'Username must be 3-20 characters long.']);
            exit;
        }

        if (strlen($password) < 6) {
            echo json_encode(['status' => 'error', 'message' => 'Password must be at least 6 characters long.']);
            exit;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $token = bin2hex(random_bytes(32)); 
        $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days')); 

        try {
            $stmt = $pdo->prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
            $stmt->execute([$username, $hash]);
            $userId = $pdo->lastInsertId();
            
            $pdo->prepare("INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)")
                ->execute([$userId, $token, $expiresAt]);

            $pdo->prepare("INSERT INTO workspaces (user_id, state_json) VALUES (?, ?)")
                ->execute([$userId, json_encode(['workspaces' => []])]);

            echo json_encode(['status' => 'success', 'token' => $token]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) {
                echo json_encode(['status' => 'error', 'message' => 'This username is already taken.']);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Registration failed.']);
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
            $newToken = bin2hex(random_bytes(32));
            $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));

            $stmt = $pdo->prepare("INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)");
            $stmt->execute([$user['id'], $newToken, $expiresAt]);

            echo json_encode(['status' => 'success', 'token' => $newToken]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Invalid username or password.']);
        }
        break;

    case 'logout':
        $token = getBearerToken();
        if ($token) {
            $stmt = $pdo->prepare("DELETE FROM user_sessions WHERE token = ?");
            $stmt->execute([$token]);
            echo json_encode(['status' => 'success', 'message' => 'Session terminated']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'No active session found']);
        }
        break;

    case 'get_state':
        $userId = getUserId($pdo);
        if (!$userId) {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Session expired.']);
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
            echo json_encode(['status' => 'error', 'message' => 'Session expired.']);
            exit;
        }

        $rawJson = json_encode($request['data'] ?? []);
        if (strlen($rawJson) > 5 * 1024 * 1024) { 
            echo json_encode(['status' => 'error', 'message' => 'Data is too large.']);
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