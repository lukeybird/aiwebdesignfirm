'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckSquare,
  ChevronRight,
  DollarSign,
  Briefcase,
  LayoutDashboard,
  Mail,
  Phone,
  Search,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type View = 'dashboard' | 'contacts' | 'deals' | 'tasks';

type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  notes: string;
  lifetimeValue: number;
};

type DealStage = 'lead' | 'qualified' | 'proposal' | 'won';

type Deal = {
  id: string;
  title: string;
  contactName: string;
  company: string;
  value: number;
  stage: DealStage;
  expectedClose: string;
  summary: string;
};

type Task = {
  id: string;
  title: string;
  due: string;
  done: boolean;
  related: string;
};

const CONTACTS: Contact[] = [
  {
    id: 'c1',
    name: 'Sarah Chen',
    email: 'sarah@oakridgehvac.com',
    phone: '(502) 555-0142',
    company: 'Oak Ridge HVAC',
    status: 'Customer',
    notes: 'Loves the automated follow-up texts. Asking about AI phone answering next.',
    lifetimeValue: 18400,
  },
  {
    id: 'c2',
    name: 'Marcus Webb',
    email: 'marcus@webbplumbing.co',
    phone: '(502) 555-0198',
    company: 'Webb Plumbing Co.',
    status: 'Prospect',
    notes: 'Met at chamber lunch. Wants a simple job board for techs.',
    lifetimeValue: 0,
  },
  {
    id: 'c3',
    name: 'Elena Ruiz',
    email: 'elena@brightcleaning.com',
    phone: '(502) 555-0167',
    company: 'Bright Cleaning Services',
    status: 'Lead',
    notes: 'Referred by Sarah Chen. Budget conscious.',
    lifetimeValue: 0,
  },
  {
    id: 'c4',
    name: 'James Okonkwo',
    email: 'james@peakroofing.net',
    phone: '(502) 555-0120',
    company: 'Peak Roofing',
    status: 'Customer',
    notes: 'Seasonal campaigns — spring push every year.',
    lifetimeValue: 42600,
  },
  {
    id: 'c5',
    name: 'Tina Morales',
    email: 'tina@moraleslaw.group',
    phone: '(502) 555-0181',
    company: 'Morales Law Group',
    status: 'Prospect',
    notes: 'Needs intake forms + calendar sync. HIPAA-aware stack.',
    lifetimeValue: 0,
  },
];

const DEALS: Deal[] = [
  {
    id: 'd1',
    title: 'Website refresh + booking',
    contactName: 'Marcus Webb',
    company: 'Webb Plumbing Co.',
    value: 8900,
    stage: 'proposal',
    expectedClose: 'May 18, 2026',
    summary: 'Scope: new site, online booking, SMS reminders. Proposal sent; waiting on owner sign-off.',
  },
  {
    id: 'd2',
    title: 'AI receptionist pilot',
    contactName: 'Sarah Chen',
    company: 'Oak Ridge HVAC',
    value: 5200,
    stage: 'qualified',
    expectedClose: 'May 28, 2026',
    summary: '30-day pilot after-hours. Recording script review scheduled.',
  },
  {
    id: 'd3',
    title: 'CRM migration',
    contactName: 'James Okonkwo',
    company: 'Peak Roofing',
    value: 15000,
    stage: 'lead',
    expectedClose: 'Jun 10, 2026',
    summary: 'Moving off spreadsheets. Discovery call completed.',
  },
  {
    id: 'd4',
    title: 'Client portal',
    contactName: 'Tina Morales',
    company: 'Morales Law Group',
    value: 22000,
    stage: 'lead',
    expectedClose: 'Jun 2, 2026',
    summary: 'Secure document upload + status tracking for cases.',
  },
  {
    id: 'd5',
    title: 'Chatbot + FAQ',
    contactName: 'Elena Ruiz',
    company: 'Bright Cleaning Services',
    value: 3400,
    stage: 'won',
    expectedClose: 'Apr 30, 2026',
    summary: 'Closed — onboarding checklist in progress.',
  },
];

