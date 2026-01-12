/**
 * Spending Decision Model
 *
 * This model decides WHETHER an agent should purchase a service.
 * zkML proves the agent ran this model correctly before spending.
 *
 * Input: pre-payment data (price, budget, reputation, history)
 * Output: buy/don't_buy decision with confidence
 */

import { ValidationError } from './errors';

export type ServiceCategory =
  | 'ai'
  | 'data'
  | 'compute'
  | 'storage'
  | 'api'
  | 'software'
  | 'infrastructure'
  | 'observability'
  | 'security'
  | 'other';

export type VendorTier = 'preferred' | 'standard' | 'new' | 'high-risk';

/**
 * Input to the spending decision model
 */
export interface SpendingModelInput {
  serviceUrl: string;
  serviceName: string;
  serviceCategory: ServiceCategory | string;
  priceUsdc: number;
  budgetUsdc: number;
  spentTodayUsdc: number;
  dailyLimitUsdc: number;
  serviceSuccessRate: number;
  serviceTotalCalls: number;
  purchasesInCategory: number;
  timeSinceLastPurchase: number;

  // Enterprise procurement fields (optional)
  vendorRiskScore?: number;
  vendorId?: string;
  vendorTier?: VendorTier;
  budgetCategory?: string;
  categoryBudgetUsdc?: number;
  categorySpentUsdc?: number;
  historicalVendorScore?: number;
  vendorOnboardingDays?: number;
  vendorComplianceStatus?: boolean;
  urgencyFlag?: boolean;
  managerPreApproval?: boolean;
}

/**
 * Output from the spending decision model
 */
export interface SpendingModelOutput {
  shouldBuy: boolean;
  confidence: number;
  reasons: string[];
  riskScore: number;
}

/**
 * Spending model configuration
 */
export interface SpendingPolicy {
  dailyLimitUsdc: number;
  maxSinglePurchaseUsdc: number;
  minSuccessRate: number;
  minBudgetBuffer: number;
  categoryLimits?: Record<string, number>;
  maxVendorRiskScore?: number;
  minVendorHistoryScore?: number;
  requireCompliance?: boolean;
  minVendorOnboardingDays?: number;
}

// B2B Enterprise policy for Visa TAP demo
export const B2B_SPENDING_POLICY: SpendingPolicy = {
  dailyLimitUsdc: 500000,         // $500K/day
  maxSinglePurchaseUsdc: 100000,  // $100K max per purchase
  minSuccessRate: 0.80,           // 80% success rate minimum
  minBudgetBuffer: 5000,          // Keep $5K minimum in treasury
  maxVendorRiskScore: 0.70,       // Reject vendors with >70% risk
  minVendorHistoryScore: 0.80,    // Require 80%+ historical performance
  requireCompliance: true,        // Must pass compliance checks
};

/**
 * Validate spending model input
 */
