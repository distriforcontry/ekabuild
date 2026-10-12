import { env } from "../env";

/**
 * SMS providers. Eskiz.uz (notify.eskiz.uz) is the de-facto gateway in Uzbekistan:
 *   POST /api/auth/login {email, password} → data.token (30 days)
 *   POST /api/message/sms/send {mobile_phone: "998901234567", message, from}
 * Note: Eskiz requires message templates to be pre-approved for production senders.
 */
export interface SmsProvider {
  send(phone: string, message: string): Promise<{ ok: boolean; id?: string; error?: string }>;
}

class MockSms implements SmsProvider {
  async send(phone: string, message: string) {
    console.log(`[sms:mock] → ${phone}: ${message}`);
    return { ok: true, id: "mock" };
  }
}

class EskizSms implements SmsProvider {
  private token: string | null = null;
  private tokenAt = 0;
  private base = "https://notify.eskiz.uz/api";

  private async auth() {
    if (this.token && Date.now() - this.tokenAt < 25 * 86400_000) return this.token;
    const fd = new FormData();
    fd.set("email", env.ESKIZ_EMAIL);
    fd.set("password", env.ESKIZ_PASSWORD);
    const res = await fetch(`${this.base}/auth/login`, { method: "POST", body: fd });
    const j: any = await res.json();
    if (!j?.data?.token) throw new Error(`Eskiz auth failed: ${j?.message ?? res.status}`);
    this.token = j.data.token;
    this.tokenAt = Date.now();
    return this.token!;
  }

  async send(phone: string, message: string) {
    try {
      const token = await this.auth();
      const fd = new FormData();
      fd.set("mobile_phone", phone.replace(/\D/g, ""));
      fd.set("message", message);
      fd.set("from", env.ESKIZ_FROM);
      const res = await fetch(`${this.base}/message/sms/send`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (res.status === 401) this.token = null;
      const j: any = await res.json().catch(() => ({}));
      return res.ok ? { ok: true, id: j?.id } : { ok: false, error: j?.message ?? `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}

export const smsProvider: SmsProvider = env.SMS_PROVIDER === "eskiz" ? new EskizSms() : new MockSms();
