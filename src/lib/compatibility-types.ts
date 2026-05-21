export type RiskType =
  | "刺激"
  | "过敏"
  | "闷痘"
  | "干燥加重"
  | "油光"
  | "光敏"
  | "其他";

export type Severity = "低" | "中" | "高";

export type Verdict = "推荐" | "谨慎" | "不推荐";

export interface RiskItem {
  type: RiskType;
  severity: Severity;
  reason: string;
}

export interface RiskRadar {
  irritation: number; // 刺激
  allergy: number; // 过敏倾向
  comedogenic: number; // 致痘性
  dryness: number; // 干燥加重
  photo: number; // 光敏
  oiliness: number; // 油感/闷感
}

export interface SkinAgeDriver {
  factor: string;
  mechanism: string;
  contributionYears: number;
}

export interface SkinAgeImpact {
  years: number; // -2.0 ~ +5.0, 1 decimal
  direction: "aging" | "neutral" | "rejuvenating";
  horizon: "12_months";
  confidence: "低" | "中" | "高";
  drivers: SkinAgeDriver[];
  caveat: string;
}

export interface CompatibilityReport {
  product: {
    name: string;
    category: string;
    keyIngredients: string[];
    recognized: boolean;
  };
  skinSnapshot: {
    type: string;
    topConcerns: string[];
  };
  compatibilityScore: number; // 0-100
  verdict: Verdict;
  summary: string;
  risks: RiskItem[];
  benefits: string[];
  usageTips: string[];
  alternatives?: string[];
  riskRadar: RiskRadar;
  skinAgeImpact: SkinAgeImpact;
  createdAt: string;
}

export const RISK_RADAR_LABELS: Record<keyof RiskRadar, string> = {
  irritation: "刺激",
  allergy: "过敏",
  comedogenic: "致痘",
  dryness: "干燥",
  photo: "光敏",
  oiliness: "油感",
};
