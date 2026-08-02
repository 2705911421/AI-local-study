const textResultSchema = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
  additionalProperties: false,
};

const gradeSchema = {
  type: "object",
  properties: {
    score: { type: "number", minimum: 0, maximum: 1 },
    feedback: { type: "string" },
    coveredKeyPoints: { type: "array", items: { type: "string" } },
    missingKeyPoints: { type: "array", items: { type: "string" } },
  },
  required: ["score", "feedback", "coveredKeyPoints", "missingKeyPoints"],
  additionalProperties: false,
};

const quizSchema = {
  type: "object",
  properties: {
    quiz: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          kind: {
            type: "string",
            enum: ["recall", "distinguish", "choice", "application"],
          },
          prompt: { type: "string" },
          answer: { type: "string" },
          rationale: { type: "string" },
          locator: { type: "string" },
          evidenceBlockId: { type: "string" },
          keyPoints: { type: "array", items: { type: "string" } },
          options: { type: "array", items: { type: "string" } },
        },
        required: [
          "id",
          "kind",
          "prompt",
          "answer",
          "rationale",
          "locator",
          "evidenceBlockId",
          "keyPoints",
          "options",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["quiz"],
  additionalProperties: false,
};

function blocksSchema(ids: string[]): JsonSchema {
  return {
    type: "object",
    properties: {
      blocks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: ids },
            text: { type: "string" },
          },
          required: ["id", "text"],
          additionalProperties: false,
        },
      },
    },
    required: ["blocks"],
    additionalProperties: false,
  };
}

export function buildTask(
  request: IntelligenceRequest,
  imagePath?: string,
): BuiltTask {
  const common =
    "不要调用任何工具，不要读取文件或网络，只处理下面明确提供的教材内容。";
  switch (request.task) {
    case "answer": {
      const evidence = request.payload.citations
        .map(
          (citation, index) =>
            `[证据 ${index + 1}｜${citation.locator}]\n${citation.excerpt}`,
        )
        .join("\n\n");
      return {
        prompt:
          `${common}\n你是教材伴学助手。只能依据证据回答，不得使用外部知识。` +
          `证据不足时必须回答“教材中未找到足够依据”。用简洁中文作答。\n\n` +
          `问题：${request.payload.question}\n\n${evidence}`,
        schema: textResultSchema,
      };
    }
    case "enhance-blocks": {
      const source = request.payload.blocks.map((block) => ({
        id: block.id,
        page: block.page,
        text: block.text,
      }));
      return {
        prompt:
          `${common}\n你是教材文本整理器。只清理页眉页脚、断词和多余空格，` +
          `不得总结、推断、删减事实或补充外部知识。保留标题、编号、术语、数据和顺序。\n\n` +
          JSON.stringify(source),
        schema: blocksSchema(source.map((item) => item.id)),
      };
    }
    case "enhance-selection": {
      const source = request.payload.blocks.map((block, index) => ({
        order: index + 1,
        page: block.page,
        text: block.text,
      }));
      return {
        prompt:
          `${common}\n将相邻原文整理为一份结构清晰的中文稿。修复断词和空格，` +
          `不得总结、推断、删减事实或补充外部知识。\n\n${JSON.stringify(source)}`,
        schema: textResultSchema,
      };
    }
    case "grade":
      return {
        prompt:
          `${common}\n你是教材练习评分器。只依据参考答案和关键要点评价，` +
          `score 必须为 0 到 1，反馈使用一句中文。\n\n` +
          JSON.stringify(request.payload),
        schema: gradeSchema,
      };
    case "generate-quiz":
      return {
        prompt:
          `${common}\n你是教材练习设计器。只根据给出的章节原文生成 ${request.payload.count} 道题。` +
          `题型在 recall、distinguish、choice、application 中分布；每题必须引用一个真实 block id 和 locator，` +
          `给出简洁参考答案、解析和关键点，不得加入教材外事实。\n\n` +
          JSON.stringify(request.payload),
        schema: quizSchema,
      };
    case "explain-image":
      return {
        prompt:
          `${common}\n请讲解教材 PDF 第 ${request.payload.page} 页图像中可见的示意图、` +
          `流程图、结构图或图表。只依据可见标题、标注、箭头、图例和关系作答。` +
          `先说明图在表达什么，再按阅读顺序解释；若没有有意义的图，请明确说明。` +
          (imagePath ? `\n图像已作为本次输入附加：${imagePath}` : ""),
        schema: textResultSchema,
        imageDataUrl: request.payload.dataUrl,
        imagePath,
      };
    default:
      throw new Error("不支持的智能任务");
  }
}

export function parseStructured(
  value: unknown,
  requestId: string,
): IntelligenceResult {
  const parsed = typeof value === "string" ? parseJsonObject(value) : value;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("智能来源返回格式不正确");
  }
  const record = parsed as Record<string, unknown>;
  if ("blocks" in record) {
    if (!Array.isArray(record.blocks)) throw new Error("智能文本格式不正确");
    return {
      requestId,
      blocks: record.blocks.filter(isGeneratedBlock),
    };
  }
  if ("quiz" in record) {
    if (!Array.isArray(record.quiz)) throw new Error("练习题格式不正确");
    const quiz = record.quiz.filter(isQuizItem);
    if (!quiz.length) throw new Error("智能来源没有返回有效练习题");
    return { requestId, quiz };
  }
  if ("score" in record) {
    const score = Number(record.score);
    if (
      !Number.isFinite(score) ||
      score < 0 ||
      score > 1 ||
      typeof record.feedback !== "string" ||
      !Array.isArray(record.coveredKeyPoints) ||
      !Array.isArray(record.missingKeyPoints)
    ) {
      throw new Error("模型评分缺少必要字段");
    }
    return {
      requestId,
      grade: {
        score,
        feedback: record.feedback,
        coveredKeyPoints: record.coveredKeyPoints.map(String),
        missingKeyPoints: record.missingKeyPoints.map(String),
      },
    };
  }
  if (typeof record.text === "string" && record.text.trim()) {
    return { requestId, text: record.text.trim() };
  }
  throw new Error("智能来源没有返回可用内容");
}

function parseJsonObject(content: string): Record<string, unknown> {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || content;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("智能来源没有返回 JSON");
  return JSON.parse(fenced.slice(start, end + 1)) as Record<string, unknown>;
}

function isQuizItem(item: unknown): item is QuizItemOutput {
  if (!isRecord(item)) return false;
  return (
    typeof item.id === "string" &&
    ["recall", "distinguish", "choice", "application"].includes(
      String(item.kind),
    ) &&
    typeof item.prompt === "string" &&
    typeof item.answer === "string" &&
    typeof item.rationale === "string" &&
    typeof item.locator === "string" &&
    typeof item.evidenceBlockId === "string" &&
    Array.isArray(item.keyPoints) &&
    item.keyPoints.every((point) => typeof point === "string") &&
    Array.isArray(item.options) &&
    item.options.every((option) => typeof option === "string")
  );
}

function isGeneratedBlock(item: unknown): item is { id: string; text: string } {
  return (
    isRecord(item) &&
    typeof item.id === "string" &&
    typeof item.text === "string" &&
    item.text.trim().length > 8
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
import type {
  BuiltTask,
  IntelligenceRequest,
  IntelligenceResult,
  JsonSchema,
  QuizItemOutput,
} from "./types.js";
