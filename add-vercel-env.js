#!/usr/bin/env node

/**
 * Quick script to help add Vercel environment variables
 * Run: node add-vercel-env.js
 */

const variables = {
  RESEND_API_KEY: 're_PtrPxqAt_Gjn9ie3c7S3fpwpQxjfnMNmQ',
  FROM_EMAIL: 'onboarding@resend.dev',
  TO_EMAIL: 'contact@aiwebdesignfirm.com'
};

console.log('\n📋 Vercel Environment Variables to Add:\n');
console.log('Copy and paste these into Vercel Dashboard → Settings → Environment Variables\n');

Object.entries(variables).forEach(([key, value]) => {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Key:   ${key}`);
  console.log(`Value: ${value}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});

console.log('✅ Make sure to enable for: Production, Preview, and Development\n');
console.log('🔗 Direct link: https://vercel.com/dashboard\n');

