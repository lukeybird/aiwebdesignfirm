import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { parseCeoCoachResponse, type CeoArtifact } from '@/lib/ceo-coach-response';
import { clampResponseLengthLevel, getCeoResponseLengthConfig } from '@/lib/ceo-coach-response-length';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const MAX_USER_MESSAGE_CHARS = 3000;
const MAX_HISTORY_MESSAGES = 24;

const SYSTEM_PROMPT_BASE = `You are the AiWebDesignFirm CEO Strategy Advisor.

Your decision framework is inspired by how Mark Zuckerberg operates as a technology CEO:
- mission-first thinking and long-term positioning
- product velocity and rapid experimentation
- strong focus on leverage, distribution, and network effects
- ruthless prioritization around highest-impact bets
- clear metrics, accountability, and operating cadence

Primary job:
Help the user run and scale their business like a high-performing tech CEO.

Response style requirements (always follow unless the RESPONSE LENGTH block overrides):
1) Be direct, strategic, and decisive.
2) Give concrete recommendations, not generic motivation.
3) When space allows, use this structure inside "reply":
   - What matters most now
   - Recommended move
   - Why this compounds
   - Next 3 actions (this week)
4) If context is missing, ask up to 3 targeted questions, then still provide a best-guess plan (unless RESPONSE LENGTH forbids extra sentences).
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
- Scale artifact count and depth to the RESPONSE LENGTH slider (fewer/shorter at low levels).
- Each artifact should be self-contained so it can render as its own card on the page.
- If nothing new to add, use an empty array: "artifacts": []
`;

