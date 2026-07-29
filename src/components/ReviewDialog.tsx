import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowSquareOut, ClockCounterClockwise, X } from "@phosphor-icons/react";
import type {
  ReviewRating,
  ReviewSchedule,
  StudyDocument,
  TextBlock,
} from "../types";
import { useAppContext } from "../AppContext";

export interface ReviewQueueItem {
  schedule: ReviewSchedule;
  document: StudyDocument;
  chapterTitle: string;
  block: TextBlock;
}

const RATINGS: Array<{ value: ReviewRating; label: string; hint: string }> = [
  { value: "again", label: "重来", hint: "10 分钟后" },
  { value: "hard", label: "困难", hint: "约 1 天" },
  { value: "good", label: "良好", hint: "按计划推进" },
  { value: "easy", label: "简单", hint: "延长间隔" },
];

export function ReviewDialog({
  items,
  onRate,
  onOpenEvidence,
}: {
  items: ReviewQueueItem[];
  onRate: (item: ReviewQueueItem, rating: ReviewRating) => Promise<void>;
  onOpenEvidence: (item: ReviewQueueItem) => void;
}) {
  const ctx = useAppContext();
  const [skipped, setSkipped] = useState<string[]>([]);
  const item = useMemo(
    () => items.find((candidate) => !skipped.includes(candidate.schedule.id)),
    [items, skipped],
  );

  return (
    <Dialog.Root
      open={ctx.overlay === "review"}
      onOpenChange={(open) => {
        if (!open) {
          setSkipped([]);
          ctx.setOverlay(null);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="overlay review-overlay">
          <Dialog.Content className="modal review-modal">
            <Dialog.Close asChild>
              <button className="modal-close" aria-label="关闭今日复习">
                <X size={19} />
              </button>
            </Dialog.Close>
            <div className="review-heading">
              <ClockCounterClockwise size={24} />
              <div>
                <Dialog.Title>今日复习</Dialog.Title>
                <Dialog.Description>
                  根据你的掌握情况安排下一次复习。
                </Dialog.Description>
              </div>
            </div>
            {item ? (
              <>
                <div className="review-context">
                  <span>{item.document.displayTitle || item.document.title}</span>
                  <strong>{item.chapterTitle}</strong>
                </div>
                <blockquote>{item.block.smartText || item.block.text}</blockquote>
                <button
                  className="review-evidence"
                  onClick={() => onOpenEvidence(item)}
                >
                  <ArrowSquareOut size={16} />
                  返回教材依据 · {item.block.locator}
                </button>
                <div className="review-ratings" aria-label="复习掌握程度">
                  {RATINGS.map((rating) => (
                    <button
                      key={rating.value}
                      onClick={() => void onRate(item, rating.value)}
                    >
                      <strong>{rating.label}</strong>
                      <span>{rating.hint}</span>
                    </button>
                  ))}
                </div>
                <div className="review-footer">
                  <span>剩余 {items.length - skipped.length} 项</span>
                  <button
                    onClick={() =>
                      setSkipped((current) => [...current, item.schedule.id])
                    }
                  >
                    跳过本项
                  </button>
                </div>
              </>
            ) : (
              <div className="review-complete">
                <strong>今天的复习已完成</strong>
                <span>新的到期内容会继续出现在这里。</span>
                <Dialog.Close asChild>
                  <button className="primary-button">完成</button>
                </Dialog.Close>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