const INITIAL_TASKS: Task[] = [
  { id: 't1', title: 'Send proposal to Marcus Webb', due: '2026-05-04', done: false, related: 'Webb Plumbing' },
  { id: 't2', title: 'Record AI receptionist greeting (Sarah)', due: '2026-05-06', done: false, related: 'Oak Ridge HVAC' },
  { id: 't3', title: 'Import Peak Roofing contact CSV', due: '2026-05-07', done: true, related: 'Peak Roofing' },
  { id: 't4', title: 'HIPAA checklist — Morales Law', due: '2026-05-09', done: false, related: 'Morales Law Group' },
  { id: 't5', title: 'Follow up Bright Cleaning intro', due: '2026-05-05', done: false, related: 'Bright Cleaning' },
];

const STAGES: { id: DealStage; label: string }[] = [
  { id: 'lead', label: 'Lead' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'won', label: 'Won' },
];

const NAV: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'deals', label: 'Deals', icon: Briefcase },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
];

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function CrmDemoApp() {
  const [view, setView] = useState<View>('dashboard');
  const [contactQuery, setContactQuery] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);

  const filteredContacts = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    if (!q) return CONTACTS;
    return CONTACTS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    );
  }, [contactQuery]);

  const selectedContact = useMemo(
    () => (selectedContactId ? CONTACTS.find((c) => c.id === selectedContactId) ?? null : null),
    [selectedContactId],
  );

  const selectedDeal = useMemo(
    () => (selectedDealId ? DEALS.find((d) => d.id === selectedDealId) ?? null : null),
    [selectedDealId],
  );

  const pipelineTotal = useMemo(() => DEALS.filter((d) => d.stage !== 'won').reduce((s, d) => s + d.value, 0), []);
  const wonTotal = useMemo(() => DEALS.filter((d) => d.stage === 'won').reduce((s, d) => s + d.value, 0), []);
  const openTasks = useMemo(() => tasks.filter((t) => !t.done).length, [tasks]);

  function toggleTask(id: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#070b12] text-[#e8eef8]">
      <header className="sticky top-0 z-30 border-b border-[#0066ff]/20 bg-[#0a1528]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0066ff] to-[#00d4ff] text-sm font-black text-black">
              D
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">Demo CRM</p>
              <p className="truncate text-xs text-cyan-200/60">Sample data — nothing is saved</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-100/90 sm:inline">
              Preview
            </span>
            <Button asChild variant="outline" size="sm" className="border-[#0066ff]/35 bg-black/20 text-cyan-100 hover:bg-[#0066ff]/15">
              <Link href="/">Back to site</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col md:flex-row">
        <aside className="border-b border-white/5 md:w-52 md:shrink-0 md:border-b-0 md:border-r md:border-white/5">
          <nav className="flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setView(item.id);
                    setSelectedContactId(null);
                    setSelectedDealId(null);
                  }}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
                    active
                      ? 'bg-[#0066ff]/25 text-white shadow-[inset_0_0_0_1px_rgba(0,212,255,0.25)]'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-h-0 flex-1 p-4 sm:p-6">
          {view === 'dashboard' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Dashboard</h1>
                <p className="mt-1 text-sm text-gray-400">Snapshot of your pipeline — all numbers are fictional.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Pipeline (open)', value: formatMoney(pipelineTotal), icon: DollarSign },
                  { label: 'Won (sample)', value: formatMoney(wonTotal), icon: DollarSign },
                  { label: 'Contacts', value: String(CONTACTS.length), icon: Users },
                  { label: 'Tasks open', value: String(openTasks), icon: CheckSquare },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-xl border border-white/10 bg-[#0c1220] p-4 shadow-[0_0_0_1px_rgba(0,102,255,0.08)]"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-200/55">
                      <card.icon className="h-3.5 w-3.5" aria-hidden />
                      {card.label}
                    </div>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-white">{card.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0c1220] p-5">
                <h2 className="text-sm font-bold uppercase tracking-wide text-cyan-200/70">Recent activity</h2>
                <ul className="mt-4 space-y-3 text-sm text-gray-300">
                  <li className="flex gap-2">
                    <span className="text-cyan-400/80">•</span>
                    Proposal opened for <span className="font-medium text-white">Webb Plumbing</span> — 2h ago
                  </li>
                  <li className="flex gap-2">
                    <span className="text-cyan-400/80">•</span>
                    Stage moved to <span className="font-medium text-white">Qualified</span> for Oak Ridge HVAC AI pilot
                  </li>
                  <li className="flex gap-2">
                    <span className="text-cyan-400/80">•</span>
                    New lead: <span className="font-medium text-white">Bright Cleaning</span> (referral)
                  </li>
                  <li className="flex gap-2">
                    <span className="text-cyan-400/80">•</span>
                    Task completed: Import Peak Roofing contact CSV
                  </li>
                </ul>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-gradient-to-r from-[#0066ff] to-[#00d4ff] text-black hover:opacity-95"
                    onClick={() => setView('contacts')}
                  >
                    Browse contacts
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="border-white/15 bg-transparent" onClick={() => setView('deals')}>
                    View deals
                  </Button>
                </div>
              </div>
            </div>
          )}

          {view === 'contacts' && !selectedContact && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Contacts</h1>
                  <p className="mt-1 text-sm text-gray-400">Click a row to open a profile (demo only).</p>
                </div>
                <div className="relative max-w-md flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <Input
                    value={contactQuery}
                    onChange={(e) => setContactQuery(e.target.value)}
                    placeholder="Search name, company, email…"
                    className="border-white/10 bg-black/30 pl-9 text-white placeholder:text-gray-500"
                  />
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="hidden px-4 py-3 sm:table-cell">Company</th>
                      <th className="hidden px-4 py-3 md:table-cell">Email</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="hidden w-10 px-4 py-3 lg:table-cell" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.map((c) => (
                      <tr
                        key={c.id}
                        className="cursor-pointer border-b border-white/5 transition-colors hover:bg-[#0066ff]/10"
                        onClick={() => setSelectedContactId(c.id)}
                      >
                        <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                        <td className="hidden px-4 py-3 text-gray-300 sm:table-cell">{c.company}</td>
                        <td className="hidden px-4 py-3 text-gray-400 md:table-cell">{c.email}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-xs text-cyan-100">
                            {c.status}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-gray-500 lg:table-cell">
                          <ChevronRight className="h-4 w-4" aria-hidden />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredContacts.length === 0 ? (
                  <p className="p-6 text-center text-sm text-gray-500">No matches. Clear the search box.</p>
                ) : null}
              </div>
            </div>
          )}

          {view === 'contacts' && selectedContact && (
            <div className="mx-auto max-w-2xl space-y-6">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 gap-1 text-cyan-200 hover:bg-white/5 hover:text-white"
                onClick={() => setSelectedContactId(null)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to list
              </Button>
              <div className="rounded-xl border border-[#0066ff]/30 bg-[#0c1220] p-6 shadow-[0_0_40px_-20px_rgba(0,102,255,0.4)]">
                <div className="flex flex-col gap-1 border-b border-white/10 pb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/60">Contact</p>
                  <h1 className="text-2xl font-bold text-white">{selectedContact.name}</h1>
                  <p className="flex items-center gap-2 text-sm text-gray-400">
                    <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                    {selectedContact.company}
                  </p>
                </div>
                <dl className="mt-5 space-y-4 text-sm">
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-gray-500">Email</dt>
                    <dd className="flex items-center gap-2 text-gray-200">
                      <Mail className="h-4 w-4 text-cyan-400/70" aria-hidden />
                      {selectedContact.email}
                    </dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-gray-500">Phone</dt>
                    <dd className="flex items-center gap-2 text-gray-200">
                      <Phone className="h-4 w-4 text-cyan-400/70" aria-hidden />
                      {selectedContact.phone}
                    </dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-gray-500">Status</dt>
                    <dd>
                      <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-0.5 text-xs text-cyan-100">
                        {selectedContact.status}
                      </span>
                    </dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-gray-500">Lifetime</dt>
                    <dd className="font-semibold tabular-nums text-white">{formatMoney(selectedContact.lifetimeValue)}</dd>
                  </div>
                </dl>
                <div className="mt-6 rounded-lg border border-white/10 bg-black/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-300">{selectedContact.notes}</p>
                </div>
              </div>
            </div>
          )}

          {view === 'deals' && !selectedDeal && (
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Deals</h1>
                <p className="mt-1 text-sm text-gray-400">Click a card for details. Stages are fixed for this demo.</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-4">
                {STAGES.map((col) => (
                  <div key={col.id} className="rounded-xl border border-white/10 bg-[#0a0f18] p-3">
                    <h2 className="mb-3 border-b border-white/10 pb-2 text-xs font-bold uppercase tracking-wide text-cyan-200/70">
                      {col.label}
                    </h2>
                    <div className="space-y-2">
                      {DEALS.filter((d) => d.stage === col.id).map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setSelectedDealId(d.id)}
                          className="w-full rounded-lg border border-white/10 bg-[#0c1220] p-3 text-left text-sm transition-colors hover:border-[#00d4ff]/35 hover:bg-[#0066ff]/10"
                        >
                          <p className="font-semibold text-white">{d.title}</p>
                          <p className="mt-1 text-xs text-gray-400">{d.company}</p>
                          <p className="mt-2 font-bold tabular-nums text-cyan-200">{formatMoney(d.value)}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'deals' && selectedDeal && (
            <div className="mx-auto max-w-2xl space-y-6">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 gap-1 text-cyan-200 hover:bg-white/5 hover:text-white"
                onClick={() => setSelectedDealId(null)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to pipeline
              </Button>
              <div className="rounded-xl border border-[#0066ff]/30 bg-[#0c1220] p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/60">Deal</p>
                <h1 className="mt-1 text-2xl font-bold text-white">{selectedDeal.title}</h1>
                <p className="mt-2 text-lg font-semibold tabular-nums text-cyan-200">{formatMoney(selectedDeal.value)}</p>
                <dl className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Contact</dt>
                    <dd className="text-right font-medium text-white">{selectedDeal.contactName}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Company</dt>
                    <dd className="text-right text-gray-300">{selectedDeal.company}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Stage</dt>
                    <dd className="text-right">
                      <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-xs capitalize text-cyan-100">
                        {selectedDeal.stage}
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="flex items-center gap-1.5 text-gray-500">
                      <Calendar className="h-3.5 w-3.5" aria-hidden />
                      Expected close
                    </dt>
                    <dd className="text-right text-gray-300">{selectedDeal.expectedClose}</dd>
                  </div>
                </dl>
                <div className="mt-6 rounded-lg border border-white/10 bg-black/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Summary</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-300">{selectedDeal.summary}</p>
                </div>
              </div>
            </div>
          )}

          {view === 'tasks' && (
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Tasks</h1>
                <p className="mt-1 text-sm text-gray-400">Check items off — changes reset when you refresh the page.</p>
              </div>
              <ul className="space-y-2">
                {tasks.map((t) => (
                  <li
                    key={t.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#0c1220] p-4 transition-colors hover:border-white/15',
                      t.done && 'opacity-60',
                    )}
                    onClick={() => toggleTask(t.id)}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold',
                        t.done ? 'border-cyan-400/50 bg-cyan-400/20 text-cyan-100' : 'border-white/20 bg-black/30',
                      )}
                      aria-hidden
                    >
                      {t.done ? '✓' : ''}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('font-medium text-white', t.done && 'line-through decoration-white/40')}>{t.title}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        Due {t.due} · {t.related}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
