import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { pusher } from '@/lib/pusher';

// GET - Get messages for a client or all messages for developer
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (clientId) {
      // Get messages for specific client
      const messages = await sql`
        SELECT 
          m.*,
          c.full_name as client_name,
          c.email as client_email
        FROM messages m
        JOIN clients c ON m.client_id = c.id
        WHERE m.client_id = ${clientId}
        ORDER BY m.created_at ASC
      `;

      return NextResponse.json({ messages });
    } else {
      // Get all messages grouped by client (for developer inbox)
      const messages = await sql`
        SELECT 
          m.*,
          c.full_name as client_name,
          c.email as client_email,
          c.id as client_id
        FROM messages m
        JOIN clients c ON m.client_id = c.id
        ORDER BY m.created_at DESC
      `;

      // Group messages by client
      const clientMap = new Map();
      messages.forEach((msg: any) => {
        if (!clientMap.has(msg.client_id)) {
          clientMap.set(msg.client_id, {
            clientId: msg.client_id,
            clientName: msg.client_name,
            clientEmail: msg.client_email,
            messages: [],
            lastMessageAt: msg.created_at,
            unreadCount: 0
          });
        }
        const client = clientMap.get(msg.client_id);
        client.messages.push({
          id: msg.id,
          senderType: msg.sender_type,
          messageText: msg.message_text,
          isRead: msg.is_read,
          createdAt: msg.created_at
        });
        if (!msg.is_read && msg.sender_type === 'client') {
          client.unreadCount++;
        }
        if (new Date(msg.created_at) > new Date(client.lastMessageAt)) {
          client.lastMessageAt = msg.created_at;
        }
      });

      const conversations = Array.from(clientMap.values()).sort((a, b) => 
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

      return NextResponse.json({ conversations });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST - Send a message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, senderType, messageText } = body;

    if (!clientId || !senderType || !messageText) {
      return NextResponse.json(
        { error: 'Client ID, sender type, and message text are required' },
        { status: 400 }
      );
    }

    if (senderType !== 'client' && senderType !== 'developer') {
      return NextResponse.json(
        { error: 'Sender type must be "client" or "developer"' },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO messages (client_id, sender_type, message_text)
      VALUES (${clientId}, ${senderType}, ${messageText.trim()})
      RETURNING id, client_id, sender_type, message_text, is_read, created_at
    `;

    const newMessage = result[0];

    // Trigger Pusher event for real-time updates
    try {
      await pusher.trigger(`client-${clientId}`, 'new-message', {
        message: newMessage
      });
      
      // Also trigger for developer inbox updates
      await pusher.trigger('developer-inbox', 'conversation-updated', {
        clientId: clientId
      });
    } catch (error) {
      console.error('Pusher error:', error);
      // Don't fail the request if Pusher fails
    }

    return NextResponse.json({
      success: true,
      message: newMessage
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Mark messages as read
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    await sql`
      UPDATE messages
      SET is_read = TRUE
      WHERE client_id = ${clientId} AND sender_type = 'client' AND is_read = FALSE
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

