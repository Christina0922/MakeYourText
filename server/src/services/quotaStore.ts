import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB 파일 경로 (프로젝트 루트의 data 폴더)
const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'quota.db');

let db: Database.Database | null = null;

/**
 * DB 초기화 및 테이블 생성
 */
export function init(): void {
  try {
    // data 폴더가 없으면 생성
    if (!existsSync(DB_DIR)) {
      mkdirSync(DB_DIR, { recursive: true });
      console.log('[quotaStore] Created data directory:', DB_DIR);
    }

    db = new Database(DB_PATH);
    
    // 사용량 테이블 (일 단위 집계)
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_usage (
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        requests INTEGER DEFAULT 0,
        chars INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, date)
      )
    `);
    
    // 구독 정보 테이블
    db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        user_id TEXT PRIMARY KEY,
        is_pro INTEGER DEFAULT 0,
        expires_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    
    // 인덱스 생성
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_daily_usage_date ON daily_usage(date);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_expires ON subscriptions(expires_at);
    `);
    
    console.log('[quotaStore] Database initialized:', DB_PATH);
  } catch (error: any) {
    console.error('[quotaStore] Failed to initialize database:', error);
    throw error;
  }
}

/**
 * 날짜 문자열 생성 (YYYY-MM-DD)
 */
function getDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 사용량 조회
 */
export function getUsage(userId: string, date?: string): { requests: number; chars: number } {
  if (!db) {
    console.warn('[quotaStore] Database not initialized, returning zero usage');
    return { requests: 0, chars: 0 };
  }
  
  const targetDate = date || getDateString();
  const stmt = db.prepare('SELECT requests, chars FROM daily_usage WHERE user_id = ? AND date = ?');
  const row = stmt.get(userId, targetDate) as { requests: number; chars: number } | undefined;
  
  return row || { requests: 0, chars: 0 };
}

/**
 * 사용량 추가
 */
export function addUsage(userId: string, addRequests: number, addChars: number, date?: string): void {
  if (!db) {
    console.warn('[quotaStore] Database not initialized, skipping usage update');
    return;
  }
  
  const targetDate = date || getDateString();
  const stmt = db.prepare(`
    INSERT INTO daily_usage (user_id, date, requests, chars)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET
      requests = requests + ?,
      chars = chars + ?
  `);
  
  stmt.run(userId, targetDate, addRequests, addChars, addRequests, addChars);
}

/**
 * 구독 정보 설정
 */
export function setSubscription(userId: string, isPro: boolean, expiresAt?: Date): void {
  if (!db) {
    console.warn('[quotaStore] Database not initialized, skipping subscription update');
    return;
  }
  
  const expiresAtStr = expiresAt ? expiresAt.toISOString() : null;
  const stmt = db.prepare(`
    INSERT INTO subscriptions (user_id, is_pro, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      is_pro = ?,
      expires_at = ?
  `);
  
  stmt.run(userId, isPro ? 1 : 0, expiresAtStr, isPro ? 1 : 0, expiresAtStr);
}

/**
 * 플랜 조회 (FREE 또는 PRO)
 */
export function getPlan(userId: string): { plan: 'FREE' | 'PRO'; expiresAt?: string } {
  if (!db) throw new Error('Database not initialized');
  
  const stmt = db.prepare('SELECT is_pro, expires_at FROM subscriptions WHERE user_id = ?');
  const row = stmt.get(userId) as { is_pro: number; expires_at: string | null } | undefined;
  
  if (!row || row.is_pro === 0) {
    return { plan: 'FREE' };
  }
  
  // 만료일 체크
  if (row.expires_at) {
    const expiresAt = new Date(row.expires_at);
    const now = new Date();
    if (expiresAt < now) {
      // 만료됨 - FREE로 변경
      setSubscription(userId, false);
      return { plan: 'FREE' };
    }
    return { plan: 'PRO', expiresAt: row.expires_at };
  }
  
  // 만료일 없으면 영구 PRO
  return { plan: 'PRO' };
}

/**
 * 다음 날 자정 시각 (ISO 8601)
 */
export function getNextResetTime(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

/**
 * DB 연결 종료
 */
export function close(): void {
  if (db) {
    db.close();
    db = null;
  }
}

