
# 新增输出:「使用这款产品,你的皮肤会衰老多少岁」

把产品适配度报告升级一个"再生生物学 (Regenerative Bio)"角度的钩子——一个让评委一眼记住的数字:**预计皮肤生物学年龄变化 (Skin Age Impact)**。

这也正好把项目和黑客松 Regenerative Bio 主题强绑定。

---

## 一、核心新字段

在 `CompatibilityReport` 上新增:

```ts
skinAgeImpact: {
  years: number;              // 例: +1.8 (变老) / -0.5 (有改善)
  direction: "aging" | "neutral" | "rejuvenating";
  horizon: "12_months";       // 固定:按持续使用 12 个月估算
  confidence: "低" | "中" | "高";
  drivers: Array<{            // 哪些成分 × 哪些机制 贡献了这个数字
    factor: string;           // 例: "高浓度酒精"
    mechanism: string;        // 例: "屏障破坏 → 经皮失水加速 → 胶原降解"
    contributionYears: number;// 例: +0.6
  }>;
  caveat: string;             // 免责声明:估算模型,不构成医学诊断
}
```

## 二、AI 评分规则 (确定性,避免同输入不同输出)

在 `SYSTEM_PROMPT` 里追加一段固定算法,让模型按规则算而不是凭感觉:

```text
H. Skin Age Impact (假设每日规律使用 12 个月):
   起始值 = 0.0 岁
   按"成分 × 肤质特征"映射累加:
   - 致老化机制 (氧化应激/糖化/屏障破坏/光敏化/慢性炎症):
       高风险组合  +0.6 岁
       中风险组合  +0.3 岁
   - 抗老化/再生机制 (抗氧化、促胶原、屏障修复、senolytic-like):
       明确证据    -0.5 岁
       潜在支持    -0.2 岁
   - 防晒类产品额外:若 SPF≥30 且 PA+++ 以上, -0.8 岁 (抑制光老化)
   - 上限 +5.0 / 下限 -2.0,保留 1 位小数
   direction: years>+0.3 → aging;-0.3..+0.3 → neutral;<-0.3 → rejuvenating
   confidence:成分清单完整且与肤质特征明确对应 → 高;部分识别 → 中;识别度低 → 低
   drivers:列出贡献最大的 2-4 项,contributionYears 之和应≈years
```

并在 `TOOL_SCHEMA.parameters` 中加入 `skinAgeImpact` 同结构,设为 required。
temperature/seed 已是 0/42,保证同输入同输出。

## 三、报告页 UI (`src/routes/report.tsx`)

在现有 compatibilityScore 卡片旁(或正上方)新增一个 **「Skin Age Impact」英雄数字卡**:

```
┌─────────────────────────────────────────────┐
│  使用 12 个月后,你的皮肤预计               │
│                                             │
│      +1.8 岁                                │
│      ▲ 加速衰老                             │
│                                             │
│  主要驱动:                                  │
│   • 高浓度变性酒精        +0.6  屏障破坏    │
│   • 香精复合物            +0.4  慢性炎症    │
│   • 缺乏抗氧化协同        +0.8  氧化应激    │
│                                             │
│  置信度:中   *估算模型,非医学诊断          │
└─────────────────────────────────────────────┘
```

视觉:
- 数字 7xl,根据 direction 用 token 颜色 (aging→destructive、rejuvenating→primary/绿、neutral→muted)
- 加一个细的指针条:`-2 岁 ←──●──→ +5 岁`
- driver 列表用现有 Card 风格
- 与上方 Stereo3DFace + 色块层视觉呼应:加上"皮肤老化贡献"叠加在脸上的可选副标题

## 四、首页文案配合升级 (`src/routes/index.tsx`)

把当前 hero 标语升级为:

> **拍张脸,扫个化妆品 —— 看它一年后会让你老几岁。**
>
> 基于成分-肤质再生生物学映射,量化你日常护肤的真实代价。

(保留下方原"爆痘/过敏"副文案作为支撑。)

## 五、文件改动一览

改写:
- `src/lib/compatibility-types.ts` — 新增 `SkinAgeImpact` 类型,挂到 `CompatibilityReport`
- `src/lib/compatibility.functions.ts` — SYSTEM_PROMPT 加规则 H;TOOL_SCHEMA 加 `skinAgeImpact` required
- `src/routes/report.tsx` — 新增英雄卡组件 + driver 列表
- `src/routes/index.tsx` — 升级 hero 标语

不动:
- 现有 compatibilityScore / risks / radar 逻辑保持不变,新字段是叠加
- 分析流程、上传逻辑、Stereo3DFace 等

## 六、验收

- 报告页顶部能看到一个醒目的「+X.X 岁 / -X.X 岁」大数字
- 下方列出 2-4 条具体驱动因素(成分 × 机制 × 贡献年数)
- 同一张脸 + 同一款产品两次提交,数字一致 (temperature=0, seed=42)
- 数字带置信度与免责声明,避免被当作医学结论
- 首页标语呼应这个新输出

---

## 黑客松层面的好处 (Mu Shanghai · Regenerative Bio)

- 把"化妆品风险检测"重新框架成 **Skin Longevity / 皮肤生物学年龄**,直接命中 Regenerative Bio 主题
- 一个具体数字 (+1.8 岁) 是评委记得住的"哇时刻",pitch 里 demo 这一屏就够了
- driver 列表 (成分 × 机制) 展示了科学深度,不是黑箱打分

确认后我就按这个方案改。
