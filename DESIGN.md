# Design Prompt：「知识觉醒」落地页

## Design Read

> Reading this as: Product landing page for a local-first AI study tool,
> with a "知识觉醒" (Knowledge Awakening) editorial language.
> NOT a SaaS template. NOT a generic portfolio.
> It should feel like you've opened a future academic book —
> and it's slowly coming to life, responding to your questions.

---

## 0. CORE CONCEPT — "知识觉醒"

The entire page is an experience about knowledge coming alive.
The visitor is not scrolling a webpage — they are witnessing a book awaken.
A textbook that has been sleeping, now begins to respond to human questions
because of AI.

### The Central Metaphor

1. **The Book**: a textbook with paper texture, chapter titles, page numbers
2. **The Awakening**: text becomes highlighted, annotated, connected to questions
3. **The Dialogue**: user asks → AI responds → answer connects back to original text

Every section serves this narrative arc: from silence to awakening.

---

## 1. PALETTE — "纸与墨"

### Light Mode (Primary)

| Token            | Value                       | Usage                                             |
| ---------------- | --------------------------- | ------------------------------------------------- |
| `--paper`        | `#F5F1E8`                   | Page background — warm off-white, like real paper |
| `--paper-raised` | `#FAF8F4`                   | Raised surfaces, cards — slightly lighter         |
| `--paper-aged`   | `#ECE8DF`                   | Stressed/older areas, alternate sections          |
| `--ink`          | `#20201D`                   | Body text — deep ink dark                         |
| `--ink-soft`     | `#4A4A46`                   | Secondary text                                    |
| `--ink-faint`    | `#8A8680`                   | Light text, placeholders                          |
| `--accent`       | `#315C4C`                   | Primary accent — ink green                        |
| `--accent-hover` | `#264A3C`                   | Darker accent for hover                           |
| `--pencil-red`   | `#B84A3C`                   | Annotation red — sparingly                        |
| `--highlight`    | `rgba(255, 224, 102, 0.35)` | Text highlight background                         |

### Dark Mode (Secondary — "夜读模式")

- Background: warm dark `#1A1814`
- Paper surfaces: `#242118`
- Ink: `#E8E2D8` (warm light)
- Accent: `#5FB898` (brighter for dark bg)

### Forbidden Colors

- ❌ Cyber blue
- ❌ Purple gradients
- ❌ Neon AI effects
- ❌ Glassmorphism
- ❌ Overly tech-feeling colors

---

## 2. TYPOGRAPHY — "学术著作"

### Font Stack

```css
/* Display — Headlines: book-like, literary, academic */
--font-display: "Noto Serif SC", "Source Han Serif SC", Georgia, serif;

/* Body — Clean, readable modern sans */
--font-body: "Noto Sans SC", "Source Han Sans SC", system-ui, sans-serif;

/* Mono — For index numbers */
--font-mono: "Cascadia Code", "JetBrains Mono", monospace;
```

### Type Scale

- **Hero h1**: `font-display`, `clamp(2.4rem, 5.5vw, 4rem)`, weight 700
- **Section h2**: `font-display`, `clamp(1.6rem, 3vw, 2.2rem)`, weight 600
- **Body text**: `font-body`, `16px`, `line-height: 1.75`
- **Index numbers**: `font-mono`, `0.72rem`, letter-spacing 0.1em

Headlines should feel like chapter titles of a future academic work.

---

## 3. PAGE STRUCTURE — 8 Sections

### ① Opening Scene (首屏)

- Full-screen cinematic opening
- Centered, large typography: "知识从未沉默。"
- Sub-line: "只是过去，我们无法向书本提问。"
- Subtitle with product name
- Two book-style buttons (outline style, not commercial CTA)
- Subtle textbook page line texture in background (faded)
- Staggered fade-in animation on load

### ② Book Awakening Animation (书本觉醒)

