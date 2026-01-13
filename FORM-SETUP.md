# Form Setup Guide

✅ **SETUP COMPLETE!** Your form is configured and ready to use.

## Current Configuration

- ✅ Resend API key configured
- ✅ API route created at `/app/api/contact/route.ts`
- ✅ Form connected to API
- ✅ Environment variables set up locally

## Next Steps for Production (Vercel)

Add these environment variables in Vercel Dashboard:
1. Go to your Vercel project → Settings → Environment Variables
2. Add:
   - `RESEND_API_KEY` = `re_PtrPxqAt_Gjn9ie3c7S3fpwpQxjfnMNmQ`
   - `FROM_EMAIL` = `onboarding@resend.dev` (or your verified domain email)
   - `TO_EMAIL` = `contact@aiwebdesignfirm.com` (or your preferred email)
3. Select all environments (Production, Preview, Development)
4. Redeploy your site

## Testing

The form is ready to test! Submit a form and check your email inbox.

---

## Alternative Options (if needed)

Your form is now set up to work with your Vercel server using a Next.js API route. You have two options:

## Option 1: Resend (Recommended - Easiest)

Resend is a modern email API that's easy to set up and has a generous free tier.

### Setup Steps:

1. **Install Resend package:**
   ```bash
   npm install resend
   ```

2. **Get your Resend API key:**
   - Go to https://resend.com
   - Sign up for a free account
   - Navigate to API Keys section
   - Create a new API key
   - Copy the key (starts with `re_`)

3. **Add environment variables:**
   
   **Local development (.env.local):**
   ```
   RESEND_API_KEY=re_your_api_key_here
   FROM_EMAIL=noreply@yourdomain.com
   TO_EMAIL=your-email@example.com
   ```
   
   **Vercel (Project Settings → Environment Variables):**
   - Add `RESEND_API_KEY` with your API key
   - Add `FROM_EMAIL` with your verified domain email (or use `onboarding@resend.dev` for testing)
   - Add `TO_EMAIL` with the email where you want to receive form submissions
   - Select all environments (Production, Preview, Development)

4. **Verify your domain (for production):**
   - In Resend dashboard, go to Domains
   - Add your domain (e.g., `aiwebdesignfirm.com`)
   - Add the DNS records they provide to your domain registrar
   - Once verified, update `FROM_EMAIL` to use your domain

### Resend Free Tier:
- 3,000 emails/month
- 100 emails/day
- Perfect for form submissions

---

## Option 2: Nodemailer with SMTP (Gmail, SendGrid, etc.)

If you prefer to use Gmail, SendGrid, or another SMTP service:

### Setup Steps:

1. **Install Nodemailer:**
   ```bash
   npm install nodemailer
   npm install --save-dev @types/nodemailer
   ```

2. **For Gmail:**
   - Enable 2-factor authentication
   - Generate an "App Password" (not your regular password)
   - Use these settings:
     ```
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_USER=your-email@gmail.com
     SMTP_PASS=your-app-password
     TO_EMAIL=your-email@example.com
     ```

3. **For SendGrid:**
   - Sign up at https://sendgrid.com
   - Create an API key
   - Use these settings:
     ```
     SMTP_HOST=smtp.sendgrid.net
     SMTP_PORT=587
     SMTP_USER=apikey
     SMTP_PASS=your-sendgrid-api-key
     TO_EMAIL=your-email@example.com
     ```

4. **Uncomment the Nodemailer code in `app/api/contact/route.ts`** and comment out the Resend section

5. **Add environment variables** to `.env.local` and Vercel

---

## Testing

1. **Local testing:**
   - Make sure your `.env.local` file has the required variables
   - Restart your dev server: `npm run dev`
   - Submit the form and check your email

2. **Production testing:**
   - Deploy to Vercel
   - Make sure environment variables are set in Vercel dashboard
   - Submit the form on your live site
   - Check your email inbox

---

## Current Status

✅ API route created at `/app/api/contact/route.ts`
✅ Form updated to submit to the API
✅ Basic validation in place
✅ Error handling implemented

⚠️ **Next Steps:**
1. Choose an email service (Resend recommended)
2. Install the package
3. Add environment variables
4. Test the form

---

## Troubleshooting

**Form not submitting?**
- Check browser console for errors
- Verify API route is accessible at `/api/contact`
- Check Vercel function logs

**Emails not sending?**
- Verify API keys are correct
- Check spam folder
- Verify domain is verified (for Resend)
- Check email service dashboard for errors

**Getting CORS errors?**
- Next.js API routes handle CORS automatically
- If issues persist, check Vercel configuration

---

## Security Notes

✅ API key is stored in environment variables (secure)
✅ API route runs server-side only
✅ Form validation prevents spam
✅ Rate limiting can be added if needed

For production, consider adding:
- Rate limiting (prevent spam)
- reCAPTCHA (prevent bots)
- Form validation on server-side (already done)

