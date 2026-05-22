import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

type PaperFields = {
  courtName: string;
  courtAddress: string;
  respondentName: string;
  fileNumber: string;
  masterHearing: string;
  judgeName: string;
  filingType: string;
  reLine: string;
  feeDescription: string;
  paymentAmount: string;
  respondentAddress: string;
  documentDate: string;
  serviceMethod: string;
  oplaAddress: string;
};

function parseProfileId(id: string): number | null {
  const n = Number.parseInt(id, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const profileId = parseProfileId(id);
    if (profileId == null) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = (await request.json()) as { profileName?: string; fields?: Partial<PaperFields> };
    const fields = body.fields ?? {};
    const profileName =
      clean(body.profileName) ||
      clean(fields.respondentName) ||
      'New profile';

    const rows = await sql`
      UPDATE paper_profiles
      SET
        profile_name = ${profileName},
        court_name = ${clean(fields.courtName)},
        court_address = ${clean(fields.courtAddress)},
        respondent_name = ${clean(fields.respondentName)},
        file_number = ${clean(fields.fileNumber)},
        master_hearing = ${clean(fields.masterHearing)},
        judge_name = ${clean(fields.judgeName)},
        filing_type = ${clean(fields.filingType)},
        re_line = ${clean(fields.reLine)},
        fee_description = ${clean(fields.feeDescription)},
        payment_amount = ${clean(fields.paymentAmount)},
        respondent_address = ${clean(fields.respondentAddress)},
        document_date = ${clean(fields.documentDate)},
        service_method = ${clean(fields.serviceMethod)},
        opla_address = ${clean(fields.oplaAddress)},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${profileId}
      RETURNING id
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('PATCH /api/paper-profiles/[id]:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const profileId = parseProfileId(id);
    if (profileId == null) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const deleted = await sql`
      DELETE FROM paper_profiles
      WHERE id = ${profileId}
      RETURNING id
    `;

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('DELETE /api/paper-profiles/[id]:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
