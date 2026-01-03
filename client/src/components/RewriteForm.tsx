import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TonePreset,
  AudienceLevel,
  PurposeType,
  Relationship,
  Strength,
  LengthOption,
  FormatOption,
  ResultOptions,
  EnglishHelperMode,
  Plan
} from '../types';
import { api } from '../services/api';
import './RewriteForm.css';

interface RewriteFormProps {
  plan: Plan;
  onSubmit: (request: {
    text: string;
    tonePresetId: string;
    purposeTypeId: string;
    audienceLevelId: string;
    relationshipId?: string;
    length: LengthOption;
    format: FormatOption;
    strength: Strength;
    resultOptions?: ResultOptions;
    language?: string;
    englishHelperMode?: EnglishHelperMode;
  }) => void;
  isLoading: boolean;
}

// 섹션 컴포넌트
interface SectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showDivider?: boolean;
}

const Section: React.FC<SectionProps> = ({ title, subtitle, children, showDivider = true }) => {
  return (
    <>
      <div className="form-section-wrapper">
        <div className="form-section-header">
          <h3 className="form-section-title">{title}</h3>
          {subtitle && <span className="form-section-subtitle">{subtitle}</span>}
        </div>
        <div className="form-section-content">
          {children}
        </div>
      </div>
      {showDivider && <div className="form-divider" />}
    </>
  );
};

