<?php
require_once __DIR__ . '/config.php';

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

// ============================================
// GET — list complaints
// ============================================
if ($method === 'GET') {
    $user_id = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;
    $role    = isset($_GET['role']) ? $_GET['role'] : 'resident';

    if ($role === 'admin' || $role === 'superadmin') {
        requireRole($conn, $user_id, array('admin', 'superadmin'));
        $sql = "SELECT c.id, c.ref_no, c.issue_type, c.location, c.description,
                       c.status, c.admin_remarks, c.created_at, c.updated_at,
                       u.full_name AS resident_name, u.phone AS resident_phone
                FROM complaints c
                JOIN users u ON c.user_id = u.id
                ORDER BY c.created_at DESC";
        $res = $conn->query($sql);
        $rows = array();
        if ($res) {
            while ($r = $res->fetch_assoc()) $rows[] = $r;
        }
        respond(true, 'OK', array('complaints' => $rows));
    }

    $stmt = $conn->prepare("SELECT id, ref_no, issue_type, location, description, status, admin_remarks, created_at, updated_at FROM complaints WHERE user_id=? ORDER BY created_at DESC");
    if (!$stmt) respond(false, 'Prepare error: ' . $conn->error);
    $stmt->bind_param('i', $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $rows = array();
    while ($r = $result->fetch_assoc()) $rows[] = $r;
    $stmt->close();
    respond(true, 'OK', array('complaints' => $rows));
}

// ============================================
// POST — create or update
// ============================================
if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) $data = $_POST;

    $action = isset($data['action']) ? $data['action'] : 'create';

    // -------- Update status (admin only) --------
    if ($action === 'update_status') {
        $admin_id = intval($data['user_id']);
        requireRole($conn, $admin_id, array('admin', 'superadmin'));

        $cid     = intval($data['complaint_id']);
        $status  = isset($data['status']) ? $data['status'] : '';
        $remarks = isset($data['remarks']) ? $data['remarks'] : '';

        if ($status !== 'Pending' && $status !== 'In Progress' && $status !== 'Resolved') {
            respond(false, 'Invalid status.');
        }

        $stmt = $conn->prepare("UPDATE complaints SET status=?, admin_remarks=?, handled_by=? WHERE id=?");
        if (!$stmt) respond(false, 'Prepare error: ' . $conn->error);
        $stmt->bind_param('ssii', $status, $remarks, $admin_id, $cid);
        if (!$stmt->execute()) {
            $err = $stmt->error;
            $stmt->close();
            respond(false, 'Update failed: ' . $err);
        }
        $stmt->close();
        logActivity($conn, $admin_id, 'update_complaint', "Complaint #$cid set to $status");
        respond(true, 'Complaint updated.');
    }

    // -------- Create new complaint (resident) --------
    $user_id     = isset($data['user_id'])     ? intval($data['user_id'])            : 0;
    $issue_type  = isset($data['issue_type'])  ? trim((string)$data['issue_type'])   : '';
    $location    = isset($data['location'])    ? trim((string)$data['location'])     : '';
    $description = isset($data['description']) ? trim((string)$data['description'])  : '';

    if ($user_id <= 0) respond(false, 'Missing user ID.');
    if ($issue_type === '') respond(false, 'Please select an issue type.');
    if ($location === '') respond(false, 'Please enter a location.');
    if ($description === '') respond(false, 'Please enter a description.');

    // Verify user exists
    $chk = $conn->prepare("SELECT id FROM users WHERE id=? AND is_active=1");
    if (!$chk) respond(false, 'Prepare error: ' . $conn->error);
    $chk->bind_param('i', $user_id);
    $chk->execute();
    $found = $chk->get_result()->fetch_assoc();
    $chk->close();
    if (!$found) respond(false, 'User not found.');

    // Generate unique reference number
    $ref_no = '';
    for ($i = 0; $i < 10; $i++) {
        $candidate = 'COM-' . str_pad((string)mt_rand(1, 999999), 6, '0', STR_PAD_LEFT);
        $c = $conn->prepare("SELECT id FROM complaints WHERE ref_no=?");
        if (!$c) break;
        $c->bind_param('s', $candidate);
        $c->execute();
        $exists = $c->get_result()->fetch_assoc();
        $c->close();
        if (!$exists) { $ref_no = $candidate; break; }
    }
    if ($ref_no === '') respond(false, 'Could not generate reference number.');

    // Insert complaint
    // bind_param types:  s = string (ref_no),  i = integer (user_id),  s = string (issue_type),  s = string (location),  s = string (description)
    $stmt = $conn->prepare("INSERT INTO complaints (ref_no, user_id, issue_type, location, description) VALUES (?, ?, ?, ?, ?)");
    if (!$stmt) respond(false, 'Prepare error: ' . $conn->error);

    $stmt->bind_param('sisss', $ref_no, $user_id, $issue_type, $location, $description);

    if (!$stmt->execute()) {
        $err = $stmt->error;
        $stmt->close();
        respond(false, 'Insert failed: ' . $err);
    }
    $stmt->close();

    logActivity($conn, $user_id, 'submit_complaint', $ref_no);
    respond(true, 'Complaint submitted successfully! Reference: ' . $ref_no, array('ref_no' => $ref_no));
}

respond(false, 'Unsupported method.');