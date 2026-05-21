'use client';

import { useMemo, useState } from 'react';
import { FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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

const DEFAULT_FIELDS: PaperFields = {
  courtName: 'UNITED STATES DEPARTMENT OF JUSTICE\nEXECUTIVE OFFICE FOR IMMIGRATION REVIEW',
  courtAddress: '5701 Executive Center Drive, Suite 300\nCharlotte, NC 28212',
  respondentName: 'JIMENEZ ARIAS, ROSVIL CARINA',
  fileNumber: 'A249-178-725',
  masterHearing: 'August 3, 2027 at 8:30 AM',
  judgeName: 'Karesh, Ellen',
  filingType: 'Court - Form I-589, Annual Asylum Fee for Asylum and for Withholding of Removal (AAF)',
  reLine: 'Submission of Proof of Payment for Asylum Maintenance Fee',
  feeDescription: 'required maintenance fee for my asylum application',
  paymentAmount: '$102',
  respondentAddress: '15 Security Dr, Lot 40\nGreenville, SC 29611\nUnited States',
  documentDate: 'May 17, 2026',
  serviceMethod: 'delivered',
  oplaAddress:
    'Office of the Principal Legal Advisor (OPLA)\n5701 Executive Center Drive, Suite 400\nCharlotte, NC 28212',
};

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.16em] text-cyan-200/70">{label}</span>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[88px] resize-y border-white/15 bg-black/35 text-sm text-white placeholder:text-gray-500"
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border-white/15 bg-black/35 text-sm text-white placeholder:text-gray-500"
        />
      )}
    </label>
  );
}

function Lines({ value }: { value: string }) {
  return (
    <>
      {value.split('\n').map((line, i) => (
        <span key={`${line}-${i}`}>
          {line}
          {i < value.split('\n').length - 1 ? <br /> : null}
        </span>
      ))}
    </>
  );
}

