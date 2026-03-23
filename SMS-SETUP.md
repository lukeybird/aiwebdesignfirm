# SMS Setup Guide - Twilio Integration

## Overview
This application uses **Twilio** for sending bulk SMS messages to clients. Twilio is the industry standard for SMS services with reliable delivery and excellent developer experience.

## Why Twilio?
- ✅ Industry standard with 99.99% uptime
- ✅ Simple Next.js integration
- ✅ Pay-per-message pricing (~$0.0075-$0.01 per SMS in US)
- ✅ Excellent documentation
- ✅ Free trial credit ($15.50)
- ✅ Supports US and international numbers

## Setup Instructions

### 1. Create a Twilio Account
1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up for a free account (includes $15.50 trial credit)
3. Verify your phone number

### 2. Get Your Twilio Credentials
1. Log in to the [Twilio Console](https://console.twilio.com)
2. Go to **Account** → **API Keys & Tokens**
3. Copy your **Account SID** and **Auth Token**

### 3. Get a Phone Number
1. In the Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a number**
2. Select a US phone number (or your preferred country)
3. Complete the purchase (free with trial account)
4. Copy the phone number (format: +1234567890)

### 4. Add Environment Variables
Add these to your `.env.local` file (for local development) and Vercel environment variables (for production):

```bash
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

**For Vercel:**
1. Go to your project in Vercel Dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`

### 5. Restart Your Development Server
After adding environment variables, restart your Next.js dev server:
```bash
npm run dev
```

## Usage

### Sending Bulk SMS
1. Navigate to **Developer** → **Clients**
2. Click the **"📱 Send Bulk SMS"** button
3. Enter your message (max 1600 characters)
4. Click **"Send to X Clients"**
5. The system will automatically:
   - Filter clients with valid phone numbers
   - Format phone numbers correctly
   - Send SMS to each client
   - Show results (successful/failed)

### Phone Number Validation
The system automatically:
- Validates phone numbers (10 digits, 11 digits starting with 1, or international format with +)
- Formats numbers correctly for Twilio
- Filters out invalid numbers
- Shows how many clients will receive the message

## Pricing
- **US SMS**: ~$0.0075 per message
- **International SMS**: Varies by country (check Twilio pricing)
- **Free Trial**: $15.50 credit (enough for ~2,000 US SMS)

## Troubleshooting

### "Twilio is not configured" Error
- Make sure all three environment variables are set
- Restart your development server after adding variables
- Check that variable names match exactly (case-sensitive)

### "No valid phone numbers found"
- Ensure clients have phone numbers in their account info
- Phone numbers must be in valid format (10 digits, 11 digits starting with 1, or international with +)

### Messages Not Sending
- Check your Twilio account balance
- Verify your Twilio phone number is active
- Check Twilio Console for error logs
- Ensure phone numbers are in E.164 format (+1234567890)

## Security Notes
- ⚠️ **Never commit** `.env.local` to git
- ⚠️ Keep your **Auth Token** secret
- ⚠️ Use environment variables, never hardcode credentials
- ✅ The API route validates all inputs before sending

## Support
- [Twilio Documentation](https://www.twilio.com/docs)
- [Twilio Support](https://support.twilio.com)
- [Twilio Console](https://console.twilio.com)

