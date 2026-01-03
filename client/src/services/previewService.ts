import { Plan, VoicePreset, VoiceControls, PreviewQuota, PreviewQuotaError } from '../types';
import { api } from './api';

const API_BASE_URL = (typeof process !== 'undefined' && process.env?.REACT_APP_API_BASE_URL) || 'http://localhost:5000/api';

/**
 * 익명 사용자 토큰 생성 및 저장
 */
function getOrCreateAnonymousToken(): string {
  const STORAGE_KEY = 'makeyourtext_anonymous_token';
  let token = localStorage.getItem(STORAGE_KEY);
  
  if (!token) {
    // UUID v4 형식의 토큰 생성 (간단한 버전)
    token = 'anon_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem(STORAGE_KEY, token);
  }
  
  return token;
}

/**
 * 미리듣기 한도 조회
 */
export async function getPreviewQuota(plan: Plan): Promise<PreviewQuota> {
  try {
    return await api.getPreviewQuota(plan);
  } catch (error: any) {
    console.error('Failed to get preview quota:', error);
    // 에러 시 기본값 반환
    return {
      remainingCount: 0,
      limitCount: 3,
      resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      unlimited: false,
    };
  }
}

/**
 * 미리듣기 API 호출 (서버 기반)
 * 한도 검사를 서버에서 수행
 */
export async function requestPreview(
  text: string,
  voicePreset: VoicePreset,
  controls: VoiceControls,
  plan: Plan,
  language: string = 'ko-KR'
): Promise<{ success: boolean; quota?: PreviewQuota; error?: PreviewQuotaError }> {
  const anonymousToken = getOrCreateAnonymousToken();
  
  try {
    const response = await fetch(`${API_BASE_URL}/tts/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Anonymous-Token': anonymousToken,
        // TODO: 로그인 사용자인 경우 Authorization 헤더 추가
        // 'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        text,
        voicePreset: voicePreset.id,
        rate: controls.rate,
        pitch: controls.pitch,
        emotion: controls.emotion,
        language,
        plan,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // 한도 초과 또는 기타 에러
      const error: PreviewQuotaError = {
        error: data.error || '미리듣기 요청에 실패했습니다.',
        errorCode: data.errorCode || 'INTERNAL_ERROR',
        message: data.message,
        upgradeRequired: data.upgradeRequired || false,
        remainingCount: data.remainingCount,
        limitCount: data.limitCount,
        resetAt: data.resetAt,
      };
      
      return {
        success: false,
        error,
      };
    }

    // 성공 시 한도 정보 반환
    const quota: PreviewQuota = data.quota || {
      remainingCount: data.remainingCount ?? 0,
      limitCount: data.limitCount ?? 3,
      resetAt: data.resetAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      unlimited: false,
    };

    return {
      success: true,
      quota,
    };
  } catch (error: any) {
    console.error('Preview request error:', error);
    return {
      success: false,
      error: {
        error: '네트워크 오류가 발생했습니다.',
        errorCode: 'INTERNAL_ERROR',
        message: error.message,
        upgradeRequired: false,
      },
    };
  }
}

/**
 * 이벤트 기록 (전환 분석용)
 */
export function trackPreviewEvent(
  event: 'preview_clicked' | 'preview_success' | 'preview_failed' | 'upgrade_modal_shown' | 'upgrade_clicked',
  metadata?: Record<string, any>
): void {
  // 실제로는 분석 서비스로 전송 (예: Google Analytics, Mixpanel 등)
  console.log('[Preview Event]', event, metadata);
  
  // localStorage에 이벤트 로그 저장 (개발용)
  try {
    const logs = JSON.parse(localStorage.getItem('preview_events') || '[]');
    logs.push({
      event,
      timestamp: new Date().toISOString(),
      metadata,
    });
    // 최근 100개만 유지
    const recentLogs = logs.slice(-100);
    localStorage.setItem('preview_events', JSON.stringify(recentLogs));
  } catch (error) {
    console.error('Failed to log preview event:', error);
  }
}

