# How to Add API Key to Vercel - Step by Step

## Step 1: Go to Your Vercel Dashboard
1. Open your web browser
2. Go to: **https://vercel.com/dashboard**
3. Sign in if you're not already signed in

## Step 2: Find Your Project
1. You should see a list of your projects
2. Look for your project (it should be named something like "aiwebdesignfirm" or "Let Us See")
3. **Click on the project name** to open it

## Step 3: Open Settings
1. Once you're in your project, look at the top menu bar
2. You should see tabs like: **Overview**, **Deployments**, **Analytics**, **Settings**, etc.
3. **Click on "Settings"** (it's usually near the right side of the menu)

## Step 4: Go to Environment Variables
1. In the Settings page, look at the left sidebar menu
2. You should see options like:
   - General
   - Environment Variables ← **Click this one**
   - Git
   - Domains
   - etc.
3. **Click on "Environment Variables"**

## Step 5: Add the New Variable
1. You should see a section that says "Environment Variables" with a list (might be empty)
2. Look for a button that says **"+ Add New"** or **"Add"** or **"Create"**
3. **Click that button**

## Step 6: Fill in the Form
A form or modal will appear. Fill it in like this:

**Key (or Name):**
```
API_KEY_GOOGLE
```
*(Type this exactly as shown - case sensitive)*

**Value:**
```
AIzaSyAbvmlzmW4aj3sjKXGmtw2OrkI0JQzRP3E
```
*(Copy and paste this entire string)*

**Environment:**
- Check the boxes for:
  - ✅ **Production**
  - ✅ **Preview** 
  - ✅ **Development**
*(Or select "All Environments" if that option exists)*

## Step 7: Save
1. Look for a button that says **"Save"** or **"Add"** or **"Create"**
2. **Click it**

## Step 8: Redeploy (Important!)
1. Go back to the **"Deployments"** tab (top menu)
2. Find your most recent deployment
3. Click the **three dots (⋯)** on the right side of that deployment
4. Select **"Redeploy"** from the dropdown menu
5. Confirm the redeploy

## Alternative: Auto-Deploy
If you don't see a redeploy option, Vercel will automatically redeploy on the next code push. Since we've already pushed the code, you can:
1. Make a small change to any file (like adding a space)
2. Commit and push it
3. Vercel will auto-deploy with the new environment variable

## Verify It's Working
After redeploying:
1. Wait 1-2 minutes for the deployment to complete
2. Visit your live site
3. Try pasting a Google Maps link
4. It should auto-fill the form fields

## Troubleshooting
If you can't find "Environment Variables":
- Make sure you're in the **Settings** tab
- Look in the left sidebar menu
- It might be under a submenu - try clicking "General" first

If the button says something different:
- It might say "New" instead of "Add New"
- Or "Create Variable" 
- Just look for any button that lets you add/create a new variable

## Still Having Trouble?
If you're still stuck, tell me:
1. What page/tab you're currently on in Vercel
2. What options you see in the menu
3. I can give you more specific guidance based on what you're seeing

