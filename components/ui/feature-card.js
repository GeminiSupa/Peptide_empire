import Icon from '@/components/ui/icon';

export default function FeatureCard({ icon, title, body }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-100 bg-bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/5 text-primary">
        <Icon name={icon} />
      </span>
      <h3 className="mt-5 text-lg font-bold">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-text-muted">{body}</p>
    </div>
  );
}
