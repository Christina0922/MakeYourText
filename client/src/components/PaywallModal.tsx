import React, { useState } from 'react';
import { api } from '../services/api';
import './PaywallModal.css';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  quota?: {
    limitRequests: number;
    usedRequests: number;
    limitChars: number;
    usedChars: number;
    resetAt: string;
  };
  message?: string;
}

const PaywallModal: React.FC<PaywallModalProps> = ({
  isOpen,
  onClose,
  quota,
  message = '무료 사용량을 모두 사용하셨습니다. 업그레이드하면 즉시 계속 사용 가능합니다.',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (type: string = 'SUBSCRIPTION_PRO_MONTHLY') => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.createCheckout(type);
      if (response.ok && response.url) {
        // Stripe Checkout으로 이동
        window.location.href = response.url;
      } else {
        setError('결제 페이지를 생성할 수 없습니다.');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || '결제 페이지 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const remainingRequests = quota ? Math.max(0, quota.limitRequests - quota.usedRequests) : 0;
  const remainingChars = quota ? Math.max(0, quota.limitChars - quota.usedChars) : 0;

  return (
    <div className="paywall-modal-overlay" onClick={onClose}>
      <div className="paywall-modal" onClick={(e) => e.stopPropagation()}>
        <button className="paywall-modal-close" onClick={onClose}>
          ×
        </button>

        <div className="paywall-modal-content">
          <h2 className="paywall-modal-title">사용량 초과</h2>

          <p className="paywall-modal-message">{message}</p>

          {quota && (
            <div className="paywall-quota-info">
              <div className="quota-item">
                <span className="quota-label">요청 횟수:</span>
                <span className="quota-value">
                  {quota.usedRequests} / {quota.limitRequests}
                </span>
              </div>
              <div className="quota-item">
                <span className="quota-label">글자 수:</span>
                <span className="quota-value">
                  {quota.usedChars.toLocaleString()} / {quota.limitChars.toLocaleString()}
                </span>
              </div>
              {quota.resetAt && (
                <div className="quota-reset">
                  다음 리셋: {new Date(quota.resetAt).toLocaleString('ko-KR')}
                </div>
              )}
            </div>
          )}

          <div className="paywall-plans">
            <div className="plan-card">
              <h3>무료</h3>
              <ul>
                <li>일일 {quota?.limitRequests || 20}회 요청</li>
                <li>일일 {quota?.limitChars?.toLocaleString() || '20,000'}자</li>
              </ul>
            </div>
            <div className="plan-card pro">
              <h3>PRO</h3>
              <ul>
                <li>무제한 요청</li>
                <li>무제한 글자 수</li>
                <li>고급 기능 사용 가능</li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="paywall-error">{error}</div>
          )}

          <div className="paywall-modal-actions">
            <button
              className="paywall-upgrade-button"
              onClick={() => handleUpgrade('SUBSCRIPTION_PRO_MONTHLY')}
              disabled={isLoading}
            >
              {isLoading ? '처리 중...' : 'PRO로 업그레이드'}
            </button>
            <button
              className="paywall-cancel-button"
              onClick={onClose}
              disabled={isLoading}
            >
              나중에
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaywallModal;

