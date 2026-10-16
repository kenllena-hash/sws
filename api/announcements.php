<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $res = $conn->query(
        "SELECT a.id, a.title, a.message, a.type, a.posted_at,
                u.full_name AS posted_by_name
         FROM announcements a
         LEFT JOIN users u ON a.posted_by = u.id
         ORDER BY a.posted_at DESC"
    );
    respond(true, 'OK', ['announcements' => $res->fetch_all(MYSQLI_ASSOC)]);
}

if ($method === 'POST') {
    $data = body();

    if (($data['action'] ?? '') === 'delete') {
        $user_id = (int)($data['user_id'] ?? 0);
        requireRole($conn, $user_id, ['admin', 'superadmin']);
        $id = (int)($data['id'] ?? 0);
        if (!$id) respond(false, 'Invalid announcement.');

        $stmt = $conn->prepare("DELETE FROM announcements WHERE id=?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
        logActivity($conn, $user_id, 'delete_announcement', "Announcement #$id");
        respond(true, 'Announcement deleted.');
    }

    $user_id = (int)($data['user_id'] ?? 0);
    requireRole($conn, $user_id, ['admin', 'superadmin']);

    $title   = safeStr($data['title'] ?? '', 150);
    $message = safeStr($data['message'] ?? '', 2000);
    $type    = $data['type'] ?? 'General';

    if (!$title || !$message) respond(false, 'Title and message required.');
    if (!in_array($type, ['General', 'Scheduled', 'Emergency'], true)) $type = 'General';

    $stmt = $conn->prepare("INSERT INTO announcements (title,message,type,posted_by) VALUES (?,?,?,?)");
    $stmt->bind_param('sssi', $title, $message, $type, $user_id);
    $stmt->execute();
    $ann_id = (int)$stmt->insert_id;
    $stmt->close();

    $sent = 0;
    $residents = $conn->query("SELECT phone FROM users WHERE role='resident' AND is_active=1");
    if ($residents) {
        $smsText = "$title — $message";
        while ($r = $residents->fetch_assoc()) {
            if (sendSMS($conn, $r['phone'], $smsText)) $sent++;
        }
    }

    logActivity($conn, $user_id, 'post_announcement', "ID#$ann_id: $title");
    respond(true, 'Announcement posted.', ['sms_sent' => $sent, 'id' => $ann_id]);
}

respond(false, 'Unsupported method.');

function sendSMS(mysqli $conn, string $number, string $message): bool {
    if (SMS_API_KEY === 'YOUR_SMS_API_KEY_HERE') {
        $stmt = $conn->prepare("INSERT INTO sms_log (phone,message,status) VALUES (?,?,'Simulated')");
        $stmt->bind_param('ss', $number, $message);
        $stmt->execute();
        $stmt->close();
        return true;
    }
    $payload = http_build_query([
        'apikey' => SMS_API_KEY, 'number' => $number,
        'message' => $message, 'sendername' => SMS_SENDER_NAME,
    ]);
    $ch = curl_init(SMS_API_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15,
    ]);
    $resp = curl_exec($ch);
    $ok = ($resp !== false);
    curl_close($ch);
    $status = $ok ? 'Sent' : 'Failed';
    $stmt = $conn->prepare("INSERT INTO sms_log (phone,message,status) VALUES (?,?,?)");
    $stmt->bind_param('sss', $number, $message, $status);
    $stmt->execute();
    $stmt->close();
    return $ok;
}