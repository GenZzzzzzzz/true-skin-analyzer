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
H. Skin Age Impact (skinAgeImpact)：估算"每日规律使用本产品 12 个月后，皮肤生物学年龄相对自然老化基线的净变化年数"。**必须基于已发表临床/机制研究的效应量推断，不要凭感觉。** 自然老化基线已扣除——本数值仅是"该产品相对于不使用它"带来的增减。

   计算流程：
   (1) 起始 years = 0.0
   (2) 识别产品的"机制贡献项"。对每一项，依据下表的临床效应量映射 contributionYears(带符号)；只在该机制确有证据时计入；将所有项相加；最后按 confidence 衰减并钳制。

   抗老化/再生证据 (负值，使皮肤年轻化)：
   • 广谱防晒 SPF≥30 且 PA+++/PPD≥8，每日使用：-0.40 到 -0.60 yr
     依据：Hughes 2013 (Ann Intern Med) RCT 显示中年人群每日防晒 4.5 年使皮肤老化(显微地形学)减少 24%；按 12 个月线性外推。
   • 全反式视黄酸 0.025-0.1% 或等效视黄醇 ≥0.3%，耐受良好：-0.50 到 -1.00 yr
     依据：Kang 2005 (Arch Dermatol)、Fisher 1997 (NEJM) 显示 6-12 个月可逆转光老化组织学指标 (procollagen I ↑ 80%)。
   • 局部 L-抗坏血酸 ≥10% (pH<3.5) 长期使用：-0.20 到 -0.35 yr
     依据：Humbert 2003 (Exp Dermatol) 显示 6 个月真皮乳头层胶原密度显著增加。
   • 烟酰胺 ≥4%：-0.15 到 -0.25 yr
     依据：Bissett 2005 (Dermatol Surg) 12 周改善细纹、色斑、弹性。
   • 屏障修复组合 (神经酰胺 + 胆固醇 + 游离脂肪酸 3:1:1 类) 用于受损屏障：-0.15 到 -0.25 yr
     依据：Man 1996 (Arch Dermatol) 经表皮失水率与炎症标记下降。
   • α-羟基酸 (甘醇酸 ≥8%, pH<4) 长期使用：-0.10 到 -0.20 yr
     依据：Ditre 1996 (J Am Acad Dermatol) 6 个月真皮厚度 +25%。
   • 多肽 (Matrixyl/铜肽) 长期使用：-0.05 到 -0.15 yr
     依据：Robinson 2005 (Int J Cosmet Sci)，效应量较小。

   致老化证据 (正值，加速衰老)：
   • 高浓度变性酒精 (denat. alcohol >20%) × 屏障受损：+0.20 到 +0.40 yr
     依据：Lachenmeier 2008 (Int J Environ Res Public Health) 长期屏障破坏与炎症老化。
   • 强致敏香精/精油 × 敏感肤质 (linalool, limonene, citral 等氧化产物)：+0.15 到 +0.30 yr
     依据：Hagvall 2007 (Contact Dermatitis) 慢性接触性皮炎 → inflammaging。
   • 已知光敏化成分 (柑橘类呋喃香豆素、未稳定视黄醇日间使用) 且无防晒：+0.20 到 +0.40 yr
     依据：Krutmann 2017 (J Dermatol Sci) 光老化机制综述。
   • 高致痘成分 (肉豆蔻酸异丙酯、椰油酸等) × 多闭口/痘倾向：+0.10 到 +0.25 yr (主要是炎症后色沉与瘢痕加速质地老化)
     依据：Fulton 1984 (J Soc Cosmet Chem) 致痘性分级。
   • 高浓度视黄醇 × 屏障严重受损 (净效应可能为正)：+0.10 到 +0.30 yr
     依据：Mukherjee 2006 (Clin Interv Aging) 不耐受导致持续刺激。

   (3) 累加后乘以 confidence 系数：高=1.0, 中=0.7, 低=0.4 (识别度低时收敛回 0)。
   (4) 钳制到 [-1.5, +1.2] yr，保留 1 位小数。真实世界 12 个月单品效应几乎不会超出此范围；若超出说明你高估了证据强度，请回查。
   (5) direction：years < -0.3 → rejuvenating；-0.3..+0.3 → neutral；> +0.3 → aging。
   (6) confidence：成分表完整 + 浓度可读 + 与肤质特征对应明确 → 高；成分部分可读或浓度未知 → 中；仅能识别品类 → 低。
   (7) drivers：列出贡献最大的 2-4 项 (factor=成分或组合, mechanism=简短机制如"UV→MMP-1→胶原降解", contributionYears=按上表选取的带符号值, citation=上表对应的"第一作者姓 + 年份, 期刊缩写")。drivers 的 contributionYears 之和经 confidence 衰减与钳制后 ≈ years。
   (8) caveat 固定写："效应量来自公开发表的临床/机制研究的线性外推，针对个体存在显著变异，不构成医学诊断。"
   (9) horizon 固定 "12_months"。

   **不要编造文献。** 只能引用上表中列出的研究；若某机制不在上表，宁可不计入也不要伪造引用。

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
