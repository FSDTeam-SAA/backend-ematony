# Ematony Backend Plan

## 1. Scope and source

- Source of truth: Figma file `Ematony - Client File`
- Date analyzed: `2026-04-30`
- Figma was readable long enough to extract the screen inventory. A later rate limit blocked deeper inspection, so some field-level details below are marked as inferred.
- Current codebase note: the existing backend uses `Express + Mongoose`, but this plan uses `PostgreSQL` because the request explicitly asked for an SQL schema. The module boundaries still map cleanly to the current Node.js backend.

## 2. Figma analysis

### 2.1 Screens directly visible in the Figma file

#### Client app

- Splash
- Onboarding 1
- Onboarding 2
- Onboarding 3
- Sign In
- Sign Up
- Forgot Password
- Code
- New Password
- Identity Verification
- Personal Information
- Verification Document
- Upload Your ID
- Upload Front Side
- Face Verification
- Home
- Notifications
- Groups
- Requests
- Enter Code
- Create a New Savings Group
- Group Created Successfully
- Group Details
- Contact Admin
- Wheel
- Congratulations
- Wallet
- Transactions History
- Profile
- Personal Info
- Password & Security
- Payments Methods
- Privacy Policy
- Terms & Condition

#### Admin app

- Login
- Forget Password
- OTP
- Reset Password
- Dashboard Overview
- User Managemant
- Group Managemant
- Issues Managemant
- Transaction Managemant
- Settings
- Client Details

### 2.2 Roles visible or implied by the UI

- `guest`
  Unauthenticated visitor using onboarding, sign up, sign in, forgot password.
- `member`
  Regular client app user using KYC, groups, wallet, transactions, notifications, support, and profile.
- `group_owner`
  Inferred from `Create a New Savings Group`, `Group Details`, `Requests`, and `Wheel`. This is not a platform-wide role; it should be stored as a group-level membership role.
- `admin`
  Platform operator using dashboard, user management, group management, issue management, transaction management, notifications, KYC review, and settings.

### 2.3 Features visible in the UI

#### Authentication

- Sign up
- Sign in
- Forgot password
- OTP / code verification
- New password / reset password
- Logout

#### Identity and compliance

- KYC start
- Personal info collection
- Document type selection
- ID upload
- Front-side upload
- Face verification / selfie / liveness state
- Admin KYC review

#### Group savings flow

- Create a new savings group
- Enter group code to join
- Request-based group admission
- Group details
- Wheel / rotation order
- Group success / congratulations states

#### Money flow

- Wallet view
- Payment methods
- Transaction history
- Group contribution payments
- Admin transaction oversight

#### Communication and support

- Notifications list
- Admin-sent notifications
- Contact admin form
- Issue management in admin

#### Account and static content

- Profile
- Personal info
- Password and security
- Privacy policy
- Terms and conditions
- Admin settings

### 2.4 Data inputs visible in the design

#### Directly visible

- Sign in: email, password
- Sign up: name, phone number, password, confirm password, terms checkbox
- Forgot password: email
- Reset password: OTP code, new password
- Contact admin: full name, group name, issue category, message
- Profile and settings: password change fields

#### Strongly inferred from grouped screens

- KYC personal info: full legal name, DOB, address, country, ID metadata
- Verification document: document type
- ID upload: front image, back image, optional extra document
- Face verification: selfie or provider session reference
- Create group: group name, contribution amount, frequency, start date, max members, description, invite settings
- Payment methods: card or bank token, default flag

### 2.5 User flow map

#### Client flow

1. Guest opens splash and onboarding.
2. Guest signs up or signs in.
3. If password is forgotten, guest requests OTP, enters code, and sets new password.
4. Newly authenticated member completes KYC.
5. Member lands on Home.
6. Member either creates a savings group or joins one using a code.
7. Group requests are approved or rejected.
8. Member views Group Details and Wheel schedule.
9. Member pays contributions, tracks wallet balance, and reviews transaction history.
10. Member receives notifications and can contact admin when needed.
11. Member manages profile, personal info, payment methods, and password settings.

#### Admin flow

1. Admin signs in.
2. Admin views Dashboard Overview stats and recent activity.
3. Admin manages users, groups, issues, transactions, notifications, and settings.
4. Admin reviews KYC applications and support tickets.
5. Admin opens Client Details for deep inspection and action history.

## 3. Backend feature breakdown

### 3.1 Core modules

