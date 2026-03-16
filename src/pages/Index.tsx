import { useState, useEffect } from "react";
import PipelineTest from "@/components/PipelineTest";
import QuizQuestionCard from "@/components/QuizQuestionCard";
import AdminDashboard from "@/components/AdminDashboard";
import StudentStats from "@/components/StudentStats";
import type { QuizQuestion } from "@/types/quiz";

type Tab = "pipeline" | "quiz" | "admin";

const Index = () => {
  const [tab, setTab] = useState<Tab>("pipeline");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [sourceId, setSourceId] = useState<string | null>(null);

  const tabs: { key: Tab; label: string }[] = [
    { key: "pipeline", label: "PIPELINE" },
    { key: "quiz", label: "QUIZ" },
    { key: "admin", label: "ADMIN" },
  ];

  return (
    <div className="min-h-screen bg-background p-6 md:p-8 max-w-5xl mx-auto">
      {/* Title */}
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-xl font-bold tracking-tighter text-foreground">
          AI_QUIZ_ENGINE<span className="text-primary">_V1.0</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          PDF → CHUNKS → EMBEDDINGS → AI QUIZ → ADAPTIVE DIFFICULTY
        </p>
      </header>

      {/* Nav */}
      <nav className="flex gap-1 mb-8 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors
              ${tab === t.key
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Pipeline */}
      {tab === "pipeline" && (
        <PipelineTest
          onQuizGenerated={(qs, sid) => {
            setQuestions(qs);
            setSourceId(sid);
          }}
          onSourceIngested={(sid) => setSourceId(sid)}
          sourceId={sourceId}
        />
      )}

      {/* Quiz */}
      {tab === "quiz" && (
        <div className="space-y-6">
          {/* Student Stats Panel */}
          <StudentStats />

          <div className="flex items-center gap-4">
            <h2 className="panel-header mb-0">Quiz Questions</h2>
          </div>

          {questions.length === 0 ? (
            <div className="panel border-border">
              <div className="py-8 text-center space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  No Quiz Generated
                </p>
                <p className="text-xs text-muted-foreground">
                  Upload and ingest a PDF to generate quiz questions.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q) => (
                <QuizQuestionCard key={q.id} question={q} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admin */}
      {tab === "admin" && <AdminDashboard />}
    </div>
  );
};

export default Index;
