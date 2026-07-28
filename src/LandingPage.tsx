import {
  ArrowRight,
  BookOpenText,
  Brain,
  Check,
  DownloadSimple,
  FilePdf,
  LockKey,
  NotePencil,
  ShieldCheck,
  Sparkle,
  WindowsLogo,
} from "@phosphor-icons/react";
import "./landing.css";

const studyFlow = [
  {
    icon: FilePdf,
    title: "导入教材",
    text: "PDF 与 EPUB 在本机解析。扫描版 PDF 可按需启用本地 OCR。",
  },
  {
    icon: BookOpenText,
    title: "读懂原文",
    text: "原版页面与智能文本双向定位，引用能直接回到教材位置。",
  },
  {
    icon: Brain,
    title: "检验理解",
    text: "围绕当前教材问答、练习与复习。依据不足时，知页会明确说明。",
  },
];

const boundaries = [
  "教材与学习记录默认保存在本机",
  "回答限定在当前导入的教材范围",
  "外部智能服务由你主动选择和连接",
  "学习备份支持 AES-256-GCM 加密",
];

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label="知页首页">
          <img src={`${import.meta.env.BASE_URL}brand/logo-mark.svg`} alt="" />
          <span>知页</span>
        </a>
        <nav aria-label="主导航">
          <a href="#workflow">怎么学习</a>
          <a href="#privacy">隐私边界</a>
          <a href="#download">Windows 版</a>
        </nav>
        <a className="nav-cta" href="./app">
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
              <a className="primary-button" href="./app">
                打开在线体验
                <ArrowRight weight="bold" aria-hidden="true" />
              </a>
              <a className="secondary-button" href="#download">
                查看 Windows 版
              </a>
            </div>
          </div>

          <figure className="hero-visual">
            <img
              src={`${import.meta.env.BASE_URL}release/pdf-reader.png`}
              alt="知页中同时显示教材原版页面、章节内容与伴学问答"
              width="1500"
              height="713"
            />
            <figcaption>教材原版、章节目录与伴学问答，在同一阅读现场。</figcaption>
          </figure>
        </section>

        <a className="mobile-section-nav" href="#workflow">
          怎么学习
          <ArrowRight weight="bold" aria-hidden="true" />
        </a>

        <section className="principle-strip" aria-label="产品原则">
          <span>本地解析</span>
          <span>原文引用</span>
          <span>依据不足时拒答</span>
          <span>Windows x64</span>
        </section>

        <section className="workflow section-shell" id="workflow">
          <div className="section-intro">
            <h2>从翻开教材，到真正掌握。</h2>
            <p>不是另一个泛泛聊天框。每一次回答、练习和笔记，都围绕你正在读的内容发生。</p>
          </div>
          <div className="flow-grid">
            {studyFlow.map((item, index) => {
              const Icon = item.icon;
              return (
                <article className={`flow-item flow-item-${index + 1}`} key={item.title}>
                  <div className="flow-icon">
                    <Icon weight="duotone" aria-hidden="true" />
                  </div>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="reading-story section-shell">
          <div className="story-copy">
            <Sparkle weight="duotone" aria-hidden="true" />
            <h2>答案不是终点，原文才是。</h2>
            <p>
              点击引用即可回到教材位置。原版页面与智能文本相互对应，整理后的内容不会替代你的原始教材。
            </p>
            <div className="story-detail">
              <span>PDF 原版阅读</span>
              <span>语义分段</span>
              <span>章节内检索</span>
            </div>
          </div>
          <div className="story-image">
            <img
              src={`${import.meta.env.BASE_URL}release/text-correspondence.png`}
              alt="知页智能文本与 PDF 原文段落对应高亮"
              width="1365"
              height="649"
              loading="lazy"
            />
          </div>
        </section>

        <section className="privacy section-shell" id="privacy">
          <div className="privacy-copy">
            <LockKey weight="duotone" aria-hidden="true" />
            <h2>本地优先，是产品边界。</h2>
            <p>
              知页不会替你决定教材发给谁。你可以完全使用本地能力，也可以主动连接自己选择的智能来源。
            </p>
          </div>
          <div className="boundary-list">
            {boundaries.map((item) => (
              <div key={item}>
                <Check weight="bold" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="download section-shell" id="download">
          <div className="download-mark">
            <WindowsLogo weight="duotone" aria-hidden="true" />
          </div>
          <div className="download-copy">
            <p className="eyebrow">Windows 桌面版</p>
            <h2>为长时间阅读，留出一张安静的桌面。</h2>
            <p>
              首个正式版本面向 Windows x64。签名安装包完成发布审核后开放下载，在线体验现在即可使用。
            </p>
          </div>
          <div className="download-actions">
            <button type="button" disabled aria-describedby="release-status">
              <DownloadSimple weight="bold" aria-hidden="true" />
              等待签名版本
            </button>
            <span id="release-status">正式包将经过 Authenticode 签名验证</span>
          </div>
        </section>
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
          <a href="./app">
            <NotePencil aria-hidden="true" />
            在线体验
          </a>
          <a href="#privacy">
            <ShieldCheck aria-hidden="true" />
            隐私边界
          </a>
        </div>
      </footer>
    </div>
  );
}
