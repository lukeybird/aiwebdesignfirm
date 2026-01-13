# Vercel Database Setup Guide

This guide will help you set up Vercel Postgres and Blob storage for your application.

## Step 1: Create Vercel Postgres Database

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project
3. Go to the **Storage** tab
4. Click **Create Database**
5. Select **Postgres**
6. Choose a name for your database (e.g., `aiwebdesignfirm-db`)
7. Select a region closest to your users
8. Click **Create**

## Step 2: Create Vercel Blob Storage

1. In the same **Storage** tab
2. Click **Create Database** again
3. Select **Blob**
4. Choose a name (e.g., `aiwebdesignfirm-blob`)
5. Click **Create**

## Step 3: Initialize the Database

After creating the Postgres database, you need to initialize the tables:

1. In Vercel dashboard, go to your project's **Storage** tab
2. Click on your Postgres database
3. Go to the **Query** tab
4. Run the following SQL to create the tables:

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

## Step 4: Environment Variables

Vercel automatically sets up environment variables for your Postgres and Blob storage. These are automatically available in your API routes:

- `POSTGRES_URL` - Connection string for Postgres
- `POSTGRES_PRISMA_URL` - Prisma connection string
- `POSTGRES_URL_NON_POOLING` - Non-pooling connection string
- `BLOB_READ_WRITE_TOKEN` - Token for Blob storage

**No manual configuration needed!** Vercel automatically injects these when you create the storage resources.

## Step 5: Deploy

1. Push your changes to GitHub
2. Vercel will automatically deploy
3. After deployment, visit `https://your-domain.com/api/db/init` to initialize the database tables

## Migration from localStorage

All data is now stored on Vercel's servers:
- **Client accounts** → Vercel Postgres
- **Leads and notes** → Vercel Postgres  
- **Client files** → Vercel Blob (with metadata in Postgres)

Your existing localStorage data will not be automatically migrated. You'll need to:
1. Create new client accounts (they'll be stored in Postgres)
2. Create new leads (they'll be stored in Postgres)
3. Upload files again (they'll be stored in Blob)

## Troubleshooting

### Database connection errors
- Make sure you've created the Postgres database in Vercel
- Check that environment variables are set (they should be automatic)
- Verify the database region matches your deployment region

### Blob upload errors
- Make sure you've created the Blob storage in Vercel
- Check that `BLOB_READ_WRITE_TOKEN` is available (should be automatic)

### Table initialization errors
- Visit `/api/db/init` after deployment
- Or manually run the SQL in the Vercel dashboard Query tab

