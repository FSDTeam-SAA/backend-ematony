CREATE TABLE roles (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE role_permissions (
  id BIGSERIAL PRIMARY KEY,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, permission_id)
);

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  role_id BIGINT NOT NULL REFERENCES roles(id),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  full_name VARCHAR(200),
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(50) UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  username VARCHAR(100) UNIQUE,
  country VARCHAR(80),
  language VARCHAR(20) NOT NULL DEFAULT 'en',
  referral_code VARCHAR(32) UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'blocked', 'pending_kyc', 'suspended')),
  email_verified_at TIMESTAMP,
  blocked_at TIMESTAMP,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE auth_refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address VARCHAR(64),
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE password_reset_otps (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(190) NOT NULL,
  purpose VARCHAR(30) NOT NULL DEFAULT 'password_reset'
    CHECK (purpose IN ('password_reset', 'email_verification')),
  otp_code VARCHAR(12) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE user_devices (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL
    CHECK (platform IN ('ios', 'android', 'web')),
  device_token TEXT,
  last_seen_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE kyc_applications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(40) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'resubmission_required')),
  current_step VARCHAR(40) NOT NULL DEFAULT 'personal_info'
    CHECK (current_step IN ('personal_info', 'document', 'upload', 'selfie', 'review', 'complete')),
  legal_full_name VARCHAR(200),
  date_of_birth DATE,
  address_line_1 VARCHAR(255),
  address_line_2 VARCHAR(255),
  city VARCHAR(120),
  state_region VARCHAR(120),
  postal_code VARCHAR(30),
  country VARCHAR(80),
  document_type VARCHAR(80),
  document_number VARCHAR(120),
  issuing_country VARCHAR(80),
  stripe_verification_id VARCHAR(255),
  stripe_verification_url TEXT,
  provider_ref VARCHAR(255),
  liveness_result VARCHAR(40),
  rejection_reason TEXT,
  submitted_at TIMESTAMP,
  reviewed_by BIGINT REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE kyc_documents (
  id BIGSERIAL PRIMARY KEY,
  kyc_application_id BIGINT NOT NULL REFERENCES kyc_applications(id) ON DELETE CASCADE,
  document_side VARCHAR(20) NOT NULL
    CHECK (document_side IN ('front', 'back', 'selfie', 'extra')),
  file_url TEXT NOT NULL,
  mime_type VARCHAR(120),
  provider_file_ref VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE savings_groups (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id BIGINT NOT NULL REFERENCES users(id),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  invite_code VARCHAR(32) NOT NULL UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'open', 'active', 'completed', 'closed')),
  contribution_amount NUMERIC(12, 2) NOT NULL,
  currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
  contribution_frequency VARCHAR(20) NOT NULL
    CHECK (contribution_frequency IN ('weekly', 'biweekly', 'monthly')),
  max_members INTEGER NOT NULL,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE group_memberships (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES savings_groups(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_role VARCHAR(20) NOT NULL DEFAULT 'member'
    CHECK (membership_role IN ('owner', 'member')),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'rejected', 'left', 'removed')),
  payout_position INTEGER,
  joined_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE group_join_requests (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES savings_groups(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_code VARCHAR(32),
  note TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by BIGINT REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id, status)
);

CREATE TABLE group_cycles (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES savings_groups(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'active', 'completed')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, cycle_number)
);

CREATE TABLE group_rotations (
  id BIGSERIAL PRIMARY KEY,
  group_cycle_id BIGINT NOT NULL REFERENCES group_cycles(id) ON DELETE CASCADE,
  group_id BIGINT NOT NULL REFERENCES savings_groups(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  position_number INTEGER NOT NULL,
  payout_date DATE,
  payout_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (payout_status IN ('pending', 'paid', 'skipped')),
  paid_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (group_cycle_id, position_number)
);

CREATE TABLE wallets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
  available_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_methods (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(40) NOT NULL,
  method_type VARCHAR(20) NOT NULL
    CHECK (method_type IN ('card', 'bank')),
  token_ref VARCHAR(255) NOT NULL,
  brand VARCHAR(50),
  last4 VARCHAR(4),
  expiry_month INTEGER,
  expiry_year INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  group_id BIGINT REFERENCES savings_groups(id) ON DELETE SET NULL,
  group_cycle_id BIGINT REFERENCES group_cycles(id) ON DELETE SET NULL,
  payment_method_id BIGINT REFERENCES payment_methods(id) ON DELETE SET NULL,
  amount NUMERIC(14, 2) NOT NULL,
  fee_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
  transaction_type VARCHAR(30) NOT NULL
    CHECK (transaction_type IN ('wallet_topup', 'group_contribution', 'payout', 'refund', 'adjustment')),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('initiated', 'pending', 'succeeded', 'failed', 'refunded')),
  provider VARCHAR(40),
  provider_txn_id VARCHAR(255),
  reference_code VARCHAR(64),
  metadata JSONB,
  processed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE wallet_ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  wallet_id BIGINT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_transaction_id BIGINT REFERENCES payment_transactions(id) ON DELETE SET NULL,
  group_id BIGINT REFERENCES savings_groups(id) ON DELETE SET NULL,
  direction VARCHAR(10) NOT NULL
    CHECK (direction IN ('credit', 'debit')),
  entry_type VARCHAR(30) NOT NULL
    CHECK (entry_type IN ('topup', 'contribution', 'payout', 'refund', 'fee', 'adjustment')),
  amount NUMERIC(14, 2) NOT NULL,
  balance_before NUMERIC(14, 2) NOT NULL,
  balance_after NUMERIC(14, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  notification_type VARCHAR(30) NOT NULL DEFAULT 'system'
    CHECK (notification_type IN ('system', 'group', 'payment', 'support')),
  scope VARCHAR(20) NOT NULL DEFAULT 'broadcast'
    CHECK (scope IN ('broadcast', 'user', 'group')),
  related_entity_type VARCHAR(40),
  related_entity_id VARCHAR(80),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_recipients (
  id BIGSERIAL PRIMARY KEY,
  notification_id BIGINT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (notification_id, user_id)
);

CREATE TABLE support_tickets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id BIGINT REFERENCES savings_groups(id) ON DELETE SET NULL,
  category VARCHAR(40) NOT NULL
    CHECK (category IN ('payment_transaction', 'membership_access', 'technical_issue', 'feedback_suggestion', 'other')),
  subject VARCHAR(200),
  message TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_admin_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE support_ticket_messages (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role VARCHAR(20) NOT NULL
    CHECK (sender_role IN ('member', 'admin')),
  message TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE cms_pages (
  id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE app_settings (
  id BIGSERIAL PRIMARY KEY,
  setting_key VARCHAR(120) NOT NULL UNIQUE,
  value_json JSONB NOT NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE activity_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  group_id BIGINT REFERENCES savings_groups(id) ON DELETE SET NULL,
  event_type VARCHAR(60) NOT NULL,
  summary VARCHAR(255) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL,
  target_type VARCHAR(60) NOT NULL,
  target_id VARCHAR(120) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
