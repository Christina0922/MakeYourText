import axios from 'axios';
import {
  TonePreset,
  AudienceLevel,
  PurposeType,
  VoicePreset,
  Relationship,
  RewriteRequest,
  RewriteResult,
  Template,
  Plan,
  PreviewQuota,
} from '../types';

// 환경변수로 서버 주소 읽기 (REACT_APP_API_BASE_URL 사용)
const API_BASE_URL = (typeof process !== 'undefined' && process.env?.REACT_APP_API_BASE_URL) || 'http://localhost:5000/api';

/**
 * 익명 userId 생성 및 저장
 */
function getOrCreateUserId(): string {
  const STORAGE_KEY = 'makeyourtext_user_id';
  let userId = localStorage.getItem(STORAGE_KEY);
  
  if (!userId) {
    // UUID v4 형식의 ID 생성
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      userId = crypto.randomUUID();
    } else {
      // Fallback: 간단한 ID 생성
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
    }
    localStorage.setItem(STORAGE_KEY, userId);
  }
  
  return userId;
}

// Axios 인스턴스 생성 (타임아웃 및 에러 처리 설정)
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30초 타임아웃
  headers: {
    'Content-Type': 'application/json'
  }
});

// 요청 인터셉터: 모든 요청에 userId 헤더 자동 추가 및 로깅
axiosInstance.interceptors.request.use(
  (config) => {
    const userId = getOrCreateUserId();
    config.headers['x-user-id'] = userId;
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// 응답 인터셉터 (에러 처리)
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('[API Timeout]', error.config?.url);
      return Promise.reject(new Error('요청 시간이 초과되었습니다. 서버가 응답하지 않습니다.'));
    }
    if (error.message === 'Network Error') {
      console.error('[API Network Error]', {
        url: error.config?.url,
        baseURL: API_BASE_URL,
        message: '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.'
      });
      return Promise.reject(new Error('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요. (http://localhost:5000)'));
    }
    console.error('[API Response Error]', error);
    return Promise.reject(error);
  }
);

