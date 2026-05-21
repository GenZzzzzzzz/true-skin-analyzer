import { createServerFn } from "@tanstack/react-start";
import type { SkinReport } from "./skin-types";

const SYSTEM_PROMPT = `你是资深皮肤科与美容皮肤学专家，正在审阅一组经过对齐与光照矫正的高分辨率人脸图像。

你会同时收到多张图像，每张前都会有一条文字说明它的用途：
- "全脸"：对齐 + Retinex 光照矫正后的完整人脸 (整体评估、肤色均匀度、皱纹)
- "T 区"：额头 + 鼻梁特写 (油脂、毛孔、闭口)
- "鼻部特写"：高分辨率鼻部图，用于黑头、毛孔粗大、油脂分泌
- "双颊"：左右脸颊并排 (毛孔、痘印、敏感、肤色)
- "眼周"：眼下与眼角 (细纹、黑眼圈、敏感)
- "红色通道增强"：将红色信号放大并叠加为热度图。**只在这张图上判断红血丝/炎症/敏感**——亮红色 = 真实红血丝/炎症区域

评估原则：
- 分数 0-100，越高越健康。
- 必须综合所有分区图像后再打分，而不是只看一张全脸。
- findings 中要说明你**从哪些分区**得出的判断 (例如："鼻部特写显示鼻头有可见黑头与扩张毛孔；T 区油光明显")。
- 仅供日常护肤参考，不构成医学诊断。
- 中文输出。建议要具体、可执行。

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

interface ZoneInput {
  zone: string;
  label: string;
  base64: string;
}

export const analyzeSkin = createServerFn({ method: "POST" })
  .inputValidator((input: { zones: ZoneInput[]; faceDetected: boolean }) => {
    if (!Array.isArray(input?.zones) || input.zones.length === 0) {
      throw new Error("zones is required");
    }
    let total = 0;
    for (const z of input.zones) {
      if (!z?.base64 || typeof z.base64 !== "string") throw new Error("invalid zone");
      total += z.base64.length;
    }
    if (total > 30_000_000) throw new Error("images too large");
    return input;
  })
  .handler(async ({ data }): Promise<{ report: SkinReport | null; error: string | null }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { report: null, error: "AI 服务未配置" };

    const content: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [
      {
        type: "text",
        text:
          `本次共有 ${data.zones.length} 张图像。${data.faceDetected ? "已通过 MediaPipe 完成人脸关键点对齐。" : "未检测到清晰人脸，已使用居中裁剪。请在 summary 中提示用户重新拍摄。"} 请按提供的分区说明分别参考，并通过 submit_skin_report 返回 7 项指标。`,
      },
    ];
    for (const z of data.zones) {
      content.push({ type: "text", text: `【${z.label}】` });
      content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${z.base64}` } });
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
            { role: "user", content },
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
      const report: SkinReport = { ...parsed, createdAt: new Date().toISOString() };
      return { report, error: null };
    } catch (e) {
      console.error("analyzeSkin failed:", e);
      return { report: null, error: e instanceof Error ? e.message : "未知错误" };
    }
  });
