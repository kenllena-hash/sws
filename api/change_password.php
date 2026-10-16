<?php
require_once __DIR__ . '/config.php';

$data = body();
$user_id      = (int)($data['user_id'] ?? 0);
$currentPass  = (string)($data['current_password'] ?? '');
$newPass      = (string)($data['new_password'] ?? '');

if ($user_id <= 0) respond(false, 'Not authenticated.');
if (!$currentPass || !$newPass) respond(false, 'All password fields are required.');
if (strlen($newPass) < 6) respond(false, 'New password must be at least 6 characters.');
if ($newPass === $currentPass) respond(false, 'New password must be different.');

$stmt = $conn->prepare("SELECT password_hash FROM users WHERE id=? AND is_active=1");
$stmt->bind_param('i', $user_id);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$row) respond(false, 'User not found.');
if (!password_verify($currentPass, $row['password_hash'])) respond(false, 'Current password is incorrect.');

$newHash = password_hash($newPass, PASSWORD_DEFAULT);
$stmt = $conn->prepare("UPDATE users SET password_hash=? WHERE id=?");
$stmt->bind_param('si', $newHash, $user_id);

if ($stmt->execute()) {
    $stmt->close();
    logActivity($conn, $user_id, 'change_password', 'Password changed');
    respond(true, 'Password changed successfully.');
}
$stmt->close();
respond(false, 'Failed to change password.');