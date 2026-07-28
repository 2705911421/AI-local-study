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
  required: [
    "score",
    "feedback",
    "coveredKeyPoints",
    "missingKeyPoints",
  ],
  additionalProperties: false,
};

function blocksSchema(ids) {
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

export function buildTask(request, imagePath) {
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

export function parseStructured(value, requestId) {
  const parsed =
    typeof value === "string" ? parseJsonObject(value) : value;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("智能来源返回格式不正确");
  }
  if ("blocks" in parsed) {
    if (!Array.isArray(parsed.blocks)) throw new Error("智能文本格式不正确");
    return {
      requestId,
      blocks: parsed.blocks.filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.text === "string" &&
          item.text.trim().length > 8,
      ),
    };
  }
  if ("score" in parsed) {
    const score = Number(parsed.score);
    if (
      !Number.isFinite(score) ||
      score < 0 ||
      score > 1 ||
      typeof parsed.feedback !== "string" ||
      !Array.isArray(parsed.coveredKeyPoints) ||
      !Array.isArray(parsed.missingKeyPoints)
    ) {
      throw new Error("模型评分缺少必要字段");
    }
    return {
      requestId,
      grade: {
        score,
        feedback: parsed.feedback,
        coveredKeyPoints: parsed.coveredKeyPoints.map(String),
        missingKeyPoints: parsed.missingKeyPoints.map(String),
      },
    };
  }
  if (typeof parsed.text === "string" && parsed.text.trim()) {
    return { requestId, text: parsed.text.trim() };
  }
  throw new Error("智能来源没有返回可用内容");
}

function parseJsonObject(content) {
  const fenced =
    content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || content;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("智能来源没有返回 JSON");
  return JSON.parse(fenced.slice(start, end + 1));
}

