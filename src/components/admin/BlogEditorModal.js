"use client";

import { useMemo, useState } from 'react';
import { Check, ExternalLink, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { seoChecklist, slugify } from '@/lib/blogCms.mjs';

const input = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: '#172237', color: '#f8fafc', fontSize: '.9rem', outline: 'none' };
const label = { display: 'block', marginBottom: 6, color: '#cbd5e1', fontSize: '.74rem', fontWeight: 800, textTransform: 'uppercase' };
const panel = { padding: 16, border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, background: 'rgba(23,34,55,.45)' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 };

function Field({ title, hint, count, children }) {
  return <label><span style={label}>{title}</span>{children}{hint || count !== undefined ? <small style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 5, color: '#64748b' }}><span>{hint}</span>{count !== undefined ? <span>{count} characters</span> : null}</small> : null}</label>;
}

function LanguageFields({ lang, blog, update }) {
  const key = lang.toLowerCase();
  const name = lang === 'EN' ? 'English' : 'Spanish';
  const titleKey = `title_${key}`;
  const excerptKey = `excerpt_${key}`;
  const contentKey = `content_${key}`;
  return (
    <div style={panel}>
      <h3 style={{ margin: '0 0 14px', fontSize: '1rem' }}>{name}</h3>
      <div style={{ display: 'grid', gap: 14 }}>
        <Field title="Article title" count={(blog[titleKey] || '').length}>
          <input required value={blog[titleKey] || ''} onChange={(e) => update(titleKey, e.target.value)} style={input} />
        </Field>
        <Field title="Short introduction" hint="Shown on blog cards and used as the SEO fallback." count={(blog[excerptKey] || '').length}>
          <textarea required value={blog[excerptKey] || ''} onChange={(e) => update(excerptKey, e.target.value)} style={{ ...input, minHeight: 92, resize: 'vertical' }} />
        </Field>
        <Field title="Article body" hint="HTML is supported. Use <h2> for section headings and <p> for paragraphs.">
          <textarea required value={blog[contentKey] || ''} onChange={(e) => update(contentKey, e.target.value)} style={{ ...input, minHeight: 310, resize: 'vertical', fontFamily: 'ui-monospace, monospace', lineHeight: 1.55 }} />
        </Field>
      </div>
    </div>
  );
}

