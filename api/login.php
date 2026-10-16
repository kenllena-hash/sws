<?php
require_once __DIR__ . '/config.php';

$data = body();
$email    = strtolower(safeStr($data['email'] ?? '', 120));
$password = (string)($data['password'] ?? '');

if (!$email || !$password) respond(false, 'Please enter email and password.');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) respond(false, 'Invalid email format.');

$stmt = $conn->prepare("SELECT id, full_name, email, phone, address, role, is_active, password_hash FROM users WHERE email=? LIMIT 1");
$stmt->bind_param('s', $email);
$stmt->execute();
$res = $stmt->get_result();

if ($res->num_rows === 0) { $stmt->close(); respond(false, 'Account not found.'); }

$user = $res->fetch_assoc();
$stmt->close();

if (!$user['is_active']) respond(false, 'Account is deactivated. Contact administrator.');
if (!password_verify($password, $user['password_hash'])) respond(false, 'Incorrect password.');

unset($user['password_hash']);
logActivity($conn, (int)$user['id'], 'login', 'User logged in');
respond(true, 'Login successful.', ['user' => $user]);