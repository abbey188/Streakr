-- ─────────────────────────────────────────────────────────────────────
-- Streakr — Neon Postgres schema (v1)
--
-- All gameplay state lives off-chain here (handoff §3.1). The Solana
-- wallet address is the identity key (handoff §3.3). Shapes are designed
-- to compose into the exact TypeScript types in src/types.ts so the
-- existing frontend components need no prop-shape changes (handoff §4).
--
-- Design rule baked in (handoff §4): a streak only ever breaks on a wrong
-- pick — never on a schedule. "Chapter Champion" style features are READS
-- over pick history, not a reset mechanism. So we keep current_streak /
-- personal_best on users and the full pick history in `picks`.
--
-- Run against the Neon branch pointed at by DATABASE_URL.
-- ─────────────────────────────────────────────────────────────────────

-- Idempotent-ish: safe to re-run during development.
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ─── teams ────────────────────────────────────────────────────────────
-- Normalised so fixtures reference teams; API composes the `Team` shape
-- ({ id, name, flag, code }) on read.
create table if not exists teams (
  id    text primary key,         -- e.g. "bra"  (matches Team.id)
  name  text not null,            -- "Brazil"
  flag  text not null,            -- "🇧🇷" (emoji) or SVG ref
  code  text not null             -- "BRA"
);

-- ─── users ────────────────────────────────────────────────────────────
-- wallet_address is the stable identity (Phantom embedded wallet, §3.3).
-- avatar is the mascot/identity config, persisted so it renders for this
-- user AND for other users in leaderboards/activity feeds.
create table if not exists users (
  wallet_address  text primary key,
  username        text unique not null,
  email           text,                       -- from Phantom social login; optional
  avatar          jsonb not null,             -- AvatarConfig (src/types.ts)
  points          integer not null default 0,
  current_streak  integer not null default 0,
  personal_best   integer not null default 0,
  -- Per-type notification opt-outs. Empty = all on; keys set to false are muted.
  -- Keys: match_start | goal | pick_result | badge | round_champion
  notification_prefs jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);

-- Privy user DID (did:privy:...) bound at signup, used for server-side auth:
-- verify the caller's Privy token -> userId -> this row's wallet_address. Added
-- via ALTER so existing deployments pick it up without a table rebuild. Nullable
-- during the auth rollout; backfilled for existing users on first authed touch.
alter table users add column if not exists privy_user_id text;
create unique index if not exists users_privy_user_id_key
  on users (privy_user_id) where privy_user_id is not null;

-- ─── fixtures ─────────────────────────────────────────────────────────
-- Synced from TxLINE (handoff §7). Composes into the `Fixture` shape.
-- `actual_winner` is who ADVANCES (incl. extra time / penalties), not the
-- 90-minute scoreline (handoff §1).
create table if not exists fixtures (
  id             text primary key,            -- our id (may mirror TxLINE id)
  txline_id      text unique,                 -- external TxLINE fixture id
  round          text not null,               -- "Round of 16" | "Quarterfinals" | ...
  team_a_id      text not null references teams(id),
  team_b_id      text not null references teams(id),
  status         text not null default 'upcoming'
                   check (status in ('upcoming','live','finished')),
  score_a        integer,
  score_b        integer,
  minute         integer,                     -- only meaningful while live
  kickoff_time   text not null,               -- display string (matches Fixture.kickoffTime)
  kickoff_at     timestamptz,                 -- real timestamp for reminders/sorting
  actual_winner  text check (actual_winner in ('A','B')),  -- filled when finished
  updated_at     timestamptz not null default now()
);

-- Pick window (Issue 5): open until first goal / red card / 2nd-half kickoff.
-- Computed during sync from the live snapshot; drives the live-card pick states.
alter table fixtures add column if not exists pick_open boolean;
alter table fixtures add column if not exists pick_close_reason text;
alter table fixtures add column if not exists period text; -- live game phase for ET/stoppage display
create index if not exists fixtures_status_idx on fixtures (status);
create index if not exists fixtures_kickoff_idx on fixtures (kickoff_at);

-- ─── picks ────────────────────────────────────────────────────────────
-- One pick per user per fixture. `correct` is resolved against
-- fixtures.actual_winner when the match finishes. Full history retained
-- so streaks can be recomputed and chapter reads derived.
create table if not exists picks (
  id             uuid primary key default gen_random_uuid(),
  user_address   text not null references users(wallet_address) on delete cascade,
  fixture_id     text not null references fixtures(id) on delete cascade,
  pick           text not null check (pick in ('A','B')),
  resolved       boolean not null default false,
  correct        boolean,                     -- null until resolved
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  unique (user_address, fixture_id)
);
create index if not exists picks_user_idx on picks (user_address);
create index if not exists picks_fixture_idx on picks (fixture_id);

-- ─── groups ───────────────────────────────────────────────────────────
-- All social is group-scoped — no global follow graph (handoff §4).
create table if not exists groups (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  emoji            text,
  invite_code      text unique not null,
  created_by       text references users(wallet_address) on delete set null,
  -- Creator picks how this group's leaderboard ranks members.
  leaderboard_type text not null default 'streak'
                     check (leaderboard_type in ('streak','points','both')),
  created_at       timestamptz not null default now()
);