const RewriteForm: React.FC<RewriteFormProps> = ({
  plan,
  onSubmit,
  isLoading
}) => {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState('');
  const [tonePresets, setTonePresets] = useState<TonePreset[]>([]);
  const [purposeTypes, setPurposeTypes] = useState<PurposeType[]>([]);
  const [audienceLevels, setAudienceLevels] = useState<AudienceLevel[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(true);
  const [presetError, setPresetError] = useState<string | null>(null);
  
  const [selectedPurpose, setSelectedPurpose] = useState<string>('');
  const [selectedTone, setSelectedTone] = useState<string>('');
  const [selectedAudience, setSelectedAudience] = useState<string>('');
  const [selectedRelationship, setSelectedRelationship] = useState<string>('');
  const [selectedLength, setSelectedLength] = useState<LengthOption>(LengthOption.STANDARD);
  const [selectedFormat, setSelectedFormat] = useState<FormatOption>(FormatOption.MESSAGE);

  // 연령대에 따라 선택 가능한 관계 필터링
  const getAvailableRelationships = (audienceLevelId: string): Relationship[] => {
    // 학생(초등/중학/고등)은 친구, 선생님만 가능
    const studentLevels = ['elementary1', 'elementary', 'middle', 'high'];
    if (studentLevels.includes(audienceLevelId)) {
      return relationships.filter(rel => rel.id === 'friend' || rel.id === 'teacher');
    }
    // 성인/시니어는 모든 관계 가능
    return relationships;
  };

  const availableRelationships = selectedAudience 
    ? getAvailableRelationships(selectedAudience)
    : relationships;
  
  // englishHelperMode: localStorage에서 초기값 로드, 변경 시 저장
  const [englishHelperMode, setEnglishHelperMode] = useState<EnglishHelperMode>(() => {
    try {
      const saved = localStorage.getItem('englishHelperMode');
      if (saved) {
        return JSON.parse(saved) as EnglishHelperMode;
      }
    } catch (e) {
      console.error('Failed to load englishHelperMode from localStorage:', e);
    }
    return EnglishHelperMode.OFF;
  });
  
  // englishHelperMode 변경 시 localStorage에 저장
  useEffect(() => {
    try {
      localStorage.setItem('englishHelperMode', JSON.stringify(englishHelperMode));
    } catch (e) {
      console.error('Failed to save englishHelperMode to localStorage:', e);
    }
  }, [englishHelperMode]);
  
  const [strength, setStrength] = useState<Strength>({
    softToFirm: 50
  });
  
  const [resultOptions, setResultOptions] = useState<ResultOptions>({
    format: 'paragraph',
    ambiguityWarning: false,
    autoIncludeDetails: false
  });

  useEffect(() => {
    // 프리셋 로드 (에러 처리 개선)
    setLoadingPresets(true);
    setPresetError(null);
    
    Promise.all([
      api.getPurposeTypes(),
      api.getTonePresets(),
      api.getAudienceLevels(),
      api.getRelationships()
    ]).then(([purposes, tones, audience, rels]) => {
      setPurposeTypes(purposes);
      setTonePresets(tones);
      setAudienceLevels(audience);
      setRelationships(rels);
      
      // 기본값 설정
      if (purposes.length > 0) {
        setSelectedPurpose(purposes[0].id);
      }
      if (Array.isArray(tones) && tones.length > 0) {
        setSelectedTone(tones[0].id);
        if (tones[0].defaultStrength) {
          setStrength({ softToFirm: tones[0].defaultStrength.softToFirm });
        }
      }
      if (audience.length > 0) {
        setSelectedAudience(audience[audience.length - 1].id); // 성인 기본
      }
      
      setLoadingPresets(false);
    }).catch((error) => {
      console.error('Failed to load presets:', error);
      setPresetError(error.message || '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
      setLoadingPresets(false);
    });
  }, []);

  const handleToneChange = (toneId: string) => {
    setSelectedTone(toneId);
    if (Array.isArray(tonePresets)) {
      const tone = tonePresets.find(t => t.id === toneId);
      if (tone && tone.defaultStrength) {
        setStrength({ softToFirm: tone.defaultStrength.softToFirm });
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !selectedTone || !selectedPurpose || !selectedAudience) {
      return;
    }
    
    // 현재 언어 가져오기
    const currentLanguage = i18n.language || 'ko';
    const languageCode = currentLanguage.split('-')[0]; // 'ko-KR' -> 'ko'
    
    // englishHelperMode는 state에서 최신 값 사용 (stale 방지)
    onSubmit({
      text: text.trim(),
      tonePresetId: selectedTone,
      purposeTypeId: selectedPurpose,
      audienceLevelId: selectedAudience,
      relationshipId: selectedRelationship || undefined,
      length: selectedLength,
      format: selectedFormat,
      strength,
      resultOptions,
      language: languageCode,
      englishHelperMode // ✅ 반드시 포함
    });
  };

  // 토글 핸들러: prev => !prev로 stale 방지
  const handleEnglishHelperModeChange = (value: EnglishHelperMode) => {
    setEnglishHelperMode(value);
    // 저장은 useEffect가 처리
  };

  // 기본 톤과 특수 톤 분리 (안전장치: 배열이 아닌 경우 빈 배열 반환)
  const baseTones = Array.isArray(tonePresets) 
    ? tonePresets.filter(t => t.category === 'base' || t.category === 'apology')
    : [];
  const specialTones = Array.isArray(tonePresets)
    ? tonePresets.filter(t => t.category === 'strong' || t.id === 'notice-formal')
    : [];

  // 프리셋 로딩 중이거나 에러가 있으면 표시
  if (loadingPresets) {
    return (
      <div className="rewrite-form">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>프리셋을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (presetError) {
    return (
      <div className="rewrite-form">
        <div style={{ padding: '20px', textAlign: 'center', color: '#d32f2f' }}>
          <p><strong>오류:</strong> {presetError}</p>
          <p style={{ fontSize: '14px', marginTop: '10px' }}>
            서버가 실행 중인지 확인해주세요. (http://localhost:5000)
          </p>
        </div>
      </div>
    );
  }

  return (
    <form className="rewrite-form" onSubmit={handleSubmit}>
      {/* 텍스트 입력 */}
      <div className="form-section">
        <label className="form-label">{t('form.textInput')}</label>
        <textarea
          className="form-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('form.textPlaceholder')}
          rows={4}
          required
        />
      </div>

      <div className="form-divider" />

      {/* 목적 */}
      <Section title="목적">
        <div className="purpose-buttons">
          {purposeTypes.map((purpose) => (
            <button
              key={purpose.id}
              type="button"
              className={`purpose-btn ${selectedPurpose === purpose.id ? 'active' : ''}`}
              onClick={() => setSelectedPurpose(purpose.id)}
            >
              {purpose.label}
            </button>
          ))}
        </div>
      </Section>

      {/* 톤 선택 - 기본 */}
      <Section title="톤 선택" subtitle="기본">
        <div className="tone-presets">
          {baseTones.map((tone) => (
            <button
              key={tone.id}
              type="button"
              className={`tone-preset-btn ${selectedTone === tone.id ? 'active' : ''}`}
              onClick={() => handleToneChange(tone.id)}
            >
              {tone.label}
            </button>
          ))}
        </div>
      </Section>

      {/* 특수 */}
      <Section title="특수">
        <div className="tone-presets">
          {specialTones.map((tone) => (
            <button
              key={tone.id}
              type="button"
              className={`tone-preset-btn strong-tone ${selectedTone === tone.id ? 'active' : ''}`}
              onClick={() => handleToneChange(tone.id)}
            >
              {tone.label}
            </button>
          ))}
        </div>
      </Section>

      {/* 누구에게(독자/연령) */}
      <Section title="누구에게" subtitle="독자/연령">
        <select
          className="form-select"
          value={selectedAudience}
          onChange={(e) => {
            const newAudience = e.target.value;
            setSelectedAudience(newAudience);
            // 연령대 변경 시 선택된 관계가 유효하지 않으면 초기화
            const newAvailableRelationships = getAvailableRelationships(newAudience);
            if (selectedRelationship && !newAvailableRelationships.find(r => r.id === selectedRelationship)) {
              setSelectedRelationship('');
            }
          }}
          required
        >
          {audienceLevels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.label}
            </option>
          ))}
        </select>
      </Section>

      {/* 관계 선택 (선택사항) */}
      <Section title="관계 선택" subtitle="선택사항">
        <select
          className="form-select"
          value={selectedRelationship}
          onChange={(e) => setSelectedRelationship(e.target.value)}
          disabled={!selectedAudience}
        >
          <option value="">{t('form.relationshipNone')}</option>
          {availableRelationships.map((rel) => (
            <option key={rel.id} value={rel.id}>
              {rel.label}
            </option>
          ))}
        </select>
        {selectedAudience && availableRelationships.length < relationships.length && (
          <small style={{ display: 'block', marginTop: '4px', color: '#666', fontSize: '12px' }}>
            {selectedAudience === 'elementary1' || selectedAudience === 'elementary' || 
             selectedAudience === 'middle' || selectedAudience === 'high'
              ? '학생은 친구, 선생님만 선택 가능합니다.'
              : ''}
          </small>
        )}
      </Section>

      {/* 길이 */}
      <Section title="길이" showDivider={false}>
        <div className="length-options">
          <button
            type="button"
            className={`length-btn ${selectedLength === LengthOption.SHORT ? 'active' : ''}`}
            onClick={() => setSelectedLength(LengthOption.SHORT)}
          >
            짧게 (1~2문장)
          </button>
          <button
            type="button"
            className={`length-btn ${selectedLength === LengthOption.STANDARD ? 'active' : ''}`}
            onClick={() => setSelectedLength(LengthOption.STANDARD)}
          >
            표준
          </button>
          <button
            type="button"
            className={`length-btn ${selectedLength === LengthOption.LONG ? 'active' : ''}`}
            onClick={() => setSelectedLength(LengthOption.LONG)}
          >
            자세히 (근거/단계 포함)
          </button>
        </div>
      </Section>

      {/* 형식 토글 2개 */}
      <div className="form-section-wrapper">
        <div className="form-section-header">
          <h3 className="form-section-title">형식</h3>
        </div>
        <div className="form-section-content">
          <div className="format-options">
            <button
              type="button"
              className={`format-btn ${selectedFormat === FormatOption.MESSAGE ? 'active' : ''}`}
              onClick={() => setSelectedFormat(FormatOption.MESSAGE)}
            >
              문자/카톡용
            </button>
            <button
              type="button"
              className={`format-btn ${selectedFormat === FormatOption.EMAIL ? 'active' : ''}`}
              onClick={() => setSelectedFormat(FormatOption.EMAIL)}
            >
              이메일/공문용
            </button>
          </div>
        </div>
      </div>

      <div className="form-divider" />

      {/* 강도 슬라이더 1개 (부드러움 ↔ 단호함) */}
      <div className="form-section-wrapper">
        <div className="form-section-header">
          <h3 className="form-section-title">강도</h3>
        </div>
        <div className="form-section-content">
          <label className="form-label">
            부드러움 ↔ 단호함 ({strength.softToFirm})
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={strength.softToFirm}
            onChange={(e) => setStrength({ softToFirm: Number(e.target.value) })}
            className="form-slider"
          />
        </div>
      </div>

      {/* 영어 도우미 모드 (한국어 모드일 때만 표시) */}
      {i18n.language?.startsWith('ko') && (
        <>
          <div className="form-divider" />
          <div className="form-section-wrapper">
            <div className="form-section-header">
              <h3 className="form-section-title">영어 도우미 모드</h3>
            </div>
            <div className="form-section-content">
              <select
                className="form-select"
                value={englishHelperMode}
                onChange={(e) => handleEnglishHelperModeChange(e.target.value as EnglishHelperMode)}
              >
                <option value={EnglishHelperMode.OFF}>영어 금지 (한국어 100%)</option>
                <option value={EnglishHelperMode.PAREN}>괄호로 영어 추가</option>
                <option value={EnglishHelperMode.TWOLINES}>한국어 + 영어 병기</option>
              </select>
            </div>
          </div>
        </>
      )}

      <div className="form-divider" />

      {/* 결과 옵션 */}
      <div className="form-section-wrapper">
        <div className="form-section-header">
          <h3 className="form-section-title">{t('form.resultOptions')}</h3>
        </div>
        <div className="form-section-content">
          <div className="result-options">
            <div className="option-group">
              <label className="option-label">{t('form.formatLabel')}</label>
              <div className="option-buttons">
                <button
                  type="button"
                  className={`option-btn ${resultOptions.format === 'paragraph' ? 'active' : ''}`}
                  onClick={() => setResultOptions({ ...resultOptions, format: 'paragraph' })}
                >
                  {t('form.formatParagraph')}
                </button>
                <button
                  type="button"
                  className={`option-btn ${resultOptions.format === 'bullet' ? 'active' : ''}`}
                  onClick={() => setResultOptions({ ...resultOptions, format: 'bullet' })}
                >
                  {t('form.formatBullet')}
                </button>
              </div>
            </div>
            <div className="option-group">
              <label className="option-label">{t('form.ambiguityWarning')}</label>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={resultOptions.ambiguityWarning}
                  onChange={(e) => setResultOptions({ ...resultOptions, ambiguityWarning: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            {/* 안전장치 체크박스 */}
            <div className="option-group">
              <label className="option-label">기한/요청사항/근거/다음 단계 자동 포함</label>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={resultOptions.autoIncludeDetails}
                  onChange={(e) => setResultOptions({ ...resultOptions, autoIncludeDetails: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="form-submit-btn"
        disabled={isLoading || !text.trim()}
      >
        {isLoading ? t('common.loading') : t('common.submit')}
      </button>
    </form>
  );
};

export default RewriteForm;
