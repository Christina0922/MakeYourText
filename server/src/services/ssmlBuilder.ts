/**
 * SSML 빌더
 * 사람 말 리듬을 위한 SSML 생성 (자연스러운 음성 최적화)
 */

export interface SsmlOptions {
  rate?: number;      // 속도 (0.7 ~ 1.3, 기본 0.87 - 더 느리고 자연스럽게)
  pitch?: number;    // 높낮이 (-20 ~ +20 semitones, 기본 -2 - 약간 낮춰서 자연스럽게)
  volume?: number;   // 볼륨 (0.0 ~ 1.0, 기본 1.0)
  breakTime?: number; // 줄바꿈 간격 (ms, 기본 350 - 더 긴 호흡)
}

/**
 * 텍스트를 SSML로 변환 (자연스러운 사람 목소리처럼)
 */
export function toSsml(text: string, options: SsmlOptions = {}): string {
  const {
    rate = 0.87,  // 기본값을 더 느리게 (0.95 → 0.87)
    pitch = -2,   // 기본값을 약간 낮춤 (0 → -2)
    volume = 1.0,
    breakTime = 350  // 기본값을 더 길게 (220 → 350)
  } = options;

  // SSML 안전 처리: XML 특수문자 이스케이프
  const escapedText = escapeXml(text);

  // 줄바꿈을 break 태그로 변환
  const lines = escapedText.split('\n').filter(line => line.trim().length > 0);
  const processedLines = lines.map((line, index) => {
    let processed = line.trim();

    // 문장 내 자연스러운 break 추가 (쉼표, 그리고, 하지만 등)
    processed = addNaturalBreaks(processed);

    // 문장 끝에 더 긴 break 추가
    if (processed.match(/[.!?。！？]$/)) {
      processed = processed + `<break time="450ms"/>`;  // 문장 끝은 더 긴 호흡
    } else if (index < lines.length - 1) {
      // 줄바꿈이 있으면 break 추가
      processed = processed + `<break time="${breakTime}ms"/>`;
    }

    return processed;
  });

  // prosody로 감싸기 (자연스러운 범위로 조정)
  const clampedRate = Math.max(0.75, Math.min(1.1, rate));  // 범위를 좁혀서 더 자연스럽게
  const clampedPitch = Math.max(-5, Math.min(3, pitch));    // pitch 변동을 작게
  const clampedVolume = Math.max(0.85, Math.min(1.0, volume));  // 볼륨도 약간 낮춤

  // pitch는 semitones 단위
  const pitchAttr = clampedPitch !== 0 
    ? ` pitch="${clampedPitch > 0 ? '+' : ''}${clampedPitch}st"`
    : '';

  const ssml = `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ko-KR">
      <prosody rate="${clampedRate.toFixed(2)}"${pitchAttr} volume="${clampedVolume.toFixed(2)}">
        ${processedLines.join('\n')}
      </prosody>
    </speak>
  `.trim();

  return ssml;
}

/**
 * 문장 내 자연스러운 break 추가 (쉼표, 접속사 등)
 */
function addNaturalBreaks(text: string): string {
  let result = text;

  // 쉼표 뒤에 짧은 break 추가
  result = result.replace(/,/g, ',<break time="200ms"/>');

  // 접속사 앞에 자연스러운 break
  const conjunctions = ['그리고', '하지만', '그런데', '그러나', '또한', '또', '그래서', '그러므로', '따라서'];
  for (const conj of conjunctions) {
    const regex = new RegExp(`\\s+${conj}`, 'g');
    result = result.replace(regex, `<break time="250ms"/>${conj}`);
  }

  // 긴 문장(30자 이상) 중간에 자연스러운 break
  if (result.length > 30 && !result.includes('<break')) {
    // 공백 기준으로 중간 지점 찾기
    const midPoint = Math.floor(result.length / 2);
    const spaceIndex = result.lastIndexOf(' ', midPoint);
    if (spaceIndex > 10 && spaceIndex < result.length - 10) {
      result = result.substring(0, spaceIndex) + '<break time="180ms"/>' + result.substring(spaceIndex + 1);
    }
  }

  return result;
}

/**
 * XML 특수문자 이스케이프
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