- Authentication and session management
- User profile and account settings
- Role and permission management
- KYC workflow and KYC review
- Savings group lifecycle
- Group join code and join request workflow
- Wheel / payout rotation scheduling
- Wallet balance and ledger
- Payment methods and payment transactions
- Notifications and broadcast delivery
- Support tickets and admin issue handling
- Admin dashboard and reports
- Static CMS content for privacy policy and terms
- Audit log and activity feed

### 3.2 Module-by-module backend requirements

#### Auth

- Register member account
- Login for member and admin
- Issue JWT access token and refresh token
- Logout and revoke refresh token
- Forgot password OTP
- Verify OTP
- Reset password
- Change password
- Fetch current session user

#### Users and roles

- Store user profile
- Role lookup
- Optional permission matrix for future feature flags
- Block and unblock user
- Delete user
- Update user details

#### KYC

- Save draft KYC data step by step
- Upload and store KYC document metadata
- Store selfie / face verification result
- Submit KYC for review
- Admin list, approve, reject, and annotate KYC

#### Groups

- Create group
- Generate unique invite code
- Join group by code
- Track join request status
- Approve or reject requests
- Store group members and owner role
- Store wheel order and payout schedule
- Return group details with members, requests, and schedule

#### Wallet and payments

- One wallet per user
- Wallet ledger entries for every money movement
- Saved payment methods
- Top-up wallet
- Pay group contribution
- Record payout, refund, fee, and adjustment transactions
- Admin list and filter transactions

#### Notifications

- Create broadcast or user-specific notification
- Fan out delivery state to recipients
- Mark single notification as read
- Mark all as read

#### Support

- Create support ticket from client app
- Track ticket category, status, priority, assignee
- Support threaded replies between member and admin
- Close or resolve ticket

#### Admin dashboard

- Aggregate stats
- Recent activity feed
- User, group, KYC, payment, and issue counts
- Export overview report

## 4. Database design

### 4.1 Recommended database

- `PostgreSQL 15+`
- Reason: the design implies relational workflows with strong joins between users, groups, payments, KYC reviews, notifications, and support tickets.

### 4.2 Table list

- `roles`
- `permissions`
- `role_permissions`
- `users`
- `auth_refresh_tokens`
- `password_reset_otps`
- `user_devices`
- `kyc_applications`
- `kyc_documents`
- `savings_groups`
- `group_memberships`
- `group_join_requests`
- `group_cycles`
- `group_rotations`
- `wallets`
- `payment_methods`
- `payment_transactions`
- `wallet_ledger_entries`
- `notifications`
- `notification_recipients`
- `support_tickets`
- `support_ticket_messages`
- `cms_pages`
- `app_settings`
- `activity_logs`
- `admin_audit_logs`

### 4.3 ER diagram explanation in text

- One `role` has many `users`.
- Many `roles` can have many `permissions` through `role_permissions`.
- One `user` has many `auth_refresh_tokens`, `password_reset_otps`, `user_devices`, `payment_methods`, `payment_transactions`, `support_tickets`, and `activity_logs`.
- One `user` has one `wallet`.
- One `user` can have many `kyc_applications`, but only one active draft or pending record should exist at a time.
- One `kyc_application` has many `kyc_documents`.
- One `user` can own many `savings_groups`.
- One `savings_group` has many `group_memberships`, `group_join_requests`, `group_cycles`, `group_rotations`, `payment_transactions`, `support_tickets`, and `activity_logs`.
- `group_memberships` forms a many-to-many relation between `users` and `savings_groups`.
- One `group_cycle` belongs to one `savings_group` and has many `group_rotations`.
- One `payment_transaction` can map to one `wallet_ledger_entry`, one `payment_method`, one `user`, one `group`, and optionally one `group_cycle`.
- One `notification` has many `notification_recipients`.
- One `support_ticket` has many `support_ticket_messages`.
- `cms_pages` stores editable privacy-policy and terms-and-conditions content.
- `admin_audit_logs` records who changed what in the admin dashboard.

### 4.4 Schema file

- Full target SQL schema: [schema.sql](/C:/sozib/app_developments/may-2026/ematony/backend-ematony/docs/schema.sql)

## 5. API design

### 5.1 Base conventions

- Base path: `/api/v1`
- Auth: JWT access token in `Authorization: Bearer <token>`
- Refresh: refresh token stored in secure cookie or rotated refresh token body flow
- List response:

```json
{
  "success": true,
  "message": "Fetched successfully",
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

- Single resource response:

```json
{
  "success": true,
  "message": "Fetched successfully",
  "data": {}
}
```

- Error response:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ]
}
```

### 5.2 Auth and session APIs

