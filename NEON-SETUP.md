# Quick Neon Setup Guide

## Your Neon Database Details
- **Database Name**: `neondb` (or `thedatabase`)
- **Region**: Washington, D.C., USA (East) - iad1
- **Plan**: Free tier (0.5 GB storage, 120 CU-hours)

## Connection String to Add to Vercel

Add this to Vercel → Settings → Environment Variables:

**Variable Name**: `POSTGRES_URL`

**Variable Value**:
```
postgresql://neondb_owner:npg_JraY28zomIGB@ep-steep-lake-ahrwis4q-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

**Important**: 
- Select all environments (Production, Preview, Development)
- Use the pooled connection string (with `-pooler`) for better performance

## After Adding the Environment Variable

1. **Redeploy** your Vercel project (or wait for auto-deploy)
2. Visit `https://your-domain.com/api/db/init` to initialize the database tables
3. Your app is now ready to use!

## What Gets Stored Where

- **Neon Postgres**: Client accounts, leads, notes, file metadata
- **Vercel Blob**: Actual uploaded files (images, documents)

