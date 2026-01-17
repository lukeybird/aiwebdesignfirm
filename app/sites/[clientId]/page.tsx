import { sql } from '@/lib/db';

export default async function ClientSitePage({
  params,
}: {
  params: { clientId: string };
}) {
  try {
    const clientId = parseInt(params.clientId);

    const websites = await sql`
      SELECT site_data
      FROM client_websites
      WHERE client_id = ${clientId}
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (websites.length === 0) {
      return (
        <html>
          <head>
            <title>Website Not Found</title>
            <style>{`
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
            `}</style>
          </head>
          <body>
            <div>
              <h1>Website Not Found</h1>
              <p>This website has not been created yet.</p>
            </div>
          </body>
        </html>
      );
    }

    const websiteData = websites[0].site_data;
    const htmlCode = websiteData.html || '';

    // Render the generated HTML
    return (
      <div dangerouslySetInnerHTML={{ __html: htmlCode }} />
    );
  } catch (error) {
    return (
      <html>
        <head>
          <title>Error</title>
        </head>
        <body>
          <h1>Error loading website</h1>
        </body>
      </html>
    );
  }
}

