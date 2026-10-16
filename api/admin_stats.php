<?php
require_once __DIR__ . '/config.php';

$user_id = (int)($_GET['user_id'] ?? 0);
requireRole($conn, $user_id, ['admin', 'superadmin']);

$q = function(string $sql) use ($conn): int {
    $r = $conn->query($sql);
    return $r ? (int)$r->fetch_assoc()['c'] : 0;
};

$stats = [
    'residents'        => $q("SELECT COUNT(*) c FROM users WHERE role='resident'"),
    'admins'           => $q("SELECT COUNT(*) c FROM users WHERE role='admin'"),
    'superadmins'      => $q("SELECT COUNT(*) c FROM users WHERE role='superadmin'"),
    'total_complaints' => $q("SELECT COUNT(*) c FROM complaints"),
    'pending'          => $q("SELECT COUNT(*) c FROM complaints WHERE status='Pending'"),
    'progress'         => $q("SELECT COUNT(*) c FROM complaints WHERE status='In Progress'"),
    'resolved'         => $q("SELECT COUNT(*) c FROM complaints WHERE status='Resolved'"),
    'announcements'    => $q("SELECT COUNT(*) c FROM announcements"),
    'sms_sent'         => $q("SELECT COUNT(*) c FROM sms_log WHERE status IN ('Sent','Simulated')"),
];

respond(true, 'OK', ['stats' => $stats]);