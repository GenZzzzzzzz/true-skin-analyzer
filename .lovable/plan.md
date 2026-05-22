## 问题
在微信内置浏览器（X5/WKWebview）打开时，页面整体显示白色背景，破坏黑色暗色风格。

## 原因
1. 微信浏览器在 SSR 首屏 HTML 还没注入样式前，会用系统默认白底渲染，造成"白屏闪烁"。
2. 微信会读取 `<meta name="theme-color">` 设置顶部状态栏/导航条颜色，没设置时是白色。
3. 微信对 `prefers-color-scheme: dark` 不敏感，需要显式声明 `color-scheme: dark` 才能让滚动条、表单控件、overscroll 区域变成深色（否则下拉露出的"橡皮筋"区域是白色）。
4. `html` / `body` 没有在 inline style 层面声明深色背景，CSS 加载前会闪白。

## 方案（只改前端展示层）

在 `src/routes/__root.tsx` 里做四件事：

1. **在 `head.meta` 增加微信/移动端深色声明**
   - `{ name: "theme-color", content: "#15131f" }`（对应 oklch(0.16 0.02 260) 大致 HEX）
   - `{ name: "color-scheme", content: "dark" }`
   - 加一条 `<meta name="format-detection" content="telephone=no">`（顺带防微信把数字识别成电话号变蓝）

2. **在 `<html>` 标签加 `className="dark"` 并 inline 设背景色**
   ```tsx
   <html lang="zh-CN" className="dark" style={{ backgroundColor: "#15131f", colorScheme: "dark" }}>
   ```
   这样在 CSS bundle 加载之前，微信内核渲染的首屏就是深色。

3. **在 `<body>` 也加 inline 背景色**
   ```tsx
   <body style={{ backgroundColor: "#15131f" }}>
   ```
   微信经常忽略 html 背景只看 body，双重兜底。

4. **在 `src/styles.css` 里加全局兜底**
   ```css
   html { background-color: var(--color-background); color-scheme: dark; }
   html, body { overscroll-behavior: none; } /* 防止下拉露白 */
   ```

## 技术细节
- `lang` 顺手改成 `zh-CN`，更适合中文页面。
- HEX `#15131f` 是当前 `--background: oklch(0.16 0.02 260)` 的近似值，仅用于 inline 兜底，运行后真实颜色仍由 CSS 变量控制。
- 不动业务逻辑、不动 Tailwind 配置、不引新依赖。

## 影响范围
- `src/routes/__root.tsx`：`head()` meta、`RootShell` 的 `<html>` / `<body>` 标签
- `src/styles.css`：追加 ~3 行兜底样式