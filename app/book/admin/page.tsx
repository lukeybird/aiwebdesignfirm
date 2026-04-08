'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Bootstrap = {
  settings: { slot_interval_minutes: number };
  rules: { weekday: number; enabled: boolean; start_time: string; end_time: string }[];
  upcoming: Record<string, unknown>[];
  past: Record<string, unknown>[];
  leads: Record<string, unknown>[];
};

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function BookingAdminPage() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [tab, setTab] = useState<'up' | 'past' | 'leads' | 'hours'>('up');
  const [err, setErr] = useState<string | null>(null);
  const [callLinkId, setCallLinkId] = useState<number | null>(null);
  const [callLinkUrl, setCallLinkUrl] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/booking/admin/bootstrap');
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr((j as { error?: string }).error || 'Load failed');
      return;
    }
    setBoot(j as Bootstrap);
    setErr(null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const tick = () => {
      fetch('/api/booking/admin/reminders/tick', { method: 'POST' }).catch(() => {});
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  async function saveHours(e: React.FormEvent) {
    e.preventDefault();
    if (!boot) return;
    const rules = boot.rules.map((r) => ({
      weekday: r.weekday,
      enabled: (document.getElementById(`en-${r.weekday}`) as HTMLInputElement)?.checked ?? false,
      start_time: (document.getElementById(`st-${r.weekday}`) as HTMLInputElement)?.value || '09:00',
      end_time: (document.getElementById(`en2-${r.weekday}`) as HTMLInputElement)?.value || '17:00',
    }));
    const slotIntervalMinutes = parseInt(
      (document.getElementById('slot-int') as HTMLSelectElement)?.value || '30',
      10,
    );
    const r = await fetch('/api/booking/admin/availability', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules, slotIntervalMinutes }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr((j as { error?: string }).error || 'Save failed');
      return;
    }
    await load();
  }

  async function sendCallLink() {
    if (!callLinkId || !callLinkUrl.trim()) return;
    const r = await fetch('/api/booking/admin/send-call-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId: callLinkId, link: callLinkUrl.trim() }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr((j as { error?: string }).error || 'Send failed');
      return;
    }
    setCallLinkId(null);
    setCallLinkUrl('');
    await load();
  }

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] text-white px-4 py-8 sm:px-8">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">Booking admin</h1>
        <p className="text-xs text-gray-500 w-full sm:w-auto">
          Private link — not indexed. Anyone with the URL can view or change availability.
        </p>
      </div>
      <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-2 mb-8">
        {(['up', 'past', 'leads', 'hours'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-full px-4 py-2 text-sm ${
              tab === k ? 'bg-[#0066ff] text-white' : 'bg-white/10 text-gray-300'
            }`}
          >
            {k === 'up' ? 'Upcoming' : k === 'past' ? 'Past' : k === 'leads' ? 'Leads' : 'Hours'}
          </button>
        ))}
        <Button variant="outline" size="sm" onClick={load} className="rounded-full border-white/20">
          Refresh
        </Button>
        <Link href="/" className="text-sm text-gray-500 self-center hover:text-gray-300 ml-2">
          Home
        </Link>
      </div>

      {err ? <p className="text-red-400 text-sm mb-4">{err}</p> : null}

      {callLinkId != null ? (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#141418] border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-bold">Send call link</h3>
            <Input
              value={callLinkUrl}
              onChange={(e) => setCallLinkUrl(e.target.value)}
              placeholder="https://…"
              className="bg-white/5 border-white/10"
            />
            <div className="flex gap-2">
              <Button type="button" onClick={sendCallLink} className="rounded-full">
                Send email
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCallLinkId(null);
                  setCallLinkUrl('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {!boot ? (
        <p className="text-gray-500">Loading…</p>
      ) : tab === 'hours' ? (
        <form onSubmit={saveHours} className="max-w-xl space-y-4">
          <label className="block text-sm text-gray-400">
            Slot length
            <select
              id="slot-int"
              defaultValue={boot.settings.slot_interval_minutes}
              className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
            </select>
          </label>
          {boot.rules.map((r) => (
            <div key={r.weekday} className="flex flex-wrap items-center gap-3 border-b border-white/5 pb-3">
              <label className="flex items-center gap-2 w-24">
                <input id={`en-${r.weekday}`} type="checkbox" defaultChecked={r.enabled} />
                {WD[r.weekday]}
              </label>
              <Input
                id={`st-${r.weekday}`}
                type="time"
                defaultValue={r.start_time?.slice(0, 5) || '09:00'}
                className="w-32 bg-white/5 border-white/10"
              />
              <span className="text-gray-500">to</span>
              <Input
                id={`en2-${r.weekday}`}
                type="time"
                defaultValue={r.end_time?.slice(0, 5) || '17:00'}
                className="w-32 bg-white/5 border-white/10"
              />
            </div>
          ))}
          <Button type="submit" className="rounded-full bg-[#0066ff]">
            Save availability
          </Button>
        </form>
      ) : tab === 'leads' ? (
        <LeadsTab boot={boot} onReload={load} />
      ) : (
        <AppointmentsTable
          rows={tab === 'up' ? boot.upcoming : boot.past}
          onReload={load}
          onCallLink={(id) => {
            setCallLinkId(id);
            setCallLinkUrl('');
          }}
        />
      )}
    </div>
  );
}

function AppointmentsTable({
  rows,
  onReload,
  onCallLink,
}: {
  rows: Record<string, unknown>[];
  onReload: () => void;
  onCallLink: (id: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm text-left">
        <thead className="bg-white/5 text-gray-400">
          <tr>
            <th className="p-3">When</th>
            <th className="p-3">Client</th>
            <th className="p-3">Status</th>
            <th className="p-3">No-show</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const id = r.id as number;
            return (
              <tr key={id} className="border-t border-white/5">
                <td className="p-3 whitespace-nowrap">
                  {new Date(r.starts_at as string).toLocaleString()}
                </td>
                <td className="p-3">
                  <div>{String(r.lead_name)}</div>
                  <div className="text-gray-500 text-xs">{String(r.lead_email)}</div>
                </td>
                <td className="p-3">{String(r.status)}</td>
                <td className="p-3">
                  <input
                    type="checkbox"
                    defaultChecked={Boolean(r.no_show)}
                    onChange={async (e) => {
                      await fetch(`/api/booking/admin/appointments/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          status: r.status,
                          no_show: e.target.checked,
                          notes: r.notes,
                          call_link: r.call_link,
                          starts_at: r.starts_at,
                          ends_at: r.ends_at,
                        }),
                      });
                      onReload();
                    }}
                  />
                </td>
                <td className="p-3 space-y-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full text-xs"
                    onClick={() => onCallLink(id)}
                  >
                    Send call link
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-xs block"
                    onClick={async () => {
                      if (!confirm('Cancel this appointment?')) return;
                      await fetch(`/api/booking/admin/appointments/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          status: 'cancelled',
                          no_show: r.no_show,
                          notes: r.notes,
                          call_link: r.call_link,
                          starts_at: r.starts_at,
                          ends_at: r.ends_at,
                        }),
                      });
                      onReload();
                    }}
                  >
                    Cancel
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LeadsTab({ boot, onReload }: { boot: Bootstrap; onReload: () => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-6">
      <Button type="button" onClick={() => setAdding(!adding)} className="rounded-full">
        {adding ? 'Close form' : 'Add lead'}
      </Button>
      {adding ? (
        <ManualLeadForm
          onDone={() => {
            setAdding(false);
            onReload();
          }}
        />
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-gray-400 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Status</th>
              <th className="p-3">Book link</th>
            </tr>
          </thead>
          <tbody>
            {boot.leads.map((l) => {
              const name = encodeURIComponent(String(l.name));
              const email = encodeURIComponent(String(l.email));
              const phone = l.phone ? encodeURIComponent(String(l.phone)) : '';
              const href = `/book?name=${name}&email=${email}${phone ? `&phone=${phone}` : ''}`;
              return (
                <tr key={String(l.id)} className="border-t border-white/5">
                  <td className="p-3">{String(l.name)}</td>
                  <td className="p-3">{String(l.email)}</td>
                  <td className="p-3">{String(l.status)}</td>
                  <td className="p-3">
                    <a href={href} className="text-[#00d4ff] underline text-xs break-all">
                      Open booking
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ManualLeadForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const r = await fetch('/api/booking/admin/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg((j as { error?: string }).error || 'Failed');
      return;
    }
    const path = (j as { bookingUrl?: string }).bookingUrl;
    if (path && typeof window !== 'undefined') {
      window.alert(`Lead created. Share:\n\n${window.location.origin}${path}`);
    }
    setName('');
    setEmail('');
    setPhone('');
    onDone();
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-3 border border-white/10 rounded-xl p-4">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="bg-white/5" />
      <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="bg-white/5" />
      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="bg-white/5" />
      {msg ? <p className="text-xs text-red-400">{msg}</p> : null}
      <Button type="submit" className="rounded-full">
        Create lead
      </Button>
    </form>
  );
}
