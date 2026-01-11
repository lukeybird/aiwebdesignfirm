# Google Places API Setup & Security

## ✅ Security Measures Already in Place

1. **Server-Side Only**: The API key is **never** exposed to the client. It's only used in the server-side API route (`/api/google-places/route.ts`).

2. **Environment Variables**: The API key is stored in `.env.local` which is:
   - Already in `.gitignore` (won't be committed to Git)
   - Only accessible on your local machine and your deployment platform (Vercel)

3. **No Client Exposure**: The API key is accessed via `process.env.GOOGLE_PLACES_API_KEY` which is secure in Next.js - it's only available on the server.

## 🔒 Additional Security Recommendations

### 1. Google Cloud Console API Key Restrictions

In your Google Cloud Console, restrict your API key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Click on your API key
3. Under **"API restrictions"**:
   - Select "Restrict key"
   - Check only: **Places API** and **Geocoding API**
4. Under **"Application restrictions"** (optional but recommended):
   - Select "HTTP referrers (web sites)"
   - Add your domain: `https://yourdomain.com/*`
   - Add localhost for development: `http://localhost:3000/*`
5. Click "Save"

### 2. Vercel Environment Variables

When deploying to Vercel:

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add: `GOOGLE_PLACES_API_KEY` with your API key value
4. Select all environments (Production, Preview, Development)
5. The key will be encrypted and only accessible server-side

### 3. Rate Limiting (Future Enhancement)

For additional security, you could add rate limiting to prevent abuse. This would require:
- A rate limiting library (e.g., `@upstash/ratelimit`)
- Or implementing your own rate limiting logic

## 📝 Setup Checklist

- [x] API key stored in `.env.local` (not committed to Git)
- [x] API key only used server-side
- [ ] API key restricted in Google Cloud Console (recommended)
- [ ] API key added to Vercel environment variables (for deployment)
- [ ] Both Places API and Geocoding API enabled in Google Cloud Console

## 🚨 Important Notes

- **Never** commit `.env.local` to Git (already in `.gitignore`)
- **Never** expose the API key in client-side code
- **Always** restrict your API key in Google Cloud Console
- Monitor your API usage in Google Cloud Console to prevent unexpected charges

## 🔍 Verifying Security

To verify your API key is secure:

1. Check that `.env.local` is in `.gitignore` ✅
2. Search your codebase for `GOOGLE_PLACES_API_KEY` - it should only appear in:
   - `.env.local` (local file, not committed)
   - `app/api/google-places/route.ts` (server-side only, using `process.env`)
3. The API key should **never** appear in:
   - Client-side components
   - Browser network requests (check DevTools)
   - Git history

Your current setup is secure! ✅

