import React, { useState, useEffect } from 'react';
import { Plan } from '../types';
import { trackPreviewEvent } from '../services/previewService';
import './UpgradeModal.css';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  message?: string;
  plan?: Plan;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  onUpgrade,
  message = '무료 미리듣기 한도를 사용하셨습니다. 계속 사용하려면 요금제를 선택해 주세요.',
  plan = Plan.FREE,
}) => {
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      trackPreviewEvent('upgrade_modal_shown', { plan });
    }
  }, [isOpen, plan]);

  const handleUpgrade = () => {
    if (isUpgrading) return; // 중복 클릭 방지
    
    setIsUpgrading(true);
    trackPreviewEvent('upgrade_clicked', { plan });
    
    // 업그레이드 처리
    onUpgrade();
    
    // 모달 닫기
    setTimeout(() => {
      setIsUpgrading(false);
      onClose();
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <div className="upgrade-modal-overlay" onClick={onClose}>
      <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <button className="upgrade-modal-close" onClick={onClose}>
          ×
        </button>
        
        <div className="upgrade-modal-content">
          <h2 className="upgrade-modal-title">요금제 업그레이드</h2>
          
          <p className="upgrade-modal-message">{message}</p>
          
          <div className="upgrade-modal-plans">
            <div className="plan-comparison">
              <div className="plan-item free">
                <div className="plan-label">무료</div>
                <div className="plan-features">
                  <div className="plan-feature">• 짧게/횟수 제한</div>
                </div>
              </div>
              
              <div className="plan-item paid">
                <div className="plan-label">유료</div>
                <div className="plan-features">
                  <div className="plan-feature">• 무제한 미리듣기</div>
                  <div className="plan-feature">• 다운로드</div>
                  <div className="plan-feature">• 더 긴 문장 지원</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="upgrade-modal-actions">
            <button
              className="upgrade-button"
              onClick={handleUpgrade}
              disabled={isUpgrading}
            >
              {isUpgrading ? '처리 중...' : '요금제 선택하기'}
            </button>
            <button
              className="cancel-button"
              onClick={onClose}
              disabled={isUpgrading}
            >
              나중에
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;

