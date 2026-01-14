# Add Pusher Credentials to Vercel

## Quick Setup

Your Pusher credentials are already configured locally. Now add them to Vercel for production:

### Steps:

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your project (`aiwebdesignfirm`)
3. Go to **Settings** → **Environment Variables**
4. Add these 4 variables:

| Variable Name | Value |
|--------------|-------|
| `PUSHER_APP_ID` | `2102232` |
| `PUSHER_SECRET` | `c7e9f18f7cf1a977873b` |
| `NEXT_PUBLIC_PUSHER_KEY` | `930f7c1420bd00b25f4d` |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | `us2` |

5. Make sure to select **all environments** (Production, Preview, Development)
6. Click **Save**
7. **Redeploy** your application (or wait for the next deployment)

## After Adding Variables

Once you've added the variables to Vercel and redeployed, the chat system will use WebSockets for real-time updates instead of polling.

## Test It

1. Open the client dashboard and open the chat
2. Open the developer support page
3. Send a message from either side
4. It should appear instantly on the other side (no 2-5 second delay)

## Troubleshooting

If messages don't appear in real-time:
- Check browser console for Pusher connection errors
- Verify all 4 environment variables are set in Vercel
- Make sure you redeployed after adding the variables
- Check that your Pusher app is active (not paused) in the Pusher dashboard

