# Hapi Power 品牌设计方案 v1.1

> **设计状态：已实施完成**
>
> **确认记录 (2026-06-06)**：
> - 色彩：方案 A 电光橙 + 深空 ✓
> - Logo：方案 A 能量台 (Power Hub) ✓
> - Slogan："随时AI，编程自在" ✓
> - 字体：保留 Geist Sans/Mono ✓
> - 统一性：Web App + Website 完全统一 ✓
>
> **实施记录 (2026-06-06)**：
> - 所有 SVG/PNG 图标资产已替换 ✓
> - Web App 设计令牌已重写 ✓
> - Website 设计系统已统一 ✓
> - 所有组件 Logo 引用已更新 ✓
> - HTML/PWA 配置已更新 ✓
> - 多语言文案已更新 ✓
> - README/CHANGELOG 已更新 ✓
> - 多代理审查 + 修复迭代已完成 ✓

---

## 一、品牌定位

### 核心定位
Hapi Power 是面向泛开发者的 **AI 编程工作台**，一个汇聚所有 AI Agent 的力量中心。
品牌气质：**活力 + 创造 + 潮流感**。

### 品牌人格（三词定义）
**自信 · 利落 · 有温度**

不是冷冰冰的工具，也不是花哨的玩具。是一个让你感到"有了它，我可以做更多"的可靠伙伴。

### 品牌价值观
1. **开发者自由**：不被任何单一 Agent 绑定，你的工具你做主
2. **随时随地**：手机也能掌控 AI 编程，打破桌面的限制
3. **创造能量**：编程是一种创造行为，Hapi Power 是你的能量源

### 差异化定位

```
         冷静克制 ←──────────────────────→ 温暖活力
              │                                │
        Linear │                    ★ Hapi Power    │
        Vercel │                      Raycast       │
              │                      Figma         │
        GitHub │                      Arc          │
              │                                │
         严肃专业 ←──────────────────────→ 潮流有趣
```

Hapi Power 占据 **Raycast 和 Figma 之间**的位置：
- 比 Raycast 更有创造力深度
- 比 Figma 更有工具力量感
- 拒绝冷漠，也拒绝轻浮

---

## 二、Slogan（已确认）

**主 Slogan**：随时AI，编程自在
**英文版**：Code free, powered by AI
**副标语**：一个工作台，驾驭所有 AI 编程 Agent

---

## 三、Logo 设计方案（已确认）

### 确认方案：能量台 (Power Hub)

**概念**：一个稳定的工作台面，上方有能量向上涌动的抽象符号。

```
视觉构成：
- 底部：一条稳定的长横线（工作台/基座）
- 上方：一个向上收窄的梯形/三角，带有切口和层次感
- 整体：像一个正在向上释放能量的基座/工作台

简化描述：底部一条粗线 = 工作台
         中间向上发散的几何形 = 能量/力量
         形成一个整体的"台座上的能量"符号
```

**特点**：
- 在 16x16 favicon 尺寸下依然清晰可辨（简单的几何线条）
- 放大到落地页 hero 尺寸时可以加入细节和动效
- 象征含义直观：平台 + 力量
- 不像任何现有开发者工具的 logo

### 方案 B："汇聚点" — Convergence

**概念**：多条路径/线条从不同方向汇聚到一个中心点，形成一个动态的星形/交叉符号。

**特点**：
- 直接表达"多 Agent 汇聚到一个工作台"
- 动感强，暗示持续运转
- 识别度可能不如方案 A 简洁

### 方案 C："锻造面" — Forge

**概念**：抽象的砧板/锻造面符号，一个倒梯形（底宽顶窄）带有向上迸发的火花。

**特点**：
- 锻造 = 创造 = 活力，概念很强
- 但"锻造"意象可能过于工业化

### Logo 配色建议

Logo 本身应支持**单色**和**品牌色**两种用法：
- **品牌色版本**：主色（建议琥珀/电光橙系）填充，配深色或白色背景
- **单色版本**：纯白（深色背景）或纯黑/深灰（浅色背景）
- **渐变版本（仅限大尺寸）**：从主色到辅色的微妙渐变，增加能量感

---

## 四、色彩体系（已确认）

### 确认方案：电光橙 + 深空

**理由**：
- 橙色 = 能量 + 创造力 + 温暖 — 完美匹配"活力+创造"
- 橙色在开发者工具领域**极度稀缺**，辨识度极高
- 橙色与"Power/力量"天然联想（火焰、能量、闪电）
- 完全避开 AI 紫/科技蓝 陷阱
- 对比 Figma #F24E1E 和 Raycast #FF6363，Hapi Power 可以用更独特的**电光橙/琥珀色调**

### 确认色彩方案：电光橙 + 深空（方案 A）

