import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isValidAUMobile, sanitiseApiKey, sendSMS, testConnection, toE164AU } from '@/services/httpsms';

describe('httpsms service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('converts Australian local numbers to E.164', () => {
    expect(toE164AU('0412345678')).toBe('+61412345678');
    expect(toE164AU('0412 345 678')).toBe('+61412345678');
    expect(toE164AU('+61412345678')).toBe('+61412345678');
  });

  it('validates Australian mobile numbers only', () => {
    expect(isValidAUMobile('0412345678')).toBe(true);
    expect(isValidAUMobile('+61412345678')).toBe(true);
    expect(isValidAUMobile('0399999999')).toBe(false);
    expect(isValidAUMobile('+61399999999')).toBe(false);
  });

  it('trims copied API keys safely', () => {
    expect(sanitiseApiKey('  key-with-space\n')).toBe('key-with-space');
  });

  it('maps httpSMS API success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'msg_123' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendSMS({ apiKey: ' key ', from: '0412 345 678', to: '0400 000 000', content: 'Hello' })).resolves.toEqual({
      success: true,
      messageId: 'msg_123',
    });

    expect(fetchMock).toHaveBeenCalledWith('https://api.httpsms.com/v1/messages/send', expect.objectContaining({
      headers: expect.objectContaining({
        'x-api-key': 'key',
        Accept: 'application/json',
      }),
      body: JSON.stringify({
        from: '+61412345678',
        to: '+61400000000',
        content: 'Hello',
      }),
    }));
  });

  it('maps httpSMS API errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    }));

    await expect(sendSMS({ apiKey: 'bad', from: '+61412345678', to: '+61400000000', content: 'Hello' })).resolves.toEqual({
      success: false,
      error: 'Invalid API key. Paste the account API key from httpsms.com/settings, not a phone API key.',
    });
  });

  it('sends a self-test SMS', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'self_test' } }),
    }));

    await expect(testConnection({ apiKey: 'key', from: '+61412345678' })).resolves.toEqual({ success: true });
  });
});
