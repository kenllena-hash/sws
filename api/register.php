<?php
require_once __DIR__ . '/config.php';

$data = body();
$name     = safeStr($data['full_name'] ?? '', 100);
$email    = strtolower(safeStr($data['email'] ?? '', 120));
$phone    = safeStr($data['phone'] ?? '', 20);
$address  = safeStr($data['address'] ?? '', 150);
$password = (string)($data['password'] ?? '');

if (!$name || !$email || !$phone || !$address || !$password) respond(false, 'Please complete all fields.');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) respond(false, 'Invalid email address.');
if (!preg_match('/^09\d{9}$/', $phone)) respond(false, 'Phone must be in format 09XXXXXXXXX.');
if (strlen($password) < 6) respond(false, 'Password must be at least 6 characters.');
if (mb_strlen($name) < 2) respond(false, 'Full name is too short.');

$chk = $conn->prepare("SELECT id FROM users WHERE email=?");
$chk->bind_param('s', $email);
$chk->execute();
$chk->store_result();
if ($chk->num_rows > 0) { $chk->close(); respond(false, 'Email already registered.'); }
$chk->close();

$hash = password_hash($password, PASSWORD_DEFAULT);
$role = 'resident';

$stmt = $conn->prepare("INSERT INTO users (full_name,email,phone,address,password_hash,role) VALUES (?,?,?,?,?,?)");
$stmt->bind_param('ssssss', $name, $email, $phone, $address, $hash, $role);

if ($stmt->execute()) {
    $newId = (int)$stmt->insert_id;
    $stmt->close();
    logActivity($conn, $newId, 'register', "New resident: $email");
    respond(true, 'Account created successfully. You can now log in.', ['user_id' => $newId]);
}
$stmt->close();
respond(false, 'Registration failed. Please try again.');