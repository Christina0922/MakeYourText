import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plan } from '../types';
import './PlanBadge.css';

interface PlanBadgeProps {
  plan: Plan;
  onUpgrade?: () => void;
  isDev?: boolean;
}

const PlanBadge: React.FC<PlanBadgeProps> = ({ plan, onUpgrade, isDev = false }) => {
  const { t } = useTranslation();
  const planLabels: Record<Plan, string> = {
    free: t('plan.free'),
    pro: t('plan.pro'),
    business: t('plan.business')
  };

  return (
    <div className="plan-badge">
      <span className={`plan-label plan-${plan}`}>
        {planLabels[plan]}
        {isDev && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>(DEV)</span>}
      </span>
      {isDev && onUpgrade && (
        <button className="upgrade-btn" onClick={onUpgrade}>
          {plan === 'free' ? t('common.upgrade') : 'Free로 전환'}
        </button>
      )}
      {!isDev && plan === 'free' && onUpgrade && (
        <button className="upgrade-btn" onClick={onUpgrade}>
          {t('common.upgrade')}
        </button>
      )}
    </div>
  );
};

export default PlanBadge;
