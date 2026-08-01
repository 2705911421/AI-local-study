const DIMENSIONS = 192;

const CONCEPT_GROUPS = [
  ["费用", "成本", "价格", "花费", "开销", "cost", "price"],
  ["优势", "优点", "好处", "价值", "benefit", "advantage"],
  ["缺点", "不足", "风险", "局限", "劣势", "disadvantage", "risk"],
  ["原因", "缘由", "成因", "为什么", "cause", "reason"],
  ["方法", "方式", "步骤", "流程", "怎么", "如何", "method", "process"],
  ["定义", "含义", "概念", "是什么", "definition", "meaning"],
  ["作用", "功能", "用途", "目的", "function", "purpose"],
  ["提升", "增加", "增强", "提高", "improve", "increase"],
  ["降低", "减少", "下降", "缩减", "reduce", "decrease"],
  ["比较", "区别", "差异", "对比", "compare", "difference"],
] as const;

function hash(value: string, seed: number): number {
  let result = seed | 0;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 0x01000193);
  }
  return result >>> 0;
}

function normalizedText(value: string): string {
  return value.toLocaleLowerCase("zh-CN").replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * A small, deterministic embedding model that runs entirely in the renderer.
 * It projects character n-grams and a compact bilingual concept lexicon into
 * one normalized vector, so no教材 text or query leaves the device.
 */
export function embedLocalText(value: string): Float32Array {
  const text = normalizedText(value);
  const vector = new Float32Array(DIMENSIONS);
  if (!text) return vector;

  const features: Array<[string, number]> = [];
  for (let size = 1; size <= 3; size += 1) {
    for (let index = 0; index <= text.length - size; index += 1) {
      features.push([
        `g${size}:${text.slice(index, index + size)}`,
        size === 1 ? 0.35 : size === 2 ? 1 : 0.7,
      ]);
    }
  }
  CONCEPT_GROUPS.forEach((group, conceptIndex) => {
    if (group.some((term) => text.includes(term))) {
      features.push([`concept:${conceptIndex}`, 2.4]);
    }
  });

  for (const [feature, weight] of features) {
    const first = hash(feature, 0x811c9dc5);
    const second = hash(feature, 0x9e3779b9);
    vector[first % DIMENSIONS] += (first & 1 ? 1 : -1) * weight;
    vector[second % DIMENSIONS] += (second & 1 ? 0.5 : -0.5) * weight;
  }
  let norm = 0;
  for (const item of vector) norm += item * item;
  norm = Math.sqrt(norm);
  if (norm) {
    for (let index = 0; index < vector.length; index += 1)
      vector[index] /= norm;
  }
  return vector;
}

export function cosineSimilarity(
  left: Float32Array,
  right: Float32Array,
): number {
  let score = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1)
    score += left[index] * right[index];
  return Math.max(0, Math.min(1, score));
}
