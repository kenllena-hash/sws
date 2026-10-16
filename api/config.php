<?php
// ==========================================
// SWS API Configuration
// PHP 8.2 Compatible
// ==========================================

// Show errors temporarily while debugging
error_reporting(E_ALL);
ini_set('display_errors', '1');
ini_set('log_errors', '1');

// -------- Database --------
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'sws_db');

// -------- SMS --------
define('SMS_API_URL', 'https://api.semaphore.co/api/v4/messages');
define('SMS_API_KEY', 'YOUR_SMS_API_KEY_HERE');
define('SMS_SENDER_NAME', 'SWS');

// -------- Connect --------
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    header('Content-Type: application/json; charset=utf-8');
    die(json_encode(array('success' => false, 'message' => 'DB connection failed.')));
}
$conn->set_charset('utf8mb4');

// -------- Auto-fix placeholder passwords --------
$check = $conn->query("SELECT COUNT(*) AS c FROM users WHERE LENGTH(password_hash) < 60");
if ($check) {
    $row = $check->fetch_assoc();
    if ($row && (int)$row['c'] > 0) {
        $hash = password_hash('password123', PASSWORD_DEFAULT);
        $upd = $conn->prepare("UPDATE users SET password_hash=? WHERE LENGTH(password_hash) < 60");
        if ($upd) {
            $upd->bind_param('s', $hash);
            $upd->execute();
            $upd->close();
        }
    }
}

// -------- Headers --------
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit(0);
}

// -------- Helpers --------
function body() {
    $raw = file_get_contents('php://input');
    $d = json_decode($raw, true);
    return is_array($d) ? $d : $_POST;
}

function respond($ok, $message, $extra = array()) {
    echo json_encode(array_merge(array('success' => $ok, 'message' => $message), $extra));
    exit;
}

function requireRole($conn, $user_id, $roles = array()) {
    $user_id = intval($user_id);
    if ($user_id <= 0) respond(false, 'Not authenticated.');

    $stmt = $conn->prepare("SELECT id, full_name, email, phone, address, role FROM users WHERE id=? AND is_active=1");
    if (!$stmt) respond(false, 'Prepare error: ' . $conn->error);
    $stmt->bind_param('i', $user_id);
    $stmt->execute();
    $u = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$u) respond(false, 'User not found or inactive.');
    if (count($roles) > 0 && !in_array($u['role'], $roles, true)) {
        respond(false, 'Access denied.');
    }
    return $u;
}

function logActivity($conn, $user_id, $action, $details = '') {
    $stmt = $conn->prepare("INSERT INTO activity_log (user_id, action, details) VALUES (?,?,?)");
    if (!$stmt) return;
    $stmt->bind_param('iss', $user_id, $action, $details);
    $stmt->execute();
    $stmt->close();
}

function safeStr($s, $max = 200) {
    return mb_substr(trim((string)$s), 0, $max);
}