const HTTPSMS_API_URL = 'https://api.httpsms.com/v1/messages/send';

interface HttpSmsResponse {
  status?: string;
  data?: {
    id?: string;
    status?: string;
  };
  message?: string;
}

interface SendSMSParams {
  apiKey: string;
  from: string;
  to: string;
  content: string;
}

export function toE164AU(phoneNumber: string): string {
  const digits = phoneNumber.replace(/[^\d+]/g, '');

  if (/^\+614\d{8}$/.test(digits)) return digits;
  if (/^614\d{8}$/.test(digits)) return `+${digits}`;
  if (/^04\d{8}$/.test(digits)) return `+61${digits.slice(1)}`;

  return phoneNumber.trim();
}

export function isValidAUMobile(phoneNumber: string): boolean {
  const normalised = toE164AU(phoneNumber);
  return /^\+614\d{8}$/.test(normalised) || /^04\d{8}$/.test(phoneNumber.replace(/\D/g, ''));
}

function mapErrorMessage(status: number, fallback?: string): string {
  if (status === 401) return 'Invalid API key — check Settings';
  if (status === 422) return 'Invalid phone number or message format';
  if (status === 500) return 'httpSMS server error — try again';
  return fallback || 'Unable to send SMS';
}

export async function sendSMS(
  params: SendSMSParams
): Promise<{ success: true; messageId: string } | { success: false; error: string }> {
  try {
    const response = await fetch(HTTPSMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-Key': params.apiKey,
      },
      body: JSON.stringify({
        from: params.from,
        to: params.to,
        content: params.content,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as HttpSmsResponse;

    if (!response.ok) {
      return { success: false, error: mapErrorMessage(response.status, data.message) };
    }

    return { success: true, messageId: data.data?.id || data.data?.status || 'sent' };
  } catch (error) {
    const isNetworkError = error instanceof TypeError;
    return { success: false, error: isNetworkError ? 'No internet connection' : 'Unable to send SMS' };
  }
}

export async function testConnection(
  params: { apiKey: string; from: string }
): Promise<{ success: true } | { success: false; error: string }> {
  const result = await sendSMS({
    apiKey: params.apiKey,
    from: params.from,
    to: params.from,
    content: 'httpSMS test from Hugh\'s Pharmacy Text Messager',
  });

  if (!result.success) {
    return result;
  }

  return { success: true };
}