export const api = {
  // 프리셋 조회
  getTonePresets: async (): Promise<TonePreset[]> => {
    try {
      const response = await axiosInstance.get('/presets/tones');
      return response.data;
    } catch (error: any) {
      console.error('getTonePresets error:', error);
      throw error;
    }
  },

  getAudienceLevels: async (): Promise<AudienceLevel[]> => {
    try {
      const response = await axiosInstance.get('/presets/audience');
      return response.data;
    } catch (error: any) {
      console.error('getAudienceLevels error:', error);
      throw error;
    }
  },

  getRelationships: async (): Promise<Relationship[]> => {
    try {
      const response = await axiosInstance.get('/presets/relationships');
      return response.data;
    } catch (error: any) {
      console.error('getRelationships error:', error);
      throw error;
    }
  },

  getPurposeTypes: async (): Promise<PurposeType[]> => {
    try {
      const response = await axiosInstance.get('/presets/purpose');
      return response.data;
    } catch (error: any) {
      console.error('getPurposeTypes error:', error);
      throw error;
    }
  },

  getVoicePresets: async (): Promise<VoicePreset[]> => {
    try {
      const response = await axiosInstance.get('/presets/voices');
      return response.data;
    } catch (error: any) {
      console.error('getVoicePresets error:', error);
      throw error;
    }
  },

  // ✅ 템플릿 목록 조회
  getTemplates: async (): Promise<Template[]> => {
    try {
      const response = await axiosInstance.get('/templates');
      return response.data;
    } catch (error: any) {
      console.error('getTemplates error:', error);
      throw error;
    }
  },

  // 리라이트 요청
  rewrite: async (request: RewriteRequest): Promise<RewriteResult> => {
    // ✅ 요청 직전에 payload를 console.log로 확인 (englishHelperMode 포함)
    console.log('[generate payload]', {
      text: request.text,
      tonePresetId: request.tonePresetId,
      purposeTypeId: request.purposeTypeId,
      audienceLevelId: request.audienceLevelId,
      length: request.length,
      format: request.format,
      language: request.language,
      englishHelperMode: request.englishHelperMode, // ✅ 반드시 포함
      plan: request.plan
    });
    
    try {
      const response = await axiosInstance.post('/rewrite', request);
      
      // ✅ 응답에 서버가 해석한 englishHelperMode 표시 (DEV 모드)
      if (process.env.NODE_ENV === 'development') {
        console.log('[server response] englishHelperMode:', request.englishHelperMode);
      }
      
      return response.data;
    } catch (error: any) {
      // 400 에러 처리 (text가 비어있는 경우)
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.reason || '문장을 입력해 주세요');
      }
      throw error;
    }
  },

  // TTS 요청 (서버 기반)
  generateTts: async (params: {
    text: string;
    voicePreset: string;
    rate: number;
    pitch: number;
    emotion: number;
    language?: string;
  }): Promise<Blob> => {
    try {
      const response = await axiosInstance.post(
        '/tts',
        params,
        { responseType: 'blob' }
      );
      return response.data;
    } catch (error: any) {
      console.error('generateTts error:', error);
      throw error;
    }
  },

  // 미리듣기 한도 조회
  getPreviewQuota: async (plan: Plan): Promise<PreviewQuota> => {
    try {
      const response = await axiosInstance.get('/tts/preview/quota', {
        params: { plan },
      });
      return response.data;
    } catch (error: any) {
      console.error('getPreviewQuota error:', error);
      throw error;
    }
  },

  // Quota 조회
  getQuota: async (): Promise<{
    ok: boolean;
    plan: 'FREE' | 'PRO';
    quota: {
      limitRequests: number;
      usedRequests: number;
      limitChars: number;
      usedChars: number;
      resetAt: string;
    };
  }> => {
    try {
      const response = await axiosInstance.get('/quota');
      return response.data;
    } catch (error: any) {
      console.error('getQuota error:', error);
      throw error;
    }
  },

  // 결제 Checkout 세션 생성
  createCheckout: async (type: string): Promise<{ ok: boolean; url: string }> => {
    try {
      const response = await axiosInstance.post('/billing/checkout', { type });
      return response.data;
    } catch (error: any) {
      console.error('createCheckout error:', error);
      throw error;
    }
  },

  // TTS 미리듣기 오디오 가져오기 (Google Chirp 3 HD)
  fetchPreviewAudio: async (params: {
    text: string;
    voice?: string;
    rate?: number;
    pitch?: number;
    audienceLevelId?: string;  // 연령대
    relationshipId?: string;   // 관계
  }): Promise<Blob> => {
    try {
      const response = await axiosInstance.post(
        '/tts/preview',
        params,
        { 
          responseType: 'blob',
          validateStatus: (status) => status < 500 // 4xx는 catch에서 처리
        }
      );

      // Content-Type 확인
      const contentType = response.headers['content-type'] || '';
      console.log('[TTS] Response:', {
        status: response.status,
        contentType: contentType,
        size: response.data?.size || 0
      });

      // 응답이 성공이 아니면 JSON 에러로 처리
      if (response.status !== 200) {
        // Blob을 텍스트로 변환하여 JSON 파싱 시도
        const errorText = await response.data.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || 'Unknown error' };
        }
        
        console.error('[TTS] Error response:', {
          status: response.status,
          error: errorData
        });

        // 501 (TTS_NOT_CONFIGURED)는 특별 처리
        if (response.status === 501) {
          const error = new Error(errorData.message || 'TTS service is not configured');
          (error as any).code = 'TTS_NOT_CONFIGURED';
          (error as any).status = 501;
          throw error;
        }

        throw new Error(errorData.message || `TTS 생성 실패: HTTP ${response.status}`);
      }

      // Content-Type이 audio/*가 아니면 에러
      if (!contentType.startsWith('audio/')) {
        const errorText = await response.data.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: 'Invalid response: not audio' };
        }
        
        console.error('[TTS] Invalid content-type:', {
          contentType: contentType,
          response: errorData
        });
        
        throw new Error(errorData.message || '서버가 오디오가 아닌 응답을 반환했습니다.');
      }

      // 정상적인 오디오 Blob 반환
      return response.data;
    } catch (error: any) {
      console.error('[TTS] fetchPreviewAudio error:', {
        message: error.message,
        code: error.code,
        status: error.status || error.response?.status
      });
      
      // 에러를 그대로 전파 (폴백은 호출 측에서 처리)
      throw error;
    }
  },
};
