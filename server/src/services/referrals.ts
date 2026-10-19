import { randomBytes } from 'crypto';
import type { PoolClient } from 'pg';
import pool from '../db';
import { WalletService } from './wallet';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_REWARD = 50;

/** Bytes of entropy per code: 10 bytes = 80 bits, which base32-encodes to exactly 16 characters. */
export const REFERRAL_CODE_BYTES = 10;
export const REFERRAL_CODE_LENGTH = (REFERRAL_CODE_BYTES * 8) / 5;

/**
 * Generates a referral code from `crypto.randomBytes`, base32-encoded with an
 * alphabet that drops the look-alike characters I, O, 0 and 1.
 *
 * Each character carries exactly 5 bits, so no entropy is lost to modulo bias
 * or float rounding (the old `randomInt(0, 32) / 32` mapping went through a
 * float and gave only 40 bits across 8 characters).
 */
export function createReferralCode(random: (size: number) => Buffer = randomBytes): string {
  const bytes = random(REFERRAL_CODE_BYTES);
  let code = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      code += ALPHABET[(buffer >> bits) & 31];
    }
  }
  return code;
}

export async function creditReferralReward(client: PoolClient, referredId: string, tradeId: string): Promise<boolean> {
  const configured = Number.parseFloat(process.env['REFERRAL_REWARD_NGN'] ?? String(DEFAULT_REWARD));
  const amount = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_REWARD;
  const { rows } = await client.query<{ referrer_id: string }>(
    `UPDATE referrals SET rewarded_at = NOW()
      WHERE referred_id = $1 AND rewarded_at IS NULL RETURNING referrer_id`, [referredId]
  );
  const referrerId = rows[0]?.referrer_id;
  if (!referrerId) return false;
  await new WalletService(client).credit({ userId: referrerId, amount, type: 'referral_reward', tradeId });
  return true;
}

export async function getReferralStats(userId: string) {
  const configured = Number.parseFloat(process.env['REFERRAL_REWARD_NGN'] ?? String(DEFAULT_REWARD));
  const reward = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_REWARD;
  const { rows } = await pool.query(`SELECT u.referral_code,
    COUNT(r.referred_id)::text AS total_referrals,
    COUNT(r.referred_id) FILTER (WHERE r.rewarded_at IS NOT NULL)::text AS verified_referrals,
    COALESCE(SUM(CASE WHEN r.rewarded_at IS NOT NULL THEN $2 ELSE 0 END), 0)::text AS total_rewards_credited
    FROM users u LEFT JOIN referrals r ON r.referrer_id = u.id WHERE u.id = $1 GROUP BY u.id, u.referral_code`, [userId, reward]);
  return rows[0] ?? { referral_code: null, total_referrals: '0', verified_referrals: '0', total_rewards_credited: '0' };
}