| Method | Endpoint | Auth | Query / Params | Request body | Response data | Status codes |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/auth/register` | Public | None | `name, email, phone, password, confirmPassword, acceptedTerms` | `user, accessToken, refreshToken` | `201, 400, 409, 422` |
| POST | `/auth/login` | Public | None | `email, password` | `user, accessToken, refreshToken` | `200, 400, 401, 423` |
| POST | `/auth/logout` | Member/Admin | None | Optional `refreshToken` | `null` | `200, 401` |
| POST | `/auth/refresh-token` | Public with refresh token | None | Optional `refreshToken` if not cookie-based | `accessToken, refreshToken` | `200, 401` |
| POST | `/auth/forgot-password` | Public | None | `email` | `emailMasked, otpExpiresAt` | `200, 404, 429` |
| POST | `/auth/verify-otp` | Public | None | `email, otp, purpose` | `verified: true` | `200, 400, 410` |
| POST | `/auth/reset-password` | Public | None | `email, otp, password, confirmPassword` | `null` | `200, 400, 410, 422` |
| POST | `/auth/change-password` | Member/Admin | None | `currentPassword, newPassword, confirmPassword` | `null` | `200, 400, 401, 422` |
| GET | `/auth/me` | Member/Admin | None | None | `user, role, permissions` | `200, 401` |

### 5.3 Profile and app bootstrap APIs

| Method | Endpoint | Auth | Query / Params | Request body | Response data | Status codes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/dashboard/home` | Member | None | None | `walletSummary, activeGroups, pendingRequests, nextContribution, recentNotifications` | `200, 401` |
| GET | `/profile` | Member | None | None | `user, kycStatus, walletSummary` | `200, 401` |
| PUT | `/profile` | Member | None | `name, phone, avatarUrl, country, language` | `user` | `200, 400, 401, 422` |
| PUT | `/profile/password` | Member | None | `currentPassword, newPassword, confirmPassword` | `null` | `200, 400, 401, 422` |
| GET | `/content/:slug` | Public | `slug=privacy-policy | terms-and-conditions` | None | `slug, title, content` | `200, 404` |

### 5.4 KYC APIs

| Method | Endpoint | Auth | Query / Params | Request body | Response data | Status codes |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/kyc/start` | Member | None | Optional `documentType` | `kycApplication` | `201, 400, 401` |
| GET | `/kyc/me` | Member | None | None | `kycApplication, documents` | `200, 401, 404` |
| PUT | `/kyc/personal-info` | Member | None | `fullName, dob, addressLine1, city, state, postalCode, country` | `kycApplication` | `200, 400, 401, 422` |
| PUT | `/kyc/document` | Member | None | `documentType, issuingCountry, documentNumber` | `kycApplication` | `200, 400, 401, 422` |
| POST | `/kyc/documents` | Member | None | `documentSide, fileUrl, mimeType` | `kycDocument` | `201, 400, 401, 422` |
| POST | `/kyc/selfie` | Member | None | `fileUrl, providerRef, livenessResult` | `kycApplication` | `201, 400, 401` |
| POST | `/kyc/submit` | Member | None | None | `kycApplication` | `200, 400, 401, 409` |
| GET | `/admin/kyc` | Admin | `page, limit, status, search` | None | `items[]` | `200, 401, 403` |
| GET | `/admin/kyc/:id` | Admin | `id` | None | `kycApplication, user, documents` | `200, 401, 403, 404` |
| PATCH | `/admin/kyc/:id/approve` | Admin | `id` | Optional `note` | `kycApplication` | `200, 401, 403, 404` |
| PATCH | `/admin/kyc/:id/reject` | Admin | `id` | `reason` | `kycApplication` | `200, 400, 401, 403, 404` |

### 5.5 Groups and requests APIs

| Method | Endpoint | Auth | Query / Params | Request body | Response data | Status codes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/groups` | Member | `page, limit, status, search` | None | `items[]` | `200, 401` |
| POST | `/groups` | Member | None | `name, description, contributionAmount, frequency, maxMembers, startDate` | `group, inviteCode` | `201, 400, 401, 422` |
| POST | `/groups/join-by-code` | Member | None | `inviteCode` | `joinRequest` | `201, 400, 401, 404, 409` |
| GET | `/groups/requests` | Member | `type=incoming|outgoing, page, limit, status` | None | `items[]` | `200, 401` |
| POST | `/groups/:id/requests` | Member | `id` | Optional `note` | `joinRequest` | `201, 400, 401, 404, 409` |
| PATCH | `/groups/requests/:requestId/approve` | Group owner/Admin | `requestId` | Optional `note` | `membership, joinRequest` | `200, 401, 403, 404, 409` |
| PATCH | `/groups/requests/:requestId/reject` | Group owner/Admin | `requestId` | `reason` | `joinRequest` | `200, 400, 401, 403, 404` |
| GET | `/groups/:id` | Member | `id` | None | `group, membership, summary` | `200, 401, 403, 404` |
| PUT | `/groups/:id` | Group owner/Admin | `id` | `name, description, contributionAmount, frequency, status` | `group` | `200, 400, 401, 403, 404` |
| GET | `/groups/:id/members` | Member | `id, page, limit` | None | `items[]` | `200, 401, 403, 404` |
| GET | `/groups/:id/wheel` | Member | `id` | None | `cycle, rotations[]` | `200, 401, 403, 404` |
| GET | `/groups/:id/transactions` | Member | `id, page, limit, status` | None | `items[]` | `200, 401, 403, 404` |

