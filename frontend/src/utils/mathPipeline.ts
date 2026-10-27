export const MOTOR_STATES = [
  'Normal',
  'Mild Imbalance',
  'Severe Imbalance',
  'Misalignment',
  'Looseness',
  'Inner Race Fault',
  'Outer Race Fault',
  'Ball Fault',
] as const;

export type MotorState = typeof MOTOR_STATES[number];

/**
 * Stage 3.2: Temperature-Scaled Softmax Calibration
 * Formula: p_T(c|x) = exp(z_c / T) / sum_j exp(z_j / T)
 */
export function computeCalibratedProbabilities(
  logits: number[],
  temperature: number = 1.45
): {
  uncalibratedProbabilities: number[];
  calibratedProbabilities: number[];
  probabilities: number[];
} {
  const safeT = Math.max(0.1, temperature);

  // Uncalibrated (T = 1.0)
  const maxRaw = Math.max(...logits);
  const expRaw = logits.map((z) => Math.exp(z - maxRaw));
  const sumRaw = expRaw.reduce((a, b) => a + b, 0);
  const uncalibratedProbabilities = expRaw.map((e) => e / (sumRaw || 1));

  // Scaled (T = safeT)
  const scaled = logits.map((z) => z / safeT);
  const maxScaled = Math.max(...scaled);
  const expScaled = scaled.map((s) => Math.exp(s - maxScaled));
  const sumScaled = expScaled.reduce((a, b) => a + b, 0);
  const calibratedProbabilities = expScaled.map((e) => e / (sumScaled || 1));

  return {
    uncalibratedProbabilities: uncalibratedProbabilities.map((v) => Number(v.toFixed(5))),
    calibratedProbabilities: calibratedProbabilities.map((v) => Number(v.toFixed(5))),
    probabilities: calibratedProbabilities.map((v) => Number(v.toFixed(5))),
  };
}

/**
 * Stage 3.3: Genuine Asymmetric Cost Matrix [8 x 8]
 * C[c][d]: True State c, Classifier Action d
 * - Diagonal = 0.0 (Correct Action)
 * - False Alarm (Normal -> Fault) = 1.0
 * - Fault Confusion = 2.0 to 5.0
 * - Missed Critical Fault (Fault -> Normal) = 10.0 (Severe breakdown penalty!)
 */
export const ASYMMETRIC_COST_MATRIX: number[][] = [
  // Action: Normal, Mild,   Sev,   Mis,   Loo,   IR,    OR,    Ball
  /* Normal    */ [0.0,   1.0,   1.0,   1.0,   1.0,   1.0,   1.0,   1.0],
  /* Mild Imb  */ [10.0,  0.0,   2.0,   2.5,   2.5,   4.0,   4.0,   4.0],
  /* Sev Imb   */ [10.0,  3.0,   0.0,   3.0,   3.0,   5.0,   5.0,   5.0],
  /* Misalign  */ [10.0,  2.5,   3.0,   0.0,   3.0,   5.0,   5.0,   5.0],
  /* Looseness */ [10.0,  2.5,   3.0,   3.0,   0.0,   5.0,   5.0,   5.0],
  /* IR Fault  */ [10.0,  6.0,   7.0,   6.0,   6.0,   0.0,   2.5,   2.5],
  /* OR Fault  */ [10.0,  6.0,   7.0,   6.0,   6.0,   2.5,   0.0,   2.5],
  /* Ball Fault*/ [10.0,  6.0,   7.0,   6.0,   6.0,   2.5,   2.5,   0.0],
];

/**
 * Computes Expected Bayes Risk: R(d) = sum_c (p_T(c|x) * C_err(c, d))
 */
export function computeExpectedRiskVector(
  probabilities: number[],
  costMatrix: number[][] = ASYMMETRIC_COST_MATRIX
): {
  expectedRiskVector: number[];
  minRisk: number;
  optimalActionIndex: number;
  optimalActionName: string;
} {
  const K = probabilities.length;
  const expectedRiskVector: number[] = [];

  for (let d = 0; d < K; d++) {
    let sum = 0;
    for (let c = 0; c < K; c++) {
      const p = probabilities[c] || 0;
      const cost = costMatrix[c][d];
      sum += p * cost;
    }
    expectedRiskVector.push(Number(sum.toFixed(4)));
  }

  let minRisk = expectedRiskVector[0];
  let optimalActionIndex = 0;
  for (let d = 1; d < K; d++) {
    if (expectedRiskVector[d] < minRisk) {
      minRisk = expectedRiskVector[d];
      optimalActionIndex = d;
    }
  }

  return {
    expectedRiskVector,
    minRisk,
    optimalActionIndex,
    optimalActionName: MOTOR_STATES[optimalActionIndex],
  };
}

/**
 * Stage 3.4: Dynamic Deferral Gatekeeper
 * Evaluates minRisk against deferral threshold theta
 */
export function evaluateDeferralDecision(
  minRisk: number,
  threshold: number = 1.20
): {
  decision: 'KEEP_LOCAL' | 'OFFLOAD_CLOUD';
  margin: number;
  isOffloadRecommended: boolean;
} {
  const margin = Number((minRisk - threshold).toFixed(4));
  const isOffloadRecommended = minRisk >= threshold;
  return {
    decision: isOffloadRecommended ? 'OFFLOAD_CLOUD' : 'KEEP_LOCAL',
    margin,
    isOffloadRecommended,
  };
}
