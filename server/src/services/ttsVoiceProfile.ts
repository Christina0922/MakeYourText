/**
 * 연령대와 관계에 따른 TTS 목소리 프로필
 * 각 분류별로 pitch, rate, emotion을 조정하여 자연스러운 목소리 생성
 */

export interface VoiceProfile {
  rate: number;      // 속도 (0.75 ~ 1.05)
  pitch: number;     // 높낮이 (semitones, -5 ~ +3)
  volume: number;    // 볼륨 (0.85 ~ 1.0)
  breakTime: number; // 호흡 시간 (ms, 250 ~ 450)
}

/**
 * 연령대별 목소리 프로필
 */
const AUDIENCE_PROFILES: Record<string, VoiceProfile> = {
  // 초등 저학년 (6-8세)
  'elementary-lower': {
    rate: 0.95,      // 빠르고 활기참
    pitch: +2,      // 높은 톤
    volume: 0.95,
    breakTime: 280  // 짧은 호흡
  },
  
  // 초등 고학년 (9-12세)
  'elementary-upper': {
    rate: 0.92,      // 약간 빠름
    pitch: +1,      // 약간 높은 톤
    volume: 0.95,
    breakTime: 300
  },
  
  // 중학생 (13-15세)
  'middle-school': {
    rate: 0.89,      // 보통 속도
    pitch: 0,       // 중간 톤
    volume: 0.93,
    breakTime: 320
  },
  
  // 고등학생 (16-18세)
  'high-school': {
    rate: 0.87,      // 약간 느림
    pitch: -1,      // 약간 낮은 톤
    volume: 0.92,
    breakTime: 340
  },
  
  // 성인 (19-64세)
  'adult': {
    rate: 0.85,      // 자연스러운 속도
    pitch: -2,      // 자연스러운 낮은 톤
    volume: 0.90,
    breakTime: 360
  },
  
  // 시니어 (65세 이상)
  'senior': {
    rate: 0.80,      // 느리고 차분함
    pitch: -4,      // 낮은 톤
    volume: 0.88,
    breakTime: 420  // 긴 호흡
  }
};

/**
 * 관계별 목소리 프로필 (연령대 기본값에 추가 조정)
 */
const RELATIONSHIP_ADJUSTMENTS: Record<string, Partial<VoiceProfile>> = {
  // 친구 - 편안하고 친근함
  'friend': {
    rate: +0.02,     // 약간 빠르게
    pitch: +1,      // 약간 높게
    volume: +0.02
  },
  
  // 선생님 - 정중하고 명확함
  'teacher': {
    rate: -0.03,    // 약간 느리게 (정중함)
    pitch: -1,      // 약간 낮게 (정중함)
    volume: 0,     // 변화 없음
    breakTime: +30 // 약간 긴 호흡
  },
  
  // 학부모 - 따뜻하고 배려심 있음
  'parent': {
    rate: -0.02,    // 약간 느리게
    pitch: -1,      // 약간 낮게
    volume: -0.01,
    breakTime: +20
  },
  
  // 상사 - 단호하고 명확함
  'boss': {
    rate: -0.01,    // 약간 느리게
    pitch: -2,      // 낮게 (권위적)
    volume: 0,
    breakTime: +10
  },
  
  // 고객 - 정중하고 공손함
  'customer': {
    rate: -0.02,    // 느리게
    pitch: -1,      // 약간 낮게
    volume: -0.01,
    breakTime: +25
  },
  
  // 거래처 - 비즈니스적이고 정중함
  'client': {
    rate: -0.01,    // 약간 느리게
    pitch: -1,      // 약간 낮게
    volume: 0,
    breakTime: +15
  },
  'business-partner': {
    rate: -0.01,
    pitch: -1,
    volume: 0,
    breakTime: +15
  }
};

/**
 * 연령대와 관계에 따른 최종 목소리 프로필 계산
 */
export function getVoiceProfile(
  audienceLevelId?: string,
  relationshipId?: string
): VoiceProfile {
  // 기본값 (성인)
  const defaultProfile: VoiceProfile = {
    rate: 0.85,
    pitch: -2,
    volume: 0.90,
    breakTime: 360
  };

  // 연령대 프로필 가져오기
  const audienceProfile = audienceLevelId 
    ? AUDIENCE_PROFILES[audienceLevelId] 
    : defaultProfile;

  // 관계 조정 가져오기
  const relationshipAdjustment = relationshipId
    ? RELATIONSHIP_ADJUSTMENTS[relationshipId]
    : {};

  // 최종 프로필 계산
  const finalProfile: VoiceProfile = {
    rate: Math.max(0.75, Math.min(1.05, 
      audienceProfile.rate + (relationshipAdjustment.rate || 0)
    )),
    pitch: Math.max(-5, Math.min(3,
      audienceProfile.pitch + (relationshipAdjustment.pitch || 0)
    )),
    volume: Math.max(0.85, Math.min(1.0,
      audienceProfile.volume + (relationshipAdjustment.volume || 0)
    )),
    breakTime: Math.max(250, Math.min(450,
      audienceProfile.breakTime + (relationshipAdjustment.breakTime || 0)
    ))
  };

  return finalProfile;
}

/**
 * 연령대 ID 매핑 (서버에서 사용하는 ID 형식)
 */
export function normalizeAudienceLevelId(id: string): string {
  // ID를 그대로 반환 (이미 서버 형식과 일치)
  return id;
}

/**
 * 관계 ID 매핑
 */
export function normalizeRelationshipId(id: string): string {
  // ID를 그대로 반환 (이미 서버 형식과 일치)
  return id;
}