- The most important visual section
- Shows a textbook page with real content
- On scroll into viewport:
  1. Text appears
  2. Key phrase gets highlighted (animated highlight)
  3. User question fades in below
  4. AI answer fades in with source attribution
  5. Dashed connector line to original text
- Expresses: AI doesn't create answers, it helps understand the original text

### ③ Manifesto (理念宣言)

- Centered large quote: "答案不是终点，原文才是。"
- Below: citation-style block with left border accent
- Wide whitespace, generous line height
- Feels like a chapter epigraph

### ④ Knowledge Path (知识路径)

- Vertical timeline (not cards)
- Steps: 01 打开一本书 → 02 提出问题 → 03 找到位置 → 04 真正理解
- Numbered steps with connecting vertical line
- Each step: number + dot marker + title + description
- Feels like a table of contents / reading trajectory

### ⑤ Product Showcase (产品展示)

- Real product screenshot (pdf-reader.png)
- Museum exhibition style — clean frame, no tape/rotation
- Three numbered annotations below:
  - 01 原文定位
  - 02 上下文理解
  - 03 持续追问

### ⑥ Local First (本地优先)

- Centered, wide paragraph style
- Title: "你的教材，属于你自己。"
- Body: philosophical, not technical
- No bullet lists, no AES-256, no specs

### ⑦ Windows Download

- Title: "为长时间阅读，留下一张安静的桌面。"
- Download logic preserved (release manifest)
- Visual: quiet, study-room feel

### ⑧ Closing

- "从翻开教材，到真正理解。"
- "知页，让知识回应你的问题。"
- No excessive CTA buttons — just the statement

---

## 4. ANIMATION SYSTEM

### Principles

- **Slow, restrained, quiet**
- No particles, no complex 3D, no fancy transitions
- Like turning pages of a book

### Variants

- `fadeUp`: opacity 0→1, y 24→0, duration 0.7s
- `stagger`: children appear with 0.15s delay
- `highlightReveal`: background-size 0%→100% (left to right)
- Scroll-triggered: `whileInView` with `viewport: { once: true, amount: 0.15 }`

### Book Awakening Sequence

1. Page enters: fade up (0.7s)
2. Highlight animation: background sweep (1s, delayed 0.4s)
3. Question box: fade up (0.6s, delayed 1.2s)
4. Answer box: fade up (0.6s, delayed 2.0s)
5. Connector line: fade in (0.8s, delayed 2.3s)

### Global Speed

- Duration: 500-800ms
- Easing: cubic-bezier(0.25, 0.1, 0.25, 1)
- No bounce, no elastic

---

## 5. RESPONSIVE

- **Mobile** (<768px): awakening animation simplified, timeline compressed
- **Tablet** (768-1024px): full layout, slightly compressed padding
- **Desktop** (>1024px): full experience

### prefers-reduced-motion

- Skip all animations
- Show final states immediately
- All text line-height ≥ 1.75, body ≥ 16px

---

## 6. ANTI-PATTERNS

Per taste-skill:

- ❌ No AI purple/blue gradients
- ❌ No Inter font
- ❌ No glassmorphism
- ❌ No em-dashes
- ❌ No "scroll to explore" cues

Per brief:

- ❌ No SaaS template layouts
- ❌ No three-column card grids
- ❌ No AI robot imagery
- ❌ No "革命性 AI" / "赋能" / "提高效率"
- ❌ No commercial CTA buttons
- ❌ No notebook-specific elements (no hole-punch, no ruled lines, no sticky notes, no tabs)
- ❌ No notebook metaphor — the concept is now "book awakening", not "student notebook"

---

## 7. TECHNICAL NOTES

- **Stack**: Vite + React + Framer Motion + pure CSS (NOT Next.js + Tailwind)
- **Components**: Single `LandingPage.tsx` component
- **Styling**: Single `landing.css` with CSS custom properties
- **Dark mode**: `@media (prefers-color-scheme: dark)` with variable overrides
- **Accessibility**: `prefers-reduced-motion`, proper ARIA labels, semantic HTML
