import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, prompt, clientInfo, files, websiteNotes } = body;

    if (!clientId || !prompt) {
      return NextResponse.json(
        { error: 'Client ID and prompt are required' },
        { status: 400 }
      );
    }

    // Get client info if not provided
    let clientData = clientInfo;
    if (!clientData) {
      const clients = await sql`
        SELECT id, email, full_name, phone, business_name, business_address, business_website, website_notes
        FROM clients
        WHERE id = ${clientId}
      `;
      clientData = clients[0];
    }

    // Get client files if not provided
    let clientFiles = files;
    if (!clientFiles) {
      const filesData = await sql`
        SELECT blob_url, file_name, file_type
        FROM client_files
        WHERE client_id = ${clientId}
        ORDER BY uploaded_at DESC
      `;
      clientFiles = filesData;
    }

    // Build context for Claude
    const contextPrompt = `
Create a professional website for ${clientData.business_name || clientData.full_name}.

Business Details:
- Business Name: ${clientData.business_name || 'Not specified'}
- Owner Name: ${clientData.full_name}
- Address: ${clientData.business_address || 'Not specified'}
- Email: ${clientData.email}
- Phone: ${clientData.phone || 'Not specified'}

Available Assets:
${clientFiles.length > 0 
  ? clientFiles.map((f: any) => `- ${f.file_name} (${f.file_type}) - URL: ${f.blob_url}`).join('\n')
  : '- No files uploaded yet'
}

Client Notes/Requirements:
${websiteNotes || clientData.website_notes || 'No specific notes provided'}

Developer Instructions:
${prompt}

Design Requirements:
- Dark theme with cyan accents (matching the AI Web Design Firm aesthetic)
- Modern, professional layout
- Fully responsive design (mobile, tablet, desktop)
- Use the uploaded images in a gallery or hero section
- Include contact information
- Professional typography
- Smooth animations and transitions

Generate complete, production-ready HTML, CSS, and JavaScript code.
The HTML should be a complete, standalone file that can be served directly.
Include all CSS in a <style> tag and all JavaScript in a <script> tag.
Make sure all image URLs from the assets are properly referenced.
`;

    // Check if API key is configured
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      console.error('CLAUDE_API_KEY is not set in environment variables');
      return NextResponse.json(
        { error: 'Claude API key is not configured. Please add CLAUDE_API_KEY to your environment variables.' },
        { status: 500 }
      );
    }

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 16000,
        messages: [{
          role: 'user',
          content: contextPrompt
        }]
      })
    });

    if (!claudeResponse.ok) {
      let errorData;
      try {
        errorData = await claudeResponse.json();
      } catch (e) {
        errorData = { message: await claudeResponse.text() };
      }
      console.error('Claude API error:', {
        status: claudeResponse.status,
        statusText: claudeResponse.statusText,
        error: errorData
      });
      return NextResponse.json(
        { 
          error: `Failed to generate website: ${errorData.error?.message || errorData.message || 'Unknown error'}`,
          details: errorData,
          status: claudeResponse.status
        },
        { status: claudeResponse.status }
      );
    }

    const claudeData = await claudeResponse.json();
    
    if (!claudeData.content || !claudeData.content[0] || !claudeData.content[0].text) {
      console.error('Invalid Claude API response:', claudeData);
      return NextResponse.json(
        { error: 'Invalid response from Claude API', details: claudeData },
        { status: 500 }
      );
    }
    
    const generatedCode = claudeData.content[0].text;

    // Extract HTML, CSS, and JS from the response
    // Claude might return markdown code blocks, so we need to parse it
    let htmlCode = generatedCode;
    
    // Try to extract code from markdown code blocks if present
    const htmlMatch = generatedCode.match(/```html\n([\s\S]*?)```/);
    const cssMatch = generatedCode.match(/```css\n([\s\S]*?)```/);
    const jsMatch = generatedCode.match(/```javascript\n([\s\S]*?)```/) || generatedCode.match(/```js\n([\s\S]*?)```/);
    
    if (htmlMatch) {
      htmlCode = htmlMatch[1];
    } else if (generatedCode.includes('<!DOCTYPE html>') || generatedCode.includes('<html>')) {
      // If it's already HTML, use it directly
      htmlCode = generatedCode;
    }

    // Store the generated website
    const siteUrl = `/sites/${clientId}`;
    
    const websiteData = {
      html: htmlCode,
      css: cssMatch ? cssMatch[1] : '',
      js: jsMatch ? jsMatch[1] : '',
      generated_at: new Date().toISOString(),
      prompt_used: prompt
    };

    // Check if website already exists for this client
    const existing = await sql`
      SELECT id FROM client_websites WHERE client_id = ${clientId}
    `;

    if (existing.length > 0) {
      // Update existing website
      await sql`
        UPDATE client_websites
        SET site_data = ${JSON.stringify(websiteData)}::jsonb,
            site_url = ${siteUrl},
            prompt_used = ${prompt},
            updated_at = CURRENT_TIMESTAMP
        WHERE client_id = ${clientId}
      `;
    } else {
      // Create new website
      await sql`
        INSERT INTO client_websites (client_id, site_url, site_data, prompt_used, status)
        VALUES (${clientId}, ${siteUrl}, ${JSON.stringify(websiteData)}::jsonb, ${prompt}, 'published')
      `;
    }

    // Auto-update business_website in clients table
    await sql`
      UPDATE clients
      SET business_website = ${siteUrl}
      WHERE id = ${clientId}
    `;

    return NextResponse.json({
      success: true,
      website: {
        url: siteUrl,
        code: htmlCode,
        data: websiteData
      }
    });

  } catch (error: any) {
    console.error('Error generating website:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate website' },
      { status: 500 }
    );
  }
}

