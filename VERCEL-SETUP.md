# Vercel Database Setup Guide

This guide will help you set up Neon Postgres (via Vercel Marketplace) and Vercel Blob storage for your application.

## Step 1: Create Neon Postgres Database

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project
3. Go to the **Storage** tab
4. Click on **Marketplace Database Providers**
5. Select **Neon** (Serverless Postgres)
6. Follow the setup wizard to create your Neon database
7. Note your database name (e.g., `thedatabase` or `neondb`)

## Step 2: Get Neon Connection String

1. After creating the Neon database, you'll get connection details
2. Copy the **POSTGRES_URL** connection string
   - It looks like: `postgresql://user:password@host/database?sslmode=require`
   - Use the **pooled** connection string (with `-pooler` in the hostname) for better performance

## Step 3: Add Environment Variable to Vercel

1. In Vercel dashboard, go to your project
2. Go to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name**: `POSTGRES_URL`
   - **Value**: (paste your Neon connection string)
   - **Environment**: Production, Preview, Development (select all)
4. Click **Save**

## Step 4: Create Vercel Blob Storage

1. In the **Storage** tab
2. Click **Create Database**
3. Select **Blob**
4. Choose a name (e.g., `aiwebdesignfirm-blob`)
5. Click **Create**

## Step 5: Initialize the Database

After setting up the connection string, you need to initialize the tables:

1. Deploy your application to Vercel
2. Visit `https://your-domain.com/api/db/init` in your browser
3. This will automatically create all the required tables

Alternatively, you can run the SQL manually in the Neon dashboard:

```sql
-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  business_name VARCHAR(255),
  business_address TEXT,
  business_website VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  listing_link TEXT NOT NULL,
  business_phone VARCHAR(50),
  business_name VARCHAR(255),
  business_email VARCHAR(255),
  business_address TEXT,
  owner_first_name VARCHAR(255),
  owner_phone VARCHAR(50),
  has_logo INTEGER,
  has_good_photos INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notes table (for leads)
CREATE TABLE IF NOT EXISTS lead_notes (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create client_files table (metadata only, actual files in Blob)
CREATE TABLE IF NOT EXISTS client_files (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  blob_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Alternatively, you can visit `/api/db/init` in your browser after deployment to automatically initialize the database.

## Step 6: Environment Variables

You need to manually add the Neon connection string:

- `POSTGRES_URL` - Your Neon connection string (you added this in Step 3)
- `BLOB_READ_WRITE_TOKEN` - Automatically set by Vercel when you create Blob storage

**Important**: Make sure `POSTGRES_URL` is set in all environments (Production, Preview, Development).

## Step 7: Deploy

1. Push your changes to GitHub
2. Vercel will automatically deploy
3. After deployment, visit `https://your-domain.com/api/db/init` to initialize the database tables

## Migration from localStorage

All data is now stored on Neon's servers (via Vercel):
- **Client accounts** → Neon Postgres
- **Leads and notes** → Neon Postgres  
- **Client files** → Vercel Blob (with metadata in Neon Postgres)

Your existing localStorage data will not be automatically migrated. You'll need to:
1. Create new client accounts (they'll be stored in Postgres)
2. Create new leads (they'll be stored in Postgres)
3. Upload files again (they'll be stored in Blob)

## Troubleshooting

### Database connection errors
- Make sure you've created the Neon database via Vercel Marketplace
- Check that `POSTGRES_URL` environment variable is set in Vercel
- Verify the connection string includes `?sslmode=require` at the end
- Make sure you're using the pooled connection string (with `-pooler` in hostname)

### Blob upload errors
- Make sure you've created the Blob storage in Vercel
- Check that `BLOB_READ_WRITE_TOKEN` is available (should be automatic)

### Table initialization errors
- Visit `/api/db/init` after deployment
- Or manually run the SQL in the Vercel dashboard Query tab

