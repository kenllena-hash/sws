<?php
require_once __DIR__ . '/config.php';

$user_id = (int)($_GET['user_id'] ?? 0);
$user = requireRole($conn, $user_id, []);
respond(true, 'Session valid.', ['user' => $user]);