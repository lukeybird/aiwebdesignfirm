import postgres from 'postgres';

// Get connection string from environment variable
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('POSTGRES_URL or DATABASE_URL environment variable is required');
}

// Create postgres client
export const sql = postgres(connectionString, {
  ssl: 'require',
});

// Initialize database tables
export async function initDatabase() {
  try {
    // Create clients table
    await sql`
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
      )
    `;

    // Create leads table
    await sql`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        listing_link TEXT NOT NULL,
        website_link TEXT,
        business_phone VARCHAR(50),
        business_name VARCHAR(255),
        business_email VARCHAR(255),
        business_address TEXT,
        owner_first_name VARCHAR(255),
        owner_phone VARCHAR(50),
        has_logo INTEGER,
        has_good_photos INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add website_link column if it doesn't exist (for existing databases)
    // This handles the case where the table was created before website_link was added
    try {
      // Check if the column exists
      const columnCheck = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'website_link'
      `;
      
      // If column doesn't exist, add it
      if (columnCheck.length === 0) {
        await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS website_link TEXT`;
        console.log('✓ Added website_link column to leads table');
      } else {
        console.log('✓ website_link column already exists');
      }
    } catch (error: any) {
      // If the error is that the table doesn't exist, that's fine - it will be created above
      if (error.message && error.message.includes('does not exist')) {
        console.log('Leads table does not exist yet, will be created with website_link column');
      } else {
        console.error('Error checking/adding website_link column:', error);
        // Don't throw - the table creation above should handle it
      }
    }

    // Create notes table (for leads)
    await sql`
      CREATE TABLE IF NOT EXISTS lead_notes (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create client_files table (metadata only, actual files in Blob)
    await sql`
      CREATE TABLE IF NOT EXISTS client_files (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        blob_url TEXT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_size BIGINT NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create messages table for client-developer chat
    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('client', 'developer')),
        message_text TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

