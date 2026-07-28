import type { StudyDocument } from "../types";

export const demoDocument: StudyDocument = {
  id: "demo-discrete-math",
  title: "离散数学学习样章",
  filename: "示例教材（内置）",
  kind: "demo",
  createdAt: Date.now(),
  chapters: [
    {
      id: "demo-c1",
      title: "第一章 命题与逻辑",
      order: 0,
      blocks: [
        {
          id: "demo-c1-b1",
          chapterId: "demo-c1",
          page: 3,
          locator: "第 3 页 · 1.1 命题",
          text: "能够判断真假的陈述句称为命题。命题的真假称为命题的真值，真值只有真和假两种。疑问句、祈使句以及无法确定真假的陈述句通常不构成命题。",
        },
        {
          id: "demo-c1-b2",
          chapterId: "demo-c1",
          page: 4,
          locator: "第 4 页 · 1.2 逻辑联结词",
          text: "由简单命题通过逻辑联结词构成的命题称为复合命题。常见联结词包括否定、合取、析取、蕴含与等价。合取命题只有在两个组成命题都为真时才为真。",
        },
        {
          id: "demo-c1-b3",
          chapterId: "demo-c1",
          page: 5,
          locator: "第 5 页 · 1.3 蕴含",
          text: "蕴含命题 p→q 只有在 p 为真且 q 为假时为假，在其余情形下均为真。其中 p 称为前件，q 称为后件。",
        },
      ],
    },
    {
      id: "demo-c2",
      title: "第二章 集合与关系",
      order: 1,
      blocks: [
        {
          id: "demo-c2-b1",
          chapterId: "demo-c2",
          page: 18,
          locator: "第 18 页 · 2.1 集合",
          text: "集合是由确定的、彼此可区分的对象组成的整体，组成集合的对象称为元素。若元素 a 属于集合 A，记作 a∈A；否则记作 a∉A。",
        },
        {
          id: "demo-c2-b2",
          chapterId: "demo-c2",
          page: 21,
          locator: "第 21 页 · 2.2 集合运算",
          text: "集合 A 与 B 的交集由同时属于 A 和 B 的元素组成，并集由至少属于 A 或 B 之一的元素组成。相对于全集 U，集合 A 的补集由所有属于 U 但不属于 A 的元素组成。",
        },
      ],
    },
    {
      id: "demo-c3",
      title: "第三章 图的基本概念",
      order: 2,
      blocks: [
        {
          id: "demo-c3-b1",
          chapterId: "demo-c3",
          page: 42,
          locator: "第 42 页 · 3.1 图",
          text: "一个图由顶点集合和边集合构成。若边没有方向，则称为无向图；若每条边都带有方向，则称为有向图。与某顶点关联的边数称为该顶点的度。",
        },
        {
          id: "demo-c3-b2",
          chapterId: "demo-c3",
          page: 45,
          locator: "第 45 页 · 3.2 路径与连通",
          text: "路径是顶点与边交替出现的序列，其中相邻顶点由对应的边连接。若无向图中任意两个顶点之间都存在路径，则称该图为连通图。",
        },
      ],
    },
  ],
};
