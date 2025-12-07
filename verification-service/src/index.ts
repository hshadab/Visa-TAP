/**
 * zkML Verification Facilitator Service
 *
 * Provides a hosted verification endpoint for merchants who don't
 * want to run local verification.
 */

import express from 'express';
import cors from 'cors';
import verifyRouter from './routes/verify';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'zkml-verification-service' });
});

// Verification routes
app.use('/v1/zkml', verifyRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    valid: false,
    error: 'Internal server error',
    error_code: 'INTERNAL_ERROR',
  });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`zkML Verification Service running on port ${PORT}`);
    console.log(`Endpoints:`);
    console.log(`  POST /v1/zkml/verify - Verify zkML proof`);
    console.log(`  GET  /health         - Health check`);
  });
}

export default app;
