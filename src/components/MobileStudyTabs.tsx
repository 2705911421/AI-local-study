import {
  BookOpen,
  Brain,
  NotePencil,
  TreeStructure,
} from "@phosphor-icons/react";

export type MobileStudyView = "reader" | "mentor" | "notes" | "mindmap";

export function MobileStudyTabs({
  value,
  onChange,
}: {
  value: MobileStudyView;
  onChange: (view: MobileStudyView) => void;
}) {
  return (
    <nav className="mobile-study-tabs" aria-label="学习视图">
      <button
        type="button"
        className={value === "reader" ? "active" : ""}
        onClick={() => onChange("reader")}
      >
        <BookOpen size={18} />
        阅读
      </button>
      <button
        type="button"
        className={value === "mentor" ? "active" : ""}
        onClick={() => onChange("mentor")}
      >
        <Brain size={18} />
        伴学
      </button>
      <button
        type="button"
        className={value === "notes" ? "active" : ""}
        onClick={() => onChange("notes")}
      >
        <NotePencil size={18} />
        笔记
      </button>
      <button
        type="button"
        className={value === "mindmap" ? "active" : ""}
        onClick={() => onChange("mindmap")}
      >
        <TreeStructure size={18} />
        导图
      </button>
    </nav>
  );
}