export function validateSpendingInput(input: SpendingModelInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof input.priceUsdc !== 'number' || isNaN(input.priceUsdc) || input.priceUsdc < 0) {
    errors.push('priceUsdc must be a non-negative number');
  }
  if (typeof input.budgetUsdc !== 'number' || isNaN(input.budgetUsdc) || input.budgetUsdc < 0) {
    errors.push('budgetUsdc must be a non-negative number');
  }
  if (typeof input.spentTodayUsdc !== 'number' || isNaN(input.spentTodayUsdc) || input.spentTodayUsdc < 0) {
    errors.push('spentTodayUsdc must be a non-negative number');
  }
  if (typeof input.dailyLimitUsdc !== 'number' || isNaN(input.dailyLimitUsdc) || input.dailyLimitUsdc <= 0) {
    errors.push('dailyLimitUsdc must be a positive number');
  }
  if (typeof input.serviceSuccessRate !== 'number' || input.serviceSuccessRate < 0 || input.serviceSuccessRate > 1) {
    errors.push('serviceSuccessRate must be between 0 and 1');
  }
  if (input.vendorRiskScore !== undefined && (input.vendorRiskScore < 0 || input.vendorRiskScore > 1)) {
    errors.push('vendorRiskScore must be between 0 and 1');
  }
  if (input.historicalVendorScore !== undefined && (input.historicalVendorScore < 0 || input.historicalVendorScore > 1)) {
    errors.push('historicalVendorScore must be between 0 and 1');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Run the spending decision model
 * This is deterministic and can be proven with zkML
 */
export function runSpendingModel(
  input: SpendingModelInput,
  policy: SpendingPolicy = B2B_SPENDING_POLICY
): SpendingModelOutput {
  const validation = validateSpendingInput(input);
  if (!validation.valid) {
    throw ValidationError.fromErrors(validation.errors);
  }

  const reasons: string[] = [];
  let riskScore = 0;

  // === HARD BLOCKS ===

  // 1. Price exceeds single purchase limit
  if (input.priceUsdc > policy.maxSinglePurchaseUsdc) {
    return {
      shouldBuy: false,
      confidence: 1.0,
      reasons: [`Price $${input.priceUsdc.toLocaleString()} exceeds max $${policy.maxSinglePurchaseUsdc.toLocaleString()}`],
      riskScore: 1.0,
    };
  }

  // 2. Would exceed daily limit
  const projectedDailySpend = input.spentTodayUsdc + input.priceUsdc;
  if (projectedDailySpend > policy.dailyLimitUsdc) {
    return {
      shouldBuy: false,
      confidence: 1.0,
      reasons: [`Would exceed daily limit: $${projectedDailySpend.toLocaleString()} > $${policy.dailyLimitUsdc.toLocaleString()}`],
      riskScore: 1.0,
    };
  }

  // 3. Insufficient budget
  const availableBudget = input.budgetUsdc - policy.minBudgetBuffer;
  if (input.priceUsdc > availableBudget) {
    return {
      shouldBuy: false,
      confidence: 1.0,
      reasons: [`Insufficient budget: need $${input.priceUsdc.toLocaleString()}, have $${availableBudget.toLocaleString()}`],
      riskScore: 1.0,
    };
  }

  // 4. Service has bad reputation
  if (input.serviceTotalCalls >= 3 && input.serviceSuccessRate < policy.minSuccessRate) {
    return {
      shouldBuy: false,
      confidence: 0.9,
      reasons: [`Service success rate ${(input.serviceSuccessRate * 100).toFixed(0)}% below minimum ${(policy.minSuccessRate * 100).toFixed(0)}%`],
      riskScore: 0.9,
    };
  }

  // 5. Vendor risk exceeds threshold
  const maxVendorRisk = policy.maxVendorRiskScore ?? 0.8;
  if (input.vendorRiskScore !== undefined && input.vendorRiskScore > maxVendorRisk) {
    return {
      shouldBuy: false,
      confidence: 1.0,
      reasons: [`Vendor risk ${(input.vendorRiskScore * 100).toFixed(0)}% exceeds threshold ${(maxVendorRisk * 100).toFixed(0)}%`],
      riskScore: 1.0,
    };
  }

  // 6. Vendor failed compliance
  if (policy.requireCompliance && input.vendorComplianceStatus === false) {
    return {
      shouldBuy: false,
      confidence: 1.0,
      reasons: ['Vendor failed compliance verification'],
      riskScore: 1.0,
    };
  }

  // 7. Category budget exceeded
  if (
    input.categoryBudgetUsdc !== undefined &&
    input.categorySpentUsdc !== undefined &&
    input.priceUsdc + input.categorySpentUsdc > input.categoryBudgetUsdc
  ) {
    return {
      shouldBuy: false,
      confidence: 1.0,
      reasons: [`Would exceed category budget: $${(input.categorySpentUsdc + input.priceUsdc).toLocaleString()} > $${input.categoryBudgetUsdc.toLocaleString()}`],
      riskScore: 1.0,
    };
  }

  // 8. Vendor history below minimum
  const minVendorHistory = policy.minVendorHistoryScore ?? 0.4;
  if (
    input.historicalVendorScore !== undefined &&
    input.historicalVendorScore < minVendorHistory &&
    input.vendorOnboardingDays !== undefined &&
    input.vendorOnboardingDays >= 90
  ) {
    return {
      shouldBuy: false,
      confidence: 0.95,
      reasons: [`Vendor history ${(input.historicalVendorScore * 100).toFixed(0)}% below minimum ${(minVendorHistory * 100).toFixed(0)}%`],
      riskScore: 0.95,
    };
  }

  // === SOFT FACTORS ===

  // Factor 1: Price relative to budget
  const budgetRatio = input.priceUsdc / input.budgetUsdc;
  if (budgetRatio > 0.5) {
    riskScore += 0.3;
    reasons.push(`High budget ratio: ${(budgetRatio * 100).toFixed(0)}% of treasury`);
  } else if (budgetRatio < 0.1) {
    reasons.push(`Low budget impact: ${(budgetRatio * 100).toFixed(1)}% of treasury`);
  }

  // Factor 2: Service reputation
  if (input.serviceTotalCalls === 0) {
    riskScore += 0.2;
    reasons.push('New service (no history)');
  } else if (input.serviceSuccessRate >= 0.9) {
    riskScore -= 0.1;
    reasons.push(`Trusted service: ${(input.serviceSuccessRate * 100).toFixed(0)}% success rate`);
  }

  // Factor 3: Daily spend progress
  const dailyProgress = input.spentTodayUsdc / policy.dailyLimitUsdc;
  if (dailyProgress > 0.8) {
    riskScore += 0.15;
    reasons.push(`Near daily limit: ${(dailyProgress * 100).toFixed(0)}% used`);
  }

  // Factor 4: Vendor risk
  if (input.vendorRiskScore !== undefined) {
    riskScore += input.vendorRiskScore * 0.3;
    if (input.vendorRiskScore <= 0.3) {
      reasons.push(`Low vendor risk: ${(input.vendorRiskScore * 100).toFixed(0)}%`);
    }
  }

  // Factor 5: Vendor history
  if (input.historicalVendorScore !== undefined && input.historicalVendorScore >= 0.9) {
    riskScore -= 0.15;
    reasons.push(`Excellent vendor history: ${(input.historicalVendorScore * 100).toFixed(0)}%`);
  }

  // Factor 6: Compliance verified
  if (input.vendorComplianceStatus === true) {
    riskScore -= 0.05;
    reasons.push('Compliance verified');
  }

  // Factor 7: Preferred vendor
  if (input.vendorTier === 'preferred') {
    riskScore -= 0.1;
    reasons.push('Preferred vendor tier');
  }

  // Normalize risk score
  riskScore = Math.max(0, Math.min(1, riskScore));

  const confidence = 1 - (riskScore * 0.5);
  const shouldBuy = riskScore < 0.8;

  if (shouldBuy) {
    reasons.unshift(`Approved: $${input.priceUsdc.toLocaleString()} within policy limits`);
  } else {
    reasons.unshift(`Rejected: risk score ${riskScore.toFixed(2)} too high`);
  }

  return { shouldBuy, confidence, reasons, riskScore };
}

/**
 * Convert spending input to numeric array for ONNX inference
 */
export function spendingInputToNumeric(input: SpendingModelInput): number[] {
  return [
    input.priceUsdc,
    input.budgetUsdc,
    input.spentTodayUsdc,
    input.dailyLimitUsdc,
    input.serviceSuccessRate,
    input.serviceTotalCalls / 100,
    input.purchasesInCategory / 10,
    Math.min(input.timeSinceLastPurchase / 3600, 1),
  ];
}

/**
 * Create B2B demo input for Visa TAP ($75K GlobalTech payment)
 */
export function createVisaTapDemoInput(): SpendingModelInput {
  return {
    serviceUrl: 'https://globaltech-suppliers.com/invoice/2024-Q4-001',
    serviceName: 'GlobalTech Suppliers Inc.',
    serviceCategory: 'infrastructure',
    priceUsdc: 75000.00,              // $75K purchase
    budgetUsdc: 500000.00,            // $500K treasury
    spentTodayUsdc: 50000.00,         // $50K already spent today
    dailyLimitUsdc: 500000.00,        // $500K daily limit
    serviceSuccessRate: 0.98,         // 98% historical success
    serviceTotalCalls: 24,            // 2 years of monthly orders
    purchasesInCategory: 3,           // 3 recent infrastructure purchases
    timeSinceLastPurchase: 604800,    // 1 week since last purchase

    // Enterprise fields
    vendorRiskScore: 0.15,            // Low risk vendor
    vendorId: 'globaltech-inc',
    vendorTier: 'preferred',
    budgetCategory: 'infrastructure',
    categoryBudgetUsdc: 200000.00,    // $200K for infrastructure
    categorySpentUsdc: 45000.00,      // $45K already spent
    historicalVendorScore: 0.92,      // Excellent track record
    vendorOnboardingDays: 730,        // 2-year relationship
    vendorComplianceStatus: true,     // SOC2 compliant
    urgencyFlag: false,
    managerPreApproval: false,
  };
}
