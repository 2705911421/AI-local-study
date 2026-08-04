import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  ArrowRight,
  BookOpenText,
  Check,
  DownloadSimple,
  FileText,
  LockKey,
  MagnifyingGlass,
  NotePencil,
  ShieldCheck,
  Sparkle,
  WindowsLogo,
} from "@phosphor-icons/react";
import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import "./landing.css";

const workflow = [
  {
    number: "01",
    title: "打开一本教材",
    text: "PDF 与 EPUB 在本机解析，从你正在读的那一页开始。",
    icon: BookOpenText,
  },
  {
    number: "02",
    title: "提出一个问题",
    text: "对着当前段落提问，不需要离开原文，也不需要重新描述上下文。",
    icon: NotePencil,
  },
  {
    number: "03",
    title: "找到依据",
    text: "回答附带章节、页码和原文位置，依据不足时会明确说明。",
    icon: MagnifyingGlass,
  },
  {
    number: "04",
    title: "形成自己的理解",
    text: "继续追问、练习和复习，让答案回到你的语言里。",
    icon: Sparkle,
  },
];

const featureNotes = [
  {
    title: "原文定位",
    text: "答案旁边就是来源，读完可以立刻核对。",
    icon: FileText,
  },
  {
    title: "上下文理解",
    text: "知页只围绕当前教材工作，不把你带离阅读。",
    icon: Sparkle,
  },
  {
    title: "本地优先",
    text: "教材与学习轨迹保存在本机，权限在你手中。",
    icon: LockKey,
  },
];

type ReleaseManifest = {
  available: boolean;
  version: string;
  downloadUrl: string;
  size: number;
  sha256: string;
  releaseDate: string;
};

