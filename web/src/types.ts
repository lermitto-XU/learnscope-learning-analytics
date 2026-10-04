export type User = {
  id: number;
  username: string;
  displayName: string;
  role: "STUDENT" | "TEACHER" | "ADMIN";
};
export type Knowledge = {
  id: number;
  title: string;
  category: string;
  description: string;
  difficulty: number;
  minutes: number;
  importance: number;
  x: number;
  y: number;
  content: string;
  version: number;
};
export type Mastery = {
  value: number;
  lower: number;
  upper: number;
  attempts: number;
  correct: number;
  evidenceAttempts: number;
  evidenceCorrect: number;
  legacyAttempts: number;
  seconds: number;
  daysSince: number;
  evidence: string;
};
export type Relation = {
  id: number;
  source: number;
  target: number;
  type: "PREREQUISITE" | "RELATED" | "PART_OF";
  weight: number;
};
export type Graph = {
  nodes: Knowledge[];
  edges: Relation[];
  mastery: Record<string, Mastery>;
};
export type Event = {
  id: number;
  knowledgeId: number;
  questionId: number;
  kind: string;
  seconds: number;
  correct: number;
  total: number;
  createdAt: number;
  title: string;
};
export type Overview = {
  mastery: Record<string, Mastery>;
  stats: {
    average: number;
    mastered: number;
    totalKnowledge: number;
    studySeconds: number;
    attempts: number;
    accuracy: number;
    evidenceAttempts: number;
    evidenceAccuracy: number;
    repeatedAttempts: number;
  };
  recommendations: { knowledge: Knowledge; mastery: Mastery; reason: string }[];
  trend: { timestamp: number; mastery: number; minutes: number }[];
  recent: Event[];
};
export type Plan = {
  steps: {
    knowledge: Knowledge;
    mastery: number;
    estimatedMinutes: number;
    inBudget: boolean;
    reason: string;
  }[];
  skipped: number[];
  totalMinutes: number;
  scheduledMinutes: number;
  completeWithinBudget: boolean;
  algorithm: string;
  warnings: string[];
};
export type Forecast = {
  probability: number;
  baselineProbability: number;
  difference: number;
  baselineSource: string;
  comparisonNotice: string;
  source: string;
  modelSpread: { name: string; probability: number }[];
  notice: string;
  outOfDistribution?: boolean;
  current: Mastery;
  knowledge: Knowledge;
  factors: { label: string; value: string }[];
};
export type Score = {
  auc: number;
  brier: number;
  rmse: number;
  logLoss: number;
  accuracy: number;
  ece: number;
  samples: number;
  calibration: { predicted: number; observed: number; count: number }[];
};
export type Metrics = {
  available: boolean;
  notice: string;
  version?: string;
  dataset?: string;
  models?: Record<string, Score>;
  temporal?: Score;
  split?: {
    trainLearners: number;
    calibrationLearners: number;
    testLearners: number;
    trainSamples: number;
    calibrationSamples: number;
    testSamples: number;
    temporalSamples: number;
    learnerOverlap: number;
  };
  features?: { name: string; importance: number }[];
};
export type Assessment = {
  id: string;
  knowledgeId: number;
  questions: {
    id: number;
    prompt: string;
    options: string[];
    difficulty: number;
  }[];
};
export type QuizResult = {
  correct: number;
  total: number;
  evidenceAdded: number;
  repeatedAnswers: number;
  historicalResult?: boolean;
  mastery: Mastery;
  feedback: {
    prompt: string;
    correct: boolean;
    selected: number;
    answer: number;
    options: string[];
    explanation: string;
  }[];
};
