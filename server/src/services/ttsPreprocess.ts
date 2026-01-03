/**
 * TTS용 텍스트 전처리
 * URL/포트/기호/약어로 인한 억양 깨짐을 방지
 */

/**
 * URL을 자연어로 치환
 */
function replaceUrls(text: string): string {
  // http://, https:// URL 패턴
  const urlPattern = /https?:\/\/[^\s]+/gi;
  return text.replace(urlPattern, (match) => {
    // localhost는 "로컬 서버"로
    if (match.includes('localhost')) {
      return '로컬 서버';
    }
    // 도메인만 추출하여 읽기
    const domainMatch = match.match(/https?:\/\/([^\/\s]+)/);
    if (domainMatch) {
      return domainMatch[1].replace(/\./g, ' 점 ');
    }
    return '웹 주소';
  });
}

/**
 * 포트 번호를 자연어로 치환
 */
function replacePorts(text: string): string {
  // 404, 500, 3333, 5000 같은 숫자 패턴
  const portPattern = /\b(404|500|3333|5000|3000|8080|8000)\b/g;
  const portMap: Record<string, string> = {
    '404': '사백 공사',
    '500': '오백',
    '3333': '삼천 삼백 삼십 삼',
    '5000': '오천',
    '3000': '삼천',
    '8080': '팔천 팔십',
    '8000': '팔천',
  };
  
  return text.replace(portPattern, (match) => {
    return portMap[match] || match.split('').join(' ');
  });
}

/**
 * 약어를 한글 발음으로 치환
 */
function replaceAbbreviations(text: string): string {
  const abbrevMap: Record<string, string> = {
    'API': '에이피아이',
    'HTTP': '에이치티티피',
    'HTTPS': '에이치티티피에스',
    'URL': '유알엘',
    'DEV': '데브',
    'TTS': '티티에스',
    'SSML': '에스에스엠엘',
    'JSON': '제이슨',
    'XML': '엑스엠엘',
    'HTML': '에이치티엠엘',
    'CSS': '씨에스에스',
    'JS': '제이에스',
    'TS': '티에스',
    'UI': '유아이',
    'UX': '유엑스',
    'ID': '아이디',
    'PW': '비밀번호',
    'DB': '디비',
    'SQL': '에스큐엘',
  };

  let result = text;
  for (const [abbrev, replacement] of Object.entries(abbrevMap)) {
    const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
    result = result.replace(regex, replacement);
  }

  return result;
}

/**
 * 특수기호 제거/치환
 */
function cleanSpecialChars(text: string): string {
  let result = text;
  
  // 괄호, 대괄호, 중괄호 제거
  result = result.replace(/[\(\)\[\]\{\}]/g, ' ');
  
  // 특수기호를 공백으로 (일부는 유지)
  result = result.replace(/[<>@#$%^&*+=|\\`~]/g, ' ');
  
  // 연속 공백 정리
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

/**
 * 긴 문장을 쪼개기 (호흡을 위한 줄바꿈 추가 - 더 자연스럽게)
 */
function addBreathingBreaks(text: string): string {
  // 문장 끝 패턴
  const sentenceEnd = /([.!?。！？])\s*/g;
  
  // 문장 끝마다 줄바꿈 추가
  let result = text.replace(sentenceEnd, '$1\n');
  
  // 너무 긴 문장(35자 이상)은 쉼표 기준으로도 쪼개기 (50 → 35로 더 자주 쪼개기)
  const lines = result.split('\n');
  const processedLines: string[] = [];
  
  for (const line of lines) {
    if (line.length > 35) {
      // 쉼표 기준으로 쪼개기
      const parts = line.split(/,/);
      if (parts.length > 1) {
        processedLines.push(...parts.map(p => p.trim()).filter(p => p));
      } else {
        // 쉼표가 없으면 자연스러운 지점에서 쪼개기 (공백 기준)
        const words = line.split(/\s+/);
        if (words.length > 8) {
          const midPoint = Math.floor(words.length / 2);
          const firstPart = words.slice(0, midPoint).join(' ');
          const secondPart = words.slice(midPoint).join(' ');
          processedLines.push(firstPart, secondPart);
        } else {
          processedLines.push(line);
        }
      }
    } else {
      processedLines.push(line);
    }
  }
  
  return processedLines.join('\n');
}

/**
 * 숫자를 읽기 좋게 변환 (간단한 버전)
 */
function normalizeNumbers(text: string): string {
  // 연속된 숫자 패턴 (3자리 이상)
  const numberPattern = /\b\d{3,}\b/g;
  return text.replace(numberPattern, (match) => {
    // 각 자리수를 한글로 읽기
    const digits = match.split('');
    const koreanDigits = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    return digits.map(d => koreanDigits[parseInt(d)] || d).join(' ');
  });
}

/**
 * TTS용 텍스트 정규화 (메인 함수)
 */
export function normalizeForTts(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let result = text.trim();

  // 1. URL 치환
  result = replaceUrls(result);

  // 2. 포트 번호 치환
  result = replacePorts(result);

  // 3. 약어 치환
  result = replaceAbbreviations(result);

  // 4. 숫자 정규화
  result = normalizeNumbers(result);

  // 5. 특수기호 정리
  result = cleanSpecialChars(result);

  // 6. 호흡을 위한 줄바꿈 추가
  result = addBreathingBreaks(result);

  // 7. 최종 공백 정리
  result = result.replace(/\s+/g, ' ').replace(/\n\s+/g, '\n').trim();

  return result;
}

