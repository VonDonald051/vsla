# VSLA Deployment Fix - Environment Setup Required

## Problem Diagnosed
Your Vercel deployment was building from the **old VSLA template** directory, not the new Convex/WorkOS implementation. This caused the registration error (500) because the old code had no registration API endpoint.

## Solution Implemented
✅ Created `vercel.json` to redirect Vercel to build from the `/vsla/` directory with the new implementation

## Next Step: Set Environment Variables in Vercel

The new deployment requires these environment variables. Follow these steps:

### 1. Go to Vercel Dashboard
- https://vercel.com/dashboard
- Select your project: **vsla** or **vsla-s**

### 2. Add Environment Variables
Go to **Settings** → **Environment Variables**

Add these variables:

```
NEXT_PUBLIC_CONVEX_URL
Value: https://proficient-egret-317.convex.cloud
```

```
WORKOS_CLIENT_ID
Value: <Get from https://dashboard.workos.com>
```

```
WORKOS_API_KEY
Value: <Get from https://dashboard.workos.com>
```

```
WORKOS_REDIRECT_URI
Value: https://vsla-s.vercel.app/callback
(Replace vsla-s.vercel.app with your actual domain)
```

### 3. Redeploy
- Go to **Deployments**
- Click the latest deployment (should be showing the Vercel config change)
- Or manually trigger a redeploy:
  - Click "..." → "Redeploy"
  - This will build from `/vsla/` with the new code

## Getting Values

### Convex URL
1. Go to https://dashboard.convex.dev
2. Click your project
3. Copy the URL from the "Production" deployment section
4. Should look like: `https://proficient-egret-317.convex.cloud`

### WorkOS Credentials
1. Go to https://dashboard.workos.com
2. Go to **Configuration**
3. Find **Client ID** and **API Key**
4. Copy both values

## What Happens After Deployment

Once you redeploy with correct environment variables:

✅ Home page shows: "VSLA - Village Savings & Loan Association"
✅ Sign Up button works (WorkOS authentication)
✅ User data auto-saves to Convex database
✅ Login/logout persists data
✅ Groups, loans, savings all work

## Troubleshooting

### Still seeing old interface?
- Make sure Vercel redeployed after vercel.json change
- Check deployment logs for build errors
- Clear browser cache (Ctrl+Shift+Delete)

### Still getting 500 error?
- Check that WORKOS_CLIENT_ID and WORKOS_API_KEY are set
- Check that NEXT_PUBLIC_CONVEX_URL is set
- Check Vercel Function logs for errors

### Not redirecting to WorkOS?
- Check that WORKOS_REDIRECT_URI matches your domain exactly
- Update WorkOS dashboard with correct redirect URI
- Verify at https://dashboard.workos.com → Configuration

## Testing After Setup

1. Visit https://vsla-s.vercel.app
2. Should see new VSLA dashboard interface
3. Click "Sign Up"
4. Should redirect to WorkOS login (not show registration form)
5. Create account via WorkOS
6. User data auto-saves to Convex ✓

## Files Changed
- Created: `/vercel.json` - Tells Vercel to build from `/vsla/`
- No code changes needed (already deployed to Convex)

## Summary
**What was wrong**: Vercel was building from wrong directory
**What I fixed**: Added vercel.json to point to `/vsla/`
**What you need to do**: Set 4 environment variables in Vercel and redeploy

**ETA**: 5 minutes to fix (mostly waiting for Vercel to redeploy)
