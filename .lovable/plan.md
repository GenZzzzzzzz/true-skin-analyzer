# 全新方向：皮肤 × 产品 适配度分析

把当前"AI 肤质分析"产品转型为：**用户同时上传一张自己的脸 + 一张化妆品/防晒/护肤品照片，AI 判断这款产品对该用户皮肤的适配度（刺激、过敏、闷痘、油皮闷感等风险）**。整套页面按苹果科技感重做：立体感、深色玻璃、柔和高光、流体阴影、微动效。

---

## 一、新主页（`/`）

主体只保留两个并排的"相机卡"，居中、巨大、立体。

```text
       SkinMatch · AI 适配度
   ────────────────────────────────
   ┌──────────┐      ┌──────────┐
   │  📷 你   │      │  📷 产品 │
   │ 拍/上传  │      │ 拍/上传  │
   │   脸     │      │ 化妆品   │
   └──────────┘      └──────────┘
            [ 分析适配度 → ]   (两张都有才点亮)
        免责声明 · 不替代医学建议
```

- 左卡：拍/上传**自拍**（沿用现有 `preprocessImage` 多分区流水线）
- 右卡：拍/上传**产品**（瓶身正面，看清成分表更佳）
- 下方一个大号 CTA "分析适配度"，只有两张图都就绪才会亮起+发光
- 顶部一个极简 logo + 一行 tagline，底部一句免责声明
- 不再有特性介绍区、教程区——主页就是个工作台

### 视觉语言（苹果科技感）
- 深色基底 `oklch(0.14 0.02 260)`，加上极轻的环境光渐变
- 两张"相机卡"使用立体感处理：
  - 多层阴影（顶部柔光高光 + 底部深阴影 + 外发光）
  - 内嵌玻璃面（`backdrop-filter: blur` + 1px 高光描边）
  - 悬停时整卡轻微 3D 倾斜（CSS transform + perspective）
  - 已上传后卡内呈现照片缩略 + 一个再拍按钮
- 主 CTA：胶囊形、青绿光晕、按下时缩放反馈
- 字体延用 Space Grotesk / Inter，标题加大字重

---

## 二、拍摄/上传交互

两张卡共用同一个"拍摄/上传"组件，但区分：

| 类型 | 取景框形状 | 提示文案 | 预处理 |
|---|---|---|---|
| 脸 | 椭圆人脸框 | "正面、自然光、无滤镜" | 现有 face-landmarks + retinex + 多分区 |
| 产品 | 矩形产品框 | "对准瓶身正面，让成分表清晰" | 仅缩放+JPEG，无需对齐 |

点击卡片 → 弹出底部抽屉（drawer）选择"拍摄 / 从相册上传"，不再像现在跳到独立路由。整个上传都在主页完成。

---

## 三、分析流程

`/analyze` 路由取消（或重定向回 `/`）。点击主 CTA 后：

1. 在主页上方覆盖一个全屏的"分析中"层（立体玻璃、跑动光线、进度文字）
2. 调用新的 server function `analyzeCompatibility`：
   - 入参：脸的多分区图（沿用现有 zones） + 产品图（base64）
   - 模型：`google/gemini-2.5-flash`
   - tool-calling 输出结构化结果（schema 见下）
3. 完成后跳转 `/report`

### 新 server function `analyzeCompatibility`
- 复用现有 `LovableAIClient` 调用方式
- Prompt 让模型先识别产品（品类、关键成分），再结合脸部多分区肤质特征评估
- 返回 JSON：

```ts
{
  product: { name, category, keyIngredients: string[] },
  skinSnapshot: { type, topConcerns: string[] },
  compatibilityScore: number,         // 0-100 适配度
  verdict: "推荐" | "谨慎" | "不推荐",
  risks: Array<{
    type: "刺激" | "过敏" | "闷痘" | "干燥加重" | "油光" | "光敏" | "其他",
    severity: "低" | "中" | "高",
    reason: string,                   // 哪些成分 × 哪个肤质特征导致
  }>,
  benefits: string[],
  usageTips: string[],                // 用法、频率、配伍
  alternatives?: string[],            // 若不推荐，给替代成分方向
}
```

---

## 四、新报告页（`/report`）

立体卡片化布局：

- 顶部巨型"适配度环形分数"（带柔光、数字滚动动画）+ verdict 徽章
- 两张并排小卡：左"你的皮肤画像"（型 + Top 3 关注点）/ 右"识别到的产品"（品类 + 关键成分 chip）
- "风险" 折叠卡组：每条带颜色严重度条 + 成因解释
- "潜在好处" / "使用建议" 两栏
- 底部 CTA："换一款再测" → 回主页

雷达图改为"风险维度雷达"（刺激/过敏/闷痘/干燥/光敏/油感），样式延用现有 Recharts。

---

## 五、文件改动一览

新增：
- `src/components/CameraCard.tsx`：通用立体相机卡（props: kind="face"|"product"）
- `src/components/UploadDrawer.tsx`：底部抽屉
- `src/lib/compatibility.functions.ts`：`analyzeCompatibility` server fn
- `src/lib/compatibility-types.ts`：上面那个返回 schema 的 TS 类型

改写：
- `src/routes/index.tsx`：新双相机主页
- `src/routes/report.tsx`：新适配度报告布局
- `src/styles.css`：新增立体阴影、玻璃高光、CTA 发光等工具类
- `src/components/SiteHeader.tsx`：简化为 logo + 副标题

保留但不再作为入口：
- `src/lib/image-preprocess.ts`（脸部分区流水线照用）
- `src/lib/face-landmarks.ts`
- `src/lib/skin.functions.ts`（保留导出，但主流程改走 compatibility）

弃用：
- `src/routes/analyze.tsx`：删除或改为 redirect 到 `/`
- 原 `SkinReport` 8 项指标 UI（被适配度模型取代）

---

## 六、需要先确认的两个小点

1. 产品识别错误（拍到的不是化妆品/无法识别成分）时的策略：
   - A：仍然给一个"信息不足"的报告，提示重拍
   - B：直接弹错误，要求重新上传产品图
2. 报告页是否保留原"肤质 8 项指标"小节作为附加信息？还是完全聚焦"适配度"，不展示通用肤质评分？

我会按 **A + 完全聚焦适配度** 默认实施，如有偏好告诉我。
