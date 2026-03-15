# AI Quiz Generator

> A backend-focused AI learning system that ingests educational PDFs and automatically generates adaptive quizzes using LLM APIs.

The system uses semantic search (vector embeddings) to retrieve relevant content and generates MCQ, True/False, and Fill-in-the-blank questions. Students can answer questions and receive AI-generated explanations with adaptive difficulty.

---

## Tech Stack

| Layer       | Technology                              |
|-------------|----------------------------------------|
| Frontend    | React + Vite + TypeScript + Tailwind   |
| Backend     | Supabase Edge Functions (Deno)         |
| Database    | PostgreSQL + pgvector                  |
| AI          | AI Gateway (Gemini/GPT models)         |
| Storage     | Supabase Storage                       |

---

## Features

- **PDF Ingestion** — Upload PDFs, extract text via multimodal AI, split into semantic chunks
- **Vector Embeddings** — Generate embeddings for semantic retrieval (RAG)
- **AI Quiz Generation** — Auto-generate MCQ, True/False, Fill-in-the-blank questions
- **Adaptive Difficulty** — Dynamic difficulty adjustment based on student performance
- **AI Explanations** — On-demand explanations for correct answers
- **Attempt Tracking** — Full history of student answers with accuracy metrics
- **Knowledge Mastery** — Track mastery levels per topic (mastered / improving / weak)
- **Rate Limiting** — In-memory rate limiting on AI-powered endpoints
- **Admin Dashboard** — View sources, chunks, questions, attempts, and analytics
- **Student Stats** — Real-time performance panel with accuracy and mastery level

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    USER INTERFACE                     │
│   Pipeline Tab  │  Quiz Tab  │  Admin Tab  │ Stats   │
└────────┬────────┴─────┬──────┴──────┬──────┴────────┘
         │              │             │
         ▼              ▼             ▼
┌─────────────────────────────────────────────────────┐
│               SUPABASE EDGE FUNCTIONS                │
│                                                       │
│  POST /ingest          ── PDF → Text → Chunks → DB   │
│  POST /generate-quiz   ── Chunks → AI → Questions     │
│  GET  /quiz            ── Filtered question retrieval  │
│  POST /submit-answer   ── Evaluate + Adaptive Logic    │
│  POST /generate-explanation ── AI answer explanation   │
└────────┬────────────────────────────────────────┬────┘
         │                                        │
         ▼                                        ▼
┌──────────────────┐              ┌────────────────────┐
│  SUPABASE DB     │              │  AI GATEWAY        │
│  (PostgreSQL)    │              │                    │
│                  │              │  Gemini Flash      │
│  sources         │              │  (quiz generation, │
│  content_chunks  │              │   explanations)    │
│  quiz_questions  │              │                    │
│  quiz_attempts   │              │  Embeddings API    │
│  student_progress│              │  (text-embedding)  │
│  + pgvector      │              │                    │
└──────────────────┘              └────────────────────┘
         │
         ▼
┌──────────────────┐
│  SUPABASE        │
│  STORAGE         │
│  (PDF files)     │
└──────────────────┘
```

### Data Flow

```
User Uploads PDF
       ↓
Text Extraction (Gemini multimodal AI)
       ↓
Chunking (~500 char segments with overlap)
       ↓
Embedding Generation (text-embedding-3-small)
       ↓
Store in PostgreSQL + pgvector
       ↓
Semantic Retrieval (select relevant chunks)
       ↓
AI Quiz Generation (3 per chunk: easy, medium, hard)
       ↓
Quiz Interface (interactive question cards)
       ↓
Answer Evaluation (compare + log attempt)
       ↓
Adaptive Difficulty (easy→medium→hard ladder)
       ↓
