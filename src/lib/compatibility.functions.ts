import { createServerFn } from "@tanstack/react-start";
import type { CompatibilityReport } from "./compatibility-types";

const SYSTEM_PROMPT = `你是资深皮肤科与化妆品成分学专家。本次为**确定性评估**任务：同一张脸 + 同一款产品，必须输出一致的结论与分数。请严格按下列规则执行，不要凭感觉评分，不要随机发挥。

输入：
1) 一组经过对齐与光照矫正的人脸多分区图像 (全脸/T 区/鼻部/双颊/眼周/红色通道增强)
2) 一张化妆品/防晒/护肤品瓶身或包装的照片

执行步骤 (必须按顺序)：
A. 产品识别：从包装图读取品牌、品类、可见的关键成分清单。若无法识别为外用化妆品/护肤/防晒，recognized=false 并提示重传。
B. 肤质判定：基于多分区图像，按下列固定特征位判定 (每项二/三分类)：
   - 出油程度 [干/中性/混合/油]
   - 屏障状态 [正常/轻度受损/明显受损]
   - 炎症/泛红 [无/轻/中/重] (依据红色通道增强图)
   - 闭口/痘 [无/少量/中量/多]
   - 色沉/痘印 [无/轻/中/重]
   - 敏感倾向 [无/有]
C. 风险打分 (riskRadar 六维 0-100)：按"成分 × 肤质特征"的固定映射打分，每个维度都用下面的规则量化：
   * 起始基线 = 10
   * 每命中一条"高风险成分 × 易感特征"组合 +25 (例：高浓度酒精 × 屏障受损；高浓度视黄醇 × 敏感；致痘成分如肉豆蔻酸异丙酯/椰油酸 × 多闭口)
   * 每命中一条"中风险组合" +12
   * 每命中一条"温和缓冲成分" (神经酰胺/泛醇/积雪草) -8
   * 上限 100，下限 0，结果四舍五入到整数
D. compatibilityScore = round( 100 - 0.35*irritation - 0.25*allergy - 0.20*comedogenic - 0.10*dryness - 0.05*photo - 0.05*oiliness )，并钳制到 0-100。
E. verdict 由分数决定：>=75 推荐；55-74 谨慎；<55 不推荐。**不要凭感觉覆盖。**
F. risks 列表必须与 riskRadar 中得分 ≥35 的维度一一对应，severity 按 35-55=低、56-75=中、>75=高。
G. 中文输出，所有判断要写出"哪些成分 × 哪个肤质特征"。仅供日常护肤参考，不构成医学诊断。
H. Skin Age Impact (skinAgeImpact)：假设用户每日规律使用本产品 12 个月，按再生生物学映射估算"皮肤生物学年龄变化年数"：
   * 起始 years = 0.0
   * 致老化机制 (氧化应激/糖化/慢性炎症/屏障破坏/光敏化)：
       高风险成分 × 易感特征  每条 +0.6
       中风险组合              每条 +0.3
   * 抗老化/再生机制 (抗氧化、促胶原、屏障修复、senolytic-like)：
       明确证据组合            每条 -0.5
       潜在支持                每条 -0.2
   * 若产品为防晒且 SPF≥30 且 PA+++ 以上，额外 -0.8 (抑制光老化)
   * 钳制到 [-2.0, +5.0]，保留 1 位小数
   * direction：years>+0.3 → aging；-0.3..+0.3 → neutral；<-0.3 → rejuvenating
   * confidence：成分清单完整且与肤质特征对应充分 → 高；部分识别 → 中；识别度低 → 低
   * drivers：列出贡献最大的 2-4 项 (factor=成分或组合, mechanism=简短机制, contributionYears=带符号年数, citation=该机制的代表性文献引用)，其和≈years
   * citation 格式："第一作者姓 + 年份, 期刊缩写"，如 "Lachenmeier 2008, Int J Environ Res Public Health" 或 "Draelos 2018, J Cosmet Dermatol"。优先引用该成分/机制经典文献；若不确定具体文献，给出该领域公认综述年份与期刊，不要写 "N/A"。
   * caveat：固定写"基于成分-肤质再生生物学映射的估算模型，引用为机制示意而非该产品的直接临床试验，不构成医学诊断。"
   horizon 固定为 "12_months"。

必须通过 submit_compatibility 工具返回结构化结果。同样输入必须产生同样输出。`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "submit_compatibility",
    description: "提交皮肤 × 产品适配度结构化报告",
    parameters: {
      type: "object",
      properties: {
        product: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: { type: "string", description: "如：水基防晒 / 视黄醇精华 / 保湿乳" },
            keyIngredients: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 12 },
            recognized: { type: "boolean" },
          },
          required: ["name", "category", "keyIngredients", "recognized"],
          additionalProperties: false,
        },
        skinSnapshot: {
          type: "object",
          properties: {
            type: { type: "string" },
            topConcerns: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
          },
          required: ["type", "topConcerns"],
          additionalProperties: false,
        },
        compatibilityScore: { type: "number", description: "0-100，越高越适配" },
        verdict: { type: "string", enum: ["推荐", "谨慎", "不推荐"] },
        summary: { type: "string", description: "2-3 句中文综合判断" },
        risks: {
          type: "array",
          minItems: 0,
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["刺激", "过敏", "闷痘", "干燥加重", "油光", "光敏", "其他"] },
              severity: { type: "string", enum: ["低", "中", "高"] },
              reason: { type: "string" },
            },
            required: ["type", "severity", "reason"],
            additionalProperties: false,
          },
        },
        benefits: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 6 },
        usageTips: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
        alternatives: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 5 },
        riskRadar: {
          type: "object",
          description: "6 维风险评分 0-100，越高代表风险越大",
          properties: {
            irritation: { type: "number" },
            allergy: { type: "number" },
            comedogenic: { type: "number" },
            dryness: { type: "number" },
            photo: { type: "number" },
            oiliness: { type: "number" },
          },
          required: ["irritation", "allergy", "comedogenic", "dryness", "photo", "oiliness"],
          additionalProperties: false,
        },
        skinAgeImpact: {
          type: "object",
          description: "持续使用 12 个月后皮肤生物学年龄变化估算",
          properties: {
            years: { type: "number", description: "带符号年数，正=加速衰老，负=有改善，范围 -2.0 ~ +5.0" },
            direction: { type: "string", enum: ["aging", "neutral", "rejuvenating"] },
            horizon: { type: "string", enum: ["12_months"] },
            confidence: { type: "string", enum: ["低", "中", "高"] },
            drivers: {
              type: "array",
              minItems: 1,
              maxItems: 4,
              items: {
                type: "object",
                properties: {
                  factor: { type: "string", description: "成分或成分组合名" },
                  mechanism: { type: "string", description: "简短再生生物学机制" },
                  contributionYears: { type: "number" },
                  citation: { type: "string", description: "代表性文献引用：第一作者姓+年份, 期刊缩写" },
                },
                required: ["factor", "mechanism", "contributionYears", "citation"],
                additionalProperties: false,
              },
            },
            caveat: { type: "string" },
          },
          required: ["years", "direction", "horizon", "confidence", "drivers", "caveat"],
          additionalProperties: false,
        },
      },
      required: [
        "product",
        "skinSnapshot",
        "compatibilityScore",
        "verdict",
        "summary",
        "risks",
        "benefits",
        "usageTips",
        "riskRadar",
        "skinAgeImpact",
      ],
      additionalProperties: false,
    },
  },
};

