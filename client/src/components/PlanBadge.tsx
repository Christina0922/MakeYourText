import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plan } from '../types';
import './PlanBadge.css';

interface PlanBadgeProps {
  plan: Plan;
  onUpgrade?: () => void;
}

const PlanBadge: React.FC<PlanBadgeProps> = ({ plan, onUpgrade }) => {
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
      </span>
      {plan === 'free' && onUpgrade && (
        <button className="upgrade-btn" onClick={onUpgrade}>
          {t('common.upgrade')}
        </button>
      )}
    </div>
  );
};

export default PlanBadge;