create table if not exists group_members (
  group_id      uuid not null references groups(id) on delete cascade,
  user_address  text not null references users(wallet_address) on delete cascade,
  joined_at     timestamptz not null default now(),
  primary key (group_id, user_address)
);

-- ─── activity feed (group-scoped) ─────────────────────────────────────
-- Composes into the `ActivityItem` shape directly. `reactions` is a
-- denormalised { [emoji]: count } map (matches ActivityItem.reactions) —
-- real reactions increment the json; keeps reads single-row and the demo
-- counts exact. A normalised per-user reaction table can come later if we
-- need to enforce one-reaction-per-user.
create table if not exists group_activity_events (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references groups(id) on delete cascade,
  actor_address  text references users(wallet_address) on delete set null,
  type           text not null check (type in ('milestone','break','win','badge')),
  message        text not null,
  reactions      jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists activity_group_idx on group_activity_events (group_id, created_at desc);

-- ─── badges ───────────────────────────────────────────────────────────
-- Off-chain achievement catalog (NFT version is a future, separate
-- feature — handoff §3.3 / §10). Composes into the `Badge` shape.
create table if not exists badges (
  id           text primary key,
  name         text not null,
  icon         text not null,        -- emoji or lucide icon name
  description  text not null,
  color        text not null         -- tailwind gradient classes, e.g. "from-orange-500 to-red-600"
);

create table if not exists user_badges (
  user_address  text not null references users(wallet_address) on delete cascade,
  badge_id      text not null references badges(id) on delete cascade,
  awarded_at    timestamptz not null default now(),
  primary key (user_address, badge_id)
);

-- ─── notifications (personalized, powers the Inbox) ───────────────────────
create table if not exists notifications (
  id            uuid primary key default gen_random_uuid(),
  user_address  text not null references users(wallet_address) on delete cascade,
  type          text not null,   -- 'pick_result'|'badge'|'round_champion'|'goal'|'match_start'|'group'|'announcement'
  title         text not null,
  body          text not null,
  icon          text,            -- emoji
  fixture_id    text,            -- optional link + dedupe key for live events
  dedup_key     text,            -- stable per-event key: goal (running score), group (actor:type:message)
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table notifications add column if not exists dedup_key text;
create index if not exists notifications_user_idx on notifications (user_address, created_at desc);
-- Kickoff dedup by body (one per user+fixture). Goals dedup by a STABLE key
-- (the goal action's Seq) instead of body — so a rapid double fires twice while
-- a score flicker / late scorer-resolution can't duplicate. Backs
-- `on conflict do nothing` so concurrent sync runs can't create duplicates.
drop index if exists notifications_live_dedup;
create unique index if not exists notifications_live_dedup
  on notifications (user_address, fixture_id, type, body)
  where type = 'match_start' and fixture_id is not null;
create unique index if not exists notifications_goal_dedup
  on notifications (user_address, fixture_id, dedup_key)
  where type = 'goal' and dedup_key is not null;

-- ─── champions (R32/R16/QF rounds + the 'Tournament' sentinel; idempotent) ─
-- round = 'Tournament' is the overall "The Streakr" crown, awarded when the
-- Final completes. group_id null = global; set = that group's champion.
create table if not exists round_champions (
  id            uuid primary key default gen_random_uuid(),
  round         text not null,
  group_id      uuid references groups(id) on delete cascade,  -- null = global
  user_address  text not null references users(wallet_address) on delete cascade,
  correct_count integer not null,
  points        integer,  -- winning score; the deciding metric for the Tournament crown
  crowned_at    timestamptz not null default now()
);
alter table round_champions add column if not exists points integer;
-- One champion per (round, scope). Coalesce null group_id so global is unique too.
create unique index if not exists round_champions_uniq
  on round_champions (round, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ─── announcements (backend-drivable glance strip; per-user dismissal client-side) ─
-- One row = one announcement shown to all (or a future audience). Created from
-- the backend (INSERT). "Live" = active AND now within [starts_at, ends_at].
create table if not exists announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  icon       text,                                  -- emoji
  kind       text not null default 'info',          -- info | tip | warning | update
  cta_label  text,
  cta_href   text,
  audience   text not null default 'all',           -- 'all' | future segments
  priority   integer not null default 0,            -- higher shows first
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz,                            -- null = no expiry
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists announcements_live_idx on announcements (active, starts_at);

-- ─── push subscriptions (Web Push / PWA) ──────────────────────────────────
-- One row per browser/device push subscription. `endpoint` is the push
-- service URL and uniquely identifies a subscription (upsert on re-subscribe).
-- A user can have several (phone + desktop). Pruned when the push service
-- returns 404/410 (subscription gone).
create table if not exists push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_address  text not null references users(wallet_address) on delete cascade,
  endpoint      text unique not null,
  p256dh        text not null,   -- client public key (for encryption)
  auth          text not null,   -- client auth secret
  created_at    timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_address);