### 5.6 Wallet, payment methods, and transactions APIs

| Method | Endpoint | Auth | Query / Params | Request body | Response data | Status codes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/wallet` | Member | None | None | `balanceSummary` | `200, 401` |
| GET | `/wallet/ledger` | Member | `page, limit, type, direction` | None | `items[]` | `200, 401` |
| GET | `/payment-methods` | Member | None | None | `items[]` | `200, 401` |
| POST | `/payment-methods` | Member | None | `provider, type, tokenRef, last4, brand, expiryMonth, expiryYear, isDefault` | `paymentMethod` | `201, 400, 401, 422` |
| PATCH | `/payment-methods/:id/default` | Member | `id` | None | `paymentMethod` | `200, 401, 404` |
| DELETE | `/payment-methods/:id` | Member | `id` | None | `null` | `200, 401, 404, 409` |
| POST | `/payments/wallet-topup` | Member | None | `amount, paymentMethodId` | `paymentTransaction, walletEntry` | `201, 400, 401, 402, 422` |
| POST | `/payments/group-contribution` | Member | None | `groupId, amount, paymentMethodId, cycleId` | `paymentTransaction, walletEntry` | `201, 400, 401, 402, 404, 409` |
| GET | `/payments` | Member | `page, limit, status, type` | None | `items[]` | `200, 401` |
| GET | `/payments/:id` | Member | `id` | None | `paymentTransaction` | `200, 401, 403, 404` |

### 5.7 Notifications APIs

| Method | Endpoint | Auth | Query / Params | Request body | Response data | Status codes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/notifications` | Member | `page, limit, unreadOnly` | None | `items[]` | `200, 401` |
| PATCH | `/notifications/:id/read` | Member | `id` | None | `notificationRecipient` | `200, 401, 404` |
| PATCH | `/notifications/read-all` | Member | None | None | `updatedCount` | `200, 401` |
| POST | `/admin/notifications` | Admin | None | `title, content, scope, userIds[]` | `notification` | `201, 400, 401, 403, 422` |

### 5.8 Support and issue management APIs

