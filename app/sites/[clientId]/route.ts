import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId: clientIdParam } = await params;
    const clientId = parseInt(clientIdParam);

    const websites = await sql`
      SELECT site_data
      FROM client_websites
      WHERE client_id = ${clientId}
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (websites.length === 0) {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Website Not Found</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
  </style>
</head>
<body>
  <div>
    <h1>Website Not Found</h1>
    <p>This website has not been created yet.</p>
  </div>
</body>
</html>
      `;
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const websiteData = websites[0].site_data;
    const htmlCode = websiteData.html || '';
    
    console.log('=== SERVING WEBSITE ===');
    console.log('Client ID:', clientId);
    console.log('Website data keys:', Object.keys(websiteData));
    console.log('HTML code length:', htmlCode.length);
    console.log('HTML code starts with:', htmlCode.substring(0, 200));
    
    if (!htmlCode || htmlCode.trim().length === 0) {
      console.error('⚠️ HTML code is empty!');
      const errorHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Error - Empty Website</title>
  <style>
    body { margin: 0; padding: 0; background: #000; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  </style>
</head>
<body>
  <div>
    <h1>Website Error</h1>
    <p>The website HTML is empty. Please regenerate the website.</p>
    <p>Website data structure: ${JSON.stringify(Object.keys(websiteData))}</p>
  </div>
</body>
</html>
      `;
      return new NextResponse(errorHtml, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    return new NextResponse(htmlCode, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Error</title>
</head>
<body>
  <h1>Error loading website</h1>
</body>
</html>
    `;
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
      status: 500,
    });
  }
}

