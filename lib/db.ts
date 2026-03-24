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
        instruction_1_completed BOOLEAN DEFAULT FALSE,
        instruction_2_completed BOOLEAN DEFAULT FALSE,
        instruction_3_completed BOOLEAN DEFAULT FALSE,
        website_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add new columns if they don't exist (for existing databases)
    try {
      const columnsToAdd = [
        { name: 'instruction_1_completed', type: 'BOOLEAN DEFAULT FALSE' },
        { name: 'instruction_2_completed', type: 'BOOLEAN DEFAULT FALSE' },
        { name: 'instruction_3_completed', type: 'BOOLEAN DEFAULT FALSE' },
        { name: 'website_notes', type: 'TEXT' },
      ];

      for (const column of columnsToAdd) {
        const columnCheck = await sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = ${column.name}
        `;
        
        if (columnCheck.length === 0) {
          await sql.unsafe(`ALTER TABLE clients ADD COLUMN ${column.name} ${column.type}`);
          console.log(`✓ Added ${column.name} column to clients table`);
        }
      }
    } catch (error: any) {
      console.error('Error adding columns to clients table:', error);
    }

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
        WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'website_link'
      `;
      
      // If column doesn't exist, add it
      if (columnCheck.length === 0) {
        await sql`ALTER TABLE leads ADD COLUMN website_link TEXT`;
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
        // Try to add it anyway - PostgreSQL will error if it already exists, but that's okay
        try {
          await sql`ALTER TABLE leads ADD COLUMN website_link TEXT`;
          console.log('✓ Added website_link column (retry succeeded)');
        } catch (retryError: any) {
          if (retryError.message && retryError.message.includes('already exists')) {
            console.log('✓ website_link column already exists (caught on retry)');
          } else {
            console.error('Error on retry:', retryError);
          }
        }
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

    // Create client_websites table for storing generated websites
    await sql`
      CREATE TABLE IF NOT EXISTS client_websites (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        site_url VARCHAR(255),
        site_data JSONB,
        prompt_used TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add client_websites columns if they don't exist (for existing databases)
    try {
      const columnsToAdd = [
        { name: 'site_url', type: 'VARCHAR(255)' },
        { name: 'site_data', type: 'JSONB' },
        { name: 'prompt_used', type: 'TEXT' },
        { name: 'status', type: "VARCHAR(50) DEFAULT 'draft'" },
        { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
      ];

      for (const column of columnsToAdd) {
        const columnCheck = await sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'client_websites' AND column_name = ${column.name}
        `;
        
        if (columnCheck.length === 0) {
          await sql.unsafe(`ALTER TABLE client_websites ADD COLUMN ${column.name} ${column.type}`);
          console.log(`✓ Added ${column.name} column to client_websites table`);
        }
      }
    } catch (error: any) {
      console.error('Error adding columns to client_websites table:', error);
    }

    // Device status (for /test page - single row, latest status)
    await sql`
      CREATE TABLE IF NOT EXISTS device_status (
        id SERIAL PRIMARY KEY,
        status BOOLEAN NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Idea HTML files (for /ideas page) - content stored in DB so no Blob required
    await sql`
      CREATE TABLE IF NOT EXISTS idea_files (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        content TEXT NOT NULL,
        blob_url TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    // Migration: add content column if table existed with old schema (blob_url)
    try {
      const col = await sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'idea_files' AND column_name = 'content'
      `;
      if (col.length === 0) {
        await sql`ALTER TABLE idea_files ADD COLUMN content TEXT`;
        console.log('✓ Added content column to idea_files');
      }
      // Allow inserts with only filename+content (make blob_url/file_size nullable if present)
      for (const c of ['blob_url', 'file_size']) {
        const exists = await sql`
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'idea_files' AND column_name = ${c}
        `;
        if (exists.length > 0) {
          await sql.unsafe(`ALTER TABLE idea_files ALTER COLUMN ${c} DROP NOT NULL`);
        }
      }
    } catch (_) {}

    // Idea projects (folder upload → /ideas/slug/...)
    await sql`
      CREATE TABLE IF NOT EXISTS idea_projects (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(128) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS idea_project_files (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES idea_projects(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        mime_type VARCHAR(128),
        is_binary BOOLEAN DEFAULT FALSE,
        UNIQUE (project_id, file_path)
      )
    `;
    try {
      const col = await sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'idea_projects' AND column_name = 'live_link'
      `;
      if (col.length === 0) {
        await sql`ALTER TABLE idea_projects ADD COLUMN live_link TEXT`;
        console.log('✓ Added live_link to idea_projects');
      }
    } catch (_) {}

    // Marine app: boat owners (subscription-based remote monitoring)
    await sql`
      CREATE TABLE IF NOT EXISTS marine_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        subscription_status VARCHAR(50) DEFAULT 'inactive',
        subscription_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS marine_devices (
        id SERIAL PRIMARY KEY,
        marine_user_id INTEGER NOT NULL REFERENCES marine_users(id) ON DELETE CASCADE,
        device_id VARCHAR(64) UNIQUE NOT NULL,
        auth_token VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL DEFAULT 'My Boat',
        last_float_status VARCHAR(32),
        last_activity_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS marine_events (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(64) NOT NULL,
        event_type VARCHAR(64) NOT NULL,
        payload JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

