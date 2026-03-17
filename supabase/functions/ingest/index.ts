import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Rate Limiting ---
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 3600_000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

function getClientIP(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
}

function chunkText(text: string, size = 500, overlap = 100): { chunk_index: number; text: string }[] {
  const chunks: { chunk_index: number; text: string }[] = [];
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return chunks;
  let start = 0;
  let index = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + size, cleaned.length);
    chunks.push({ chunk_index: index++, text: cleaned.substring(start, end) });
    start += size - overlap;
  }
  return chunks;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // JWT auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  if (isRateLimited(clientIP)) {
    console.warn(`[ingest] Rate limited: ${clientIP}`);
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Max 3 uploads per hour." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const aiApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return new Response(JSON.stringify({ error: "Expected multipart/form-data with a 'file' field" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const file = formData.get("file") as File;
    if (!file) {
      return new Response(JSON.stringify({ error: "PDF file required. Send as 'file' in form data." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate file type via both extension and MIME
    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
      return new Response(JSON.stringify({ error: "Only PDF files are accepted." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file.size > 20 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File too large. Maximum size is 20MB." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ingest] Processing: ${file.name} (${(file.size / 1024).toFixed(1)} KB) from IP: ${clientIP}`);

    const buffer = new Uint8Array(await file.arrayBuffer());

    // Upload to storage
    const storagePath = `${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("pdfs")
      .upload(storagePath, buffer, { contentType: "application/pdf" });

    if (uploadError) {
      console.error("[ingest] Storage upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to upload PDF" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ingest] ✓ Uploaded to storage: ${storagePath}`);

    // Extract text using Gemini multimodal
    const base64Pdf = btoa(String.fromCharCode(...buffer));
    console.log(`[ingest] Sending PDF to AI for text extraction (${(base64Pdf.length / 1024).toFixed(0)} KB base64)`);

    let extractedText = "";
    try {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract ALL text content from this PDF document. Return ONLY the raw text content, preserving paragraphs and structure. Do not add any commentary, headers, or formatting. Just the exact text from the document."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:application/pdf;base64,${base64Pdf}`
                  }
                }
              ]
            }
          ],
        }),
      });

      if (!aiResponse.ok) {
        console.error(`[ingest] AI extraction failed: ${aiResponse.status}`);
        return new Response(JSON.stringify({ error: "Failed to extract text from PDF. Please try again." }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResponse.json();
      extractedText = aiData.choices?.[0]?.message?.content || "";
      console.log(`[ingest] ✓ AI extracted ${extractedText.length} characters`);
    } catch (e) {
      console.error("[ingest] AI text extraction error:", e);
      return new Response(JSON.stringify({ error: "Failed to extract text from PDF. Please try again." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (extractedText.trim().length < 50) {
      console.warn("[ingest] Very little text extracted from PDF");
      return new Response(JSON.stringify({
        error: "Could not extract meaningful text from this PDF. It may be blank, scanned/image-only, or corrupted.",
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create source
    const title = file.name.replace(/\.pdf$/i, "");
    const { data: source, error: sourceError } = await supabase
      .from("sources")
      .insert({ title, file_url: storagePath })
      .select()
      .single();

    if (sourceError) {
      console.error("[ingest] Source insert error:", sourceError);
      return new Response(JSON.stringify({ error: "Failed to create source record" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ingest] ✓ Source created: ${source.id}`);

    // Chunk text
    const chunks = chunkText(extractedText);
    console.log(`[ingest] Created ${chunks.length} chunks`);

    // Generate embeddings and store chunks
    let chunksCreated = 0;
    let embeddingsFailed = 0;
    for (const chunk of chunks) {
      let embedding = null;
      try {
        const embeddingResponse = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${aiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: chunk.text,
          }),
        });

        if (embeddingResponse.ok) {
          const embData = await embeddingResponse.json();
          embedding = embData.data?.[0]?.embedding || null;
        } else {
          embeddingsFailed++;
          console.warn(`[ingest] Embedding failed for chunk ${chunk.chunk_index}: ${embeddingResponse.status}`);
        }
      } catch (e) {
        embeddingsFailed++;
        console.warn(`[ingest] Embedding error for chunk ${chunk.chunk_index}:`, e);
      }

      const { error: chunkError } = await supabase.from("content_chunks").insert({
        source_id: source.id,
        chunk_index: chunk.chunk_index,
        text: chunk.text,
        embedding,
      });

      if (chunkError) {
        console.error(`[ingest] Chunk ${chunk.chunk_index} insert error:`, chunkError);
      } else {
        chunksCreated++;
      }
    }

    console.log(`[ingest] ✓ Complete: ${chunksCreated} chunks stored, ${embeddingsFailed} embeddings failed`);

    return new Response(
      JSON.stringify({
        success: true,
        source_id: source.id,
        chunks_created: chunksCreated,
        text_length: extractedText.length,
        embeddings_failed: embeddingsFailed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[ingest] Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
