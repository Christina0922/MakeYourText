import axios from 'axios';
import {
  TonePreset,
  AudienceLevel,
  PurposeType,
  VoicePreset,
  Relationship,
  RewriteRequest,
  RewriteResult
} from '../types';

// 환경변수로 서버 주소 읽기 (REACT_APP_API_BASE_URL 사용)
const API_BASE_URL = (typeof process !== 'undefined' && process.env?.REACT_APP_API_BASE_URL) || 'http://localhost:5000/api';

export const api = {
  // 프리셋 조회
  getTonePresets: async (): Promise<TonePreset[]> => {
    const response = await axios.get(`${API_BASE_URL}/presets/tones`);
    return response.data;
  },

  getAudienceLevels: async (): Promise<AudienceLevel[]> => {
    const response = await axios.get(`${API_BASE_URL}/presets/audience`);
    return response.data;
  },

  getRelationships: async (): Promise<Relationship[]> => {
    const response = await axios.get(`${API_BASE_URL}/presets/relationships`);
    return response.data;
  },

  getPurposeTypes: async (): Promise<PurposeType[]> => {
    const response = await axios.get(`${API_BASE_URL}/presets/purpose`);
    return response.data;
  },

  getVoicePresets: async (): Promise<VoicePreset[]> => {
    const response = await axios.get(`${API_BASE_URL}/presets/voices`);
    return response.data;
  },

  // 리라이트 요청
  rewrite: async (request: RewriteRequest): Promise<RewriteResult> => {
    // 요청 직전에 payload를 console.log로 확인
    console.log('Rewrite API Request Payload:', {
      text: request.text,
      tonePresetId: request.tonePresetId,
      purposeTypeId: request.purposeTypeId,
      audienceLevelId: request.audienceLevelId,
      length: request.length,
      format: request.format,
      language: request.language,
      englishHelperMode: request.englishHelperMode,
      plan: request.plan
    });
    
    try {
      const response = await axios.post(`${API_BASE_URL}/rewrite`, request);
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
    const response = await axios.post(
      `${API_BASE_URL}/tts`,
      params,
      { responseType: 'blob' }
    );
    return response.data;
  }
};
