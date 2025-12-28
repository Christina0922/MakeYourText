import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TonePreset,
  AudienceLevel,
  PurposeType,
  Relationship,
  Strength,
  ResultOptions,
  Plan
} from '../types';
import { api } from '../services/api';
import './RewriteForm.css';

interface RewriteFormProps {
  plan: Plan;
  onSubmit: (request: {
    text: string;
    tonePresetId: string;
    audienceLevelId: string;
    relationshipId?: string;
    purposeTypeId: string;
    strength: Strength;
    resultOptions?: ResultOptions;
  }) => void;
  isLoading: boolean;
}

const RewriteForm: React.FC<RewriteFormProps> = ({
  plan,
  onSubmit,
  isLoading
}) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [tonePresets, setTonePresets] = useState<TonePreset[]>([]);
  const [audienceLevels, setAudienceLevels] = useState<AudienceLevel[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [purposeTypes, setPurposeTypes] = useState<PurposeType[]>([]);
  
  const [selectedTone, setSelectedTone] = useState<string>('');
  const [selectedAudience, setSelectedAudience] = useState<string>('');
  const [selectedRelationship, setSelectedRelationship] = useState<string>('');
  const [selectedPurpose, setSelectedPurpose] = useState<string>('');
  
  const [strength, setStrength] = useState<Strength>({
    calmToStrong: 50,
    softToFirm: 50
  });
  
  const [resultOptions, setResultOptions] = useState<ResultOptions>({
    format: 'paragraph',
    ambiguityWarning: false
  });

  useEffect(() => {
    // 프리셋 로드
    Promise.all([
      api.getTonePresets(),
      api.getAudienceLevels(),
      api.getRelationships(),
      api.getPurposeTypes()
    ]).then(([tones, audience, rels, purposes]) => {
      setTonePresets(tones);
      setAudienceLevels(audience);
      setRelationships(rels);
      setPurposeTypes(purposes);
      
      // 기본값 설정
      if (tones.length > 0) {
        setSelectedTone(tones[0].id);
        setStrength(tones[0].defaultStrength);
      }
      if (audience.length > 0) {
        setSelectedAudience(audience[audience.length - 1].id); // 성인 기본
      }
      if (purposes.length > 0) {
        setSelectedPurpose(purposes[0].id);
      }
    });
  }, []);

  const handleToneChange = (toneId: string) => {
    setSelectedTone(toneId);
    const tone = tonePresets.find(t => t.id === toneId);
    if (tone) {
      setStrength(tone.defaultStrength);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !selectedTone || !selectedAudience || !selectedPurpose) {
      return;
    }
    onSubmit({
      text: text.trim(),
      tonePresetId: selectedTone,
      audienceLevelId: selectedAudience,
      relationshipId: selectedRelationship || undefined,
      purposeTypeId: selectedPurpose,
      strength,
      resultOptions
    });
  };

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

      <div className="form-section">
        <label className="form-label">{t('form.toneSelect')}</label>
        <div className="tone-presets">
          {tonePresets.map((tone) => (
            <button
              key={tone.id}
              type="button"
              className={`tone-preset-btn ${selectedTone === tone.id ? 'active' : ''} ${tone.category === 'strong' ? 'strong-tone' : ''}`}
              onClick={() => handleToneChange(tone.id)}
            >
              {tone.label}
            </button>
          ))}
        </div>
      </div>

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

      <div className="form-section">
        <label className="form-label">{t('form.purposeSelect')}</label>
        <select
          className="form-select"
          value={selectedPurpose}
          onChange={(e) => setSelectedPurpose(e.target.value)}
          required
        >
          {purposeTypes.map((purpose) => (
            <option key={purpose.id} value={purpose.id}>
              {purpose.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-section">
        <label className="form-label">
          {t('form.strengthCalm')} ({strength.calmToStrong})
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={strength.calmToStrong}
          onChange={(e) => setStrength({ ...strength, calmToStrong: Number(e.target.value) })}
          className="form-slider"
        />
      </div>

      <div className="form-section">
        <label className="form-label">
          {t('form.strengthSoft')} ({strength.softToFirm})
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={strength.softToFirm}
          onChange={(e) => setStrength({ ...strength, softToFirm: Number(e.target.value) })}
          className="form-slider"
        />
      </div>

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