AI Explanation (on-demand tutoring)
```

---

## Database Schema

| Table                    | Purpose                                        |
|--------------------------|------------------------------------------------|
| `sources`                | Uploaded PDF metadata (title, file URL)         |
| `content_chunks`         | Text segments with vector embeddings (pgvector) |
| `quiz_questions`         | AI-generated questions with dedup hash          |
| `quiz_attempts`          | Student answer history with correctness         |
| `student_topic_progress` | Mastery tracking per student per topic          |

### Adaptive Difficulty Logic

| Current   | If Correct → | If Incorrect → |
|-----------|-------------|----------------|
| Easy      | Medium      | Easy           |
| Medium    | Hard        | Easy           |
| Hard      | Hard        | Medium         |

### Mastery Levels

| Accuracy | Level     |
|----------|-----------|
| > 80%    | Mastered  |
| 50–80%   | Improving |
| < 50%    | Weak      |

---

## API Endpoints

### `POST /functions/v1/ingest`
Upload and process a PDF file.

**Input:** `multipart/form-data` with `file` field (PDF only, max 20MB)

**Response:**
```json
{
  "success": true,
  "source_id": "uuid",
  "chunks_created": 12,
  "text_length": 5840,
  "embeddings_failed": 0
}
```

### `POST /functions/v1/generate-quiz`
Generate quiz questions from ingested content.

**Input:**
```json
{ "source_id": "uuid" }
```

**Rate Limit:** 5 requests per minute per client IP

**Response:**
```json
{
  "success": true,
  "questions_generated": 15,
  "questions": [...]
}
```

### `GET /functions/v1/quiz`
Retrieve quiz questions with optional filters.

**Query Params:** `source_id`, `difficulty`

### `POST /functions/v1/submit-answer`
Submit and evaluate a student answer.

**Input:**
```json
{
  "student_id": "uuid",
  "question_id": "uuid",
  "selected_answer": "string"
}
```

**Response:**
```json
{
  "correct": true,
  "correct_answer": "Mitochondria",
  "next_difficulty": "hard"
}
```

### `POST /functions/v1/generate-explanation`
Get AI explanation for a question's correct answer.

**Rate Limit:** 10 requests per minute per client IP

---

## Error Handling

All API endpoints implement:
- ✅ Input validation (file type, required fields, type checking)
- ✅ Input sanitization (length limits on AI prompts)
- ✅ Structured JSON error responses with HTTP status codes
- ✅ AI gateway error forwarding (429 rate limit, 402 credits exhausted)
- ✅ Database operation error logging with `[function-name]` prefixes
- ✅ Duplicate question prevention via `question_hash`
- ✅ Graceful degradation (embeddings optional, chunks still stored)

---

## Rate Limiting

| Endpoint              | Limit                    |
|-----------------------|--------------------------|
| `generate-quiz`       | 5 requests/min per IP    |
| `generate-explanation` | 10 requests/min per IP   |

---

## How to Run

1. Open the app in preview
2. Navigate to the **PIPELINE** tab
3. **Upload a PDF** — click the file input and select a `.pdf` file
4. Wait for ingestion (text extraction + chunking + embedding)
5. Click **GENERATE_QUIZ()** to create AI questions
6. Switch to the **QUIZ** tab to answer questions
7. Click an option and hit **SUBMIT_ANSWER()**
8. View adaptive difficulty and request **GET_EXPLANATION()**
9. Check the **ADMIN** tab for full data inspection and analytics

---

## Project Structure

```
src/
├── components/
│   ├── PipelineTest.tsx      # PDF upload + ingestion UI
│   ├── QuizQuestionCard.tsx   # Interactive question component
│   ├── AdminDashboard.tsx     # Data inspection + analytics
│   └── StudentStats.tsx       # Real-time student performance
├── lib/
│   └── api.ts                 # Edge function API client
├── types/
│   └── quiz.ts                # TypeScript interfaces
└── pages/
    └── Index.tsx               # Main app with tab navigation

supabase/
└── functions/
    ├── ingest/index.ts         # PDF processing pipeline
    ├── generate-quiz/index.ts  # AI question generation + rate limiting
    ├── quiz/index.ts           # Question retrieval
    ├── submit-answer/index.ts  # Answer evaluation + adaptive logic
    └── generate-explanation/index.ts  # AI tutoring + rate limiting
```
