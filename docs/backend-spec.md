# Ematony Backend Spec

## 1. Figma Analysis

### Screens detected
- Authentication: `Sign In`, `Sign Up`, `Forgot Password`, OTP-based reset flow
- Admin: `Dashboard Overview`
- Admin navigation labels: `User Management`, `Group Management`, `Issue Management`, `Transaction Management`, `Settings`
- Client/support flow: `Contact Admin`

### Roles detected from UI and existing code
- `admin`: dashboard access, user moderation, KYC review, payment review, notification sending
- `user`: mobile/client auth and support flow

### Features visible in UI
- Credential login
- Password recovery via email + OTP
- Dashboard stats cards
- User activity/reporting table
- User search, pagination, block/delete actions
- KYC review with approve/reject actions and Stripe verification handoff
- Payment listing with status filters
- Notification listing and broadcast/user-targeted sending
- Settings/password change
- Contact-admin issue submission

### Data inputs and actions
- Auth forms: email, password, OTP, new password
- User table: search, pagination, block, delete, edit target
- KYC table: status filter, approve, reject reason, open Stripe session
- Payments: status filter, pagination
- Notifications: title, message, optional user id
- Contact admin: full name, group name, category, message

### User flow
1. Admin signs in with email/password
2. Admin lands on dashboard overview
3. Admin navigates into users, KYC, payments, notifications, settings
4. Admin performs moderation/review actions
5. Client users can submit support/contact-admin issues and complete KYC flow

### Ambiguities
- `Group Management` and `Issue Management` are visible in Figma, but detailed admin table columns, filters, and lifecycle states are not fully defined in the prompt.
- The existing codebase is Mongo/Mongoose. The SQL schema below is a normalized reference design derived from the Figma request, while the implementation remains aligned to the current Express/Mongoose stack.

## 2. Feature Breakdown

### Implemented in this backend pass
- JWT auth login
- Forgot-password alias aligned to `/auth/forgot-password`
- Reset password
- Refresh token
- Change password
- Admin dashboard stats
- User listing, detail, update, delete, block toggle
- Payment listing/detail with pagination
- KYC listing, approve, reject, Stripe verification session creation
- Notification listing, send, mark-as-read
- Shared paginated response metadata
- Stronger auth middleware for blocked/unverified users

### Planned from design but not implemented due missing domain detail
- Full `Group Management` CRUD
- Full `Issue Management` admin lifecycle
- Client-facing support/contact-admin submission endpoint

## 3. Database Design

### Implementation database
- Current implementation: MongoDB with Mongoose models in `backend-ematony/model`

### Reference relational schema
- See [schema.sql](./schema.sql)

### ER explanation
- `roles` -> `users`: one-to-many
- `users` -> `password_reset_tokens`: one-to-many
- `users` -> `kyc_verifications`: one-to-many, but usually one active record per user
- `users` -> `payment_transactions`: one-to-many
- `users` -> `notifications`: one-to-many for targeted notifications, nullable for broadcasts
- `users` -> `support_tickets`: one-to-many
- `groups` -> `group_memberships`: one-to-many
- `users` -> `group_memberships`: one-to-many
- `users` -> `admin_audit_logs`: one-to-many as actor

## 4. API Design

### Auth
- `POST /api/v1/auth/login`
  - Body: `{ "email": "admin@gmail.com", "password": "" }`
  - Response: access token, refresh token, role, user
- `POST /api/v1/auth/forgot-password`
  - Body: `{ "email": "admin@gmail.com" }`
  - Response: OTP dispatch confirmation
- `POST /api/v1/auth/reset-password`
  - Body: `{ "email": "", "otp": "", "password": "" }`
  - Response: success message
- `POST /api/v1/auth/refresh-token`
  - Body or cookie: refresh token
  - Response: new access token + refresh token
- `POST /api/v1/auth/change-password`
  - Auth: Bearer token
  - Body: `{ "oldPassword": "OldPassword123!", "newPassword": "NewPassword123!" }`
- `POST /api/v1/auth/logout`
  - Auth: Bearer token

### Dashboard
- `GET /api/v1/admin/dashboard/stats`
  - Auth: admin
  - Response: `totalUsers`, `totalPayments`, `totalRevenue`, `pendingKyc`, `activeGroups`

### Users
- `GET /api/v1/user/all?page=1&limit=10&search=smith`
  - Auth: admin
  - Response: paginated users
- `GET /api/v1/user/:id`
  - Auth: admin
- `PUT /api/v1/user/:id`
  - Auth: admin
  - Body supports: `name`, `firstName`, `lastName`, `email`, `phone`, `role`, `isBlocked`
- `DELETE /api/v1/user/:id`
  - Auth: admin
- `PATCH /api/v1/user/:id/block`
  - Auth: admin
  - Toggles blocked state

### Payments
- `GET /api/v1/payment/all?page=1&limit=10&status=pending`
  - Auth: admin
- `GET /api/v1/payment/:id`
  - Auth: admin

### KYC
- `GET /api/v1/kyc/all?page=1&limit=10&status=pending`
  - Auth: admin
- `POST /api/v1/kyc/stripe/verification-session`
  - Auth: admin
  - Body: `{ "userId": "<mongo-id>" }`
- `PATCH /api/v1/kyc/:id/approve`
  - Auth: admin
- `PATCH /api/v1/kyc/:id/reject`
  - Auth: admin
  - Body: `{ "reason": "Document is blurry" }`

### Notifications
- `GET /api/v1/notification/all?page=1&limit=10`
  - Auth: admin
- `POST /api/v1/notification/send`
  - Auth: admin
  - Body: `{ "title": "System update", "message": "Scheduled maintenance", "userId": "optional" }`
- `PATCH /api/v1/notification/:id/read`
  - Auth: admin

### Response format
```json
{
  "success": true,
  "message": "Human readable message",
  "data": [],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

### Status codes
- `200` success
- `201` created
- `400` validation/invalid id
- `401` invalid or missing token
- `403` blocked user or non-admin access
- `404` record not found
- `500` server error

## 5. Backend Code Structure

```text
backend-ematony/
  controller/
    admin.controller.js
    auth.controller.js
    kyc.controller.js
    notification.controller.js
    payment.controller.js
    user.controller.js
  route/
    admin.route.js
    auth.route.js
    kyc.route.js
    notification.route.js
    payment.route.js
    user.route.js
  model/
    kyc.model.js
    notification.model.js
    payment.model.js
    user.model.js
  middleware/
    auth.middleware.js
    globalErrorHandler.js
  services/
    stripe-identity.service.js
  docs/
    backend-spec.md
    schema.sql
  postman.json
```

## 6. Setup Instructions

1. Install dependencies in `backend-ematony`:
   - `npm install`
2. Configure environment variables:
   - `MONGO_DB_URL`
   - `JWT_ACCESS_SECRET`
   - `JWT_ACCESS_EXPIRES_IN`
   - `JWT_REFRESH_SECRET`
   - `JWT_REFRESH_EXPIRES_IN`
   - `OTP_SECRET`
   - `OTP_EXPIRE`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_IDENTITY_RETURN_URL`
   - `ADMIN_APP_URL`
3. Start the server:
   - `npm run dev`
4. Import [postman.json](../postman.json) into Postman
5. Authenticate with an admin account and use the returned access token as `Bearer {{token}}`
