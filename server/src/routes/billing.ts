import express from 'express';
import { setSubscription } from '../services/quotaStore.js';

const router = express.Router();

// DEV 모드 체크
const DEV_MODE = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || 'http://localhost:3333';

/**
 * POST /api/billing/checkout
 * Stripe Checkout 세션 생성
 */
router.post('/checkout', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: 'USER_ID_REQUIRED',
        message: 'x-user-id header is required'
      });
    }

    const { type } = req.body;
    if (!type) {
      return res.status(400).json({
        ok: false,
        error: 'TYPE_REQUIRED',
        message: 'type is required'
      });
    }

    // DEV 모드이거나 Stripe 키가 없으면 더미 URL 반환
    if (DEV_MODE || !STRIPE_SECRET_KEY) {
      console.log('[billing] DEV mode: returning dummy checkout URL');
      return res.json({
        ok: true,
        url: `${PUBLIC_APP_URL}/checkout-success?session_id=dummy_${Date.now()}`,
        dev: true
      });
    }

    // 실제 Stripe Checkout 세션 생성
    const stripeModule = await import('stripe');
    const Stripe = stripeModule.default;
    const stripeClient = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover'
    });

    const priceId = getPriceId(type);
    if (!priceId) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_TYPE',
        message: `Invalid type: ${type}`
      });
    }

    const session = await stripeClient.checkout.sessions.create({
      mode: type.startsWith('SUBSCRIPTION_') ? 'subscription' : 'payment',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${PUBLIC_APP_URL}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_APP_URL}/checkout-cancel`,
      client_reference_id: userId,
      metadata: {
        userId,
        type
      }
    });

    return res.json({
      ok: true,
      url: session.url || session.url,
      sessionId: session.id
    });
  } catch (error: any) {
    console.error('[billing] Checkout error:', error);
    return res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /api/billing/webhook
 * Stripe Webhook (결제 성공 처리)
 * 실제 배포 시에는 Stripe Dashboard에서 이 엔드포인트를 등록해야 합니다.
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (DEV_MODE || !STRIPE_SECRET_KEY) {
      return res.json({ received: true, dev: true });
    }

    const stripeModule = await import('stripe');
    const Stripe = stripeModule.default;
    const stripeClient = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover'
    });

    const sig = req.headers['stripe-signature'];
    if (!sig) {
      return res.status(400).json({ error: 'No signature' });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn('[billing] STRIPE_WEBHOOK_SECRET not set, skipping webhook verification');
      return res.json({ received: true });
    }

    let event;
    try {
      event = stripeClient.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error('[billing] Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // 결제 성공 이벤트 처리
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const userId = session.client_reference_id || session.metadata?.userId;
      const type = session.metadata?.type;

      if (userId && type) {
        if (type.startsWith('SUBSCRIPTION_PRO_')) {
          // 구독: 1년 또는 1개월
          const months = type.includes('YEARLY') ? 12 : 1;
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + months);
          setSubscription(userId, true, expiresAt);
          console.log(`[billing] Subscription activated for user ${userId} until ${expiresAt.toISOString()}`);
        } else if (type.startsWith('TOPUP_')) {
          // 크레딧 충전 (간단하게 PRO로 전환, 실제로는 크레딧 시스템 구현 필요)
          const months = type === 'TOPUP_L' ? 3 : type === 'TOPUP_M' ? 1 : 0.5;
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + months);
          setSubscription(userId, true, expiresAt);
          console.log(`[billing] Top-up activated for user ${userId} until ${expiresAt.toISOString()}`);
        }
      }
    }

    return res.json({ received: true });
  } catch (error: any) {
    console.error('[billing] Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 환경변수에서 Price ID 가져오기
 */
function getPriceId(type: string): string | null {
  const priceMap: Record<string, string> = {
    'SUBSCRIPTION_PRO_MONTHLY': process.env.STRIPE_PRICE_PRO_MONTHLY || '',
    'SUBSCRIPTION_PRO_YEARLY': process.env.STRIPE_PRICE_PRO_YEARLY || '',
    'TOPUP_S': process.env.STRIPE_PRICE_TOPUP_S || '',
    'TOPUP_M': process.env.STRIPE_PRICE_TOPUP_M || '',
    'TOPUP_L': process.env.STRIPE_PRICE_TOPUP_L || '',
  };

  return priceMap[type] || null;
}

export default router;

