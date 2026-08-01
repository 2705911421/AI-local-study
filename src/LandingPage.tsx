import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowRight,
  BookOpenText,
  Brain,
  Check,
  DownloadSimple,
  FilePdf,
  Fingerprint,
  NotePencil,
  PaperPlaneTilt,
  Quotes,
  ShieldCheck,
  WindowsLogo,
} from "@phosphor-icons/react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import "./landing.css";

const studyFlow = [
  {
    icon: FilePdf,
    title: "导入教材",
    text: "PDF 与 EPUB 在本机解析。扫描版 PDF 可按需启用本地 OCR。",
    note: "从你的资料开始",
  },
  {
    icon: BookOpenText,
    title: "读懂原文",
    text: "原版页面与智能文本双向定位，点击引用就能回到教材位置。",
    note: "答案始终可追溯",
  },
  {
    icon: Brain,
    title: "检验理解",
    text: "围绕当前教材问答、练习与复习。依据不足时，知页会明确说明。",
    note: "把阅读变成掌握",
  },
];

const boundaries = [
  "教材与学习记录默认保存在本机",
  "回答限定在当前导入的教材范围",
  "外部智能服务由你主动选择和连接",
  "学习备份支持 AES-256-GCM 加密",
];

const productPrinciples = [
  ["01", "本地解析"],
  ["02", "原文引用"],
  ["03", "依据不足时拒答"],
  ["04", "Windows x64"],
];

const reveal = {
  initial: { opacity: 0, y: 42, rotate: 0.6 },
  visible: { opacity: 1, y: 0, rotate: 0 },
};

