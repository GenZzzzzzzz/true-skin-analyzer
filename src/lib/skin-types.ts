export type MetricKey =
  | "oil"
  | "hydration"
  | "sensitivity"
  | "pores"
  | "acne"
  | "evenness"
  | "wrinkles";

export interface Metric {
  key: MetricKey;
  label: string;
  score: number;
  level: "优" | "良" | "一般" | "差";
  findings: string;
  recommendations: string[];
}

export interface SkinReport {
  overallScore: number;
  skinType: string;
  summary: string;
  metrics: Metric[];
  createdAt: string;
}

export const METRIC_LABELS: Record<MetricKey, string> = {
  oil: "油脂分布",
  hydration: "干燥/缺水",
  sensitivity: "敏感/红血丝",
  pores: "毛孔状态",
  acne: "痘痘/粉刺",
  evenness: "肤色均匀度",
  wrinkles: "皱纹/细纹",
};
