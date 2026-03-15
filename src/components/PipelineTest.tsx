import { useState } from "react";
import type { PipelineStatus, QuizQuestion } from "@/types/quiz";
import { ingestPDF, generateQuiz } from "@/lib/api";

export default function PipelineTest() {
  const [status, setStatus] = useState<PipelineStatus>("idle");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [chunksCreated, setChunksCreated] = useState(0);
  const [textLength, setTextLength] = useState(0);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);
    setStatus("uploading");

    try {
      setStatus("ingesting");
      const result = await ingestPDF(file);
      setSourceId(result.source_id);
      setChunksCreated(result.chunks_created);
      setTextLength(result.text_length || 0);
      setStatus("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingestion failed");
      setStatus("error");
    }
  };

  const handleGenerateQuiz = async () => {
    if (!sourceId) return;
    setError(null);
    setStatus("generating");

    try {
      const result = await generateQuiz(sourceId);
      setQuestions(result.questions || []);
      setStatus("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quiz generation failed");
      setStatus("error");
    }
  };

  const statusLabel = status.toUpperCase();
  const statusDotClass =
    status === "error"
      ? "status-dot status-dot-error"
      : status === "idle"
        ? "status-dot status-dot-idle"
        : "status-dot status-dot-active";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <span className={statusDotClass} />
          <span className="text-xs text-muted-foreground">
            PIPELINE: {statusLabel}
          </span>
        </div>
      </div>

      {/* Upload + Pipeline Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="panel">
          <h2 className="panel-header">1 — Ingestion</h2>
          <input
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            disabled={status === "ingesting" || status === "uploading"}
            className="block w-full text-muted-foreground text-xs
              file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs
              file:font-semibold file:bg-foreground file:text-background
              hover:file:bg-primary file:cursor-pointer
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {fileName && (
            <p className="mt-3 text-xs text-muted-foreground truncate">
              FILE: {fileName}
            </p>
          )}
        </div>

        <div className="panel">
          <h2 className="panel-header">Pipeline Data</h2>
          <div className="space-y-1">
            <div className="data-row">
              <span className="data-label">SOURCE_ID:</span>
              <span className="data-value text-xs truncate max-w-[180px]">
                {sourceId || "NULL"}
              </span>
            </div>
            <div className="data-row">
              <span className="data-label">CHUNKS:</span>
              <span className="data-value">{chunksCreated}</span>
            </div>
            <div className="data-row">
              <span className="data-label">TEXT_LEN:</span>
              <span className="data-value">{textLength}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Quiz */}
      {sourceId && (
        <div className="panel">
          <h2 className="panel-header">2 — Generate Quiz</h2>
          <button
            onClick={handleGenerateQuiz}
            disabled={status === "generating"}
            className="px-4 py-2 text-xs font-semibold bg-foreground text-background
              hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            {status === "generating" ? "[GENERATING...]" : "GENERATE_QUIZ()"}
          </button>
          {questions.length > 0 && (
            <p className="mt-3 text-xs text-primary">
              ✓ {questions.length} questions generated
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="panel border-destructive">
          <p className="text-xs text-destructive">ERROR: {error}</p>
        </div>
      )}
    </div>
  );
}
