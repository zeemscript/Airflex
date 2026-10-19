process.env['DATABASE_URL'] = process.env['DATABASE_URL'] || 'postgresql://test:test@localhost:5432/test';
import { createReferralCode, REFERRAL_CODE_BYTES, REFERRAL_CODE_LENGTH } from './referrals';
import { requestOtpSchema } from '../schemas/auth.schemas';

const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{16}$/;

describe('referral code generation', () => {
  it('creates a 16-character code from the supported alphabet', () => {
    const code = createReferralCode();
    expect(REFERRAL_CODE_LENGTH).toBe(16);
    expect(code).toHaveLength(16);
    expect(code).toMatch(CODE_PATTERN);
  });

  it('draws at least 80 bits from crypto.randomBytes', () => {
    const random = jest.fn((size: number) => Buffer.alloc(size, 0xff));
    createReferralCode(random);
    expect(random).toHaveBeenCalledWith(REFERRAL_CODE_BYTES);
    expect(REFERRAL_CODE_BYTES * 8).toBeGreaterThanOrEqual(80);
  });

  it('encodes every 5-bit group to one alphabet character', () => {
    expect(createReferralCode((size) => Buffer.alloc(size, 0x00))).toBe('AAAAAAAAAAAAAAAA');
    expect(createReferralCode((size) => Buffer.alloc(size, 0xff))).toBe('9999999999999999');
  });

  it('produces no collisions across 10 000 codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 10_000; i += 1) codes.add(createReferralCode());
    expect(codes.size).toBe(10_000);
  });
});

describe('referralCode request validation', () => {
  const phone = '+2348012345678';

  it('accepts new 16-character and legacy 8-character codes', () => {
    expect(requestOtpSchema.safeParse({ phone, referralCode: createReferralCode() }).success).toBe(true);
    expect(requestOtpSchema.safeParse({ phone, referralCode: 'AIR77REF' }).success).toBe(true);
  });

  it('rejects other lengths and non-alphanumeric codes', () => {
    expect(requestOtpSchema.safeParse({ phone, referralCode: 'SHORT' }).success).toBe(false);
    expect(requestOtpSchema.safeParse({ phone, referralCode: 'ABCD-EFGH' }).success).toBe(false);
  });
});
