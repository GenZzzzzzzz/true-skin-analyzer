import { createServerFn } from "@tanstack/react-start";
import type { CompatibilityReport } from "./compatibility-types";

const SYSTEM_PROMPT = `你是资深皮肤科与化妆品成分学专家。用户会同时提供：
1) 一组经过对齐与光照矫正的人脸多分区图像 (全脸/T 区/鼻部/双颊/眼周/红色通道增强)
2) 一张化妆品/防晒/护肤品瓶身或包装的照片

你的任务：
- 先从产品图像中识别产品 (品牌+品类+尽可能多的关键成分)。若图像无法识别为可外用产品，将 recognized 设为 false，并在 summary 中提示用户重新上传。
- 再基于多分区人脸图像总结用户当前肤质特征 (型 + Top 关注点)。红色通道仅用于判断红血丝/炎症。
- 综合二者，评估这款产品对该用户的**适配度** (0-100)。重点判断刺激、过敏、闷痘、干燥加重、油光闷感、光敏 6 项风险。
- 给出 verdict (推荐/谨慎/不推荐)、风险列表 (含成因)、潜在好处、使用建议 (频率/用法/配伍)，必要时给替代成分方向。
- 中文输出。所有判断要具体到"哪些成分 × 哪个肤质特征"。
- 仅供日常护肤参考，不构成医学诊断。

必须通过 submit_compatibility 工具返回结构化结果。`;

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
