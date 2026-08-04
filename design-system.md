# 知页设计系统

## Direction

知页是本地 AI 教材学习助手。视觉语言采用“学术出版物 + 安静的数字阅读室”，重点是可信、可追溯和长时间阅读，而不是泛化的 SaaS 科技感。

## Stack Adaptation

The existing product is a Vite + React + TypeScript desktop/web app, so the asset workflow is adapted to that runtime: native `<img>` elements with fixed aspect-ratio wrappers replace `next/image`, while Motion and the existing Phosphor icon system remain in use.

## Tokens

```css
--paper: #f5f1e8;
--paper-raised: #faf8f2;
--ink: #22221f;
--accent: #315b4c;
--accent-soft: #dce5df;
--paper-brown: #b6a98f;
--annotation-red: #a85e52;
--highlight: #e8d99e;
```

## Typography

- Display: `Noto Serif SC`, used for editorial headlines.
- UI/body: `DM Sans` with system fallback.
- Micro labels: uppercase sans with generous tracking.
- Core headlines remain HTML text; generated images never carry primary copy.

## Shape And Motion

- One radius scale: 8px controls, 12px framed media.
- Borders are low-contrast green-gray, shadows are warm and soft.
- Motion is limited to reveal, hover lift, and route transition.
- `prefers-reduced-motion` disables transitions and entrance motion.

## Asset Rules

- Generated images: scene, material, editorial composition, device environment.
- CSS: paper grain, shadows, gradients, dividers, layout geometry.
- SVG/icon library: arrows, steps, chapter markers, botanical line work.
- Real product screenshots: only for actual product UI; never replace them with generated fake UI.

## Responsive Art Direction

- Desktop hero keeps the visual subject on the right and copy on the left.
- Mobile hides nonessential scene layers and preserves text, CTA, and product evidence.
- Non-hero assets use lazy loading and fixed aspect-ratio wrappers to avoid layout shift.
