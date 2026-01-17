# Website Generation Flow - How It Works

## Complete Flow:

1. **Developer Interface** (`/developer/websites/[clientId]`)
   - Developer enters a prompt
   - Clicks "Generate Website with Claude"
   - Frontend sends request to `/api/websites/generate`

2. **API Route** (`/api/websites/generate`)
   - Receives: clientId, prompt, clientInfo, files, websiteNotes
   - Fetches client data from database if not provided
   - Fetches client files (images) from database
   - Builds a detailed prompt with all client information
   - **Calls Claude API** with the prompt
   - Claude generates HTML code
   - Extracts HTML from Claude's response
   - **Saves to database**: `client_websites` table
     - `site_data` (JSONB): Contains { html, css, js, generated_at, prompt_used }
     - `site_url`: `/sites/${clientId}`
   - **Updates client account**: Sets `business_website` = `/sites/${clientId}`
   - Returns success response

3. **Website Serving** (`/sites/[clientId]`)
   - When someone visits `/sites/5` (for client ID 5)
   - Route handler fetches website from `client_websites` table
   - Returns the HTML code directly
   - Browser renders the HTML

## Database Storage:

- **Table**: `client_websites`
- **Columns**:
  - `id`: Primary key
  - `client_id`: Links to client
  - `site_url`: `/sites/${clientId}`
  - `site_data`: JSONB containing { html, css, js, generated_at, prompt_used }
  - `prompt_used`: The prompt that generated it
  - `status`: 'draft' or 'published'
  - `created_at`, `updated_at`: Timestamps

## Current Issues to Debug:

1. Is Claude actually generating code?
2. Is the HTML being extracted correctly?
3. Is it being saved to the database?
4. Is the route serving it correctly?

