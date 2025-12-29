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
    const response = await axios.post(`${API_BASE_URL}/rewrite`, request);
    return response.data;
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
