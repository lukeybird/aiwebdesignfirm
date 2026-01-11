# Quick Setup Instructions

## Step 1: Get Your Google API Key

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click "CREATE CREDENTIALS" → "API key"
3. Copy the API key that appears

## Step 2: Add API Key to Local Project

The `.env.local` file has been created. Open it and replace `your_api_key_here` with your actual API key.

**File location:** `.env.local` in your project root

## Step 3: Enable Required APIs

Make sure these APIs are enabled in Google Cloud Console:
- Places API
- Geocoding API

Go to: https://console.cloud.google.com/apis/library
- Search for "Places API" → Enable
- Search for "Geocoding API" → Enable

## Step 4: Add to Vercel (for deployment)

1. Go to your Vercel project: https://vercel.com/dashboard
2. Click on your project
3. Go to "Settings" → "Environment Variables"
4. Add new variable:
   - **Name:** `GOOGLE_PLACES_API_KEY`
   - **Value:** (paste your API key)
   - **Environment:** Select all (Production, Preview, Development)
5. Click "Save"

## Step 5: Restart Development Server

After adding the API key to `.env.local`, restart your dev server:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## ✅ You're Done!

Once the API key is added, the Google Maps auto-fill feature will work automatically when you paste a Google Maps link into the Business Address field.