type MessageRow = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type CoachProfile = {
  name?: string;
  phone?: string;
  email?: string;
  businessName?: string;
  businessDescription?: string;
  biggestProblem?: string;
  websiteUrl?: string;
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
      name TEXT,
      phone TEXT,
      email TEXT,
      business_name TEXT,
      business_description TEXT,
      biggest_problem TEXT,
      website_url TEXT,
      website_context TEXT,
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
  await sql`ALTER TABLE ceo_coach_sessions ADD COLUMN IF NOT EXISTS name TEXT`;
  await sql`ALTER TABLE ceo_coach_sessions ADD COLUMN IF NOT EXISTS phone TEXT`;
  await sql`ALTER TABLE ceo_coach_sessions ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`ALTER TABLE ceo_coach_sessions ADD COLUMN IF NOT EXISTS business_name TEXT`;
  await sql`ALTER TABLE ceo_coach_sessions ADD COLUMN IF NOT EXISTS business_description TEXT`;
  await sql`ALTER TABLE ceo_coach_sessions ADD COLUMN IF NOT EXISTS biggest_problem TEXT`;
  await sql`ALTER TABLE ceo_coach_sessions ADD COLUMN IF NOT EXISTS website_url TEXT`;
  await sql`ALTER TABLE ceo_coach_sessions ADD COLUMN IF NOT EXISTS website_context TEXT`;
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

function cleanProfile(raw: unknown): CoachProfile {
  if (!raw || typeof raw !== 'object') return {};
  const p = raw as Record<string, unknown>;
  const str = (k: string, max = 1000) =>
    typeof p[k] === 'string' ? p[k].trim().slice(0, max) : undefined;
  return {
    name: str('name', 120),
    phone: str('phone', 60),
    email: str('email', 180),
    businessName: str('businessName', 180),
    businessDescription: str('businessDescription', 2000),
    biggestProblem: str('biggestProblem', 2000),
    websiteUrl: str('websiteUrl', 400),
  };
}

function normalizeWebsiteUrl(input?: string): string | null {
  if (!input) return null;
  const v = input.trim();
  if (!v || v.toLowerCase() === 'no' || v.toLowerCase() === 'none') return null;
  const withProtocol = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(withProtocol);
    if (!/^https?:$/.test(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchWebsiteContext(websiteUrl: string): Promise<string | null> {
  try {
    const res = await fetch(websiteUrl, { headers: { 'user-agent': 'AiWebDesignFirmBot/1.0' } });
    if (!res.ok) return null;
    const html = await res.text();
    const plain = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!plain) return null;
    return plain.slice(0, 6000);
  } catch {
    return null;
  }
}

async function callClaude(messages: MessageRow[], system: string, maxTokens: number) {
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
      max_tokens: maxTokens,
      system,
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

    const session = await sql<
      {
        name: string | null;
        phone: string | null;
        email: string | null;
        business_name: string | null;
        business_description: string | null;
        biggest_problem: string | null;
        website_url: string | null;
      }[]
    >`
      SELECT name, phone, email, business_name, business_description, biggest_problem, website_url
      FROM ceo_coach_sessions
      WHERE id = ${sessionId}
      LIMIT 1
    `;

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

    return NextResponse.json({
      sessionId,
      messages,
      artifacts,
      profile: {
        name: session[0]?.name ?? '',
        phone: session[0]?.phone ?? '',
        email: session[0]?.email ?? '',
        businessName: session[0]?.business_name ?? '',
        businessDescription: session[0]?.business_description ?? '',
        biggestProblem: session[0]?.biggest_problem ?? '',
        websiteUrl: session[0]?.website_url ?? '',
      },
    });
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
    const incomingProfile = cleanProfile(body.profile);
    const responseLength = clampResponseLengthLevel(body.responseLength);
    const { maxTokens, instruction } = getCeoResponseLengthConfig(responseLength);

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

    const existing = await sql<
      {
        name: string | null;
        phone: string | null;
        email: string | null;
        business_name: string | null;
        business_description: string | null;
        biggest_problem: string | null;
        website_url: string | null;
        website_context: string | null;
      }[]
    >`
      SELECT
        name, phone, email, business_name, business_description, biggest_problem, website_url, website_context
      FROM ceo_coach_sessions
      WHERE id = ${sessionId}
      LIMIT 1
    `;

    const mergedProfile = {
      name: incomingProfile.name || existing[0]?.name || '',
      phone: incomingProfile.phone || existing[0]?.phone || '',
      email: incomingProfile.email || existing[0]?.email || '',
      businessName: incomingProfile.businessName || existing[0]?.business_name || '',
      businessDescription: incomingProfile.businessDescription || existing[0]?.business_description || '',
      biggestProblem: incomingProfile.biggestProblem || existing[0]?.biggest_problem || '',
      websiteUrl:
        normalizeWebsiteUrl(incomingProfile.websiteUrl) ||
        normalizeWebsiteUrl(existing[0]?.website_url ?? undefined) ||
        '',
    };

    let websiteContext = existing[0]?.website_context || '';
    const normalizedIncomingWebsite = normalizeWebsiteUrl(incomingProfile.websiteUrl);
    if (normalizedIncomingWebsite && normalizedIncomingWebsite !== normalizeWebsiteUrl(existing[0]?.website_url ?? undefined)) {
      websiteContext = (await fetchWebsiteContext(normalizedIncomingWebsite)) || '';
    } else if (mergedProfile.websiteUrl && !websiteContext) {
      websiteContext = (await fetchWebsiteContext(mergedProfile.websiteUrl)) || '';
    }

    await sql`
      UPDATE ceo_coach_sessions
      SET
        name = ${mergedProfile.name || null},
        phone = ${mergedProfile.phone || null},
        email = ${mergedProfile.email || null},
        business_name = ${mergedProfile.businessName || null},
        business_description = ${mergedProfile.businessDescription || null},
        biggest_problem = ${mergedProfile.biggestProblem || null},
        website_url = ${mergedProfile.websiteUrl || null},
        website_context = ${websiteContext || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sessionId}
    `;

    const system = `${SYSTEM_PROMPT_BASE}

${instruction}

Business profile (authoritative context from onboarding):
- Name: ${mergedProfile.name || 'unknown'}
- Phone: ${mergedProfile.phone || 'unknown'}
- Email: ${mergedProfile.email || 'unknown'}
- Business: ${mergedProfile.businessName || 'unknown'}
- Business description: ${mergedProfile.businessDescription || 'unknown'}
- Biggest problem: ${mergedProfile.biggestProblem || 'unknown'}
- Website: ${mergedProfile.websiteUrl || 'none provided'}

Website extracted context (if available):
${websiteContext || 'No website content extracted yet.'}

Sales intent:
- Explain why AI is high-value for this exact business and problem.
- Be persuasive but not deceptive.
- Keep conversation moving toward booking a strategy call.
- If user asks next steps, include a clear nudge to book the meeting.

If anything conflicts, the RESPONSE LENGTH block wins.`;

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

    const raw = await callClaude(claudeMessages, system, maxTokens);
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
      responseLength,
      profile: mergedProfile,
    });
  } catch (error) {
    console.error('CEO coach error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process CEO coach request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
