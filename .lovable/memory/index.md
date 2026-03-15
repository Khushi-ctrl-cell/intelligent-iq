Design system: dark zinc/emerald clinical lab aesthetic. JetBrains Mono + Inter fonts.
Colors: emerald primary, amber medium, red hard difficulty. Matte zinc background.
Stack: React+Vite+Tailwind+Supabase Edge Functions. No Next.js.
AI: AI Gateway (google/gemini-2.5-flash for PDF extraction, google/gemini-3-flash-preview for quiz). AI_API_KEY auto-provisioned.
DB: sources, content_chunks (pgvector), quiz_questions, quiz_attempts, student_topic_progress.
Storage: pdfs bucket (public).
Edge functions: ingest, generate-quiz, quiz, submit-answer, generate-explanation, health, admin-data, student-stats.
RLS: All tables deny-all for public. Edge functions use service_role to bypass RLS.
PDF parsing: Uses Gemini multimodal (base64 PDF → text extraction). DO NOT use npm:pdf-parse — it breaks in Deno edge runtime.
Frontend: All data reads go through edge functions (admin-data, student-stats, quiz), not direct Supabase client.
Branding: All platform-specific branding removed. Local vars use aiApiKey. Env var is still LOVABLE_API_KEY at runtime (platform-provisioned).
