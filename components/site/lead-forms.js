'use client';

import { useRef, useState } from 'react';
import Ms from '@/components/storefront/icon';
import { useSite } from '@/components/site/site-provider';
import { pushEvent, trackLead } from '@/lib/site/analytics.mjs';
import { LEAD_HONEYPOT_FIELD, LEAD_SOURCES, saveLead } from '@/lib/site/leads.mjs';

/**
 * The prototype's three lead forms: contact, affiliate application and
 * professional account. The prototype only thanked the visitor; here each
 * one is saved as a lead in the CRM (the catalog's `/api/leads/contact`,
 * lib/site/leads.mjs), the full answers go to the team as a WhatsApp message
 * opened ready to send, and the catalog's `generate_lead` event fires.
 */

/**
 * The bot filter's two client halves, as the catalog's LeadFormTrap: a field
 * no person can see or reach, and the time the form has been open.
 */
const HIDDEN = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  border: 0,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
};

function Trap() {
  return (
    <div style={HIDDEN} aria-hidden="true">
      <label>
        Leave this field empty
        <input name={LEAD_HONEYPOT_FIELD} type="text" defaultValue="" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

function fieldsOf(form) {
  const data = new FormData(form);
  const out = {};
  for (const [name, value] of data.entries()) {
    const text = String(value).trim();
    if (!text) continue;
    out[name] = out[name] ? `${out[name]}, ${text}` : text;
  }
  return out;
}

function missing(scope) {
  return [...scope.querySelectorAll('[required]')].filter((input) => (
    input.type === 'checkbox' ? !input.checked : !String(input.value).trim()
  ));
}

function Done({ title, body }) {
  return (
    <div className="fdone">
      <Ms name="check_circle" filled />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function useSend() {
  const { whatsapp, lang } = useSite();
  const openedAt = useRef(Date.now());
  return (form, heading, labels, values, formName, contact) => {
    const lines = Object.entries(labels)
      .filter(([name]) => values[name])
      .map(([name, label]) => `${label}: ${values[name]}`);
    // Started before WhatsApp opens and not awaited: the window has to open
    // inside the click or the browser blocks it.
    saveLead({
      ...contact,
      source: LEAD_SOURCES[formName],
      lang,
      honeypot: form.elements[LEAD_HONEYPOT_FIELD]?.value || '',
      formMs: Date.now() - openedAt.current,
    });
    trackLead(formName);
    window.open(whatsapp([heading, '', ...lines].join('\n')), '_blank', 'noopener');
  };
}

export function ContactForm() {
  const { t } = useSite();
  const form = useRef(null);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const send = useSend();
  if (sent) return <Done title={t('Message sent')} body={t('We\'ll get back to you within 24–48 business hours.')} />;

  const submit = () => {
    const bad = missing(form.current);
    if (bad.length) { setError(t('Please fill in your name, email and message.')); bad[0].focus(); return; }
    const values = fieldsOf(form.current);
    send(form.current, 'Website contact form', { name: 'Name', phone: 'Phone', email: 'Email', topic: 'Topic', msg: 'Message' },
      values, 'contact', { name: values.name, email: values.email, phone: values.phone });
    setSent(true);
  };

  return (
    <form ref={form} noValidate onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <Trap />
      <div className="g2">
        <label>{t('Name')}<input required name="name" autoComplete="name" /></label>
        <label>{t('Phone or WhatsApp')}<input name="phone" type="tel" /></label>
      </div>
      <label>{t('Email')}<input required name="email" type="email" autoComplete="email" /></label>
      <label>
        {t('Topic')}
        <select name="topic">
          {['Product availability', 'Certificates of Analysis', 'An existing order', 'Bulk or wholesale', 'Affiliate program', 'Something else'].map((x) => (
            <option key={x} value={x}>{t(x)}</option>
          ))}
        </select>
      </label>
      <label>{t('Message')}<textarea required name="msg" rows={4} /></label>
      <div className="err">{error}</div>
      <button type="button" className="btn block" onClick={submit}>{t('Send message')}</button>
    </form>
  );
}

const PLATFORMS = ['Instagram', 'Facebook', 'TikTok', 'YouTube', 'Website or blog', 'Email', 'WhatsApp', 'In-person customers', 'Other'];

function Radios({ name, options, t, initial }) {
  return (
    <div className="radios">
      {options.map(([value, label]) => (
        <label key={value}><input type="radio" name={name} value={value} defaultChecked={value === initial} />{t(label)}</label>
      ))}
    </div>
  );
}

export function AffiliateForm() {
  const { t } = useSite();
  const form = useRef(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const send = useSend();
  if (sent) return <Done title={t('Application sent')} body={t('Thanks! We\'ll reply on WhatsApp or email the same business day.')} />;

  const next = () => {
    const bad = missing(form.current.querySelector(`fieldset[data-step="${step}"]`));
    if (bad.length) { setError(t('Please complete the required fields.')); bad[0].focus(); return; }
    setError('');
    if (step < 3) {
      setStep(step + 1);
      pushEvent({ event: 'affiliate_form_step', step: step + 1 });
      return;
    }
    const values = fieldsOf(form.current);
    send(form.current, 'Affiliate application', {
      name: 'Name', email: 'Email', wa: 'WhatsApp', biz: 'Business', phys: 'Physical business',
      aud: 'Has an audience', plat: 'Platforms', size: 'Audience size', refs: 'Monthly referrals',
      how: 'How they will promote', cur: 'Promotes peptides now', int: 'Interested in', cats: 'Categories',
      content: 'Content source', heard: 'Heard about us',
    }, values, 'affiliate', { name: values.name, email: values.email, phone: values.wa });
    setSent(true);
  };

  return (
    <>
      <div className="fsteps">
        {['1 · You', '2 · Audience', '3 · Interest'].map((label, index) => (
          <span key={label} className={index < step ? 'on' : ''}>{t(label)}</span>
        ))}
      </div>
      <form ref={form} noValidate onSubmit={(event) => { event.preventDefault(); next(); }}>
        <Trap />
        <fieldset data-step="1" hidden={step !== 1}>
          <div className="g2">
            <label>{t('Full name')}<input required name="name" autoComplete="name" /></label>
            <label>{t('Email')}<input required type="email" name="email" autoComplete="email" /></label>
            <label>{t('WhatsApp number')}<input required type="tel" name="wa" placeholder="+506" /></label>
            <label>{t('Business or work type')}<input name="biz" placeholder={t('e.g. clinic, gym, creator')} /></label>
          </div>
          <label>{t('Physical business (optional)')}<input name="phys" placeholder={t('Name and location, if you have one')} /></label>
        </fieldset>
        <fieldset data-step="2" hidden={step !== 2}>
          <label>{t('Do you have an audience interested in these products?')}<Radios name="aud" t={t} options={[['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']]} /></label>
          <label>
            {t('Platforms you use')}
            <div className="chksel">
              {PLATFORMS.map((x) => <label key={x}><input type="checkbox" name="plat" value={x} />{t(x)}</label>)}
            </div>
          </label>
          <div className="g2">
            <label>{t('Audience size')}<select name="size">{['Under 500', '500–2,000', '2,000–10,000', '10,000–50,000', '50,000+'].map((x) => <option key={x}>{t(x)}</option>)}</select></label>
            <label>{t('Estimated monthly referrals')}<select name="refs">{['1–5', '6–20', '21–50', '51–100', '100+', 'Not sure yet'].map((x) => <option key={x}>{t(x)}</option>)}</select></label>
          </div>
          <label>{t('How do you plan to promote us?')}<textarea name="how" rows={2} /></label>
          <label>{t('Do you currently promote peptides or related products?')}<Radios name="cur" t={t} options={[['yes', 'Yes'], ['no', 'No']]} /></label>
        </fieldset>
        <fieldset data-step="3" hidden={step !== 3}>
          <label>{t('I\'m interested in')}<Radios name="int" t={t} options={[['Affiliate commissions', 'Affiliate commissions'], ['Wholesale', 'Wholesale'], ['Both', 'Both']]} /></label>
          <label>{t('Product categories of interest')}<input name="cats" /></label>
          <label>{t('Content source')}<select name="content">{['My own content', 'Peptides Costa Rica materials', 'Both'].map((x) => <option key={x}>{t(x)}</option>)}</select></label>
          <label>{t('How did you hear about the program?')}<input name="heard" /></label>
          <label className="agree">
            <input type="checkbox" name="terms" required />
            {t('I agree to the commission terms: commission is earned only on eligible, completed purchases and may be adjusted for cancellations, refunds, chargebacks, fraud or terms violations.')}
          </label>
        </fieldset>
        <div className="err">{error}</div>
        <div className="fnav">
          {step > 1 ? <button type="button" className="btn ghost" onClick={() => { setError(''); setStep(step - 1); }}>{t('Back')}</button> : null}
          <button type="button" className="btn" onClick={next}>
            {step === 3 ? t('Submit application') : <>{t('Continue')}<Ms name="arrow_forward" /></>}
          </button>
        </div>
      </form>
    </>
  );
}

export function ProForm() {
  const { t } = useSite();
  const form = useRef(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const send = useSend();
  if (sent) return <Done title={t('Application received')} body={t('Your contact will reply within one business day.')} />;

  const next = () => {
    if (step === 1) {
      setStep(2);
      pushEvent({ event: 'pro_form_step', step: 2 });
      return;
    }
    const scope = form.current.querySelector('fieldset[data-step="2"]');
    const bad = missing(scope);
    if (bad.length) { setError(t('Please complete the required fields.')); bad[0].focus(); return; }
    const ced = String(form.current.elements.ced.value || '').replace(/\D/g, '');
    if (!(ced.length === 10 && ced[0] === '3')) {
      setError(t('A cédula jurídica has 10 digits and starts with 3.'));
      form.current.elements.ced.focus();
      return;
    }
    const values = fieldsOf(form.current);
    send(form.current, 'Professional account application', {
      biz: 'Business', ced: 'Cédula jurídica', name: 'Name', role: 'Role', email: 'Email', wa: 'WhatsApp',
      type: 'Organisation', vol: 'Monthly volume', cmp: 'Compounds', custom: 'Custom sizes or blends',
    }, values, 'pro_account', { name: values.name, email: values.email, phone: values.wa });
    setSent(true);
  };

  return (
    <>
      <div className="fsteps">
        {['1 · Your needs', '2 · Your details'].map((label, index) => (
          <span key={label} className={index < step ? 'on' : ''}>{t(label)}</span>
        ))}
      </div>
      <form ref={form} noValidate onSubmit={(event) => { event.preventDefault(); next(); }}>
        <Trap />
        <fieldset data-step="1" hidden={step !== 1}>
          <label>{t('Type of organisation')}<Radios name="type" t={t} initial="Clinic" options={['Clinic', 'Research lab', 'University', 'Pharmacy', 'Other business'].map((x) => [x, x])} /></label>
          <label>{t('Expected monthly volume')}<Radios name="vol" t={t} initial="10–25 vials" options={['10–25 vials', '25–50 vials', '50–100 vials', '100+ vials'].map((x) => [x, x])} /></label>
          <label>{t('Compounds of interest')}<input name="cmp" placeholder={t('e.g. GHK-Cu, BPC-157, NAD+')} /></label>
          <label>{t('Need custom sizes or blends?')}<Radios name="custom" t={t} initial="Not now" options={[['Yes', 'Yes'], ['Not now', 'Not now']]} /></label>
        </fieldset>
        <fieldset data-step="2" hidden={step !== 2}>
          <div className="g2">
            <label>{t('Business name')}<input required name="biz" /></label>
            <label>{t('Cédula jurídica')}<input required name="ced" inputMode="numeric" placeholder="3-101-XXXXXX" /></label>
            <label>{t('Your name')}<input required name="name" autoComplete="name" /></label>
            <label>{t('Role')}<select name="role">{['Owner / director', 'Lab manager', 'Purchasing', 'Researcher', 'Other'].map((x) => <option key={x}>{t(x)}</option>)}</select></label>
            <label>{t('Email')}<input required type="email" name="email" /></label>
            <label>{t('WhatsApp')}<input required type="tel" name="wa" placeholder="+506" /></label>
          </div>
          <label className="agree">
            <input type="checkbox" required name="ruo" />
            {t('I confirm all products are purchased for laboratory research use only, not for human or veterinary use.')}
          </label>
        </fieldset>
        <div className="err">{error}</div>
        <div className="fnav">
          {step > 1 ? <button type="button" className="btn ghost" onClick={() => { setError(''); setStep(1); }}>{t('Back')}</button> : null}
          <button type="button" className="btn" onClick={next}>
            {step === 2 ? t('Request professional pricing') : <>{t('Continue')}<Ms name="arrow_forward" /></>}
          </button>
        </div>
      </form>
    </>
  );
}
