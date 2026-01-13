# Quick Vercel Environment Variables Setup

## Option 1: Using Vercel Dashboard (Easiest - 2 minutes)

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Click on your project: `aiwebdesignfirm` (or your project name)

2. **Navigate to Settings:**
   - Click **"Settings"** tab
   - Click **"Environment Variables"** in the left sidebar

3. **Add These 3 Variables:**
   
   Click **"Add New"** for each:
   
   **Variable 1:**
   - Key: `RESEND_API_KEY`
   - Value: `re_PtrPxqAt_Gjn9ie3c7S3fpwpQxjfnMNmQ`
   - Environments: ✅ Production ✅ Preview ✅ Development
   - Click **"Save"**
   
   **Variable 2:**
   - Key: `FROM_EMAIL`
   - Value: `onboarding@resend.dev`
   - Environments: ✅ Production ✅ Preview ✅ Development
   - Click **"Save"**
   
   **Variable 3:**
   - Key: `TO_EMAIL`
   - Value: `contact@aiwebdesignfirm.com` (or your preferred email)
   - Environments: ✅ Production ✅ Preview ✅ Development
   - Click **"Save"**

4. **Redeploy:**
   - Go to **"Deployments"** tab
   - Click the **"..."** menu on the latest deployment
   - Click **"Redeploy"**
   - Or just push a new commit to trigger auto-deploy

✅ **Done!** Your form will now work in production.

---

## Option 2: Using Vercel CLI (Command Line)

If you prefer command line:

1. **Install Vercel CLI (if not installed):**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Link your project (if not already linked):**
   ```bash
   vercel link
   ```

4. **Run the setup script:**
   ```bash
   ./setup-vercel-env.sh
   ```

   Or manually add each variable:
   ```bash
   vercel env add RESEND_API_KEY production preview development
   # When prompted, paste: re_PtrPxqAt_Gjn9ie3c7S3fpwpQxjfnMNmQ
   
   vercel env add FROM_EMAIL production preview development
   # When prompted, paste: onboarding@resend.dev
   
   vercel env add TO_EMAIL production preview development
   # When prompted, paste: contact@aiwebdesignfirm.com
   ```

5. **Redeploy:**
   ```bash
   vercel --prod
   ```

---

## Quick Copy-Paste Values

**RESEND_API_KEY:**
```
re_PtrPxqAt_Gjn9ie3c7S3fpwpQxjfnMNmQ
```

**FROM_EMAIL:**
```
onboarding@resend.dev
```

**TO_EMAIL:**
```
contact@aiwebdesignfirm.com
```

---

## Verify It's Working

After adding the variables and redeploying:

1. Go to your live site
2. Click "Start My Project" button
3. Fill out and submit the form
4. Check your email inbox (the TO_EMAIL address)
5. You should receive the form submission!

---

## Troubleshooting

**Form not sending emails?**
- Check Vercel Function Logs: Vercel Dashboard → Your Project → Functions → View Logs
- Verify environment variables are set correctly
- Make sure you redeployed after adding variables

**Getting errors?**
- Check that all 3 variables are added
- Verify they're enabled for all environments (Production, Preview, Development)
- Check Resend dashboard for any API errors

