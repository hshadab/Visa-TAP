/**
 * Example: Merchant Integration with zkML Verification
 *
 * This example demonstrates how a merchant can verify zkML proofs
 * in incoming TAP payment requests.
 */

import express from 'express';
import { zkmlMiddleware, isZkmlVerified, getVerifiedModelCommitment } from '@visa-tap/cdn-proxy-zkml';

const app = express();
app.use(express.json());

// Configure zkML verification threshold
const ZKML_THRESHOLD = 1000; // $1000 USD

/**
 * Apply zkML verification middleware to payment endpoints
 *
 * This middleware will:
 * 1. Check if transaction amount exceeds threshold
 * 2. Verify zkML proof if present
 * 3. Block or allow request based on verification result
 */
app.use('/api/payment', zkmlMiddleware({
  threshold: ZKML_THRESHOLD,
  verifyMode: 'local',
  blockMissingProofs: true,
  blockInvalidProofs: true,
  debug: true,
  getTransactionAmount: (req) => {
    // Extract amount from request body (in cents)
    return (req.body?.amount || 0) / 100;
  },
}));

/**
 * Payment endpoint
 */
app.post('/api/payment', (req, res) => {
  // At this point, zkML verification has passed (if required)

  const verified = isZkmlVerified(req);
  const modelCommitment = getVerifiedModelCommitment(req);
  const zkmlResult = req.zkmlVerification;

  console.log('Payment request received:');
  console.log('  Amount:', req.body.amount / 100, 'USD');
  console.log('  zkML verified:', verified);
  console.log('  zkML status:', zkmlResult?.zkml);

  if (modelCommitment) {
    console.log('  Model commitment:', modelCommitment.substring(0, 16) + '...');
  }

  // Process payment
  const response = {
    success: true,
    transaction_id: `txn_${Date.now()}`,
    amount: req.body.amount,
    currency: req.body.currency || 'USD',
    zkml_verification: {
      status: zkmlResult?.zkml,
      model_commitment: modelCommitment,
    },
  };

  res.json(response);
});

/**
 * Health check endpoint
 */
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'merchant-payment-api',
    zkml_enabled: true,
    zkml_threshold: ZKML_THRESHOLD,
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('=== Merchant Payment API with zkML Verification ===');
  console.log(`Server running on port ${PORT}`);
  console.log(`zkML threshold: $${ZKML_THRESHOLD}`);
  console.log('');
  console.log('Test with:');
  console.log(`  curl -X POST http://localhost:${PORT}/api/payment \\`);
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"amount": 50000, "currency": "USD"}\'');
  console.log('');
  console.log('Note: Transactions >= $1000 require zkML proof headers');
});
