import { describe, it, expect } from 'vitest';
import { profileSchema, isProfileComplete } from './profileSchema';
import { SAMPLE_PROFILE } from './profile';

describe('profileSchema (shape validation)', () => {
  it('accepts a well-formed profile', () => {
    expect(profileSchema.safeParse(SAMPLE_PROFILE).success).toBe(true);
  });

  it('rejects a profile missing the personal block', () => {
    const { personal, ...rest } = SAMPLE_PROFILE;
    void personal;
    expect(profileSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects wrong types (skills not an array)', () => {
    expect(profileSchema.safeParse({ ...SAMPLE_PROFILE, skills: 'Go' }).success).toBe(false);
  });

  it('rejects a non-string email', () => {
    const bad = { ...SAMPLE_PROFILE, personal: { ...SAMPLE_PROFILE.personal, email: 123 } };
    expect(profileSchema.safeParse(bad).success).toBe(false);
  });
});

describe('isProfileComplete', () => {
  it('is true when the core fields are present and email is valid', () => {
    expect(isProfileComplete(SAMPLE_PROFILE)).toBe(true);
  });

  it('is false when email is empty', () => {
    expect(
      isProfileComplete({ ...SAMPLE_PROFILE, personal: { ...SAMPLE_PROFILE.personal, email: '' } }),
    ).toBe(false);
  });

  it('is false when email is malformed', () => {
    expect(
      isProfileComplete({ ...SAMPLE_PROFILE, personal: { ...SAMPLE_PROFILE.personal, email: 'nope' } }),
    ).toBe(false);
  });

  it('is false when first name is blank', () => {
    expect(
      isProfileComplete({ ...SAMPLE_PROFILE, personal: { ...SAMPLE_PROFILE.personal, firstName: '  ' } }),
    ).toBe(false);
  });
});
