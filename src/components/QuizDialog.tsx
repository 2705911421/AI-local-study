import * as Dialog from "@radix-ui/react-dialog";
import { Quotes, X } from "@phosphor-icons/react";
import { useLearning, useShell } from "../workspace/WorkspaceDomains";

export function QuizDialog({
  onGrade,
  onNext,
  onSetMastery,
}: {
  onGrade: () => void;
  onNext: () => void;
  onSetMastery: (value: "mastered" | "review") => void;
}) {
  const learning = useLearning();
  const shell = useShell();
  const { quiz, quizIndex, quizAnswer, quizScore, quizMastery } = learning;
  if (!quiz.length || !quiz[quizIndex]) return null;

  return (
    <Dialog.Root
      open={shell.overlay === "quiz" && quiz.length > 0}
      onOpenChange={(open) => !open && shell.closeOverlay()}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="overlay quiz-overlay">
          <Dialog.Content className="modal quiz-modal">
            <Dialog.Close asChild>
              <button
                type="button"
                className="modal-close"
                aria-label="关闭章节练习"
              >
                <X size={19} />
              </button>
            </Dialog.Close>
            <div className="quiz-header">
              <span>章节练习</span>
              <strong>
                {quizIndex + 1} / {quiz.length}
              </strong>
            </div>
            <div
              className="quiz-progress"
              role="progressbar"
              aria-label="章节练习进度"
              aria-valuemin={1}
              aria-valuemax={quiz.length}
              aria-valuenow={quizIndex + 1}
            >
              <span
                style={{
                  width: `${((quizIndex + 1) / quiz.length) * 100}%`,
                }}
              />
            </div>
            <Dialog.Title>{quiz[quizIndex].prompt}</Dialog.Title>
            <Dialog.Description className="sr-only">
              根据当前章节教材依据完成练习，答案会自动保存在本机。
            </Dialog.Description>
            <span className="quiz-locator">
              <Quotes size={13} weight="fill" />
              评分依据：{quiz[quizIndex].locator}
            </span>
            <textarea
              rows={6}
              value={quizAnswer}
              onChange={(event) =>
                learning.changeQuizAnswer(event.target.value)
              }
              placeholder="用自己的话作答…"
              disabled={quizScore !== null}
            />
            {quizScore !== null && (
              <div
                className={`quiz-feedback ${quizScore >= 0.35 ? "good" : ""}`}
                role="status"
              >
                <strong>
                  {quizScore >= 0.65
                    ? "核心要点基本完整"
                    : quizScore >= 0.35
                      ? "已经覆盖部分关键内容"
                      : "建议回看教材依据"}
                </strong>
                <p>教材参考：{quiz[quizIndex].answer}</p>
                <div className="mastery-actions">
                  <span>你对这题的判断</span>
                  <button
                    type="button"
                    className={
                      quizMastery[quizIndex] === "mastered" ? "is-selected" : ""
                    }
                    onClick={() => onSetMastery("mastered")}
                  >
                    已掌握
                  </button>
                  <button
                    type="button"
                    className={
                      quizMastery[quizIndex] === "review" ? "is-selected" : ""
                    }
                    onClick={() => onSetMastery("review")}
                  >
                    需复习
                  </button>
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={shell.closeOverlay}
              >
                稍后继续
              </button>
              {quizScore === null ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={onGrade}
                  disabled={!quizAnswer.trim()}
                >
                  提交答案
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={onNext}
                >
                  {quizIndex < quiz.length - 1 ? "下一题" : "完成练习"}
                </button>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
