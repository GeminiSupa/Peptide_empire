'use client';

/**
 * The floating bar on a phone: what is in the order, how close free delivery
 * is, and the way into the sheet. Hidden while the sheet is open, and when
 * the order is empty.
 */
export default function OrderBar({ t, count, total, progress, onOpen, hidden }) {
  if (!count || hidden) return null;

  return (
    <div className="obar show">
      <div className="info">
        <b className="num">{total}</b>
        <small>
          {t(`${count} vial${count === 1 ? '' : 's'}`)}
          {progress.reached ? ` · ${t('Free delivery')}` : ''}
        </small>
        <div className="mini"><i style={{ width: `${progress.percent}%` }} /></div>
      </div>
      <button className="btn" type="button" onClick={onOpen}>{t('View order')}</button>
    </div>
  );
}
