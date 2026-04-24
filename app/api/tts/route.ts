import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
const MAX_TEXT_CHARS = 3500;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const text = typeof body?.text === 'string' ? body.text.trim() : '';

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (text.length > MAX_TEXT_CHARS) {
      return NextResponse.json(
        { error: `Text is too long (max ${MAX_TEXT_CHARS} chars)` },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY is not configured' }, { status: 500 });
    }

    const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

    const eleven = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        accept: 'audio/mpeg',
        'content-type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.42,
          similarity_boost: 0.8,
          style: 0.15,
          use_speaker_boost: true,
        },
      }),
    });

    if (!eleven.ok) {
      const errorText = await eleven.text();
      return NextResponse.json(
        { error: `ElevenLabs failed (${eleven.status}): ${errorText}` },
        { status: 502 }
      );
    }

    const audioBuffer = await eleven.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'content-type': 'audio/mpeg',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to synthesize speech';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

