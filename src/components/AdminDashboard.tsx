import { useEffect, useState } from "react";
import { fetchHealth, fetchAdminData, fetchHealthAdmin } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import type { Source, ContentChunk, QuizQuestion, QuizAttempt, AIQualityMetric } from "@/types/quiz";

interface HealthData {
  status: string;
  services: { database: string; ai: string; storage: string };
  config: { embedding_model: string; quiz_model: string; rate_limit_quiz: string; rate_limit_explanation: string };
  timestamp: string;
}

export default function AdminDashboard() {
  const { isDemo } = useAuth();
  const [sources, setSources] = useState<Source[]>([]);
  const [chunks, setChunks] = useState<ContentChunk[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [aiMetrics, setAiMetrics] = useState<AIQualityMetric[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"status" | "sources" | "chunks" | "questions" | "attempts" | "analytics" | "ai-quality">("status");
  const [adminKey, setAdminKey] = useState("");
  const [authenticated, setAuthenticated] = useState(isDemo);
  const [authError, setAuthError] = useState("");

  const loadData = async (key: string) => {
    try {
      const data = await fetchAdminData(key);
      setSources((data.sources || []) as Source[]);
      setChunks((data.chunks || []) as ContentChunk[]);
      setQuestions((data.questions || []) as QuizQuestion[]);
      setAttempts((data.attempts || []) as QuizAttempt[]);
      setAiMetrics((data.ai_metrics || []) as AIQualityMetric[]);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    }
  };

  const loadHealth = async (key?: string) => {
    setHealthLoading(true);
    try {
      const data = key ? await fetchHealthAdmin(key) : await fetchHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  };

  const handleLogin = async () => {
    setAuthError("");
    try {
      await fetchAdminData(adminKey);
      setAuthenticated(true);
      loadData(adminKey);
      loadHealth(adminKey);
    } catch {
      setAuthError("Invalid admin key");
    }
  };

  useEffect(() => {
    if (isDemo) {
      loadHealth().catch(() => {});
    }
  }, [isDemo]);

  if (!authenticated) {
    return (
      <div className="panel space-y-4 max-w-md mx-auto mt-12">
        <h2 className="panel-header">Admin Authentication</h2>
        <p className="text-xs text-muted-foreground">Enter the admin secret key to access the dashboard.</p>
        <input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          placeholder="Admin secret key..."
          className="w-full bg-secondary text-foreground text-sm px-3 py-2 border border-border focus:border-primary focus:outline-none"
        />
        {authError && <p className="text-xs text-destructive">{authError}</p>}
        <button
          onClick={handleLogin}
          disabled={!adminKey}
          className="px-4 py-2 text-xs font-semibold bg-foreground text-background hover:bg-primary disabled:opacity-50 transition-colors"
        >
          AUTHENTICATE()
        </button>
      </div>
    );
  }

  const tabs = [
    { key: "status" as const, label: "STATUS", count: null },
    { key: "sources" as const, label: "SOURCES", count: sources.length },
    { key: "chunks" as const, label: "CHUNKS", count: chunks.length },
    { key: "questions" as const, label: "QUESTIONS", count: questions.length },
    { key: "attempts" as const, label: "ATTEMPTS", count: attempts.length },
    { key: "analytics" as const, label: "ANALYTICS", count: null },
    { key: "ai-quality" as const, label: "AI QUALITY", count: aiMetrics.length },
  ];

  const totalCorrect = attempts.filter((a) => a.is_correct).length;
  const avgAccuracy = attempts.length > 0 ? ((totalCorrect / attempts.length) * 100).toFixed(1) : "0";

  const difficultyBreakdown = {
    easy: questions.filter((q) => q.difficulty === "easy").length,
    medium: questions.filter((q) => q.difficulty === "medium").length,
    hard: questions.filter((q) => q.difficulty === "hard").length,
  };

  function serviceStatusDot(val: string) {
    if (val === "connected" || val === "available") return "status-dot status-dot-active";
    if (val.startsWith("error") || val === "unavailable" || val === "unreachable") return "status-dot status-dot-error";
    return "status-dot status-dot-idle";
  }

  function serviceLabel(val: string) {
    return val.toUpperCase();
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors whitespace-nowrap
              ${activeTab === tab.key
                ? "text-primary border-b border-primary"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span className="ml-1.5 text-muted-foreground">({tab.count})</span>
            )}
          </button>
        ))}
        <button
          onClick={() => { loadData(adminKey); loadHealth(adminKey); }}
          className="ml-auto px-3 py-2 text-[10px] font-semibold text-muted-foreground
            hover:text-foreground transition-colors"
        >
          REFRESH
        </button>
      </div>

      {/* System Status */}
      {activeTab === "status" && (
        <div className="space-y-4">
          <div className="panel">
            <h2 className="panel-header">System Status</h2>
            {healthLoading ? (
              <p className="text-xs text-muted-foreground animate-pulse-slow">[CHECKING...]</p>
            ) : health ? (
              <div className="space-y-2">
                <div className="data-row">
                  <span className="data-label">OVERALL:</span>
                  <span className={`text-sm font-bold uppercase ${health.status === "ok" ? "text-primary" : "text-destructive"}`}>
                    {health.status}
                  </span>
                </div>
                <div className="border-t border-border pt-2 mt-2 space-y-1.5">
                  {Object.entries(health.services).map(([key, val]) => (
                    <div key={key} className="data-row">
                      <span className="data-label flex items-center gap-2">
                        <span className={serviceStatusDot(val)} />
                        {key.toUpperCase()}:
                      </span>
                      <span className={`text-xs font-medium ${val === "connected" || val === "available" ? "text-primary" : "text-destructive"}`}>
                        {serviceLabel(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-destructive">Health check unavailable</p>
            )}
          </div>

          {health?.config && (
            <div className="panel">
              <h2 className="panel-header">Configuration</h2>
              <div className="space-y-1.5">
                <div className="data-row">
                  <span className="data-label">EMBEDDING_MODEL:</span>
                  <span className="text-xs text-foreground">{health.config.embedding_model}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">QUIZ_MODEL:</span>
                  <span className="text-xs text-foreground">{health.config.quiz_model}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">RATE_LIMIT_QUIZ:</span>
                  <span className="text-xs text-foreground">{health.config.rate_limit_quiz}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">RATE_LIMIT_EXPLANATION:</span>
                  <span className="text-xs text-foreground">{health.config.rate_limit_explanation}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">LAST_CHECK:</span>
                  <span className="text-xs text-muted-foreground">{new Date(health.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => loadHealth(adminKey)}
            disabled={healthLoading}
            className="px-4 py-2 text-xs font-semibold bg-foreground text-background
              hover:bg-primary disabled:opacity-50 transition-colors"
          >
            {healthLoading ? "[CHECKING...]" : "RUN_HEALTH_CHECK()"}
          </button>
        </div>
      )}

      {/* Sources */}
      {activeTab === "sources" && (
        <div className="space-y-2">
          {sources.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sources uploaded yet.</p>
          ) : (
            sources.map((s) => (
              <div key={s.id} className="panel">
                <div className="data-row">
                  <span className="data-label">TITLE:</span>
                  <span className="data-value">{s.title}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">ID:</span>
                  <span className="text-xs text-muted-foreground font-mono">{s.id}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">CREATED:</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Chunks */}
      {activeTab === "chunks" && (
        <div className="space-y-2">
          {chunks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No chunks extracted yet.</p>
          ) : (
            chunks.map((c) => (
              <div key={c.id} className="panel">
                <div className="flex justify-between mb-2">
                  <span className="text-[10px] text-muted-foreground">
                    CHUNK #{c.chunk_index} — SOURCE: {c.source_id.slice(0, 8)}
                  </span>
                </div>
                <p className="text-xs text-secondary-foreground leading-relaxed line-clamp-3 font-sans">
                  {c.text}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Questions */}
      {activeTab === "questions" && (
        <div className="space-y-2">
          {questions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No questions generated yet.</p>
          ) : (
            questions.map((q) => (
              <div key={q.id} className="panel">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm text-foreground">{q.question}</p>
                  <span
                    className={`shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase border
                    ${q.difficulty === "easy"
                        ? "bg-difficulty-easy text-difficulty-easy border-difficulty-easy"
                        : q.difficulty === "medium"
                          ? "bg-difficulty-medium text-difficulty-medium border-difficulty-medium"
                          : "bg-difficulty-hard text-difficulty-hard border-difficulty-hard"
                      }`}
                  >
                    {q.difficulty}
                  </span>
                </div>
                <div className="data-row">
                  <span className="data-label">ANSWER:</span>
                  <span className="text-xs text-primary">{q.answer}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">TYPE:</span>
                  <span className="text-xs text-muted-foreground">{q.type}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Attempts */}
      {activeTab === "attempts" && (
        <div className="space-y-2">
          {attempts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No attempts recorded yet.</p>
          ) : (
            attempts.map((a) => (
              <div key={a.id} className="panel">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`status-dot ${a.is_correct ? "status-dot-active" : "status-dot-error"}`} />
                  <span className={`text-xs font-semibold ${a.is_correct ? "text-primary" : "text-destructive"}`}>
                    {a.is_correct ? "CORRECT" : "INCORRECT"}
                  </span>
                </div>
                <div className="data-row">
                  <span className="data-label">QUESTION_ID:</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {a.question_id?.slice(0, 8) || "N/A"}
                  </span>
                </div>
                <div className="data-row">
                  <span className="data-label">ANSWER:</span>
                  <span className="text-xs text-foreground">{a.selected_answer}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">DIFFICULTY:</span>
                  <span className="text-xs text-muted-foreground">{a.difficulty_at_time}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">TIME:</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Analytics */}
      {activeTab === "analytics" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="panel text-center">
            <p className="text-2xl font-bold text-primary">{sources.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">PDFs</p>
          </div>
          <div className="panel text-center">
            <p className="text-2xl font-bold text-primary">{chunks.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">CHUNKS</p>
          </div>
          <div className="panel text-center">
            <p className="text-2xl font-bold text-primary">{questions.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">QUESTIONS</p>
          </div>
          <div className="panel text-center">
            <p className="text-2xl font-bold text-primary">{avgAccuracy}%</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">ACCURACY</p>
          </div>
          <div className="panel col-span-2 md:col-span-4">
            <h3 className="panel-header">Difficulty Distribution</h3>
            <div className="flex gap-6">
              <div>
                <span className="text-lg font-bold text-difficulty-easy">{difficultyBreakdown.easy}</span>
                <span className="text-[10px] text-muted-foreground ml-1.5">EASY</span>
              </div>
              <div>
                <span className="text-lg font-bold text-difficulty-medium">{difficultyBreakdown.medium}</span>
                <span className="text-[10px] text-muted-foreground ml-1.5">MEDIUM</span>
              </div>
              <div>
                <span className="text-lg font-bold text-difficulty-hard">{difficultyBreakdown.hard}</span>
                <span className="text-[10px] text-muted-foreground ml-1.5">HARD</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Quality Metrics */}
      {activeTab === "ai-quality" && (
        <div className="space-y-4">
          {(() => {
            const totalGenerated = aiMetrics.reduce((s, m) => s + m.questions_generated, 0);
            const totalRejected = aiMetrics.reduce((s, m) => s + m.questions_rejected, 0);
            const totalVerified = aiMetrics.reduce((s, m) => s + m.questions_verified, 0);
            const overallAccuracy = totalGenerated > 0 ? ((totalVerified / totalGenerated) * 100).toFixed(1) : "0";

            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="panel text-center">
                    <p className="text-2xl font-bold text-foreground">{totalGenerated}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">GENERATED</p>
                  </div>
                  <div className="panel text-center">
                    <p className="text-2xl font-bold text-destructive">{totalRejected}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">REJECTED</p>
                  </div>
                  <div className="panel text-center">
                    <p className="text-2xl font-bold text-primary">{totalVerified}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">VERIFIED</p>
                  </div>
                  <div className="panel text-center">
                    <p className="text-2xl font-bold text-primary">{overallAccuracy}%</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">AI ACCURACY</p>
                  </div>
                </div>

                {aiMetrics.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No AI quality metrics recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    <h3 className="panel-header">Generation History</h3>
                    {aiMetrics.map((m) => (
                      <div key={m.id} className="panel">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(m.created_at).toLocaleString()}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
                            m.accuracy_rate >= 80
                              ? "text-primary border-primary/30 bg-primary/10"
                              : m.accuracy_rate >= 50
                                ? "text-difficulty-medium border-difficulty-medium"
                                : "text-destructive border-destructive/30 bg-destructive/10"
                          }`}>
                            {m.accuracy_rate}% ACCURACY
                          </span>
                        </div>
                        <div className="flex gap-6 text-xs">
                          <span><span className="text-muted-foreground">GEN:</span> {m.questions_generated}</span>
                          <span><span className="text-destructive">REJ:</span> {m.questions_rejected}</span>
                          <span><span className="text-primary">VER:</span> {m.questions_verified}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
