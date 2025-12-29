import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rewriteRouter from './routes/rewrite.js';
import presetsRouter from './routes/presets.js';
import ttsRouter from './routes/tts.js';
import templatesRouter from './routes/templates.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS 설정 (모든 origin 허용)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// 라우트 등록
app.use('/api/rewrite', rewriteRouter);
app.use('/api/presets', presetsRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/templates', templatesRouter); // ✅ 템플릿 라우트 추가

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 루트 경로
app.get('/', (req, res) => {
  res.json({ message: 'MakeYourText API Server', version: '1.0.0' });
});

// 에러 핸들링
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 BYPASS_LIMITS: ${process.env.BYPASS_LIMITS || (process.env.NODE_ENV === 'development' ? 'true' : 'false')}`);
});