function SeoFields({ lang, blog, update }) {
  const key = lang.toLowerCase();
  const checks = seoChecklist(blog, key);
  return (
    <div style={panel}>
      <h3 style={{ margin: '0 0 14px', fontSize: '1rem' }}>{lang === 'EN' ? 'English' : 'Spanish'} search details</h3>
      <div style={{ display: 'grid', gap: 14 }}>
        <Field title="Focus search phrase" hint="One phrase this article answers."><input value={blog[`focus_keyword_${key}`] || ''} onChange={(e) => update(`focus_keyword_${key}`, e.target.value)} style={input} /></Field>
        <Field title="SEO title" hint="Leave blank to use the article title." count={(blog[`seo_title_${key}`] || '').length}><input value={blog[`seo_title_${key}`] || ''} onChange={(e) => update(`seo_title_${key}`, e.target.value)} style={input} /></Field>
        <Field title="SEO description" hint="A clear summary for search results." count={(blog[`seo_description_${key}`] || '').length}><textarea value={blog[`seo_description_${key}`] || ''} onChange={(e) => update(`seo_description_${key}`, e.target.value)} style={{ ...input, minHeight: 90, resize: 'vertical' }} /></Field>
        <Field title="Direct answer summary" hint="2–3 factual sentences that help readers and AI search engines understand the page."><textarea value={blog[`ai_summary_${key}`] || ''} onChange={(e) => update(`ai_summary_${key}`, e.target.value)} style={{ ...input, minHeight: 105, resize: 'vertical' }} /></Field>
        <div>
          <span style={label}>Publishing checklist</span>
          <div style={{ display: 'grid', gap: 7 }}>
            {checks.map((check) => <div key={check.label} style={{ display: 'flex', gap: 8, alignItems: 'center', color: check.pass ? '#86efac' : '#94a3b8', fontSize: '.8rem' }}>{check.pass ? <Check size={14} /> : <span style={{ width: 14, textAlign: 'center' }}>○</span>}{check.label}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqEditor({ lang, value, update }) {
  const entries = Array.isArray(value) ? value.map((entry) => ({ question: String(entry?.question || ''), answer: String(entry?.answer || '') })) : [];
  const set = (index, key, next) => update(entries.map((entry, at) => at === index ? { ...entry, [key]: next } : entry));
  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}><h3 style={{ margin: 0, fontSize: '1rem' }}>{lang} FAQs</h3><button type="button" className="admin-btn" onClick={() => update([...entries, { question: '', answer: '' }])}><Plus size={14} /> Add question</button></div>
      <p style={{ color: '#94a3b8', fontSize: '.78rem', margin: '0 0 12px' }}>Only add questions answered visibly on the article. They also become structured search data.</p>
      <div style={{ display: 'grid', gap: 10 }}>
        {entries.map((entry, index) => <div key={index} style={{ display: 'grid', gap: 7, padding: 10, background: '#101a2b', borderRadius: 8 }}><input aria-label={`${lang} FAQ question ${index + 1}`} placeholder="Question" value={entry.question} onChange={(e) => set(index, 'question', e.target.value)} style={input} /><textarea aria-label={`${lang} FAQ answer ${index + 1}`} placeholder="Answer" value={entry.answer} onChange={(e) => set(index, 'answer', e.target.value)} style={{ ...input, minHeight: 75, resize: 'vertical' }} /><button type="button" onClick={() => update(entries.filter((_, at) => at !== index))} className="admin-btn" style={{ justifySelf: 'end', color: '#fca5a5' }}><Trash2 size={14} /> Remove</button></div>)}
        {!entries.length ? <div style={{ color: '#64748b', fontSize: '.82rem' }}>No FAQs added.</div> : null}
      </div>
    </div>
  );
}

export default function BlogEditorModal({ blog, setBlog, onClose, onSave, saving, bucketImages, onImageUpload }) {
  const [tab, setTab] = useState('content');
  const update = (key, value) => setBlog((current) => {
    const next = { ...current, [key]: value };
    if (key === 'title_en' && current._slugAuto) next.slug = slugify(value);
    if (key === 'title_es' && current._slugEsAuto !== false) next.slug_es = slugify(value);
    return next;
  });
  const preview = useMemo(() => ({ en: `https://peptidescostarica.net/blog/${blog.slug || 'article-slug'}/`, es: `https://peptidescostarica.net/es/blog/${blog.slug_es || blog.slug || 'article-slug'}/` }), [blog.slug, blog.slug_es]);
  const tabs = [['content', '1. Article'], ['seo', '2. SEO & AI search'], ['publish', '3. FAQs & publish']];
  return (
    <div className="modal active" onClick={onClose} style={{ zIndex: 200 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1080, width: '94%', maxHeight: '94vh', overflowY: 'auto', background: '#0e1626', color: '#f8fafc' }}>
        <button className="close-modal" onClick={onClose} style={{ color: '#94a3b8' }}>&times;</button>
        <div style={{ marginBottom: 16 }}><span style={{ color: blog.published ? '#4ade80' : '#fbbf24', fontSize: '.75rem', fontWeight: 800 }}>{blog.published ? 'LIVE' : 'DRAFT'}</span><h2 style={{ margin: '3px 0 4px', fontSize: '1.35rem' }}>{blog.id ? 'Edit article' : 'Create article'}</h2><p style={{ margin: 0, color: '#94a3b8', fontSize: '.83rem' }}>One entry publishes to both websites. Peptidescostarica.net is the canonical search result.</p></div>
        <div role="tablist" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>{tabs.map(([id, text]) => <button key={id} type="button" onClick={() => setTab(id)} className="admin-btn" style={{ background: tab === id ? '#2563eb' : '#172237', color: '#fff' }}>{text}</button>)}</div>
        <form onSubmit={onSave} style={{ display: 'grid', gap: 16 }}>
          {tab === 'content' ? <><div style={grid}><Field title="English URL slug" hint="Keep this stable after publishing."><input required value={blog.slug || ''} onChange={(e) => setBlog((current) => ({ ...current, slug: slugify(e.target.value), _slugAuto: false }))} style={input} /></Field><Field title="Spanish URL slug"><input required value={blog.slug_es || ''} onChange={(e) => setBlog((current) => ({ ...current, slug_es: slugify(e.target.value), _slugEsAuto: false }))} style={input} /></Field></div><div style={grid}><LanguageFields lang="EN" blog={blog} update={update} /><LanguageFields lang="ES" blog={blog} update={update} /></div></> : null}
          {tab === 'seo' ? <div style={grid}><SeoFields lang="EN" blog={blog} update={update} /><SeoFields lang="ES" blog={blog} update={update} /></div> : null}
          {tab === 'publish' ? <><div style={grid}><FaqEditor lang="English" value={blog.faq_en} update={(value) => update('faq_en', value)} /><FaqEditor lang="Spanish" value={blog.faq_es} update={(value) => update('faq_es', value)} /></div><div style={{ ...panel, display: 'grid', gap: 14 }}><div style={grid}><Field title="Author"><input value={blog.author_name || ''} onChange={(e) => update('author_name', e.target.value)} style={input} /></Field><Field title="Category"><input value={blog.category || ''} onChange={(e) => update('category', e.target.value)} style={input} /></Field><Field title="Tags" hint="Comma-separated"><input value={(blog.tags || []).join(', ')} onChange={(e) => update('tags', e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean))} style={input} /></Field></div><Field title="Cover image"><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><input value={blog.image_url || ''} onChange={(e) => update('image_url', e.target.value)} placeholder="https://…" style={{ ...input, flex: '1 1 300px' }} /><input type="file" accept="image/*" id="blogImageUpload" onChange={onImageUpload} hidden /><button type="button" className="admin-btn admin-btn-primary" onClick={() => document.getElementById('blogImageUpload')?.click()}><Upload size={14} /> Upload</button></div><select value={bucketImages.some((image) => image.url === blog.image_url) ? blog.image_url : ''} onChange={(e) => update('image_url', e.target.value)} style={{ ...input, marginTop: 8 }}><option value="">Select an uploaded image…</option>{bucketImages.map((image) => <option key={image.name} value={image.url}>{image.name}</option>)}</select></Field><div><span style={label}>Public previews</span><div style={{ display: 'grid', gap: 5, fontSize: '.8rem' }}><a href={preview.en} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>{preview.en} <ExternalLink size={12} /></a><a href={preview.es} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>{preview.es} <ExternalLink size={12} /></a></div></div><label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, background: 'rgba(255,255,255,.05)', cursor: 'pointer' }}><input type="checkbox" checked={Boolean(blog.published)} onChange={(e) => update('published', e.target.checked)} style={{ transform: 'scale(1.25)' }} /><span><b style={{ color: blog.published ? '#4ade80' : '#f8fafc' }}>{blog.published ? 'Publish on both websites' : 'Keep as draft'}</b><small style={{ display: 'block', color: '#94a3b8', marginTop: 2 }}>{blog.published ? 'Saving makes this visible to customers.' : 'Only staff can see it in this CMS.'}</small></span></label></div></> : null}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', position: 'sticky', bottom: -20, background: '#0e1626', padding: '14px 0 4px', borderTop: '1px solid rgba(255,255,255,.08)' }}><button type="button" className="admin-btn" onClick={onClose}><X size={15} /> Cancel</button><button type="submit" disabled={saving} className="admin-btn admin-btn-primary"><Save size={15} /> {saving ? 'Saving…' : blog.published ? 'Save and publish' : 'Save draft'}</button></div>
        </form>
      </div>
    </div>
  );
}
