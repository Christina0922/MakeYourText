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

// Axios 인스턴스 생성 (타임아웃 및 에러 처리 설정)
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30초 타임아웃
  headers: {
    'Content-Type': 'application/json'
  }
});

// 요청 인터셉터 (에러 로깅)
axiosInstance.interceptors.request.use(
  (config) => {
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
};
