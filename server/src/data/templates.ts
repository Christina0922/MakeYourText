import { Template, FormatOption } from '../types/index.js';
import { PURPOSE_TYPES, AUDIENCE_LEVELS, RELATIONSHIPS, TONE_PRESETS } from './presets.js';

/**
 * 템플릿 생성 (상황/연령/채널/관계 조합)
 * 최대 30개
 */
export function generateTemplates(): Template[] {
  const templates: Template[] = [];
  
  // 상황 그룹
  const purposeGroups: Record<string, string[]> = {
    '요청': ['request'],
    '안내공지': ['notice-guide'],
    '사과': ['apology'],
    '후기감사': ['review-thanks'],
    '항의시정요구': ['complaint-correction']
  };
  
  // 연령 필터
  const ageFilters: Record<string, string[]> = {
    '어린이': ['elementary1', 'elementary'],
    '청소년': ['middle', 'high'],
    '성인': ['adult'],
    '시니어': ['senior']
  };
  
  // 채널
  const channels: FormatOption[] = [FormatOption.MESSAGE, FormatOption.EMAIL];
  
  // 관계 (선택)
  const relationships = ['', 'friend', 'teacher', 'parent', 'boss', 'customer', 'client'];
  
  // 톤 매핑 (상황별 기본 톤)
  const toneMapping: Record<string, string[]> = {
    'request': ['cultured', 'friendly', 'warm'],
    'notice-guide': ['notice-formal', 'cultured'],
    'apology': ['apology', 'warm'],
    'review-thanks': ['friendly', 'warm'],
    'complaint-correction': ['firm', 'warning', 'protest']
  };
  
  let templateId = 1;
  
  // 각 상황별로 템플릿 생성
  for (const [groupName, purposeIds] of Object.entries(purposeGroups)) {
    for (const purposeId of purposeIds) {
      const purpose = PURPOSE_TYPES.find(p => p.id === purposeId);
      if (!purpose) continue;
      
      // 연령별
      for (const [ageLabel, audienceIds] of Object.entries(ageFilters)) {
        for (const audienceId of audienceIds) {
          const audience = AUDIENCE_LEVELS.find(a => a.id === audienceId);
          if (!audience) continue;
          
          // 채널별
          for (const format of channels) {
            // 관계별 (없음 포함)
            for (const relId of relationships) {
              // 톤별
              const tones = toneMapping[purposeId] || ['cultured'];
              for (const toneId of tones) {
                const tone = TONE_PRESETS.find(t => t.id === toneId);
                if (!tone) continue;
                
                // 관계 정보
                const relationship = relId ? RELATIONSHIPS.find(r => r.id === relId) : null;
                
                // 태그 생성
                const tags: string[] = [ageLabel, format === FormatOption.MESSAGE ? '문자' : '이메일'];
                if (relationship) {
                  tags.push(relationship.label);
                }
                
                // 템플릿 이름
                const templateName = `${purpose.label} - ${audience.label} - ${format === FormatOption.MESSAGE ? '문자' : '이메일'}${relationship ? ` - ${relationship.label}` : ''}`;
                
                templates.push({
                  id: `template-${templateId++}`,
                  name: templateName,
                  purposeId,
                  audienceId,
                  format,
                  relationshipId: relId || undefined,
                  toneId,
                  tags,
                  group: groupName
                });
                
                // 최대 30개 제한
                if (templates.length >= 30) {
                  return templates;
                }
              }
            }
          }
        }
      }
    }
  }
  
  return templates.slice(0, 30); // 최대 30개
}

export const TEMPLATES = generateTemplates();

