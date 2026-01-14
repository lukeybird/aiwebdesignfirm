# Pusher WebSocket Setup Guide

## Overview
The chat system now uses Pusher WebSockets for real-time updates instead of HTTP polling. This provides instant message delivery and better performance.

## Required Environment Variables

You need to add these environment variables to your `.env.local` file and Vercel:

### Server-Side (Vercel Environment Variables)
- `PUSHER_APP_ID` - Your Pusher App ID
- `PUSHER_SECRET` - Your Pusher Secret Key

### Client-Side (Public - Safe to expose)
- `NEXT_PUBLIC_PUSHER_KEY` - Your Pusher Key (public)
- `NEXT_PUBLIC_PUSHER_CLUSTER` - Your Pusher cluster (e.g., `us2`, `eu`, `ap-southeast-1`)

## Setup Steps

### 1. Create a Pusher Account
1. Go to https://pusher.com/
2. Sign up for a free account
3. Create a new app/channel

### 2. Get Your Pusher Credentials
After creating an app, you'll see:
- **App ID**: Found in the "Keys" tab
- **Key**: Found in the "Keys" tab (this is your `NEXT_PUBLIC_PUSHER_KEY`)
- **Secret**: Found in the "Keys" tab (click "Reveal" to see it)
- **Cluster**: Found in the "Keys" tab (e.g., `us2`, `eu`)

### 3. Add to Local Environment
Create or update `.env.local`:
```env
PUSHER_APP_ID=your_app_id_here
PUSHER_SECRET=your_secret_here
NEXT_PUBLIC_PUSHER_KEY=your_key_here
NEXT_PUBLIC_PUSHER_CLUSTER=us2
```

### 4. Add to Vercel
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add all four variables:
   - `PUSHER_APP_ID`
   - `PUSHER_SECRET`
   - `NEXT_PUBLIC_PUSHER_KEY`
   - `NEXT_PUBLIC_PUSHER_CLUSTER`

### 5. Restart Your Development Server
```bash
npm run dev
```

## How It Works

### Channels
- **Client Channel**: `client-{clientId}` - Each client subscribes to their own channel
- **Developer Inbox Channel**: `developer-inbox` - All developers subscribe to this for inbox updates

### Events
- **`new-message`**: Triggered when a new message is sent (to client-specific channel)
- **`conversation-updated`**: Triggered when a conversation is updated (to developer-inbox channel)
- **`messages-read`**: Triggered when developer reads messages (to client channel)

### Benefits Over Polling
- ✅ Instant message delivery (no 2-5 second delay)
- ✅ Lower server load (no constant polling)
- ✅ Better battery life on mobile devices
- ✅ Real-time updates across all connected clients
- ✅ Automatic reconnection on network issues

## Troubleshooting

### Messages Not Appearing
1. Check browser console for Pusher connection errors
2. Verify all environment variables are set correctly
3. Check Pusher dashboard for connection status
4. Ensure your Pusher app is not paused (free tier has limits)

### Connection Issues
- Check that `NEXT_PUBLIC_PUSHER_CLUSTER` matches your Pusher app's cluster
- Verify your Pusher app is active (not paused)
- Check network/firewall settings

### Fallback Behavior
If Pusher fails to initialize, the system will log an error but won't crash. However, messages won't update in real-time. You may need to refresh the page.

## Pusher Free Tier Limits
- 200,000 messages per day
- 100 concurrent connections
- 20 channels per app

For production use, consider upgrading if you exceed these limits.

