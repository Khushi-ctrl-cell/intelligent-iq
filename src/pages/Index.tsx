import { useState, useEffect } from "react";
import PipelineTest from "@/components/PipelineTest";
import QuizQuestionCard from "@/components/QuizQuestionCard";
import AdminDashboard from "@/components/AdminDashboard";
import StudentStats from "@/components/StudentStats";
import { fetchQuiz } from "@/lib/api";
import type { QuizQuestion } from "@/types/quiz";

type Tab = "pipeline" | "quiz" | "admin";

const Index = () => {
  const [tab, setTab] = useState<Tab>("pipeline");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<string>("");

  const loadQuestions = async () => {
    setQuizLoading(true);
    try {
      const params: Record<string, string> = {};
      if (difficultyFilter) params.difficulty = difficultyFilter;
      const res = await fetchQuiz(params);
      setQuestions(res.questions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setQuizLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "quiz") loadQuestions();
  }, [tab, difficultyFilter]);

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
      {tab === "pipeline" && <PipelineTest />}

      {/* Quiz */}
      {tab === "quiz" && (
        <div className="space-y-6">
          {/* Student Stats Panel */}
          <StudentStats />

          <div className="flex items-center gap-4">
            <h2 className="panel-header mb-0">Quiz Questions</h2>
            <div className="flex gap-1 ml-auto">
              {["", "easy", "medium", "hard"].map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficultyFilter(d)}
                  className={`px-3 py-1 text-[10px] font-bold uppercase border transition-colors
                    ${difficultyFilter === d
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {d || "ALL"}
                </button>
              ))}
            </div>
          </div>

          {quizLoading ? (
            <p className="text-xs text-muted-foreground animate-pulse-slow">[LOADING QUESTIONS...]</p>
          ) : questions.length === 0 ? (
            <div className="panel">
              <p className="text-xs text-muted-foreground">
                No questions found. Upload a PDF and generate a quiz first.
              </p>
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