interface ZoneInput {
  zone: string;
  label: string;
  base64: string;
}

export const analyzeCompatibility = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { zones: ZoneInput[]; productBase64: string; faceDetected: boolean }) => {
      if (!Array.isArray(input?.zones) || input.zones.length === 0) {
        throw new Error("zones is required");
      }
      if (!input.productBase64 || typeof input.productBase64 !== "string") {
        throw new Error("productBase64 is required");
      }
      let total = input.productBase64.length;
      for (const z of input.zones) {
        if (!z?.base64 || typeof z.base64 !== "string") throw new Error("invalid zone");
        total += z.base64.length;
      }
      if (total > 40_000_000) throw new Error("images too large");
      return input;
    },
  )
  .handler(
    async ({ data }): Promise<{ report: CompatibilityReport | null; error: string | null }> => {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) return { report: null, error: "AI 服务未配置" };

      const content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      > = [
        {
          type: "text",
          text: `本次共有 ${data.zones.length} 张脸部分区图像 + 1 张产品图像。${
            data.faceDetected
              ? "脸部已通过 MediaPipe 完成关键点对齐。"
              : "未检测到清晰人脸，已使用居中裁剪。请在 summary 中提示用户重新拍摄。"
          } 请先识别产品，再综合脸部分区判断适配度，并通过 submit_compatibility 返回结果。`,
        },
      ];
      for (const z of data.zones) {
        content.push({ type: "text", text: `【脸部 · ${z.label}】` });
        content.push({
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${z.base64}` },
        });
      }
      content.push({ type: "text", text: "【产品图像】" });
      content.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${data.productBase64}` },
      });

      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content },
            ],
            tools: [TOOL_SCHEMA],
            tool_choice: { type: "function", function: { name: "submit_compatibility" } },
            temperature: 0,
            top_p: 0,
            seed: 42,
          }),
        });

        if (res.status === 429)
          return { report: null, error: "请求过于频繁，请稍后再试" };
        if (res.status === 402)
          return {
            report: null,
            error: "AI 额度不足，请在 Settings → Workspace → Usage 充值",
          };
        if (!res.ok) {
          const t = await res.text();
          console.error("AI gateway error:", res.status, t);
          return { report: null, error: `AI 服务错误 (${res.status})` };
        }

        const payload = await res.json();
        const toolCall = payload?.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall?.function?.arguments) {
          return { report: null, error: "AI 未返回结构化结果，请重试" };
        }
        const parsed = JSON.parse(toolCall.function.arguments);
        const report: CompatibilityReport = {
          ...parsed,
          createdAt: new Date().toISOString(),
        };
        return { report, error: null };
      } catch (e) {
        console.error("analyzeCompatibility failed:", e);
        return { report: null, error: e instanceof Error ? e.message : "未知错误" };
      }
    },
  );