```
主色 (Primary):    oklch(68% 0.18 55)  → ~#F97316 电光橙
主色深 (Hover):    oklch(62% 0.20 50)  → ~#EA580C
主色浅 (Subtle):   oklch(68% 0.06 55 / 0.10)  → 微妙橙色背景

强调色 (Accent):   oklch(78% 0.14 85)  → ~#FBBF24 琥珀金
成功色 (Success):  oklch(65% 0.16 155) → ~#10B981 翠绿
警告色 (Warning):  oklch(75% 0.15 80)  → ~#F59E0B 琥珀
危险色 (Danger):   oklch(60% 0.20 22)  → ~#EF4444 红色

浅色主题表面:
Canvas:    oklch(99% 0.003 75)  → 极淡暖白
Surface-0: oklch(100% 0 0)     → 纯白
Surface-1: oklch(98.5% 0.003 55) → 极微妙橙调白
Surface-2: oklch(96% 0.005 55) → 淡橙灰
Surface-3: oklch(94% 0.008 55) → 浅橙灰

深色主题表面:
Canvas:    oklch(13% 0.015 55) → 深橙黑
Surface-0: oklch(15% 0.012 55)
Surface-1: oklch(18% 0.010 55)
Surface-2: oklch(22% 0.008 55)
Surface-3: oklch(26% 0.006 55)

文本:
Primary:   oklch(13% 0.02 55)  → 近黑（浅色主题）
Secondary: oklch(40% 0.01 55)
Inverse:   oklch(98% 0.005 55) → 近白（深色主题）
```

### ~~方案 B（备选）：珊瑚红 + 星空~~ — 已否决

```
主色:    oklch(62% 0.22 25)  → ~#EF4444 活力珊瑚红
强调色:  oklch(70% 0.15 55)  → ~#FB923C 暖橙
Canvas:  oklch(98% 0.005 25) → 微红暖白
```

**差异**：方案 B 更强烈/激进，方案 A 更温暖/友好。推荐方案 A。

### 色彩策略：Committed（承诺型）

遵循品牌注册参考的色彩策略建议：
- 主色（电光橙）占据 **30-50% 的视觉面积**（Hero区域、Logo、CTA按钮）
- 不在边缘用中性色打安全牌
- 橙色就是品牌的声量，不是点缀

---

## 五、字体体系（已确认）

### 确认方案：保留 Geist 字体家族

**理由**：
- 项目已经自托管 Geist Sans + Geist Mono，迁移成本为零
- Geist 是 Vercel 出品的高品质现代无衬线，辨识度正在提升
- 几何无衬线的风格与"活力+潮流感"匹配
- 中文字体方面，需要选择一个与 Geist 调性匹配的现代无衬线

### 字体系统

```
英文正文/UI:  Geist Sans Variable（已有）
英文代码:     Geist Mono Variable（已有）
英文标题:     Geist Sans Variable Weight 700-800（粗体大号）
中文正文/UI:  思源黑体 (Noto Sans SC) 或系统默认（-apple-system, system-ui）
中文标题:     同上，通过字重和字号建立层级
```

### 不建议的字体选择
- ~~Source Serif 4~~：衬线字体与"活力+潮流"调性不符，建议移除
- ~~Nunito~~：Marketing Website 当前使用的圆润字体过于"友好"，缺少力量感
- ~~Space Mono~~：与 Geist Mono 定位重叠但品质不如

### 层级体系

```
h1: clamp(2.5rem, 5vw, 4rem)   / weight 800 / Geist Sans
h2: clamp(1.75rem, 3.5vw, 2.5rem) / weight 700
h3: clamp(1.25rem, 2vw, 1.5rem) / weight 600
body: 0.9375rem (15px)          / weight 400 / line-height 1.6
small: 0.8125rem (13px)         / weight 500
caption: 0.75rem (12px)         / weight 500 / tracking 0.02em
```

---

## 六、品牌视觉系统概览

### 设计语言关键词
**力量几何 (Power Geometry)**：用简洁有力的几何形状和大胆的色彩，传递工具的力量感和创造的能量感。

### 视觉系统要素

| 要素 | 描述 |
|------|------|
| **形状** | 锐角为主、适度圆角。直线+斜线，不用过多的曲线和泡泡形状 |
| **空间** | 大胆的留白，让内容呼吸。关键元素给予充足空间 |
| **对比** | 高对比度。深色+橙色，白色+深色。不做"微妙"的灰色层级 |
| **阴影** | 克制使用。更倾向于用颜色边界和层级来区分，而非阴影 |
| **动效** | 有目的的、利落的运动。弹性/能量感的缓动曲线。不做无意义的浮动 |
| **图标** | 线条图标为主，stroke 1.5-2px。不使用填充色块图标 |
| **边框** | 细边框 (1px) 或无边框。避免粗边框（当前 Website 的 2px 野兽派风格需调整） |
| **圆角** | 中等圆角 (8-12px 组件级别，20px+ 卡片/面板级别)。不用极端圆角或直角 |

