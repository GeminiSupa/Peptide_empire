'use client';

import { useEffect, useState } from 'react';
import { useSite } from '@/components/site/site-provider';

/**
 * Behaviour for a page drawn from a prototype snapshot (proto-page.js): the
 * accordions, the in-page search boxes and the jump links. The markup is the
 * server's; this only listens, inside `#page`, the way the prototype did.
 */
export default function ProtoInteractions() {
  useEffect(() => {
    const root = document.getElementById('page');
    if (!root) return undefined;

    const onClick = (event) => {
      const button = event.target.closest('.acc > button');
      if (button && root.contains(button)) {
        const item = button.parentElement;
        const open = !item.classList.contains('open');
        item.classList.toggle('open', open);
        button.setAttribute('aria-expanded', String(open));
        return;
      }
      const jump = event.target.closest('[data-jump]');
      if (jump && root.contains(jump)) {
        event.preventDefault();
        document.getElementById(jump.dataset.jump)?.scrollIntoView({ behavior: 'smooth' });
      }
    };

    // Each search box filters its own list, as in the prototype.
    const onInput = (event) => {
      const q = String(event.target.value || '').toLowerCase().trim();
      const hide = (el, hidden) => { el.hidden = Boolean(hidden); };
      if (event.target.id === 'faqQ') {
        root.querySelectorAll('.fqg .acc').forEach((acc) => hide(acc, q && !acc.textContent.toLowerCase().includes(q)));
        root.querySelectorAll('.fqg').forEach((group) => hide(group, ![...group.querySelectorAll('.acc')].some((acc) => !acc.hidden)));
      } else if (event.target.id === 'icQ') {
        root.querySelectorAll('.icg a').forEach((a) => hide(a, q && !String(a.dataset.t || a.textContent).toLowerCase().includes(q)));
      } else if (event.target.id === 'coaQ') {
        root.querySelectorAll('.coar').forEach((row) => hide(row, q && !String(row.dataset.n || row.textContent).toLowerCase().includes(q)));
      } else if (event.target.id === 'locQ') {
        root.querySelectorAll('.chipsl a').forEach((a) => hide(a, q && !String(a.dataset.t || a.textContent).toLowerCase().includes(q)));
      }
    };

    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    return () => {
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onInput);
    };
  }, []);

  return null;
}

/** The app page's reconstitution calculator (a laboratory calculation aid). */
export function LabCalc({ appHref = '#install' }) {
  const { t } = useSite();
  const [s, setS] = useState({ mg: 5, ml: 2, amt: 250 });
  const conc = s.mg / s.ml;
  const vol = (s.amt / 1000) / conc;
  const n = Math.floor((s.mg * 1000) / s.amt);
  const pct = Math.min(100, (vol / s.ml) * 100);
  const group = (k, label, values, unit) => (
    <div className="lcg">
      <div className="lcl"><span>{t(label)}</span><b>{`${s[k]} ${unit}`}</b></div>
      <div className="lcc">
        {values.map((v) => (
          <button type="button" key={v} aria-pressed={s[k] === v} onClick={() => setS((current) => ({ ...current, [k]: v }))}>{v}</button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="lcalc" id="lcalc">
      <div className="lcout">
        <small>{t('CONCENTRATION')}</small>
        <div className="lcbig">{Math.round(conc * 100) / 100} <em>mg/mL</em></div>
        <div className="lcsub">{`= ${Math.round(conc * 1000).toLocaleString('en-US')} mcg/mL`}</div>
        <div className="lcvial"><i style={{ height: `${Math.max(8, pct)}%` }} /></div>
        <div className="lcg2">
          <span>{t('Volume per aliquot')}<b>{`${vol.toFixed(3)} mL`}</b></span>
          <span>{t('Aliquots per vial')}<b>{n}</b></span>
        </div>
      </div>
      {group('mg', 'Vial mass', [2, 5, 10, 15, 50], 'mg')}
      {group('ml', 'Diluent added', [1, 2, 3, 5], 'mL')}
      {group('amt', 'Amount per aliquot', [100, 250, 500, 1000], 'mcg')}
      <a className="btn block" href={appHref}>{t('Get it in the app')}<span className="ms">download</span></a>
    </div>
  );
}

/** "Open now" during support hours: Monday to Friday, 10:00–17:00 in Costa Rica. */
export function OpenNow() {
  const { t } = useSite();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const now = new Date(Date.now() - 6 * 3600 * 1000);
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    setOpen(day >= 1 && day <= 5 && hour >= 10 && hour < 17);
  }, []);
  return <span className={`openb${open ? ' on' : ''}`} hidden={!open}>{open ? t('Open now') : ''}</span>;
}
