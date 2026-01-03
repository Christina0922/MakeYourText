import React from 'react';
import { PreviewQuota, Plan } from '../types';
import './PreviewQuotaDisplay.css';

interface PreviewQuotaDisplayProps {
  quota: PreviewQuota;
  plan: Plan;
}

const PreviewQuotaDisplay: React.FC<PreviewQuotaDisplayProps> = ({ quota, plan }) => {
  if (quota.unlimited || quota.remainingCount === -1) {
    return (
      <div className="preview-quota-display unlimited">
        <span className="quota-label">무제한 미리듣기</span>
      </div>
    );
  }

  const isLow = quota.remainingCount <= 1;
  const isExhausted = quota.remainingCount === 0;

  return (
    <div className={`preview-quota-display ${isExhausted ? 'exhausted' : isLow ? 'low' : ''}`}>
      <span className="quota-label">남은 무료 미리듣기:</span>
      <span className="quota-count">{quota.remainingCount}회</span>
      {quota.resetAt && (
        <span className="quota-reset">
          (다음 리셋: {new Date(quota.resetAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})
        </span>
      )}
    </div>
  );
};

export default PreviewQuotaDisplay;

