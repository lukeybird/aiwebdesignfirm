import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { pusher } from '@/lib/pusher';

// GET - Get messages for a specific client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    const messages = await sql`
      SELECT 
        id,
        client_id,
        sender_type,
        message_text,
        is_read,
        created_at
      FROM messages
      WHERE client_id = ${clientId}
      ORDER BY created_at ASC
    `;

    // Mark messages as read when developer views them
    await sql`
      UPDATE messages
      SET is_read = TRUE
      WHERE client_id = ${clientId} AND sender_type = 'client' AND is_read = FALSE
    `;

    // Trigger Pusher event to notify client that messages were read
    try {
      await pusher.trigger(`client-${clientId}`, 'messages-read', {
        clientId: clientId
      });
    } catch (error) {
      console.error('Pusher error:', error);
    }

    return NextResponse.json({ messages });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

