import { useState } from "react";
import type { QuizQuestion } from "@/types/quiz";
import { submitAnswer, generateExplanation } from "@/lib/api";

const STUDENT_ID = "00000000-0000-0000-0000-000000000001";

interface QuizQuestionCardProps {
  question: QuizQuestion;
}

export default function QuizQuestionCard({ question }: QuizQuestionCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<{
    correct: boolean;
    correct_answer: string;
    next_difficulty: string;
  } | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [explLoading, setExplLoading] = useState(false);
  const [fillAnswer, setFillAnswer] = useState("");

  const difficultyClass = question.difficulty === "easy"
    ? "bg-difficulty-easy text-difficulty-easy border-difficulty-easy"
    : question.difficulty === "medium"
      ? "bg-difficulty-medium text-difficulty-medium border-difficulty-medium"
      : "bg-difficulty-hard text-difficulty-hard border-difficulty-hard";

  const handleSubmit = async () => {
    const answer = question.type === "Fill-in-the-blank" ? fillAnswer : selected;
    if (!answer) return;

    setLoading(true);
    try {
      const res = await submitAnswer(STUDENT_ID, question.id, answer);
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExplanation = async () => {
    if (!result) return;
    setExplLoading(true);
    try {
      const res = await generateExplanation(question.question, result.correct_answer);
      setExplanation(res.explanation);
    } catch (err) {
      console.error(err);
    } finally {
      setExplLoading(false);
    }
  };

  return (
    <div className="panel space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-foreground font-medium leading-relaxed">
          {question.question}
        </p>
        <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase border ${difficultyClass}`}>
          {question.difficulty}
        </span>
      </div>

      {/* Type badge + verification */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          TYPE: {question.type}
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">
          CHUNK: {question.source_chunk_id?.slice(0, 8) || "N/A"}
        </span>
        {question.is_verified && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary border border-primary/30 bg-primary/10">
            AI Verified ✔
          </span>
        )}
      </div>

      {/* Options */}
      {question.type === "Fill-in-the-blank" ? (
        <input
          type="text"
          value={fillAnswer}
          onChange={(e) => setFillAnswer(e.target.value)}
          placeholder="Type your answer..."
          disabled={!!result}
          className="w-full bg-secondary text-foreground text-sm px-3 py-2 border border-border
            focus:border-primary focus:outline-none disabled:opacity-50"
        />
      ) : (
        <div className="space-y-1">
          {(question.options as string[] | null)?.map((opt, i) => (
            <button
              key={i}
              onClick={() => !result && setSelected(opt)}
              disabled={!!result}
              className={`w-full text-left px-3 py-2 text-sm border transition-colors
                ${selected === opt
                  ? result
                    ? result.correct && opt === selected
                      ? "border-status-success bg-difficulty-easy text-foreground"
                      : !result.correct && opt === selected
                        ? "border-status-error bg-difficulty-hard text-foreground"
                        : "border-border text-muted-foreground"
                    : "border-primary bg-secondary text-foreground"
                  : result && opt === result.correct_answer
                    ? "border-status-success bg-difficulty-easy text-foreground"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }
                disabled:cursor-default`}
            >
              <span className="text-muted-foreground mr-2 text-xs">
                {String.fromCharCode(65 + i)}.
              </span>
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Submit */}
      {!result && (
        <button
          onClick={handleSubmit}
          disabled={loading || (!selected && !fillAnswer)}
          className="px-4 py-2 text-xs font-semibold bg-foreground text-background
            hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "[SUBMITTING...]" : "SUBMIT_ANSWER()"}
        </button>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center gap-3">
            <span className={`status-dot ${result.correct ? "status-dot-active" : "status-dot-error"}`} />
            <span className={`text-sm font-semibold ${result.correct ? "text-primary" : "text-destructive"}`}>
              {result.correct ? "CORRECT" : "INCORRECT"}
            </span>
          </div>

          <div className="data-row">
            <span className="data-label">CORRECT_ANSWER:</span>
            <span className="data-value text-xs">{result.correct_answer}</span>
          </div>
          <div className="data-row">
            <span className="data-label">NEXT_DIFFICULTY:</span>
            <span className={`text-xs font-medium text-difficulty-${result.next_difficulty}`}>
              {result.next_difficulty?.toUpperCase()}
            </span>
          </div>

          {/* Explanation */}
          {!explanation ? (
            <button
              onClick={handleExplanation}
              disabled={explLoading}
              className="px-3 py-1.5 text-[10px] font-semibold border border-border
                text-muted-foreground hover:text-foreground hover:border-muted-foreground
                disabled:opacity-50 transition-colors"
            >
              {explLoading ? "[LOADING...]" : "GET_EXPLANATION()"}
            </button>
          ) : (
            <div className="p-3 bg-secondary text-sm text-secondary-foreground leading-relaxed font-sans">
              {explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
