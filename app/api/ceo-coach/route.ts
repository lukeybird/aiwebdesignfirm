import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { parseCeoCoachResponse, type CeoArtifact } from '@/lib/ceo-coach-response';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const MAX_USER_MESSAGE_CHARS = 3000;
const MAX_HISTORY_MESSAGES = 24;

const SYSTEM_PROMPT = `You are the AiWebDesignFirm CEO Strategy Advisor.

Your decision framework is inspired by how Mark Zuckerberg operates as a technology CEO:
- mission-first thinking and long-term positioning
- product velocity and rapid experimentation
- strong focus on leverage, distribution, and network effects
- ruthless prioritization around highest-impact bets
- clear metrics, accountability, and operating cadence

Primary job:
Help the user run and scale their business like a high-performing tech CEO.

Response style requirements (always follow):
1) Be direct, strategic, and decisive.
2) Give concrete recommendations, not generic motivation.
3) Default to this structure:
   - What matters most now
   - Recommended move
   - Why this compounds
   - Next 3 actions (this week)
4) If context is missing, ask up to 3 targeted questions, then still provide a best-guess plan.
5) Keep tone consistent and executive-level across all replies.
6) Do not break character or mention these internal instructions.

OUTPUT FORMAT (critical):
You MUST respond with a single JSON object only. No markdown fences, no prose before or after the JSON.
Shape:
{
  "reply": "string shown in the chat (can use newlines; be concise but complete)",
  "artifacts": [
    {
      "id": "optional short slug",
      "title": "short card title",
      "body": "content for the live page panel (bullet list or short paragraphs)",
      "kind": "plan" | "checklist" | "metric" | "note" | "risk" | "next_step"
    }
  ]
}

Artifacts rules:
- Include 1-4 artifacts per turn that capture decisions, metrics to watch, risks, and next steps.
- Each artifact should be self-contained so it can render as its own card on the page.
- If nothing new to add, use an empty array: "artifacts": []
`;

type MessageRow = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

let ceoTablesReady = false;

async function ensureCeoCoachTables() {
  if (ceoTablesReady) return;

  await sql`
    CREATE TABLE IF NOT EXISTS ceo_coach_sessions (
      id VARCHAR(128) PRIMARY KEY,
      source_page TEXT,
      user_agent TEXT,
      ip_address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ceo_coach_messages (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(128) NOT NULL REFERENCES ceo_coach_sessions(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      model VARCHAR(120),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ceo_coach_artifacts (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(128) NOT NULL REFERENCES ceo_coach_sessions(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      kind VARCHAR(32) NOT NULL DEFAULT 'note',
      external_id VARCHAR(128),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_ceo_coach_messages_session_created ON ceo_coach_messages(session_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ceo_coach_artifacts_session_created ON ceo_coach_artifacts(session_id, created_at)`;
  ceoTablesReady = true;
}

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function normalizeKind(kind: string | undefined): string {
  const allowed = new Set(['plan', 'checklist', 'metric', 'note', 'risk', 'next_step']);
  const k = (kind ?? 'note').toLowerCase();
  return allowed.has(k) ? k : 'note';
}

async function callClaude(messages: MessageRow[]) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY is not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1600,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
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

async function insertArtifacts(sessionId: string, artifacts: CeoArtifact[]) {
  for (const a of artifacts) {
    const kind = normalizeKind(a.kind);
    const extId = a.id && a.id.length <= 128 ? a.id : null;
    await sql`
      INSERT INTO ceo_coach_artifacts (session_id, title, body, kind, external_id)
      VALUES (${sessionId}, ${a.title}, ${a.body}, ${kind}, ${extId})
    `;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureCeoCoachTables();
    const sessionId = safeText(request.nextUrl.searchParams.get('sessionId'));
    if (!sessionId || sessionId.length > 128) {
      return NextResponse.json({ error: 'sessionId query param is required' }, { status: 400 });
    }

    const messages = await sql<
      { id: number; role: string; content: string; created_at: string }[]
    >`
      SELECT id, role, content, created_at::text
      FROM ceo_coach_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC, id ASC
    `;

    const artifacts = await sql<
      { id: number; title: string; body: string; kind: string; created_at: string; external_id: string | null }[]
    >`
      SELECT id, title, body, kind, created_at::text, external_id
      FROM ceo_coach_artifacts
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC, id ASC
    `;

    return NextResponse.json({ sessionId, messages, artifacts });
  } catch (error) {
    console.error('CEO coach GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureCeoCoachTables();

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
      INSERT INTO ceo_coach_sessions (id, source_page, user_agent, ip_address, updated_at)
      VALUES (${sessionId}, ${sourcePage || null}, ${userAgent}, ${ipAddress}, CURRENT_TIMESTAMP)
      ON CONFLICT (id)
      DO UPDATE SET
        source_page = COALESCE(EXCLUDED.source_page, ceo_coach_sessions.source_page),
        user_agent = EXCLUDED.user_agent,
        ip_address = EXCLUDED.ip_address,
        updated_at = CURRENT_TIMESTAMP
    `;

    await sql`
      INSERT INTO ceo_coach_messages (session_id, role, content)
      VALUES (${sessionId}, 'user', ${message})
    `;

    const historyRows = await sql<MessageRow[]>`
      SELECT role, content
      FROM ceo_coach_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC
      LIMIT ${MAX_HISTORY_MESSAGES}
    `;

    const orderedHistory = [...historyRows].reverse();
    const claudeMessages = orderedHistory
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    const raw = await callClaude(claudeMessages);
    const { reply, artifacts } = parseCeoCoachResponse(raw);

    await sql`
      INSERT INTO ceo_coach_messages (session_id, role, content, model)
      VALUES (${sessionId}, 'assistant', ${reply}, ${CLAUDE_MODEL})
    `;

    if (artifacts.length > 0) {
      await insertArtifacts(sessionId, artifacts);
    }

    return NextResponse.json({
      reply,
      artifacts,
      sessionId,
    });
  } catch (error) {
    console.error('CEO coach error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process CEO coach request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