### 品牌应用边界

**是 Hapi Power 的**：
- 电光橙作为品牌色贯穿始终
- 锐利但不过度激进的几何线条
- 深色背景上橙色的能量感对比
- 利落、自信的排版和留白
- 有节制的动效：该动的地方果断动，不该动的地方安静

**不是 Hapi Power 的**：
- 蓝紫渐变、霓虹发光效果
- 圆润可爱的气泡和卡通风格
- 2px 粗边框的新野兽派（当前 Website 的风格需收敛）
- 过度装饰、金色/金属质感
- 静态无生气的灰色界面

---

## 七、竞品品牌差异化

| 维度 | Cursor | GitHub Copilot | Replit | **Hapi Power** |
|------|--------|---------------|--------|---------------|
| 主色 | 深蓝+霓虹 | 蓝+紫 | 多彩渐变 | **电光橙** |
| 气质 | 暗黑酷炫 | 企业专业 | 活泼年轻 | **力量活力** |
| Logo | 字母C+光晕 | 章鱼猫 | 三角+渐变 | **能量台符号** |
| Slogan | "The AI Code Editor" | "Your AI pair programmer" | "Build software faster" | **"随时AI，编程自在"** |

---

## 八、实施范围

> 以下文件将在实施阶段逐一更新。

### 需要更新的文件清单

#### Logo & 图标资产
| 文件 | 说明 |
|------|------|
| `docs/assets/logo-mark.svg` | 新 Logo 主标识 |
| `docs/assets/logo-lockup.svg` | Logo + 文字组合 |
| `docs/assets/favicon.svg` | 新 favicon |
| `web/public/icon.svg` | PWA 主图标 |
| `web/public/mask-icon.svg` | Safari pinned tab |
| `web/public/favicon.ico` | Favicon ICO |
| `web/public/pwa-*.png` | 所有 PWA 图标 (需重新渲染) |
| `web/public/apple-touch-icon-*.png` | Apple 图标 |
| `web/public/splash-*.png` | iOS 启动画面 |
| `website/public/images/logo-mark.svg` | 网站 Logo |

#### 代码中的 Logo/品牌引用
| 文件 | 说明 |
|------|------|
| `web/src/components/LoginPrompt.tsx` | LogoIcon 组件需替换为新 SVG |
| `website/src/components/Layout.tsx` | Header/Footer logo |
| `web/index.html` | theme-color, favicon, apple-touch-icon, splash |
| `website/index.html` | favicon, title |
| `web/vite.config.ts` | PWA manifest 配置 |
| `web/src/sw.ts` | 推送通知标题 |

#### 设计令牌 (Design Tokens)
| 文件 | 说明 |
|------|------|
| `web/src/styles/tokens.css` | 完整色彩体系重写 |
| `web/src/styles/typography.css` | 字体层级微调 |
| `web/tailwind.config.ts` | Tailwind 主题映射 |
| `website/src/index.css` | Website 色彩系统统一 |
| `website/tailwind.config.ts` | Website Tailwind 配置 |

#### 文档
| 文件 | 说明 |
|------|------|
| `README.md` | Logo, tagline, 品牌色 |
| `README.zh-CN.md` | 同上 |
| `CHANGELOG.md` | 品牌更新记录 |
| `CONTRIBUTING.md` | 品牌指南引用 |

#### 多语言文案
| 文件 | 说明 |
|------|------|
| `web/src/locales/en.json` | 英文 Slogan/品牌文案 |
| `web/src/locales/zh.json` | 中文 Slogan/品牌文案 |
| `website/src/locales/en.json` | 英文营销文案 |
| `website/src/locales/zh.json` | 中文营销文案 |

---

## 九、品牌参考案例总结

| 参考 | 借鉴点 | 不借鉴的 |
|------|--------|----------|
| **Raycast** | 暖色主色 + 深色背景的能量组合 | 不复制其橙红色调，走更独特的琥珀橙 |
| **Figma** | "活力但不失专业"的平衡感 | 不用其红橙系，避免混淆 |
| **Vercel** | Logo 几何简洁性 + Geist 字体体系 | 不用纯黑白，需要色彩声量 |
| **Linear** | 品牌系统的极致一致性 | 不用其冷峻深色调 |
| **Arc** | "温暖科技"的调性 | 不用其多彩渐变和过度友好感 |

---

*本方案已于 2026-06-06 确认，可进入实施阶段。*
*实施时需按照第八节的文件清单逐项更新，确保 Web App 和 Website 的品牌完全统一。*
