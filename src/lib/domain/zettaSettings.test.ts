import { describe, expect, it } from 'vitest';
import { avatarSchema, pixDefaults } from './zettaSettings';

describe('Zetta settings rules', () => {
  it('limits Pix merchant name to 25 unaccented characters', () => { expect(pixDefaults('Á'.repeat(26), 'Brasília').name).toBe('A'.repeat(25)); });
  it('limits Pix city to 15 unaccented characters', () => { expect(pixDefaults('João', 'São José dos Pinhais').city).toBe('SAO JOSE DOS PI'); });
  it('limits avatars to 5 MB', () => { expect(avatarSchema.safeParse({ type: 'image/png', size: 5 * 1024 * 1024 }).success).toBe(true); expect(avatarSchema.safeParse({ type: 'image/png', size: 5 * 1024 * 1024 + 1 }).success).toBe(false); });
});