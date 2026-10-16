<?php
require_once __DIR__ . '/config.php';

$data    = body();
$number  = safeStr($data['number']  ?? '', 20);
$message = safeStr($data['message'] ?? '', 1000);

if (!$number || !$message) respond(false, 'Number and message required.');

$stmt = $conn->prepare("INSERT INTO sms_log (phone, message, status) VALUES (?, ?, 'Simulated')");
$stmt->bind_param('ss', $number, $message);
$stmt->execute();
$stmt->close();

respond(true, 'SMS queued (simulated).', ['phone' => $number]);