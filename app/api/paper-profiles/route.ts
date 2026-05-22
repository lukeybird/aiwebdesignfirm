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

type PaperProfileRow = {
  id: number;
  profile_name: string;
  court_name: string;
  court_address: string;
  respondent_name: string;
  file_number: string;
  master_hearing: string;
  judge_name: string;
  filing_type: string;
  re_line: string;
  fee_description: string;
  payment_amount: string;
  respondent_address: string;
  document_date: string;
  service_method: string;
  opla_address: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return String(v);
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function rowToProfile(row: PaperProfileRow) {
  return {
    id: String(row.id),
    profileName: row.profile_name,
    fields: {
      courtName: row.court_name,
      courtAddress: row.court_address,
      respondentName: row.respondent_name,
      fileNumber: row.file_number,
      masterHearing: row.master_hearing,
      judgeName: row.judge_name,
      filingType: row.filing_type,
      reLine: row.re_line,
      feeDescription: row.fee_description,
      paymentAmount: row.payment_amount,
      respondentAddress: row.respondent_address,
      documentDate: row.document_date,
      serviceMethod: row.service_method,
      oplaAddress: row.opla_address,
    },
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function GET() {
  try {
    const rows = (await sql`
      SELECT *
      FROM paper_profiles
      ORDER BY updated_at DESC, id DESC
    `) as unknown as PaperProfileRow[];

    return NextResponse.json({ profiles: rows.map(rowToProfile) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('GET /api/paper-profiles:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { profileName?: string; fields?: Partial<PaperFields> };
    const fields = body.fields ?? {};
    const profileName =
      clean(body.profileName) ||
      clean(fields.respondentName) ||
      'New profile';

    const rows = (await sql`
      INSERT INTO paper_profiles (
        profile_name,
        court_name,
        court_address,
        respondent_name,
        file_number,
        master_hearing,
        judge_name,
        filing_type,
        re_line,
        fee_description,
        payment_amount,
        respondent_address,
        document_date,
        service_method,
        opla_address
      )
      VALUES (
        ${profileName},
        ${clean(fields.courtName)},
        ${clean(fields.courtAddress)},
        ${clean(fields.respondentName)},
        ${clean(fields.fileNumber)},
        ${clean(fields.masterHearing)},
        ${clean(fields.judgeName)},
        ${clean(fields.filingType)},
        ${clean(fields.reLine)},
        ${clean(fields.feeDescription)},
        ${clean(fields.paymentAmount)},
        ${clean(fields.respondentAddress)},
        ${clean(fields.documentDate)},
        ${clean(fields.serviceMethod)},
        ${clean(fields.oplaAddress)}
      )
      RETURNING *
    `) as unknown as PaperProfileRow[];

    return NextResponse.json({ profile: rowToProfile(rows[0]) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('POST /api/paper-profiles:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