| Method | Endpoint | Auth | Query / Params | Request body | Response data | Status codes |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/support/tickets` | Member | None | `groupId, category, subject, message` | `ticket` | `201, 400, 401, 422` |
| GET | `/support/tickets` | Member | `page, limit, status` | None | `items[]` | `200, 401` |
| GET | `/support/tickets/:id` | Member/Admin | `id` | None | `ticket, messages[]` | `200, 401, 403, 404` |
| POST | `/support/tickets/:id/messages` | Member/Admin | `id` | `message, attachmentUrl` | `ticketMessage` | `201, 400, 401, 403, 404` |
| PATCH | `/support/tickets/:id/close` | Member/Admin | `id` | Optional `resolutionNote` | `ticket` | `200, 401, 403, 404` |
| GET | `/admin/issues` | Admin | `page, limit, status, category, priority, search` | None | `items[]` | `200, 401, 403` |
| PATCH | `/admin/issues/:id/assign` | Admin | `id` | `assignedAdminId` | `ticket` | `200, 400, 401, 403, 404` |
| PATCH | `/admin/issues/:id/status` | Admin | `id` | `status, priority, resolutionNote` | `ticket` | `200, 400, 401, 403, 404` |

### 5.9 Admin dashboard and operations APIs

| Method | Endpoint | Auth | Query / Params | Request body | Response data | Status codes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/admin/dashboard/stats` | Admin | Optional `range` | None | `totals, charts, counts` | `200, 401, 403` |
| GET | `/admin/dashboard/activity` | Admin | `page, limit, type` | None | `items[]` | `200, 401, 403` |
| GET | `/admin/reports/overview` | Admin | `range, format=pdf|csv` | None | `fileUrl` or streamed file | `200, 401, 403` |
| GET | `/admin/users` | Admin | `page, limit, search, role, status` | None | `items[]` | `200, 401, 403` |
| GET | `/admin/users/:id` | Admin | `id` | None | `user, groups, kyc, recentTransactions` | `200, 401, 403, 404` |
| PUT | `/admin/users/:id` | Admin | `id` | `name, phone, role, status` | `user` | `200, 400, 401, 403, 404` |
| PATCH | `/admin/users/:id/block` | Admin | `id` | `blocked` | `user` | `200, 401, 403, 404` |
| DELETE | `/admin/users/:id` | Admin | `id` | None | `null` | `200, 401, 403, 404, 409` |
| GET | `/admin/groups` | Admin | `page, limit, search, status` | None | `items[]` | `200, 401, 403` |
| GET | `/admin/groups/:id` | Admin | `id` | None | `group, members, wheel, requests` | `200, 401, 403, 404` |
| PATCH | `/admin/groups/:id/status` | Admin | `id` | `status` | `group` | `200, 400, 401, 403, 404` |
| GET | `/admin/transactions` | Admin | `page, limit, status, type, groupId, userId` | None | `items[]` | `200, 401, 403` |
| GET | `/admin/transactions/:id` | Admin | `id` | None | `paymentTransaction, walletEntries` | `200, 401, 403, 404` |
| GET | `/admin/notifications` | Admin | `page, limit, scope` | None | `items[]` | `200, 401, 403` |
| GET | `/admin/settings` | Admin | None | None | `settings` | `200, 401, 403` |
| PUT | `/admin/settings` | Admin | None | `supportEmail, maintenanceMode, defaultCurrency` | `settings` | `200, 400, 401, 403` |
| PUT | `/admin/content/:slug` | Admin | `slug` | `title, content, isPublished` | `cmsPage` | `200, 400, 401, 403, 404` |

## 6. Pagination, filtering, and search rules

- All list endpoints should accept `page` and `limit`.
- Recommended default `limit`: `10` for admin tables, `20` for client lists.
- Recommended hard max `limit`: `100`.
- Search should be case-insensitive and should operate on obvious columns:
  - users: `name, email, phone`
  - groups: `name, invite_code`
  - issues: `subject, category, requester name`
  - transactions: `reference_code, provider_txn_id`
- Common filters:
  - `status`
  - `dateFrom`
  - `dateTo`
  - `role`
  - `groupId`
  - `userId`
  - `category`

## 7. Authorization matrix

- Public:
  - onboarding content
  - register
  - login
  - forgot password
  - verify OTP
  - reset password
  - public CMS pages
- Member:
  - profile
  - KYC self-service
  - groups, requests, wheel, wallet, payment methods
  - notifications
  - support tickets
- Group owner:
  - approve or reject join requests for owned groups
  - update owned group settings
- Admin:
  - dashboard
  - all user management
  - all group management
  - KYC review
  - all transaction management
  - all issues
  - broadcast notifications
  - platform settings and CMS pages

## 8. Error handling rules

- `400 Bad Request`
  Invalid payload shape, invalid enum, missing required field.
- `401 Unauthorized`
  Missing or invalid JWT.
- `403 Forbidden`
  Authenticated but not allowed for the resource.
- `404 Not Found`
  Entity does not exist.
- `409 Conflict`
  Duplicate email, duplicate join request, invalid state transition.
- `422 Unprocessable Entity`
  Business validation failed, such as insufficient balance or incomplete KYC.
- `429 Too Many Requests`
  OTP spam or login brute force protection.
- `500 Internal Server Error`
  Unexpected server failure.

## 9. Recommended implementation order

1. Auth, roles, sessions, and profile.
2. KYC workflow and admin KYC review.
3. Groups, memberships, join requests, and wheel schedule.
4. Wallet, payment methods, contribution payments, and transaction history.
5. Notifications and support tickets.
6. Admin dashboard aggregates, reports, settings, and CMS pages.

## 10. Deliverables in this repo

- Full SQL target schema: [schema.sql](/C:/sozib/app_developments/may-2026/ematony/backend-ematony/docs/schema.sql)
- Planned Postman collection: [postman.json](/C:/sozib/app_developments/may-2026/ematony/backend-ematony/postman.json)