export default function LandingPage() {
  const reduceMotion = useReducedMotion();
  const [isLeaving, setIsLeaving] = useState(false);
  const [release, setRelease] = useState<{
    available: boolean;
    version: string;
    downloadUrl: string;
    size: number;
    sha256: string;
    releaseDate: string;
  } | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const calmX = useSpring(pointerX, { stiffness: 90, damping: 24 });
  const calmY = useSpring(pointerY, { stiffness: 90, damping: 24 });
  const sketchX = useTransform(calmX, [-0.5, 0.5], [-18, 18]);
  const sketchY = useTransform(calmY, [-0.5, 0.5], [-12, 12]);
  const productX = useTransform(calmX, [-0.5, 0.5], [10, -10]);
  const productY = useTransform(calmY, [-0.5, 0.5], [7, -7]);
  const questionRotate = useTransform(calmX, [-0.5, 0.5], [-5, 5]);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 100, damping: 28 });
  const paperDrift = useTransform(progress, [0, 1], [0, -130]);

  useEffect(() => {
    if (!isLeaving) return;
    const timer = window.setTimeout(
      () => {
        window.location.assign(new URL("./app", window.location.href).href);
      },
      reduceMotion ? 20 : 720,
    );
    return () => window.clearTimeout(timer);
  }, [isLeaving, reduceMotion]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${import.meta.env.BASE_URL}release/latest.json`)
      .then((response) => {
        if (!response.ok) throw new Error("release manifest unavailable");
        return response.json();
      })
      .then((manifest) => {
        if (!cancelled) setRelease(manifest);
      })
      .catch(() => {
        if (!cancelled) setRelease(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reduceMotion || event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - bounds.left) / bounds.width - 0.5);
    pointerY.set((event.clientY - bounds.top) / bounds.height - 0.5);
  };

  const handlePointerLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  const handleAppEntry = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    if (!isLeaving) setIsLeaving(true);
  };

  const motionProps = reduceMotion
    ? {}
    : {
        initial: "initial",
        whileInView: "visible",
        viewport: { once: true, amount: 0.16 },
        variants: reveal,
        transition: {
          duration: 0.72,
          ease: [0.16, 1, 0.3, 1] as const,
        },
      };

  return (
    <div
      className="landing"
      ref={pageRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <motion.div
        className="paper-grain"
        style={reduceMotion ? undefined : { y: paperDrift }}
        aria-hidden="true"
      />
      <aside className="reading-progress" aria-hidden="true">
        <span>知页</span>
        <div>
          <motion.i style={{ scaleY: reduceMotion ? 1 : progress }} />
        </div>
      </aside>

      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label="知页首页">
          <img src={`${import.meta.env.BASE_URL}brand/logo-mark.svg`} alt="" />
          <span>知页</span>
          <small>本地教材伴学</small>
        </a>
        <nav aria-label="主导航">
          <a href="#workflow">怎么学习</a>
          <a href="#privacy">隐私边界</a>
          <a href="#download">Windows 版</a>
        </nav>
        <a className="nav-cta" href="./app" onClick={handleAppEntry}>
          在线体验
          <ArrowRight weight="bold" aria-hidden="true" />
        </a>
      </header>

      <main>
        <section className="hero" id="top">
          <div className="hero-copy">
            <p className="eyebrow">你的教材，你的学习现场</p>
            <h1>教材留在本地，问题回到原文。</h1>
            <p className="hero-lede">
              导入 PDF 或 EPUB，知页只依据当前教材回答。
            </p>
            <div className="hero-actions">
              <a
                className="primary-button"
                href="./app"
                onClick={handleAppEntry}
              >
                打开在线体验
                <ArrowRight weight="bold" aria-hidden="true" />
              </a>
              <a className="secondary-button" href="#download">
                查看 Windows 版
              </a>
            </div>
            <div className="hero-pencil-note" aria-hidden="true">
              <span>问题从这里出发</span>
              <i />
            </div>
          </div>

          <div className="hero-stage">
            <motion.div
              className="hero-sketch"
              style={reduceMotion ? undefined : { x: sketchX, y: sketchY }}
            >
              <img
                src={`${import.meta.env.BASE_URL}illustrations/research-notebook.webp`}
                alt=""
                width="1568"
                height="1003"
              />
            </motion.div>
            <motion.figure
              className="hero-visual"
              style={reduceMotion ? undefined : { x: productX, y: productY }}
            >
              <span className="paper-tape paper-tape-left" aria-hidden="true" />
              <span
                className="paper-tape paper-tape-right"
                aria-hidden="true"
              />
              <div className="hero-frame">
                <img
                  src={`${import.meta.env.BASE_URL}release/pdf-reader.png`}
                  alt="知页中同时显示教材原版页面、章节内容与伴学问答"
                  width="1500"
                  height="713"
                />
              </div>
              <figcaption>
                <span>同一阅读现场</span>
                教材原版、章节目录与伴学问答
              </figcaption>
            </motion.figure>
            <motion.div
              className="question-orbit"
              style={reduceMotion ? undefined : { rotate: questionRotate }}
              aria-hidden="true"
            >
              ?
            </motion.div>
          </div>
        </section>

        <a className="mobile-section-nav" href="#workflow">
          怎么学习
          <ArrowRight weight="bold" aria-hidden="true" />
        </a>

        <section className="principle-strip" aria-label="产品原则">
          {productPrinciples.map(([index, label], itemIndex) => (
            <motion.div
              key={label}
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: itemIndex * 0.07, duration: 0.45 }}
            >
              <span>{index}</span>
              <strong>{label}</strong>
            </motion.div>
          ))}
        </section>

        <section className="workflow section-shell" id="workflow">
          <motion.div className="section-intro" {...motionProps}>
            <p className="hand-note">一条能回到原文的学习路径</p>
            <h2>从翻开教材，到真正掌握。</h2>
            <p>
              不是另一个泛泛聊天框。每一次回答、练习和笔记，都围绕你正在读的内容发生。
            </p>
          </motion.div>
          <div className="flow-grid">
            {studyFlow.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article
                  className={`flow-item flow-item-${index + 1}`}
                  key={item.title}
                  {...motionProps}
                  transition={{
                    duration: 0.68,
                    delay: reduceMotion ? 0 : index * 0.08,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <div className="flow-index">0{index + 1}</div>
                  <div className="flow-icon">
                    <Icon weight="duotone" aria-hidden="true" />
                  </div>
                  <div className="flow-content">
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                    <span>{item.note}</span>
                  </div>
                  <i className="scribble-line" aria-hidden="true" />
                </motion.article>
              );
            })}
          </div>
        </section>

        <motion.section
          className="reading-story section-shell paper-sheet"
          {...motionProps}
        >
          <div className="story-copy">
            <Quotes weight="fill" aria-hidden="true" />
            <h2>答案不是终点，原文才是。</h2>
            <p>点击引用即可回到教材位置。整理后的内容不会替代你的原始教材。</p>
            <div className="story-detail" aria-label="原文能力">
              <span>PDF 原版阅读</span>
              <span>语义分段</span>
              <span>章节内检索</span>
            </div>
          </div>
          <motion.div
            className="story-image"
            whileHover={reduceMotion ? undefined : { rotate: -0.45, y: -5 }}
            transition={{ type: "spring", stiffness: 160, damping: 20 }}
          >
            <span className="paper-tape paper-tape-center" aria-hidden="true" />
            <img
              src={`${import.meta.env.BASE_URL}release/text-correspondence.png`}
              alt="知页智能文本与 PDF 原文段落对应高亮"
              width="1365"
              height="649"
              loading="lazy"
            />
          </motion.div>
          <span className="margin-note" aria-hidden="true">
            引用不是装饰
            <br />
            它是一条返回路径
          </span>
        </motion.section>

        <section className="privacy section-shell" id="privacy">
          <motion.div className="privacy-copy" {...motionProps}>
            <div className="privacy-mark">
              <Fingerprint weight="duotone" aria-hidden="true" />
            </div>
            <p className="hand-note">这条线，由你决定画在哪里</p>
            <h2>本地优先，是产品边界。</h2>
            <p>
              知页不会替你决定教材发给谁。你可以完全使用本地能力，也可以主动连接自己选择的智能来源。
            </p>
          </motion.div>
          <motion.div className="boundary-list" {...motionProps}>
            {boundaries.map((item, index) => (
              <motion.div
                key={item}
                whileHover={reduceMotion ? undefined : { x: 8 }}
              >
                <span className="boundary-number">0{index + 1}</span>
                <Check weight="bold" aria-hidden="true" />
                <span>{item}</span>
              </motion.div>
            ))}
          </motion.div>
        </section>

        <motion.section
          className="download section-shell paper-sheet"
          id="download"
          {...motionProps}
        >
          <div className="download-mark">
            <WindowsLogo weight="duotone" aria-hidden="true" />
          </div>
          <div className="download-copy">
            <p className="eyebrow">Windows 桌面版</p>
            <h2>为长时间阅读，留出一张安静的桌面。</h2>
            <p>
              首个正式版本面向 Windows
              x64。签名安装包完成发布审核后开放下载，在线体验现在即可使用。
            </p>
          </div>
          <div className="download-actions">
            {release?.available && release.downloadUrl ? (
              <a
                className="download-button"
                href={release.downloadUrl}
                aria-describedby="release-status"
              >
                <DownloadSimple weight="bold" aria-hidden="true" />
                下载 Windows {release.version}
              </a>
            ) : (
              <button type="button" disabled aria-describedby="release-status">
                <DownloadSimple weight="bold" aria-hidden="true" />
                等待签名版本
              </button>
            )}
            <span id="release-status">
              {release?.available
                ? `${(release.size / 1024 / 1024).toFixed(1)} MB · SHA-256 ${release.sha256.slice(0, 12)}…`
                : "正式包将经过 Authenticode 签名验证"}
            </span>
          </div>
          <PaperPlaneTilt
            className="download-doodle"
            weight="duotone"
            aria-hidden="true"
          />
        </motion.section>
      </main>

      <footer>
        <div className="footer-brand">
          <img src={`${import.meta.env.BASE_URL}brand/logo-mark.svg`} alt="" />
          <div>
            <strong>知页</strong>
            <span>本地教材伴学</span>
          </div>
        </div>
        <p>阅读、问答、练习与笔记，始终围绕你的教材。</p>
        <div className="footer-links">
          <a href="./app" onClick={handleAppEntry}>
            <NotePencil aria-hidden="true" />
            在线体验
          </a>
          <a href="#privacy">
            <ShieldCheck aria-hidden="true" />
            隐私边界
          </a>
        </div>
      </footer>

      {isLeaving ? (
        <motion.div
          className="page-transition"
          initial={reduceMotion ? false : { y: "100%", rotate: 1.5 }}
          animate={{ y: 0, rotate: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.68,
            ease: [0.76, 0, 0.24, 1],
          }}
          aria-hidden="true"
        >
          <div>
            <img
              src={`${import.meta.env.BASE_URL}brand/logo-mark.svg`}
              alt=""
            />
            <span>把教材翻到工作台</span>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
