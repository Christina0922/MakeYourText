import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Template } from '../types';
import { api } from '../services/api';
import './TemplateSelector.css';

interface TemplateSelectorProps {
  selectedTemplates: string[];
  onSelectionChange: (selected: string[]) => void;
  onFilterChange?: (filters: { age?: string; channel?: string }) => void;
}

const MAX_TEMPLATES = 30;

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedTemplates,
  onSelectionChange,
  onFilterChange
}) => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ageFilter, setAgeFilter] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('');

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (onFilterChange) {
      onFilterChange({
        age: ageFilter || undefined,
        channel: channelFilter || undefined
      });
    }
  }, [ageFilter, channelFilter, onFilterChange]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (err: any) {
      setError(err.message || '템플릿을 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  // 필터링된 템플릿
  const filteredTemplates = templates.filter(t => {
    if (ageFilter) {
      // 태그에서 연령 필터 확인
      const ageLabels: Record<string, string[]> = {
        '어린이': ['어린이', '초등'],
        '청소년': ['청소년', '중학생', '고등학생'],
        '성인': ['성인'],
        '시니어': ['시니어']
      };
      const allowedAges = ageLabels[ageFilter] || [];
      const hasMatchingAge = t.tags.some(tag => 
        allowedAges.some(age => tag.includes(age))
      );
      if (!hasMatchingAge) return false;
    }
    if (channelFilter) {
      const hasChannel = t.tags.some(tag => 
        tag === channelFilter || tag.includes(channelFilter)
      );
      if (!hasChannel) return false;
    }
    return true;
  });

  // 그룹별 템플릿
  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    const group = template.group;
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  const handleTemplateToggle = (templateId: string) => {
    if (selectedTemplates.includes(templateId)) {
      onSelectionChange(selectedTemplates.filter(id => id !== templateId));
    } else {
      if (selectedTemplates.length >= MAX_TEMPLATES) {
        alert(`템플릿은 최대 ${MAX_TEMPLATES}개까지 선택할 수 있습니다`);
        return;
      }
      onSelectionChange([...selectedTemplates, templateId]);
    }
  };

  const handleSelectAll = () => {
    const allIds = filteredTemplates.map(t => t.id);
    if (allIds.length > MAX_TEMPLATES) {
      alert(`템플릿은 최대 ${MAX_TEMPLATES}개까지 선택할 수 있습니다`);
      onSelectionChange(allIds.slice(0, MAX_TEMPLATES));
    } else {
      onSelectionChange(allIds);
    }
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
  };

  const handleGroupToggle = (group: string) => {
    const groupTemplates = groupedTemplates[group] || [];
    const groupIds = groupTemplates.map(t => t.id);
    const allSelected = groupIds.every(id => selectedTemplates.includes(id));
    
    if (allSelected) {
      // 그룹 전체 해제
      onSelectionChange(selectedTemplates.filter(id => !groupIds.includes(id)));
    } else {
      // 그룹 전체 선택 (최대 개수 체크)
      const newSelected = [...selectedTemplates];
      for (const id of groupIds) {
        if (!newSelected.includes(id) && newSelected.length < MAX_TEMPLATES) {
          newSelected.push(id);
        }
      }
      if (newSelected.length >= MAX_TEMPLATES) {
        alert(`템플릿은 최대 ${MAX_TEMPLATES}개까지 선택할 수 있습니다`);
      }
      onSelectionChange(newSelected);
    }
  };

  if (loading) {
    return <div className="template-selector-loading">템플릿을 불러오는 중...</div>;
  }

  if (error) {
    return <div className="template-selector-error">오류: {error}</div>;
  }

  return (
    <div className="template-selector">
      <div className="template-selector-header">
        <h3>템플릿 선택 (복수)</h3>
        <div className="template-selector-stats">
          선택 {selectedTemplates.length}/{MAX_TEMPLATES}
        </div>
      </div>

      {/* 필터 */}
      <div className="template-selector-filters">
        <div className="filter-group">
          <label>연령:</label>
          <select
            value={ageFilter}
            onChange={(e) => setAgeFilter(e.target.value)}
          >
            <option value="">전체</option>
            <option value="어린이">어린이</option>
            <option value="청소년">청소년</option>
            <option value="성인">성인</option>
            <option value="시니어">시니어</option>
          </select>
        </div>
        <div className="filter-group">
          <label>채널:</label>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
          >
            <option value="">전체</option>
            <option value="문자">문자</option>
            <option value="이메일">이메일</option>
          </select>
        </div>
      </div>

      {/* 전체 선택/해제 */}
      <div className="template-selector-actions">
        <button onClick={handleSelectAll}>전체 선택</button>
        <button onClick={handleDeselectAll}>전체 해제</button>
      </div>

      {/* 그룹별 템플릿 목록 */}
      <div className="template-selector-groups">
        {Object.entries(groupedTemplates).map(([group, groupTemplates]) => {
          const groupIds = groupTemplates.map(t => t.id);
          const allSelected = groupIds.every(id => selectedTemplates.includes(id));
          const someSelected = groupIds.some(id => selectedTemplates.includes(id));

          return (
            <div key={group} className="template-group">
              <div className="template-group-header">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={() => handleGroupToggle(group)}
                />
                <h4>{group}</h4>
                <span className="template-group-count">
                  ({groupTemplates.length}개)
                </span>
              </div>
              <div className="template-list">
                {groupTemplates.map(template => (
                  <label key={template.id} className="template-item">
                    <input
                      type="checkbox"
                      checked={selectedTemplates.includes(template.id)}
                      onChange={() => handleTemplateToggle(template.id)}
                    />
                    <div className="template-info">
                      <div className="template-name">{template.name}</div>
                      <div className="template-tags">
                        {template.tags.map((tag, idx) => (
                          <span key={idx} className="template-tag">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 최대 개수 경고 */}
      {selectedTemplates.length >= MAX_TEMPLATES && (
        <div className="template-selector-warning">
          최대 {MAX_TEMPLATES}개까지 선택할 수 있습니다
        </div>
      )}
    </div>
  );
};

export default TemplateSelector;

