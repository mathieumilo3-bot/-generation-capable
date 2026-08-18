create table if not exists setter_candidates (
 id uuid primary key default gen_random_uuid(),
 full_name text not null,
 email text,
 profile_url text,
 platform text,
 headline text,
 experience_years numeric,
 high_ticket_experience boolean default false,
 dm_experience boolean default false,
 proof_of_results text,
 availability text,
 score integer default 0,
 priority text default 'secondary',
 status text default 'new',
 notes text,
 created_at timestamptz default now(),
 updated_at timestamptz default now()
);

create table if not exists setter_outreach (
 id uuid primary key default gen_random_uuid(),
 candidate_id uuid references setter_candidates(id) on delete cascade,
 channel text not null,
 step integer not null,
 message text not null,
 status text default 'draft',
 sent_at timestamptz,
 replied_at timestamptz,
 created_at timestamptz default now()
);

create table if not exists setter_applications (
 id uuid primary key default gen_random_uuid(),
 candidate_id uuid references setter_candidates(id) on delete cascade,
 status text default 'received',
 test_score numeric,
 interview_score numeric,
 decision text,
 created_at timestamptz default now(),
 updated_at timestamptz default now()
);

create table if not exists setter_metrics (
 id uuid primary key default gen_random_uuid(),
 candidate_id uuid references setter_candidates(id) on delete cascade,
 period_start date not null,
 contacts integer default 0,
 conversations integer default 0,
 qualified integer default 0,
 meetings_booked integer default 0,
 meetings_held integer default 0,
 sales integer default 0,
 revenue numeric default 0,
 created_at timestamptz default now(),
 unique(candidate_id, period_start)
);
