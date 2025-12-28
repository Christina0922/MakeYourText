import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rewriteRouter from './routes/rewrite.js';
import presetsRouter from './routes/presets.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어
app.use(cors());
app.use(express.json());

// 라우트
app.use('/api/rewrite', rewriteRouter);
app.use('/api/presets', presetsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

