import type { Sql } from 'postgres';

/** Older DBs had a `token` column; we no longer use it. */
async function migrateBookingLeadsSchema(sql: Sql) {
  try {
    await sql`ALTER TABLE booking_leads DROP COLUMN IF EXISTS token`;
  } catch {
    /* */
  }
}

/** Booking + consultation scheduling tables (idempotent). */
export async function initBookingTables(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS booking_leads (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      plan VARCHAR(32),
      notes TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'contacted', 'booked', 'completed', 'lost')),
      admin_notes TEXT,
      crm_lead_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await migrateBookingLeadsSchema(sql);

  await sql`
    CREATE TABLE IF NOT EXISTS booking_settings (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      slot_interval_minutes INT NOT NULL DEFAULT 30
        CHECK (slot_interval_minutes IN (15, 30, 60)),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    INSERT INTO booking_settings (id, slot_interval_minutes) VALUES (1, 30)
    ON CONFLICT (id) DO NOTHING
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS booking_weekday_rules (
      weekday SMALLINT PRIMARY KEY CHECK (weekday >= 0 AND weekday <= 6),
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      start_time TIME NOT NULL DEFAULT '09:00',
      end_time TIME NOT NULL DEFAULT '17:00',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const wc = await sql`SELECT COUNT(*)::int AS c FROM booking_weekday_rules`;
  if ((wc[0] as { c: number }).c === 0) {
    for (let d = 0; d <= 6; d++) {
      const enabled = d >= 1 && d <= 5;
      await sql`
        INSERT INTO booking_weekday_rules (weekday, enabled, start_time, end_time)
        VALUES (${d}, ${enabled}, ${'09:00'}, ${'17:00'})
      `;
    }
  }

  await sql`
    CREATE TABLE IF NOT EXISTS booking_appointments (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL REFERENCES booking_leads(id) ON DELETE CASCADE,
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'cancelled', 'completed')),
      no_show BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT,
      call_link TEXT,
      reminder_1h_sent_at TIMESTAMPTZ,
      reminder_30m_sent_at TIMESTAMPTZ,
      reminder_15m_sent_at TIMESTAMPTZ,
      call_link_alert_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS booking_appointments_one_active_per_start
    ON booking_appointments (starts_at)
    WHERE status = 'scheduled'
  `;

  await sql`CREATE INDEX IF NOT EXISTS booking_appointments_lead_id ON booking_appointments (lead_id)`;
  await sql`CREATE INDEX IF NOT EXISTS booking_appointments_starts_at ON booking_appointments (starts_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_booking_leads_email ON booking_leads (email)`;

  /** Admin-only blocks: slots show as taken (demand) but are not real appointments */
  await sql`
    CREATE TABLE IF NOT EXISTS booking_slot_holds (
      id SERIAL PRIMARY KEY,
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS booking_slot_holds_starts_unique
    ON booking_slot_holds (starts_at)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS booking_slot_holds_starts_at ON booking_slot_holds (starts_at)
  `;
}
