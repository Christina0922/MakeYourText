import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rewriteRouter from './routes/rewrite.js';
import presetsRouter from './routes/presets.js';
import ttsRouter from './routes/tts.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS 설정
app.use(cors());
app.use(express.json());

// 라우트 등록
app.use('/api/rewrite', rewriteRouter);
app.use('/api/presets', presetsRouter);
app.use('/api/tts', ttsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`BYPASS_LIMITS: ${process.env.BYPASS_LIMITS || process.env.NODE_ENV === 'development' ? 'true' : 'false'}`);
});
