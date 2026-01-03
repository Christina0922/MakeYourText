import { api } from '../services/api';

/**
 * 서버에서 TTS 미리듣기 오디오 가져오기
 */
export async function fetchPreviewAudio(
  text: string,
  options?: {
    voice?: string;
    rate?: number;
    pitch?: number;
    audienceLevelId?: string;  // 연령대
    relationshipId?: string;   // 관계
  }
): Promise<Blob> {
  return api.fetchPreviewAudio({
    text,
    voice: options?.voice,
    rate: options?.rate,
    pitch: options?.pitch,
    audienceLevelId: options?.audienceLevelId,
    relationshipId: options?.relationshipId,
  });
}

/**
 * 오디오 Blob을 재생
 */
export function playAudioBlob(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      resolve();
    };

    audio.onerror = (error) => {
      URL.revokeObjectURL(audioUrl);
      reject(new Error('오디오 재생 실패'));
    };

    audio.play().catch((error) => {
      URL.revokeObjectURL(audioUrl);
      reject(error);
    });
  });
}

