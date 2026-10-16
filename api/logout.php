<?php
require_once __DIR__ . '/config.php';

$data = body();
$user_id = (int)($data['user_id'] ?? $_GET['user_id'] ?? 0);

if ($user_id > 0) logActivity($conn, $user_id, 'logout', 'User logged out');
respond(true, 'Logged out.');