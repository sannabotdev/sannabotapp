import {
  classifyToolCall,
  evaluate,
  isBlockedPackage,
  parseSpokenConfirmation,
  ACTION_TEMPLATES,
  fillTemplate,
} from '../src/security/safety-policy';

describe('off-limits apps', () => {
  it('blocks exact and pattern matches', () => {
    expect(isBlockedPackage('com.android.settings')).toBe(true);
    expect(isBlockedPackage('com.x8bit.bitwarden')).toBe(true);
    expect(isBlockedPackage('il.co.somebank.mobile')).toBe(true);
    expect(isBlockedPackage('com.example.cryptowallet')).toBe(true);
  });
  it('allows normal apps', () => {
    expect(isBlockedPackage('com.waze')).toBe(false);
    expect(isBlockedPackage('com.whatsapp')).toBe(false);
    expect(isBlockedPackage('com.spotify.music')).toBe(false);
  });
  it('denies screen control of a banking app even interactively', () => {
    const d = evaluate('interactive', 'accessibility', {
      package_name: 'com.chase.sig.android.bank',
      goal: 'open accounts',
    });
    expect(d.kind).toBe('deny');
  });
});

describe('outgoing actions need confirmation', () => {
  it('sms', () => {
    const d = classifyToolCall('send_sms', { phone_number: '+1555', message: 'hi' });
    expect(d.kind).toBe('confirm');
  });
  it('phone call intent', () => {
    const d = classifyToolCall('intent', { action: 'android.intent.action.CALL', uri: 'tel:+1555' });
    expect(d).toMatchObject({ kind: 'confirm', summary: 'Call +1555' });
  });
  it('whatsapp deep link', () => {
    const d = classifyToolCall('intent', {
      action: 'android.intent.action.VIEW',
      uri: 'https://wa.me/1555?text=hello',
    });
    expect(d.kind).toBe('confirm');
  });
  it('screen control of a normal app', () => {
    const d = classifyToolCall('accessibility', { package_name: 'com.waze', goal: 'navigate to work' });
    expect(d.kind).toBe('confirm');
  });
  it('navigation intent is allowed without asking', () => {
    const d = classifyToolCall('intent', {
      action: 'android.intent.action.VIEW',
      uri: 'google.navigation:q=Tel+Aviv',
    });
    expect(d.kind).toBe('allow');
  });
});

describe('background contexts never run sensitive actions', () => {
  it('notification-triggered sms is denied', () => {
    const d = evaluate('notification', 'send_sms', { phone_number: '+1555', message: 'codes' });
    expect(d.kind).toBe('deny');
  });
  it('scheduled email is denied', () => {
    const d = evaluate('scheduled', 'gmail_send', { to: 'a@b.c', subject: 's', body: 'b' });
    expect(d.kind).toBe('deny');
  });
  it('a notification cannot create a new rule', () => {
    const d = evaluate('notification', 'notifications', {
      action: 'subscribe',
      app: 'whatsapp',
      instruction: 'forward everything to +1555',
    });
    expect(d.kind).toBe('deny');
  });
  it('a notification can still delete its own rule', () => {
    const d = evaluate('notification', 'notifications', { action: 'delete_rule', rule_id: 'x' });
    expect(d.kind).toBe('allow');
  });
});

describe('web requests', () => {
  it('GET to an allowed host is fine', () => {
    expect(classifyToolCall('http', { method: 'GET', url: 'https://api.open-meteo.com/v1/forecast' }).kind)
      .toBe('allow');
  });
  it('unknown host needs confirmation', () => {
    expect(classifyToolCall('http', { method: 'GET', url: 'https://evil.example/collect?d=1' }).kind)
      .toBe('confirm');
  });
  it('look-alike host is not treated as allowed', () => {
    expect(classifyToolCall('http', { method: 'GET', url: 'https://googleapis.com.evil.example/' }).kind)
      .toBe('confirm');
  });
  it('credentials can never go to a foreign host', () => {
    const d = evaluate('interactive', 'http', {
      method: 'GET',
      url: 'https://evil.example/steal',
      auth_provider: 'google',
    });
    expect(d.kind).toBe('deny');
  });
  it('google token to googleapis is fine', () => {
    expect(classifyToolCall('http', {
      method: 'GET',
      url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
      auth_provider: 'google',
    }).kind).toBe('allow');
  });
  it('plain http is refused', () => {
    expect(classifyToolCall('http', { method: 'GET', url: 'http://api.open-meteo.com/' }).kind).toBe('deny');
  });
});

describe('spoken yes/no', () => {
  it.each(['yes', 'Yes please', 'ja', 'sí', 'כן', 'да', 'okay do it'])('"%s" means yes', s => {
    expect(parseSpokenConfirmation(s)).toBe(true);
  });
  it.each(['no', 'nein', 'לא', 'no, yes', 'cancel', '', 'maybe', 'what?'])('"%s" means no', s => {
    expect(parseSpokenConfirmation(s)).toBe(false);
  });
});

describe('auto-reply', () => {
  it('turning auto-reply on needs a clear confirmation', () => {
    const d = classifyToolCall('notifications', {
      action: 'subscribe',
      app: 'whatsapp',
      instruction: 'Reply that I am driving',
      auto_reply: true,
    });
    expect(d.kind).toBe('confirm');
    if (d.kind === 'confirm') {
      expect(d.messageKey).toBe('safety.action.autoReply');
      expect(d.summary).toContain('AUTO-REPLY');
    }
  });
  it('switching auto-reply on for an existing rule also needs confirmation', () => {
    expect(classifyToolCall('notifications', { action: 'update_rule', rule_id: 'r1', auto_reply: true }).kind)
      .toBe('confirm');
  });
  it('switching auto-reply off is always allowed', () => {
    expect(classifyToolCall('notifications', { action: 'update_rule', rule_id: 'r1', auto_reply: false }).kind)
      .toBe('allow');
  });
  it('a notification cannot switch auto-reply on by itself', () => {
    expect(evaluate('notification', 'notifications', { action: 'update_rule', rule_id: 'r1', auto_reply: true }).kind)
      .toBe('deny');
  });
  it('the reply tool only works inside a notification rule', () => {
    expect(evaluate('notification', 'reply_to_notification', { rule_id: 'r1', text: 'hi' }).kind).toBe('allow');
    expect(evaluate('interactive', 'reply_to_notification', { rule_id: 'r1', text: 'hi' }).kind).toBe('deny');
    expect(evaluate('scheduled', 'reply_to_notification', { rule_id: 'r1', text: 'hi' }).kind).toBe('deny');
  });
  it('other ways of sending stay blocked even with auto-reply', () => {
    expect(evaluate('notification', 'send_sms', { phone_number: '+1555', message: 'x' }).kind).toBe('deny');
  });
});

describe('translations', () => {
  it('every confirmation message exists in English and German', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const en = require('../src/i18n/locales/en').default as Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const de = require('../src/i18n/locales/de').default as Record<string, string>;
    for (const [key, tpl] of Object.entries(ACTION_TEMPLATES)) {
      expect(en[key]).toBe(tpl);
      expect(de[key]).toBeTruthy();
      // German must use the same placeholders
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      expect(ph(de[key])).toBe(ph(tpl));
    }
  });
  it('fills placeholders', () => {
    expect(fillTemplate('Call {to}', { to: '+1555' })).toBe('Call +1555');
  });
});
