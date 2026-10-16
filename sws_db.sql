-- ============================================
-- SWS Database — Production Ready
-- Import via phpMyAdmin (XAMPP)
-- ============================================
DROP DATABASE IF EXISTS sws_db;
CREATE DATABASE sws_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sws_db;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  address VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('resident','admin','superadmin') DEFAULT 'resident',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB;

CREATE TABLE complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ref_no VARCHAR(20) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  issue_type VARCHAR(60) NOT NULL,
  location VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('Pending','In Progress','Resolved') DEFAULT 'Pending',
  handled_by INT DEFAULT NULL,
  admin_remarks TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('Scheduled','Emergency','General') DEFAULT 'General',
  posted_by INT DEFAULT NULL,
  posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (posted_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_posted (posted_at)
) ENGINE=InnoDB;

CREATE TABLE sms_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'Queued',
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(120) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- ==========================================
-- DEFAULT ACCOUNTS
-- Passwords are auto-set to: password123
-- The API auto-fixes 'NEEDS_RESET' on first run.
-- ==========================================
INSERT INTO users (full_name, email, phone, address, password_hash, role) VALUES
('Super Administrator', 'superadmin@sws.com', '09000000001', 'SWS Head Office', 'NEEDS_RESET', 'superadmin'),
('SWS Admin',           'admin@sws.com',      '09000000002', 'SWS Office',      'NEEDS_RESET', 'admin'),
('Rudeus Greyrat',      'rudeus@email.com',   '09123456789', 'Buina, Fittoa',   'NEEDS_RESET', 'resident');

INSERT INTO complaints (ref_no, user_id, issue_type, location, description, status) VALUES
('COM-00001', 3, 'Water Outage',       'Buina',                 'No water supply since morning.', 'In Progress'),
('COM-00002', 3, 'Water Leakage',      'Barangay Buina Proper', 'Leaking pipe near the market.',  'Resolved'),
('COM-00003', 3, 'Low Water Pressure', 'Barangay Roa',          'Weak water flow.',               'Pending');

INSERT INTO announcements (title, message, type, posted_by) VALUES
('Scheduled Water Outage', 'Water interruption on May 22, 2026 from 8AM–2PM.', 'Scheduled', 1),
('Emergency Water Interruption', 'Emergency repair in Buina Proper.',           'Emergency', 1);