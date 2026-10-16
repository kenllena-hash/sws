<?php
require_once __DIR__ . '/config.php';

$data = body();
$actor_id = (int)($data['user_id'] ?? $_GET['user_id'] ?? 0);

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    requireRole($conn, $actor_id, ['admin', 'superadmin']);
    $res = $conn->query(
        "SELECT id, full_name, email, phone, address, role, is_active, created_at
         FROM users ORDER BY FIELD(role,'superadmin','admin','resident'), created_at DESC"
    );
    respond(true, 'OK', ['users' => $res->fetch_all(MYSQLI_ASSOC)]);
}

$action = $data['action'] ?? '';
requireRole($conn, $actor_id, ['superadmin']);

if ($action === 'create') {
    $name  = safeStr($data['full_name'] ?? '', 100);
    $email = strtolower(safeStr($data['email'] ?? '', 120));
    $phone = safeStr($data['phone'] ?? '', 20);
    $addr  = safeStr($data['address'] ?? '', 150);
    $pass  = (string)($data['password'] ?? '');
    $role  = $data['role'] ?? 'resident';

    if (!$name || !$email || !$phone || !$addr || !$pass) respond(false, 'All fields required.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) respond(false, 'Invalid email.');
    if (!preg_match('/^09\d{9}$/', $phone)) respond(false, 'Phone must be 09XXXXXXXXX.');
    if (strlen($pass) < 6) respond(false, 'Password must be at least 6 characters.');
    if (!in_array($role, ['admin', 'superadmin', 'resident'], true)) respond(false, 'Invalid role.');

    $chk = $conn->prepare("SELECT id FROM users WHERE email=?");
    $chk->bind_param('s', $email);
    $chk->execute();
    if ($chk->get_result()->num_rows > 0) { $chk->close(); respond(false, 'Email already exists.'); }
    $chk->close();

    $hash = password_hash($pass, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("INSERT INTO users (full_name,email,phone,address,password_hash,role) VALUES (?,?,?,?,?,?)");
    $stmt->bind_param('ssssss', $name, $email, $phone, $addr, $hash, $role);
    if ($stmt->execute()) {
        $newId = (int)$stmt->insert_id;
        $stmt->close();
        logActivity($conn, $actor_id, 'create_user', "$email as $role");
        respond(true, 'User created successfully.', ['user_id' => $newId]);
    }
    $stmt->close();
    respond(false, 'Create failed.');
}

if ($action === 'update_role') {
    $uid  = (int)($data['target_id'] ?? 0);
    $role = $data['role'] ?? '';
    if (!in_array($role, ['admin', 'superadmin', 'resident'], true)) respond(false, 'Invalid role.');
    if ($uid === $actor_id) respond(false, 'You cannot change your own role.');
    if (!$uid) respond(false, 'Invalid user.');

    $stmt = $conn->prepare("UPDATE users SET role=? WHERE id=?");
    $stmt->bind_param('si', $role, $uid);
    $stmt->execute();
    $stmt->close();
    logActivity($conn, $actor_id, 'update_role', "User #$uid → $role");
    respond(true, 'Role updated.');
}

if ($action === 'toggle_active') {
    $uid = (int)($data['target_id'] ?? 0);
    if ($uid === $actor_id) respond(false, 'You cannot deactivate yourself.');
    if (!$uid) respond(false, 'Invalid user.');
    $stmt = $conn->prepare("UPDATE users SET is_active = 1 - is_active WHERE id=?");
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $stmt->close();
    logActivity($conn, $actor_id, 'toggle_active', "User #$uid");
    respond(true, 'Status toggled.');
}

if ($action === 'delete') {
    $uid = (int)($data['target_id'] ?? 0);
    if ($uid === $actor_id) respond(false, 'You cannot delete yourself.');
    if (!$uid) respond(false, 'Invalid user.');
    $stmt = $conn->prepare("DELETE FROM users WHERE id=?");
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $stmt->close();
    logActivity($conn, $actor_id, 'delete_user', "User #$uid");
    respond(true, 'User deleted.');
}

respond(false, 'Unknown action.');