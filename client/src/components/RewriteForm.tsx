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
  
  const [selectedPurpose, setSelectedPurpose] = useState<string>('');
  const [selectedTone, setSelectedTone] = useState<string>('');
  const [selectedAudience, setSelectedAudience] = useState<string>('');
  const [selectedRelationship, setSelectedRelationship] = useState<string>('');
  const [selectedLength, setSelectedLength] = useState<LengthOption>(LengthOption.STANDARD);
  const [selectedFormat, setSelectedFormat] = useState<FormatOption>(FormatOption.MESSAGE);
  const [englishHelperMode, setEnglishHelperMode] = useState<EnglishHelperMode>(EnglishHelperMode.OFF);
  
  const [strength, setStrength] = useState<Strength>({
    softToFirm: 50
  });
  
  const [resultOptions, setResultOptions] = useState<ResultOptions>({
    format: 'paragraph',
    ambiguityWarning: false,
    autoIncludeDetails: false
  });

  useEffect(() => {
    // 프리셋 로드
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
      if (tones.length > 0) {
        setSelectedTone(tones[0].id);
        setStrength({ softToFirm: tones[0].defaultStrength.softToFirm });
      }
      if (audience.length > 0) {
        setSelectedAudience(audience[audience.length - 1].id); // 성인 기본
      }
    });
  }, []);

  const handleToneChange = (toneId: string) => {
    setSelectedTone(toneId);
    const tone = tonePresets.find(t => t.id === toneId);
    if (tone) {
      setStrength({ softToFirm: tone.defaultStrength.softToFirm });
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
      englishHelperMode
    });
  };

  // 기본 톤과 특수 톤 분리
  const baseTones = tonePresets.filter(t => t.category === 'base' || t.category === 'apology');
  const specialTones = tonePresets.filter(t => t.category === 'strong' || t.id === 'notice-formal');

  return (
    <form className="rewrite-form" onSubmit={handleSubmit}>
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

      {/* 목적 버튼 5개 */}
      <div className="form-section">
        <label className="form-label">목적</label>
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
      </div>

      {/* 톤 선택 - 기본 6개 + 특수 3개 */}
      <div className="form-section">
        <label className="form-label">{t('form.toneSelect')}</label>
        <div className="tone-group">
          <div className="tone-subgroup">
            <div className="tone-subgroup-label">기본</div>
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
          </div>
          <div className="tone-subgroup">
            <div className="tone-subgroup-label">특수</div>
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
          </div>
        </div>
      </div>

      {/* 독자/연령 드롭다운 */}
      <div className="form-section">
        <label className="form-label">{t('form.audienceSelect')}</label>
        <select
          className="form-select"
          value={selectedAudience}
          onChange={(e) => setSelectedAudience(e.target.value)}
          required
        >
          {audienceLevels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.label}
            </option>
          ))}
        </select>
      </div>

      {/* 관계 선택 (선택사항) */}
      <div className="form-section">
        <label className="form-label">{t('form.relationshipSelect')}</label>
        <select
          className="form-select"
          value={selectedRelationship}
          onChange={(e) => setSelectedRelationship(e.target.value)}
        >
          <option value="">{t('form.relationshipNone')}</option>
          {relationships.map((rel) => (
            <option key={rel.id} value={rel.id}>
              {rel.label}
            </option>
          ))}
        </select>
      </div>

      {/* 길이 옵션 3개 */}
      <div className="form-section">
        <label className="form-label">길이</label>
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
      </div>

      {/* 형식 토글 2개 */}
      <div className="form-section">
        <label className="form-label">형식</label>
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

      {/* 강도 슬라이더 1개 (부드러움 ↔ 단호함) */}
      <div className="form-section">
        <label className="form-label">
          강도: 부드러움 ↔ 단호함 ({strength.softToFirm})
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

      {/* 영어 도우미 모드 (한국어 모드일 때만 표시) */}
      {i18n.language?.startsWith('ko') && (
        <div className="form-section">
          <label className="form-label">영어 도우미 모드</label>
          <select
            className="form-select"
            value={englishHelperMode}
            onChange={(e) => setEnglishHelperMode(e.target.value as EnglishHelperMode)}
          >
            <option value={EnglishHelperMode.OFF}>영어 금지 (한국어 100%)</option>
            <option value={EnglishHelperMode.PAREN}>괄호로 영어 추가</option>
            <option value={EnglishHelperMode.TWOLINES}>한국어 + 영어 병기</option>
          </select>
        </div>
      )}

      {/* 결과 옵션 */}
      <div className="form-section">
        <label className="form-label">{t('form.resultOptions')}</label>
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