export default function PapersGenerator() {
  const [fields, setFields] = useState<PaperFields>(DEFAULT_FIELDS);

  const updateField = <K extends keyof PaperFields>(key: K, value: PaperFields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const respondentAddressLines = useMemo(() => fields.respondentAddress.split('\n').filter(Boolean), [fields.respondentAddress]);

  return (
    <main className="min-h-[100dvh] bg-[#0a0a0f] text-white">
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          body * {
            visibility: hidden !important;
          }

          #papers-print-area,
          #papers-print-area * {
            visibility: visible !important;
          }

          #papers-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
          }

          .paper-page {
            box-shadow: none !important;
            margin: 0 auto !important;
            page-break-after: always;
          }

          .paper-page:last-child {
            page-break-after: auto;
          }
        }
      `}</style>

      <div className="mx-auto grid w-full max-w-[1500px] gap-6 px-4 py-6 lg:grid-cols-[26rem_minmax(0,1fr)] lg:px-6">
        <section className="rounded-2xl border border-white/10 bg-[#071325]/95 p-4 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.8)] lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
          <div className="mb-5 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="flex items-center gap-2 text-lg font-black text-white">
                <FileText className="h-5 w-5 text-cyan-300" aria-hidden />
                Papers
              </p>
              <p className="mt-1 text-xs text-gray-400">Edit the highlighted fields once. The pages update automatically.</p>
            </div>
            <Button
              type="button"
              onClick={() => window.print()}
              className="shrink-0 bg-gradient-to-r from-[#0066ff] to-[#00d4ff] text-black hover:opacity-95"
            >
              <Printer className="h-4 w-4" />
              PDF
            </Button>
          </div>

          <div className="space-y-4">
            <Field label="Court name" value={fields.courtName} onChange={(v) => updateField('courtName', v)} multiline />
            <Field label="Court address" value={fields.courtAddress} onChange={(v) => updateField('courtAddress', v)} multiline />
            <Field label="Name" value={fields.respondentName} onChange={(v) => updateField('respondentName', v)} />
            <Field label="File number" value={fields.fileNumber} onChange={(v) => updateField('fileNumber', v)} />
            <Field label="Master hearing" value={fields.masterHearing} onChange={(v) => updateField('masterHearing', v)} />
            <Field label="Judge" value={fields.judgeName} onChange={(v) => updateField('judgeName', v)} />
            <Field label="Filing type" value={fields.filingType} onChange={(v) => updateField('filingType', v)} multiline />
            <Field label="Re line" value={fields.reLine} onChange={(v) => updateField('reLine', v)} />
            <Field label="Fee description" value={fields.feeDescription} onChange={(v) => updateField('feeDescription', v)} multiline />
            <Field label="Payment amount" value={fields.paymentAmount} onChange={(v) => updateField('paymentAmount', v)} />
            <Field
              label="Person address"
              value={fields.respondentAddress}
              onChange={(v) => updateField('respondentAddress', v)}
              multiline
            />
            <Field label="Date" value={fields.documentDate} onChange={(v) => updateField('documentDate', v)} />
            <Field label="Service method" value={fields.serviceMethod} onChange={(v) => updateField('serviceMethod', v)} />
            <Field label="OPLA address" value={fields.oplaAddress} onChange={(v) => updateField('oplaAddress', v)} multiline />
          </div>
        </section>

        <section id="papers-print-area" className="space-y-6 overflow-x-auto pb-8">
          <article className="paper-page mx-auto min-h-[11in] w-[8.5in] bg-white px-[0.78in] py-[0.62in] font-serif text-[12pt] leading-[1.25] text-black shadow-2xl">
            <div className="text-center text-[11pt] font-bold uppercase leading-tight">
              <Lines value={fields.courtName} />
              <br />
              <Lines value={fields.courtAddress} />
            </div>

            <div className="mt-9 space-y-3">
              <p>In the Matter of:</p>
              <p>
                <strong>{fields.respondentName}</strong>
                <br />
                File No: <strong>{fields.fileNumber}</strong>
              </p>
              <p>
                <strong>MASTER HEARING:</strong>
                <br />
                {fields.masterHearing}
              </p>
              <p>
                Judge: <strong>{fields.judgeName}</strong>
              </p>
              <p>
                Filing Type:
                <br />
                {fields.filingType}
              </p>
              <p>Re: {fields.reLine}</p>
              <p>Dear Immigration Judge:</p>
              <p>
                I respectfully submit this letter to inform the Court that I have complied with the {fields.feeDescription}.
                Enclosed, please find a true and correct copy of the official receipt of payment in the amount of{' '}
                {fields.paymentAmount}.
              </p>
              <p>
                I respectfully request that this document be included in my record. Thank you for your time and
                consideration.
              </p>
              <p>Respectfully submitted,</p>
              <p>
                <strong>{fields.respondentName}</strong>
                <br />
                {respondentAddressLines.map((line, index) => (
                  <span key={`${line}-${index}`}>
                    {line}
                    {index < respondentAddressLines.length - 1 ? <br /> : null}
                  </span>
                ))}
              </p>
              <p>Date: {fields.documentDate}</p>
            </div>
          </article>

          <article className="paper-page mx-auto min-h-[11in] w-[8.5in] bg-white px-[0.78in] py-[0.62in] font-serif text-[12pt] leading-[1.25] text-black shadow-2xl">
            <h2 className="mb-5 text-[16pt] font-bold">Certificate of Service</h2>
            <p>
              On {fields.documentDate}, I, <strong>{fields.respondentName}</strong>, hereby certify that a true and
              correct copy of this RESPONDENT'S NOTICE OF FILING IN SUPPORT OF Proof of Payment for Asylum Maintenance
              Fee was {fields.serviceMethod} to the Office of Chief Counsel at:
            </p>
            <p className="mt-6">
              <Lines value={fields.oplaAddress} />
            </p>
            <p className="mt-10">Respectfully submitted,</p>
            <p className="mt-7">
              <strong>{fields.respondentName}</strong>
              <br />
              <Lines value={fields.respondentAddress} />
            </p>
            <p className="mt-7">Date: {fields.documentDate}</p>
          </article>
        </section>
      </div>
    </main>
  );
}
