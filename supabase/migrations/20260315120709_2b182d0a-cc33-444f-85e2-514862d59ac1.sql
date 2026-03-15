
-- Enable pgvector extension
create extension if not exists vector with schema extensions;

-- 1. Sources table
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_url text not null,
  created_at timestamp with time zone default now()
);

alter table public.sources enable row level security;
create policy "Sources are publicly readable" on public.sources for select using (true);
create policy "Sources can be inserted by anyone" on public.sources for insert with check (true);

-- 2. Content Chunks table
create table public.content_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id) on delete cascade not null,
  chunk_index int not null,
  subject text,
  topic text,
  text text not null,
  embedding vector(1536),
  metadata jsonb,
  created_at timestamp with time zone default now()
);

alter table public.content_chunks enable row level security;
create policy "Chunks are publicly readable" on public.content_chunks for select using (true);
create policy "Chunks can be inserted by anyone" on public.content_chunks for insert with check (true);

-- 3. Quiz Questions table
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id) on delete cascade,
  source_chunk_id uuid references public.content_chunks(id),
  question_hash text unique,
  question text not null,
  type text check (type in ('MCQ', 'True/False', 'Fill-in-the-blank')),
  options jsonb,
  answer text not null,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  created_at timestamp with time zone default now()
);

alter table public.quiz_questions enable row level security;
create policy "Questions are publicly readable" on public.quiz_questions for select using (true);
create policy "Questions can be inserted by anyone" on public.quiz_questions for insert with check (true);

-- 4. Quiz Attempts table
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  question_id uuid references public.quiz_questions(id),
  selected_answer text not null,
  is_correct boolean not null,
  difficulty_at_time text,
  created_at timestamp with time zone default now()
);

alter table public.quiz_attempts enable row level security;
create policy "Attempts are publicly readable" on public.quiz_attempts for select using (true);
create policy "Attempts can be inserted by anyone" on public.quiz_attempts for insert with check (true);

-- 5. Student Topic Progress table
create table public.student_topic_progress (
  student_id uuid not null,
  topic text not null,
  correct_count int default 0,
  wrong_count int default 0,
  mastery_level text default 'beginner',
  primary key (student_id, topic)
);

alter table public.student_topic_progress enable row level security;
create policy "Progress is publicly readable" on public.student_topic_progress for select using (true);
create policy "Progress can be inserted by anyone" on public.student_topic_progress for insert with check (true);
create policy "Progress can be updated by anyone" on public.student_topic_progress for update using (true);

-- 6. Storage bucket for PDFs
insert into storage.buckets (id, name, public) values ('pdfs', 'pdfs', true);

create policy "PDFs are publicly accessible" on storage.objects for select using (bucket_id = 'pdfs');
create policy "Anyone can upload PDFs" on storage.objects for insert with check (bucket_id = 'pdfs');
