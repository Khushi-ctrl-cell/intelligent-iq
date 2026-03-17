import { useEffect, useState } from "react";
import { fetchStudentStats } from "@/lib/api";

interface ProgressData {
  correct_count: number;
  wrong_count: number;
  mastery_level: string;
  topic: string;
}

export default function StudentStats() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [recentDifficulty, setRecentDifficulty] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await fetchStudentStats();
      if (data.progress) {
        setProgress(data.progress as ProgressData);
      }
      setTotalAttempts(data.total_attempts || 0);
      setRecentDifficulty(data.recent_difficulty || null);
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const accuracy = progress
    ? progress.correct_count + progress.wrong_count > 0
      ? ((progress.correct_count / (progress.correct_count + progress.wrong_count)) * 100).toFixed(0)
      : "0"
    : "—";

  const masteryClass = !progress
    ? "text-muted-foreground"
    : progress.mastery_level === "mastered"
      ? "text-difficulty-easy"
      : progress.mastery_level === "improving"
        ? "text-difficulty-medium"
        : progress.mastery_level === "weak"
          ? "text-difficulty-hard"
          : "text-muted-foreground";

  const difficultyColor = !recentDifficulty
    ? "text-muted-foreground"
    : recentDifficulty === "easy"
      ? "text-difficulty-easy"
      : recentDifficulty === "medium"
        ? "text-difficulty-medium"
        : "text-difficulty-hard";

  if (loading) {
    return (
      <div className="panel">
        <h2 className="panel-header">Student Stats</h2>
        <p className="text-xs text-muted-foreground animate-pulse-slow">[LOADING...]</p>
      </div>
    );
  }

  return (
    <div className="panel space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="panel-header mb-0">Student Stats</h2>
        <button
          onClick={loadStats}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          REFRESH
        </button>
      </div>

      <div className="data-row">
        <span className="data-label">QUESTIONS_ATTEMPTED:</span>
        <span className="data-value">{totalAttempts}</span>
      </div>
      <div className="data-row">
        <span className="data-label">ACCURACY:</span>
        <span className="data-value">{accuracy}%</span>
      </div>
      <div className="data-row">
        <span className="data-label">CURRENT_DIFFICULTY:</span>
        <span className={`text-sm font-medium uppercase ${difficultyColor}`}>
          {recentDifficulty || "N/A"}
        </span>
      </div>
      <div className="data-row">
        <span className="data-label">MASTERY:</span>
        <span className={`text-sm font-semibold uppercase ${masteryClass}`}>
          {progress?.mastery_level || "N/A"}
        </span>
      </div>
      {progress && (
        <div className="data-row">
          <span className="data-label">CORRECT/WRONG:</span>
          <span className="text-xs">
            <span className="text-primary">{progress.correct_count}</span>
            <span className="text-muted-foreground"> / </span>
            <span className="text-destructive">{progress.wrong_count}</span>
          </span>
        </div>
      )}
    </div>
  );
}
