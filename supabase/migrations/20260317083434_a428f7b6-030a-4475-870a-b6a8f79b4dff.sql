-- Make PDF bucket private
UPDATE storage.buckets SET public = false WHERE id = 'pdfs';

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "PDFs are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload PDFs" ON storage.objects;
