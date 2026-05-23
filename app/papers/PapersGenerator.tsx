'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Plus, Printer, Trash2 } from 'lucide-react';
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

type PaperProfile = {
  id: string;
  profileName: string;
  fields: PaperFields;
  createdAt: string;
  updatedAt: string;
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

async function parseJsonError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error || res.statusText;
  } catch {
    return res.statusText;
  }
}

export default function PapersGenerator() {
  const [fields, setFields] = useState<PaperFields>(DEFAULT_FIELDS);
  const [profiles, setProfiles] = useState<PaperProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  const profileName = fields.respondentName.trim() || 'New profile';

  const updateField = <K extends keyof PaperFields>(key: K, value: PaperFields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingProfiles(true);
      setError(null);
      try {
        const res = await fetch('/api/paper-profiles');
        const j = (await res.json()) as { profiles?: PaperProfile[]; error?: string };
        if (!res.ok) throw new Error(j.error || (await parseJsonError(res)));
        if (cancelled) return;
        const loaded = Array.isArray(j.profiles) ? j.profiles : [];
        setProfiles(loaded);
        if (loaded.length > 0) {
          setSelectedProfileId(loaded[0].id);
          setFields(loaded[0].fields);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load paper profiles');
      } finally {
        if (!cancelled) {
          setLoadingProfiles(false);
          hydratedRef.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || !selectedProfileId) return;
    setSavingStatus('saving');
    const timeout = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/paper-profiles/${selectedProfileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileName, fields }),
        });
        if (!res.ok) throw new Error(await parseJsonError(res));
        setProfiles((prev) =>
          prev.map((p) =>
            p.id === selectedProfileId ? { ...p, profileName: profileName || fields.respondentName, fields } : p,
          ),
        );
        setSavingStatus('saved');
      } catch (e) {
        setSavingStatus('error');
        setError(e instanceof Error ? e.message : 'Could not auto-save profile');
      }
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [fields, profileName, selectedProfileId]);

  async function createProfile() {
    setError(null);
    setSavingStatus('saving');
    const newFields = {
      ...fields,
      respondentName: fields.respondentName || 'New profile',
    };
    const newProfileName = fields.respondentName || 'New profile';
    try {
      const res = await fetch('/api/paper-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileName: newProfileName, fields: newFields }),
      });
      const j = (await res.json()) as { profile?: PaperProfile; error?: string };
      if (!res.ok || !j.profile) throw new Error(j.error || (await parseJsonError(res)));
      setProfiles((prev) => [j.profile!, ...prev]);
      setSelectedProfileId(j.profile.id);
      setFields(j.profile.fields);
      setSavingStatus('saved');
    } catch (e) {
      setSavingStatus('error');
      setError(e instanceof Error ? e.message : 'Could not create profile');
    }
  }

  async function deleteProfile() {
    if (!selectedProfileId) return;
    setError(null);
    setSavingStatus('saving');
    try {
      const res = await fetch(`/api/paper-profiles/${selectedProfileId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await parseJsonError(res));
      const remaining = profiles.filter((p) => p.id !== selectedProfileId);
      setProfiles(remaining);
      if (remaining.length > 0) {
        setSelectedProfileId(remaining[0].id);
        setFields(remaining[0].fields);
      } else {
        setSelectedProfileId('');
        setFields(DEFAULT_FIELDS);
      }
      setSavingStatus('saved');
    } catch (e) {
      setSavingStatus('error');
      setError(e instanceof Error ? e.message : 'Could not delete profile');
    }
  }

  function selectProfile(id: string) {
    const profile = profiles.find((p) => p.id === id);
    setSelectedProfileId(id);
    if (profile) {
      setFields(profile.fields);
    }
  }

  function openPrintDialog(mode: 'print' | 'save') {
    const originalTitle = document.title;
    if (mode === 'save') {
      const safeName = [fields.respondentName, fields.fileNumber]
        .filter(Boolean)
        .join(' ')
        .replace(/[^a-z0-9-_ ]/gi, '')
        .trim()
        .replace(/\s+/g, '-');
      document.title = safeName ? `${safeName}-papers` : 'papers';
    }

    window.print();
    window.setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  }

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
              <p className="mt-1 text-xs text-gray-400">
                Create applicant profiles. Only the highlighted variables below are editable.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => openPrintDialog('print')}
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button
                type="button"
                onClick={() => openPrintDialog('save')}
                className="bg-gradient-to-r from-[#0066ff] to-[#00d4ff] text-black hover:opacity-95"
              >
                <Download className="h-4 w-4" />
                Save PDF
              </Button>
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
              {error}
              <button type="button" className="ml-2 underline" onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          ) : null}

          <div className="mb-5 space-y-3 rounded-2xl border border-white/10 bg-black/25 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200/70">Profile</span>
              <span className="text-[11px] text-gray-400">
                {loadingProfiles
                  ? 'Loading...'
                  : savingStatus === 'saving'
                    ? 'Saving...'
                    : savingStatus === 'saved'
                      ? 'Saved'
                      : savingStatus === 'error'
                        ? 'Save error'
                        : selectedProfileId
                          ? 'Auto-save on'
                          : 'Create profile to save'}
              </span>
            </div>
            <select
              value={selectedProfileId}
              onChange={(e) => selectProfile(e.target.value)}
              className="h-10 w-full rounded-md border border-white/15 bg-black/40 px-3 text-sm text-white"
            >
              <option value="">Unsaved draft</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.profileName}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="flex-1 bg-cyan-500 text-black hover:bg-cyan-400"
                onClick={() => void createProfile()}
              >
                <Plus className="h-4 w-4" />
                New / Save Profile
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/20"
                disabled={!selectedProfileId}
                onClick={() => void deleteProfile()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <Field label="Court address" value={fields.courtAddress} onChange={(v) => updateField('courtAddress', v)} multiline />
            <Field label="Name of Judge (if applicable)" value={fields.judgeName} onChange={(v) => updateField('judgeName', v)} />
            <Field
              label="Time of Next Hearing (if applicable)"
              value={fields.masterHearing}
              onChange={(v) => updateField('masterHearing', v)}
            />
            <Field label="Applicant's Name" value={fields.respondentName} onChange={(v) => updateField('respondentName', v)} />
            <Field label="Case Number" value={fields.fileNumber} onChange={(v) => updateField('fileNumber', v)} />
            <Field label="Address (OPLA / Office of Chief Counsel)" value={fields.oplaAddress} onChange={(v) => updateField('oplaAddress', v)} multiline />
            <Field
              label="Applicant's Address"
              value={fields.respondentAddress}
              onChange={(v) => updateField('respondentAddress', v)}
              multiline
            />
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
              {fields.masterHearing.trim() ? (
                <p>
                  <strong>MASTER HEARING:</strong>
                  <br />
                  {fields.masterHearing}
                </p>
              ) : null}
              {fields.judgeName.trim() ? (
                <p>
                  Judge: <strong>{fields.judgeName}</strong>
                </p>
              ) : null}
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
