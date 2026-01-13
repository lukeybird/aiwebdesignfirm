#!/bin/bash

# Script to add environment variables to Vercel
# This requires Vercel CLI to be installed and you to be logged in

echo "Setting up Vercel environment variables..."

# Check if vercel CLI is available
if ! command -v vercel &> /dev/null; then
    echo "Vercel CLI not found. Installing..."
    npm install -g vercel@latest
fi

# Add environment variables
echo "Adding RESEND_API_KEY..."
vercel env add RESEND_API_KEY production preview development <<< "re_PtrPxqAt_Gjn9ie3c7S3fpwpQxjfnMNmQ"

echo "Adding FROM_EMAIL..."
vercel env add FROM_EMAIL production preview development <<< "onboarding@resend.dev"

echo "Adding TO_EMAIL..."
vercel env add TO_EMAIL production preview development <<< "contact@aiwebdesignfirm.com"

echo ""
echo "✅ Environment variables added!"
echo "You may need to redeploy your site for changes to take effect."
echo "Run: vercel --prod"

