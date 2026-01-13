# Form Email Troubleshooting Guide

## Common Issues & Solutions

### Issue 1: "Failed to send email" or "Email service not configured"

**Most Likely Cause:** Environment variables not set in Vercel

**Solution:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify these 3 variables exist:
   - `RESEND_API_KEY` = `re_PtrPxqAt_Gjn9ie3c7S3fpwpQxjfnMNmQ`
   - `FROM_EMAIL` = `onboarding@resend.dev`
   - `TO_EMAIL` = `contact@aiwebdesignfirm.com`
3. Make sure they're enabled for: ✅ Production ✅ Preview ✅ Development
4. **Redeploy** your site after adding variables

---

### Issue 2: "Invalid API key" or "Unauthorized"

**Cause:** API key is incorrect or expired

**Solution:**
1. Go to https://resend.com/api-keys
2. Check if your API key is still active
3. If needed, create a new API key
4. Update `RESEND_API_KEY` in Vercel environment variables
5. Redeploy

---

### Issue 3: "Domain not verified" or "Invalid from address"

**Cause:** Using a custom domain email that isn't verified

**Solution:**
- For testing, use `onboarding@resend.dev` (already verified)
- For production with your domain:
  1. Go to Resend Dashboard → Domains
  2. Add your domain (e.g., `aiwebdesignfirm.com`)
  3. Add the DNS records Resend provides
  4. Wait for verification
  5. Update `FROM_EMAIL` to use your domain (e.g., `noreply@aiwebdesignfirm.com`)

---

### Issue 4: Form works locally but not in production

**Cause:** Environment variables only set locally, not in Vercel

**Solution:**
1. Check Vercel environment variables (see Issue 1)
2. Make sure variables are set for **Production** environment
3. Redeploy after adding variables

---

## How to Check What Went Wrong

### Step 1: Check Vercel Function Logs

1. Go to Vercel Dashboard → Your Project
2. Click **"Functions"** tab
3. Click on `/api/contact` function
4. View the logs to see the exact error

The logs will show:
- Whether `RESEND_API_KEY` is set
- The exact Resend API error message
- Configuration details

### Step 2: Check Browser Console

1. Open your site
2. Open browser DevTools (F12)
3. Go to Console tab
4. Submit the form
5. Check for any error messages

### Step 3: Test the API Directly

You can test the API endpoint directly:

```bash
curl -X POST https://your-site.vercel.app/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "phone": "123-456-7890"
  }'
```

---

## Quick Checklist

- [ ] `RESEND_API_KEY` is set in Vercel environment variables
- [ ] `FROM_EMAIL` is set in Vercel environment variables  
- [ ] `TO_EMAIL` is set in Vercel environment variables
- [ ] All variables are enabled for Production, Preview, and Development
- [ ] Site has been redeployed after adding variables
- [ ] API key is valid (check Resend dashboard)
- [ ] FROM_EMAIL is verified (use `onboarding@resend.dev` for testing)

---

## Still Not Working?

1. **Check Vercel Function Logs** - This will show the exact error
2. **Verify API Key** - Go to Resend dashboard and check if key is active
3. **Test with curl** - Use the command above to test the API directly
4. **Check Resend Dashboard** - Look for any errors or rate limits

The improved error messages will now show more specific details about what went wrong!

