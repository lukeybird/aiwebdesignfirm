# Fix Vercel Deployment for Private Repository

## Problem
Vercel is not automatically deploying when you push to your private GitHub repository.

## Solution Steps

### Step 1: Reconnect GitHub Integration

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Select your project (`aiwebdesignfirm`)

2. **Go to Settings → Git**
   - Click on "Settings" in the top navigation
   - Click on "Git" in the left sidebar

3. **Disconnect Current Integration**
   - Find the GitHub integration section
   - Click "Disconnect" or "Remove"

4. **Reconnect with Private Repo Access**
   - Click "Connect Git Repository"
   - Select "GitHub"
   - Authorize Vercel
   - **IMPORTANT**: When authorizing, make sure to grant access to **private repositories**
   - Select your repository: `lukeybird/aiwebdesignfirm`

### Step 2: Verify Auto-Deploy is Enabled

1. In **Settings → Git**
2. Make sure "Auto-deploy" is enabled/toggled ON
3. Check that the branch is set to `main`

### Step 3: Check GitHub App Permissions

1. **Go to GitHub**
   - Visit https://github.com/settings/applications
   - Click on "Installed GitHub Apps"
   - Find "Vercel"

2. **Configure Permissions**
   - Click "Configure"
   - Under "Repository access":
     - Select "All repositories" OR
     - Select "Only select repositories" and ensure `aiwebdesignfirm` is selected
   - Under "Permissions":
     - "Contents" should be "Read-only" or "Read and write"
     - "Metadata" should be "Read-only"

3. **Save Changes**

### Step 4: Manually Trigger Deployment

After reconnecting:

1. Go to **Deployments** tab in Vercel
2. Click the "..." menu on the latest deployment
3. Click "Redeploy"
4. This will test if the connection is working

### Step 5: Test Auto-Deploy

After reconnecting, make a small change and push:

```bash
# Make a small change
echo "// Updated" >> app/page.tsx
git add app/page.tsx
git commit -m "Test auto-deploy"
git push origin main
```

Check Vercel dashboard - a new deployment should start automatically.

## Alternative: Manual Deployment via Vercel CLI

If GitHub integration still doesn't work:

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login:
   ```bash
   vercel login
   ```

3. Link project:
   ```bash
   vercel link
   ```

4. Deploy:
   ```bash
   vercel --prod
   ```

## Troubleshooting

### If deployments still don't trigger:

1. **Check Webhook Status**
   - GitHub → Repository → Settings → Webhooks
   - Look for Vercel webhook
   - Check if it's active and receiving events

2. **Check Vercel Logs**
   - Vercel Dashboard → Deployments
   - Look for any error messages
   - Check build logs for issues

3. **Verify Repository Access**
   - Make sure you're the owner or have admin access
   - Check that the repository isn't archived

## Most Common Fix

**90% of the time, this is fixed by:**
1. Disconnecting the GitHub integration in Vercel
2. Reconnecting it
3. **Granting access to private repositories** during authorization

Make sure to check the "Private repositories" checkbox when re-authorizing!