export default function LandingPage() {
  const reduceMotion = useReducedMotion();
  const [isLeaving, setIsLeaving] = useState(false);
  const [release, setRelease] = useState<ReleaseManifest | null>(null);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 100, damping: 28 });

  useEffect(() => {
    let cancelled = false;
    void fetch(`${import.meta.env.BASE_URL}release/latest.json`)
      .then((response) => {
        if (!response.ok) throw new Error("release manifest unavailable");
        return response.json() as Promise<ReleaseManifest>;
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

  useEffect(() => {
    if (!isLeaving) return;
    const timer = window.setTimeout(
      () => window.location.assign(new URL("./app", window.location.href).href),
      reduceMotion ? 20 : 520,
    );
    return () => window.clearTimeout(timer);
  }, [isLeaving, reduceMotion]);

  const handleAppEntry = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    setIsLeaving(true);
  };

  const reveal = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.16 },
        transition: { duration: 0.68, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <div className="landing" id="top">
      <div className="paper-grain" aria-hidden="true" />
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
          <a href="#principle">理念</a>
          <a href="#workflow">怎么学习</a>
          <a href="#local-first">安全与隐私</a>
          <a href="#download">Windows 版</a>
        </nav>
        <a className="nav-cta" href="./app" onClick={handleAppEntry}>
          打开工作台 <ArrowRight weight="bold" aria-hidden="true" />
        </a>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">KNOWLEDGE, WITH CONTEXT</p>
            <motion.h1
              id="hero-title"
              {...(reduceMotion
                ? {}
                : {
                    initial: { opacity: 0, y: 18 },
                    animate: { opacity: 1, y: 0 },
                    transition: { duration: 0.72 },
                  })}
            >
              教材留在本地，<em>问题回到原文。</em>
            </motion.h1>
            <motion.p
              className="hero-lede"
              {...(reduceMotion
                ? {}
                : {
                    initial: { opacity: 0, y: 14 },
                    animate: { opacity: 1, y: 0 },
                    transition: { delay: 0.12, duration: 0.7 },
                  })}
            >
              知页把 PDF 与 EPUB
              变成可以追问的知识空间。每一次回答，都带着页码、段落和上下文。
            </motion.p>
            <motion.div
              className="hero-actions"
              {...(reduceMotion
                ? {}
                : {
                    initial: { opacity: 0, y: 12 },
                    animate: { opacity: 1, y: 0 },
                    transition: { delay: 0.22, duration: 0.7 },
                  })}
            >
              <a
                className="primary-button"
                href="./app"
                onClick={handleAppEntry}
              >
                开始阅读 <ArrowRight weight="bold" aria-hidden="true" />
              </a>
              <a className="secondary-button" href="#download">
                查看 Windows 版 <DownloadSimple aria-hidden="true" />
              </a>
            </motion.div>
            <div className="hero-meta">
              <span>
                <Check weight="bold" /> 无需注册
              </span>
              <span>
                <LockKey weight="bold" /> 内容留在你的设备
              </span>
            </div>
          </div>

          <motion.div
            className="hero-visual"
            {...(reduceMotion
              ? {}
              : {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  transition: { delay: 0.08, duration: 0.86 },
                })}
          >
            <img
              className="hero-photo"
              src={`${import.meta.env.BASE_URL}assets/optimized/pexels-old-book-desk.webp`}
              alt="暖光照亮的旧书与木质阅读桌"
              width="1880"
              height="1253"
              fetchPriority="high"
            />
            <img
              className="hero-illustration"
              src={`${import.meta.env.BASE_URL}assets/optimized/hero-book-awakening.webp`}
              alt="书页、手写批注和知识连接的概念插画"
              width="1568"
              height="1003"
            />
            <div className="hero-reader-frame">
              <div className="reader-toolbar">
                <span className="reader-dot" />
                <span className="reader-dot" />
                <span className="reader-dot" />
                <span className="reader-title">病理生理学 · 第六章</span>
              </div>
              <img
                src={`${import.meta.env.BASE_URL}release/pdf-reader.png`}
                alt="知页阅读器界面，原文与回答并列显示"
                width="1500"
                height="713"
              />
              <div className="answer-float">
                <div className="answer-label">
                  <Sparkle weight="fill" /> AI 回答
                </div>
                <p>理解发生在原文上下文中，而不是离开书页之后。</p>
                <span>来源：第 42 页</span>
              </div>
            </div>
            <div className="hero-caption">
              阅读器 · 原文与理解在同一张桌面上
            </div>
          </motion.div>
        </section>

        <section
          className="awakening"
          id="awakening"
          aria-labelledby="awakening-title"
        >
          <motion.div className="section-intro" {...reveal}>
            <p className="eyebrow">KNOWLEDGE AWAKENING</p>
            <h2 id="awakening-title">
              书页先说话，<em>答案随后出现。</em>
            </h2>
            <p>知页不替你读书。它把提问、原文和理解放在同一张桌面上。</p>
          </motion.div>
          <motion.div className="awakening-stage" {...reveal}>
            <img
              className="awakening-photo"
              src={`${import.meta.env.BASE_URL}assets/optimized/pexels-library-open-books.webp`}
              alt=""
              width="1880"
              height="1253"
              loading="lazy"
            />
            <article className="book-page">
              <span className="page-number">42</span>
              <h3>工作记忆的容量</h3>
              <p>
                工作记忆负责暂时保存和处理信息。它的容量有限，因此理解复杂概念时，需要反复回到已有的上下文。
              </p>
              <p>
                <mark>阅读不是把内容搬进脑中，而是在原文之间建立关系。</mark>
              </p>
            </article>
            <div className="awakening-thread" aria-hidden="true" />
            <div className="question-card">
              <span>你的问题</span>
              <strong>为什么需要上下文？</strong>
            </div>
            <div className="answer-card">
              <div>
                <Sparkle weight="fill" />
                <span>知页回答</span>
              </div>
              <p>
                因为工作记忆容量有限，新的信息需要和原文中的关系连接起来，理解才会稳定。
              </p>
              <small>依据：第 42 页 · 工作记忆的容量</small>
            </div>
          </motion.div>
        </section>

        <section
          className="principle-band"
          id="principle"
          aria-labelledby="principle-title"
        >
          <div className="principle-mark" aria-hidden="true">
            “
          </div>
          <div>
            <h2 id="principle-title">
              答案不是终点，
              <br />
              <span>原文才是。</span>
            </h2>
            <p>每一次提问，都回到你正在读的那一页。</p>
          </div>
        </section>

        <section
          className="workflow-section"
          id="workflow"
          aria-labelledby="workflow-title"
        >
          <motion.div className="section-intro" {...reveal}>
            <p className="eyebrow">A QUIET METHOD</p>
            <h2 id="workflow-title">从翻开教材，到真正理解。</h2>
            <p>把学习拆成四个清晰动作，AI 只在需要的地方出现。</p>
          </motion.div>
          <div className="workflow-timeline">
            {workflow.map(({ number, title, text, icon: Icon }, index) => (
              <motion.article
                className="workflow-step"
                key={number}
                {...(reduceMotion
                  ? {}
                  : {
                      initial: { opacity: 0, y: 18 },
                      whileInView: { opacity: 1, y: 0 },
                      viewport: { once: true, amount: 0.2 },
                      transition: { delay: index * 0.08, duration: 0.55 },
                    })}
              >
                <div className="step-marker">
                  <span>{number}</span>
                  <i />
                </div>
                <div className="step-content">
                  <div className="step-icon">
                    <Icon size={22} weight="light" />
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section
          className="showcase-section"
          id="showcase"
          aria-labelledby="showcase-title"
        >
          <motion.div className="showcase-copy" {...reveal}>
            <p className="eyebrow">THE READING DESK</p>
            <h2 id="showcase-title">
              原文在左，
              <br />
              <em>理解在右。</em>
            </h2>
            <p>你不需要在窗口之间来回跳动。读到哪里，就从哪里提问。</p>
            <div className="feature-list">
              {featureNotes.map(({ title, text, icon: Icon }) => (
                <div className="feature-row" key={title}>
                  <span className="feature-icon">
                    <Icon size={20} />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div className="showcase-screen" {...reveal}>
            <img
              src={`${import.meta.env.BASE_URL}release/pdf-reader.png`}
              alt="知页阅读器产品界面"
              width="1500"
              height="713"
              loading="lazy"
            />
            <div className="screen-label">
              <span>原文定位</span>
              <ArrowRight size={14} />
              <span>AI 问答</span>
            </div>
          </motion.div>
        </section>

        <section
          className="local-first"
          id="local-first"
          aria-labelledby="local-first-title"
        >
          <div className="local-first-inner">
            <motion.div {...reveal}>
              <p className="eyebrow">LOCAL BY DEFAULT</p>
              <h2 id="local-first-title">
                你的教材，
                <br />
                属于你自己。
              </h2>
              <p>
                知识应该被理解，而不是被上传。教材、阅读记录和学习轨迹，始终掌握在你的设备里。
              </p>
            </motion.div>
            <motion.div className="local-first-visual" {...reveal}>
              <img
                src={`${import.meta.env.BASE_URL}assets/optimized/pexels-window-desk.webp`}
                alt="窗边的书桌、书本和笔记本电脑"
                width="1880"
                height="1253"
                loading="lazy"
              />
              <div className="privacy-specs">
                <div>
                  <LockKey size={21} />
                  <strong>本地存储</strong>
                  <span>数据只在你的设备上</span>
                </div>
                <div>
                  <ShieldCheck size={21} />
                  <strong>透明可控</strong>
                  <span>每次回答都可追溯</span>
                </div>
                <div>
                  <FileText size={21} />
                  <strong>原文优先</strong>
                  <span>没有脱离上下文的答案</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section
          className="download"
          id="download"
          aria-labelledby="download-title"
        >
          <div className="download-inner">
            <motion.div {...reveal}>
              <p className="eyebrow">FOR WINDOWS</p>
              <h2 id="download-title">
                为长时间阅读，
                <br />
                留下一张安静的桌面。
              </h2>
              <p>
                在线体验现在即可打开。Windows x64
                安装包会经过签名验证，再交到你手里。
              </p>
            </motion.div>
            <motion.div className="download-card" {...reveal}>
              <WindowsLogo size={28} weight="light" aria-hidden="true" />
              {release?.available && release.downloadUrl ? (
                <a className="primary-button" href={release.downloadUrl}>
                  <DownloadSimple weight="bold" /> 下载 Windows{" "}
                  {release.version}
                </a>
              ) : (
                <button className="primary-button" type="button" disabled>
                  <DownloadSimple weight="bold" /> Beta 暂不公开下载
                </button>
              )}
              <span id="release-status">
                {release?.available
                  ? `${(release.size / 1024 / 1024).toFixed(1)} MB · SHA-256 ${release.sha256.slice(0, 12)}…`
                  : "Beta 内测版本暂不公开下载；正式包将经过 Authenticode 签名验证"}
              </span>
            </motion.div>
          </div>
        </section>

        <section className="closing" aria-labelledby="closing-title">
          <p className="eyebrow">BEGIN WITH ONE QUESTION</p>
          <h2 id="closing-title">让知识，回应你的问题。</h2>
          <a className="primary-button" href="./app" onClick={handleAppEntry}>
            开始探索 <ArrowRight weight="bold" />
          </a>
        </section>
      </main>

      <footer>
        <a className="footer-brand" href="#top">
          <img src={`${import.meta.env.BASE_URL}brand/logo-mark.svg`} alt="" />
          <strong>知页</strong>
          <span>本地教材伴学</span>
        </a>
        <p>阅读发生在你手中，理解回到原文。</p>
        <div className="footer-links">
          <a href="#principle">理念</a>
          <a href="#local-first">安全与隐私</a>
          <a href="#download">Windows 版</a>
        </div>
      </footer>

      {isLeaving ? (
        <motion.div
          className="page-transition"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <img src={`${import.meta.env.BASE_URL}brand/logo-mark.svg`} alt="" />
          <span>正在打开知页工作台</span>
        </motion.div>
      ) : null}
    </div>
  );
}
