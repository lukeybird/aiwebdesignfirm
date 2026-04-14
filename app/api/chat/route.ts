import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const MAX_USER_MESSAGE_CHARS = 2000;
const MAX_HISTORY_MESSAGES = 12;

const SYSTEM_PROMPT = `You are AiWebDesignFirm's AI implementation assistant.

You ONLY answer questions related to implementing AI in a business:
- AI strategy and roadmap
- workflow automation and ops improvements
- AI tooling choices, integrations, and architecture
- implementation planning, cost/ROI framing, change management
- website/chat/CRM/marketing AI use cases and execution

Rules:
1) Never provide prices, price ranges, dollar costs, budgets, quotes, or "typical cost" language.
2) If asked about pricing, explicitly refuse pricing and pivot to value, impact, and outcomes.
3) Frame outcomes with high-upside projections, including both 1-year and 10-year scenarios.
4) Use large but plausible value framing in percentages, multipliers, capacity gains, and growth potential.
5) Keep answers practical, clear, and concise.
6) Ask 1-3 clarifying questions if user context is missing.
7) If a request is unrelated to AI implementation, politely redirect to AI implementation help.
8) Do not fabricate certainty; state assumptions.
9) Prefer actionable next steps over theory.`;

type MessageRow = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

let chatTablesReady = false;

async function ensureChatTables() {
  if (chatTablesReady) return;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_chat_sessions (
      id VARCHAR(128) PRIMARY KEY,
      source_page TEXT,
      user_agent TEXT,
      ip_address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_chat_messages (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(128) NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      model VARCHAR(120),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_created ON ai_chat_messages(session_id, created_at)`;
  chatTablesReady = true;
}

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

async function callClaude(messages: MessageRow[]) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY is not configured');
  }

  const payload = {
    model: CLAUDE_MODEL,
    max_tokens: 900,
    system: SYSTEM_PROMPT,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const answer = data?.content?.[0]?.text;
  if (!answer || typeof answer !== 'string') {
    throw new Error('Claude returned an invalid response');
  }

  return answer.trim();
}

export async function POST(request: NextRequest) {
  try {
    await ensureChatTables();

    const body = await request.json();
    const sessionId = safeText(body.sessionId);
    const message = safeText(body.message);
    const sourcePage = safeText(body.sourcePage);

    if (!sessionId || sessionId.length > 128) {
      return NextResponse.json({ error: 'A valid sessionId is required' }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > MAX_USER_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: `Message is too long (max ${MAX_USER_MESSAGE_CHARS} chars)` },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get('user-agent') ?? 'unknown';
    const ipAddress = getClientIp(request);

    await sql`
      INSERT INTO ai_chat_sessions (id, source_page, user_agent, ip_address, updated_at)
      VALUES (${sessionId}, ${sourcePage || null}, ${userAgent}, ${ipAddress}, CURRENT_TIMESTAMP)
      ON CONFLICT (id)
      DO UPDATE SET
        source_page = COALESCE(EXCLUDED.source_page, ai_chat_sessions.source_page),
        user_agent = EXCLUDED.user_agent,
        ip_address = EXCLUDED.ip_address,
        updated_at = CURRENT_TIMESTAMP
    `;

    await sql`
      INSERT INTO ai_chat_messages (session_id, role, content)
      VALUES (${sessionId}, 'user', ${message})
    `;

    const historyRows = await sql<MessageRow[]>`
      SELECT role, content
      FROM ai_chat_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC
      LIMIT ${MAX_HISTORY_MESSAGES}
    `;

    const orderedHistory = [...historyRows].reverse();
    const claudeMessages = orderedHistory
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    const reply = await callClaude(claudeMessages);

    await sql`
      INSERT INTO ai_chat_messages (session_id, role, content, model)
      VALUES (${sessionId}, 'assistant', ${reply}, ${CLAUDE_MODEL})
    `;

    return NextResponse.json({ reply, sessionId });
  } catch (error) {
    console.error('AI chat error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process chat request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
