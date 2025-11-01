# Authentication Setup Guide

## Overview

Your Loan Tracker now has **Better Auth** with an invite-only system. Only users with valid invite codes can sign up, and only admins can create invite codes.

## Quick Setup

### 1. Generate Better Auth Secret

For local development:
```bash
openssl rand -base64 32
```

Copy the output and add it to your `.env.local`:
```
BETTER_AUTH_SECRET=your-generated-secret-here
```

For production (Fly.io):
```bash
# Generate secret
SECRET=$(openssl rand -base64 32)

# Set it on Fly
fly secrets set BETTER_AUTH_SECRET="$SECRET" --app loan-tracker
```

### 2. Set Admin Emails (Optional)

In `.env.local` or Fly secrets:
```
ADMIN_EMAILS=your-email@example.com,friend@example.com
```

**Note:** The first user to sign up is automatically an admin.

### 3. Set App URL

For production:
```bash
fly secrets set NEXT_PUBLIC_APP_URL="https://loan-tracker.fly.dev" --app loan-tracker
```

For local development (.env.local):
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Initialize Database Tables

Run the init endpoint once to create auth tables:
```bash
# Local
curl http://localhost:3000/api/init

# Production
curl https://loan-tracker.fly.dev/api/init
```

## How Authentication Works

### User Flow

1. **First User** (You):
   - Go to `/signup`
   - Create account (no invite needed for first user)
   - Automatically becomes admin

2. **Inviting Friends**:
   - As admin, visit `/invites`
   - Click "Create Invite"
   - Optionally specify friend's email
   - Share the generated invite URL

3. **Friend Signs Up**:
   - Friend visits invite URL (e.g., `/signup?invite=abc123...`)
   - Creates account with email and password
   - Can now access the app

### Admin Capabilities

Admins can:
- Create invite codes
- View all invites and their status
- See who used each invite
- Access the full app

### Security Features

✅ **Invite-only signups** - No public registration
✅ **Password hashing** - Using Better Auth's bcrypt implementation
✅ **Session management** - Secure cookie-based sessions
✅ **Invite expiration** - Codes expire after set days (default: 7)
✅ **One-time use** - Each invite can only be used once
✅ **Email locking** - Optionally lock invite to specific email

## Configuration Options

### Better Auth Secret

**Purpose:** Encrypts sessions and passwords
**Required:** Yes
**Generation:**
```bash
openssl rand -base64 32
```

### Admin Emails

**Purpose:** Specify who can create invites
**Required:** No (first user is auto-admin)
**Format:** Comma-separated emails
**Example:**
```
ADMIN_EMAILS=admin@example.com,friend@example.com
```

### App URL

**Purpose:** For generating invite links
**Required:** Yes for production
**Local:** `http://localhost:3000`
**Production:** `https://your-app.fly.dev`

## API Endpoints

### Auth Endpoints (Better Auth)
- `POST /api/auth/sign-in` - Sign in
- `POST /api/auth/sign-up` - Sign up (requires invite)
- `POST /api/auth/sign-out` - Sign out
- `GET /api/auth/session` - Get current session

### Invite Endpoints
- `GET /api/invites` - List all invites (admin only)
- `POST /api/invites` - Create invite (admin only)
- `GET /api/invites/verify?code=XXX` - Verify invite code
- `POST /api/invites/use` - Mark invite as used

## Database Schema

### Better Auth Tables (auto-created)
- `user` - User accounts
- `session` - Active sessions
- `account` - OAuth accounts (if used)
- `verification` - Email verification tokens

### Custom Tables
- `invite_codes` - Invite management
  - `code` - Unique invite code
  - `email` - Optional email restriction
  - `used_by` - Who used the invite
  - `created_by` - Admin who created it
  - `expires_at` - Expiration date

## Local Development

1. Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```

2. Generate and set secret:
```bash
SECRET=$(openssl rand -base64 32)
echo "BETTER_AUTH_SECRET=$SECRET" >> .env.local
```

3. Add your email as admin:
```bash
echo "ADMIN_EMAILS=your-email@example.com" >> .env.local
```

4. Set app URL:
```bash
echo "NEXT_PUBLIC_APP_URL=http://localhost:3000" >> .env.local
```

5. Run development server:
```bash
npm run dev
```

6. Initialize database:
```bash
curl http://localhost:3000/api/init
```

7. Visit `http://localhost:3000/signup` to create first account

## Production Deployment

1. Set all secrets on Fly.io:
```bash
# Generate secret
SECRET=$(openssl rand -base64 32)

# Set secrets
fly secrets set \
  BETTER_AUTH_SECRET="$SECRET" \
  ADMIN_EMAILS="your-email@example.com" \
  NEXT_PUBLIC_APP_URL="https://loan-tracker.fly.dev" \
  --app loan-tracker
```

2. Deploy:
```bash
fly deploy
```

3. Initialize database:
```bash
curl https://loan-tracker.fly.dev/api/init
```

4. Create your account at `https://loan-tracker.fly.dev/signup`

## Managing Users

### Creating Invites

1. Sign in as admin
2. Go to `/invites`
3. Fill in the form:
   - **Email** (optional): Lock invite to specific email
   - **Expires in**: Days until expiration (default: 7)
4. Click "Create Invite"
5. Copy and share the URL

### Viewing Invites

The invites page shows:
- ✅ **Active** - Not used, not expired
- 🟢 **Used** - Successfully redeemed
- 🔴 **Expired** - Past expiration date

### Revoking Access

Currently, there's no built-in user deletion. To revoke access:
1. Change your `BETTER_AUTH_SECRET`
2. All sessions will be invalidated
3. Users must sign in again

Or connect to your Turso database directly:
```bash
turso db shell loan-tracker
DELETE FROM user WHERE email = 'user@example.com';
DELETE FROM session WHERE user_id = 'user_id_here';
```

## Troubleshooting

### "Unauthorized" errors
- Check that `BETTER_AUTH_SECRET` is set
- Verify you're signed in
- Clear cookies and sign in again

### Can't create invites
- Ensure you're logged in
- Check that your email is in `ADMIN_EMAILS` or you were the first user
- Verify database tables exist (run `/api/init`)

### Invite link doesn't work
- Check that `NEXT_PUBLIC_APP_URL` is set correctly
- Verify invite hasn't expired
- Ensure invite hasn't been used already

### Sessions not persisting
- Check browser cookies are enabled
- Verify `BETTER_AUTH_SECRET` is set
- Try different browser

## Security Best Practices

1. **Never commit `.env.local`** - It's in `.gitignore`
2. **Use strong secrets** - 32+ character random strings
3. **Rotate secrets periodically** - Every 90 days recommended
4. **Limit admin access** - Only add trusted users to `ADMIN_EMAILS`
5. **Monitor invites** - Regularly check `/invites` for suspicious activity
6. **Use HTTPS** - Fly.io provides this automatically
7. **Short expiration** - Keep invite codes short-lived (7 days default)

## Advanced Configuration

### Custom Invite Expiration

When creating invites via API:
```bash
curl -X POST https://loan-tracker.fly.dev/api/invites \
  -H "Content-Type: application/json" \
  -d '{"email": "friend@example.com", "expiresInDays": 1}'
```

### Bulk Invites

Create multiple invites programmatically:
```bash
for email in friend1@example.com friend2@example.com; do
  curl -X POST http://localhost:3000/api/invites \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"expiresInDays\": 7}"
done
```

## Migration from Unprotected App

If you already deployed without auth:

1. Deploy with auth enabled
2. First person to visit `/signup` becomes admin
3. **Important:** Do this quickly before someone else does!
4. Create invites for all your existing users
5. They must sign up to continue using the app

## Support

For Better Auth documentation:
- https://www.better-auth.com/docs

For issues:
- Check `fly logs` for server errors
- Check browser console for client errors
- Verify all environment variables are set correctly
