# AI 肤质分析 SaaS — MVP 实施方案

## 产品形态
一个网页应用：用户上传或拍摄面部照片 → 系统做基础图像增强 → 调用 Gemini Vision 多模态模型分析 8 项肤质指标 → 输出可视化报告。**首版不做账号系统、付费、历史记录**，专注核心分析体验。

## 核心流程

```text
[首页/落地]
   ↓ 点击"开始分析"
[拍摄/上传页]
   ├─ 摄像头实时拍摄（getUserMedia）
   └─ 上传本地照片（拖拽 / 选择文件）
   ↓
[图像预处理（前端）]
   ├─ 自动裁剪人脸区域（FaceDetector API / 兜底中心裁剪）
   ├─ 白平衡 / 亮度归一化（Canvas 滤镜）
   └─ 压缩到 ~1024px JPG
   ↓
[后端 Server Function]
   └─ 调用 Lovable AI Gateway（google/gemini-2.5-pro，多模态）
       用结构化 tool-calling 返回 8 项指标评分 + 文字解读
   ↓
[报告页]
   ├─ 综合肤质类型 + 总分
   ├─ 8 项指标雷达图 + 进度条
   ├─ 每项的"现状 / 成因 / 护理建议"
   └─ 可保存为图片 / 复制链接（无账号场景下基于本地）
```

## 8 项肤质指标（与你列的清单一致）
1. 油脂分布（T 区/额头/鼻/下巴）
2. 干燥/缺水
3. 敏感/红血丝
4. 毛孔状态
5. 痘痘/粉刺
6. 肤色均匀度
7. 皱纹/细纹
8. 综合肤质类型（干/油/混/敏感）

每项返回：`score (0-100)`、`level (优/良/一般/差)`、`findings (文字)`、`recommendations (3 条建议)`。

## 页面清单（TanStack Start 路由）

| 路径 | 文件 | 内容 |
|---|---|---|
| `/` | `src/routes/index.tsx` | Hero + 特性介绍 + CTA "开始分析" |
| `/analyze` | `src/routes/analyze.tsx` | 拍摄/上传 + 拍摄指引（光线、角度、距离） |
| `/report` | `src/routes/report.tsx` | 分析结果报告页（结果通过 sessionStorage 传递） |
| `/api/analyze-skin` | `src/routes/api/analyze-skin.ts`（备用，主路径走 server function） | — |

主分析逻辑放在 `src/lib/skin.functions.ts` 的 `createServerFn` 中。

## 设计方向（科技/极简）

- **配色**：深色主背景 `oklch(0.18 0.02 260)` + 高对比白文字 + 单一冷色强调（青绿 `oklch(0.78 0.15 195)`），数据图表用渐变线条
- **字体**：标题 Space Grotesk，正文 Inter
- **质感**：大量留白、细边框、毛玻璃卡片、score 数字超大号、轻微 motion（结果数字从 0 滚动到目标值，雷达图描边动画）
- **图标**：Lucide 单色细线
- **拍摄页**：黑色满屏 + 中央人脸取景框 + 顶部光线检测提示

所有色彩走 `src/styles.css` 的 oklch 设计 token，组件层只用语义 class。

## 技术决策

- **AI**：Lovable AI Gateway，模型 `google/gemini-2.5-pro`（多模态、推理强）；用 tool-calling 强制结构化输出，避免解析 JSON 字符串
- **图像增强**：前端 Canvas 处理（白平衡 + 亮度归一化 + 裁剪），不在 MVP 阶段引入 ESRGAN 超分（需 GPU 推理服务，超出 Lovable 范围）
- **后端**：TanStack Start `createServerFn`，不需要 Lovable Cloud（无数据库/账号需求）
- **LOVABLE_API_KEY**：自动配置，无需用户输入

## 风险与说明

1. **精度边界**：Gemini Vision 通用模型对肤质细节（毛孔级别）做的是"视觉评估"，不是医疗级诊断。报告页会标注"仅供参考，不作为医学诊断"。
2. **若需要医疗级精度**：未来需接入专业 API（Perfect Corp / Haut.AI）或自部署 U-Net / ESRGAN 模型——这些需要 GPU 推理服务，不在 Lovable 平台内能完成，需另起后端。
3. **拍摄环境**：分析准确度高度依赖光线，因此拍摄页提供明确指引（自然光、正面、无滤镜）。

## 实施分步

1. 建立设计 token（深色科技风 oklch 色板 + Space Grotesk/Inter 字体引入）
2. 首页 `/`：Hero + 8 项指标特性介绍 + CTA
3. 拍摄页 `/analyze`：摄像头组件 + 上传组件 + 拍摄指引
4. 前端图像预处理工具（`src/lib/image-preprocess.ts`）
5. Server function `analyzeSkin`（`src/lib/skin.functions.ts`）调用 Gemini，tool-calling 返回 8 项指标
6. 报告页 `/report`：雷达图（Recharts）、指标卡片、建议清单
7. 加载/错误/重试态、隐私声明
8. SEO（每页独立 title/description/og）+ `llms.txt`

---

**确认后我开始实施。** 实施过程预计中等规模，主要工作集中在拍摄/上传 UX、Gemini 提示词工程和报告页可视化。