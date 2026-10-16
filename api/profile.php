<?php
require_once __DIR__ . '/config.php';

$data = body();
$action = $data['action'] ?? $_GET['action'] ?? 'get';

if ($action === 'get') {
    $user_id = (int)($data['user_id'] ?? $_GET['user_id'] ?? 0);
    if ($user_id <= 0) respond(false, 'User ID required.');

    $stmt = $conn->prepare("SELECT id, full_name, email, phone, address, role, is_active, created_at FROM users WHERE id=? LIMIT 1");
    $stmt->bind_param('i', $user_id);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$user) respond(false, 'User not found.');
    respond(true, 'OK', ['user' => $user]);
}

if ($action === 'update') {
    $user_id = (int)($data['user_id'] ?? 0);
    if ($user_id <= 0) respond(false, 'Not authenticated.');

    $name    = safeStr($data['full_name'] ?? '', 100);
    $phone   = safeStr($data['phone'] ?? '', 20);
    $address = safeStr($data['address'] ?? '', 150);

    if (!$name || !$phone || !$address) respond(false, 'Name, phone, and address are required.');
    if (!preg_match('/^09\d{9}$/', $phone)) respond(false, 'Phone must be in format 09XXXXXXXXX.');
    if (mb_strlen($name) < 2) respond(false, 'Name is too short.');

    $stmt = $conn->prepare("UPDATE users SET full_name=?, phone=?, address=? WHERE id=?");
    $stmt->bind_param('sssi', $name, $phone, $address, $user_id);

    if ($stmt->execute()) {
        $stmt->close();
        logActivity($conn, $user_id, 'update_profile', 'Profile updated');

        $stmt2 = $conn->prepare("SELECT id, full_name, email, phone, address, role FROM users WHERE id=?");
        $stmt2->bind_param('i', $user_id);
        $stmt2->execute();
        $user = $stmt2->get_result()->fetch_assoc();
        $stmt2->close();

        respond(true, 'Profile updated successfully.', ['user' => $user]);
    }
    $stmt->close();
    respond(false, 'Update failed.');
}

respond(false, 'Unknown action.');