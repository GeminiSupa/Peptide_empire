import Icon from '@/components/ui/icon';

export default function FeatureCard({ icon, title, body }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-bg-card p-6 shadow-[0_10px_30px_rgba(9,39,113,0.06)] transition duration-200 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_16px_36px_rgba(9,39,113,0.11)]">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/5 text-primary">
        <Icon name={icon} />
      </span>
      <h3 className="mt-5 text-lg font-bold">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-text-muted">{body}</p>
    </div>
  );
}
