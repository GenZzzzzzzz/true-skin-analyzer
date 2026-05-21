import { createServerFn } from "@tanstack/react-start";
import type { SkinReport } from "./skin-types";

const SYSTEM_PROMPT = `你是一位资深皮肤科与美容皮肤学专家。用户会提供一张正面人脸照片，请仅基于可见的视觉信息，给出 7 项肤质指标的评估，并综合得出肤质类型。

重要原则：
- 评估仅供日常护肤参考，不构成医学诊断。
- 评分 0-100，分数越高代表该项越健康。
- 若照片光线、角度或清晰度不足以判定某项，仍给出最合理估计但在 findings 中说明。
- 用简体中文回复，建议要可执行、具体。

必须通过 submit_skin_report 工具返回结构化结果。`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "submit_skin_report",
    description: "提交肤质分析结构化报告",
    parameters: {
      type: "object",
      properties: {
        overallScore: { type: "number", description: "0-100 综合健康分" },
        skinType: { type: "string", description: "如：干性/油性/混合性偏油/混合性偏干/敏感性" },
        summary: { type: "string", description: "2-3 句中文综合总结" },
        metrics: {
          type: "array",
          minItems: 7,
          maxItems: 7,
          items: {
            type: "object",
            properties: {
              key: { type: "string", enum: ["oil","hydration","sensitivity","pores","acne","evenness","wrinkles"] },
              label: { type: "string" },
              score: { type: "number" },
              level: { type: "string", enum: ["优","良","一般","差"] },
              findings: { type: "string" },
              recommendations: {
                type: "array",
                minItems: 2,
                maxItems: 4,
                items: { type: "string" },
              },
            },
            required: ["key","label","score","level","findings","recommendations"],
            additionalProperties: false,
          },
        },
      },
      required: ["overallScore","skinType","summary","metrics"],
      additionalProperties: false,
    },
  },
};

export const analyzeSkin = createServerFn({ method: "POST" })
  .inputValidator((input: { imageBase64: string }) => {
    if (!input?.imageBase64 || typeof input.imageBase64 !== "string") {
      throw new Error("imageBase64 is required");
    }
    if (input.imageBase64.length > 8_000_000) {
      throw new Error("Image too large");
    }
    return input;
  })
  .handler(async ({ data }): Promise<{ report: SkinReport | null; error: string | null }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { report: null, error: "AI 服务未配置" };
    }

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: "请分析这张人脸照片的肤质，并通过 submit_skin_report 工具返回结果。" },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${data.imageBase64}` } },
              ],
            },
          ],
          tools: [TOOL_SCHEMA],
          tool_choice: { type: "function", function: { name: "submit_skin_report" } },
        }),
      });

      if (res.status === 429) return { report: null, error: "请求过于频繁，请稍后再试" };
      if (res.status === 402) return { report: null, error: "AI 额度不足，请在 Settings → Workspace → Usage 充值" };
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
      const report: SkinReport = {
        ...parsed,
        createdAt: new Date().toISOString(),
      };
      return { report, error: null };
    } catch (e) {
      console.error("analyzeSkin failed:", e);
      return { report: null, error: e instanceof Error ? e.message : "未知错误" };
    }
  });
