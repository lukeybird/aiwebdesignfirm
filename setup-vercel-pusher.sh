#!/bin/bash

# Script to add Pusher environment variables to Vercel
# Run this script after logging into Vercel CLI

echo "Adding Pusher environment variables to Vercel..."

# Add environment variables
vercel env add PUSHER_APP_ID production <<< "2102232"
vercel env add PUSHER_APP_ID preview <<< "2102232"
vercel env add PUSHER_APP_ID development <<< "2102232"

vercel env add PUSHER_SECRET production <<< "c7e9f18f7cf1a977873b"
vercel env add PUSHER_SECRET preview <<< "c7e9f18f7cf1a977873b"
vercel env add PUSHER_SECRET development <<< "c7e9f18f7cf1a977873b"

vercel env add NEXT_PUBLIC_PUSHER_KEY production <<< "930f7c1420bd00b25f4d"
vercel env add NEXT_PUBLIC_PUSHER_KEY preview <<< "930f7c1420bd00b25f4d"
vercel env add NEXT_PUBLIC_PUSHER_KEY development <<< "930f7c1420bd00b25f4d"

vercel env add NEXT_PUBLIC_PUSHER_CLUSTER production <<< "us2"
vercel env add NEXT_PUBLIC_PUSHER_CLUSTER preview <<< "us2"
vercel env add NEXT_PUBLIC_PUSHER_CLUSTER development <<< "us2"

echo "✅ All Pusher environment variables added to Vercel!"
echo "You may need to redeploy your application for changes to take effect."

