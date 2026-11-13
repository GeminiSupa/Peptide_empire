"use client";

import { useMemo, useRef, useState } from 'react';
import {
  Bold, Check, ExternalLink, Heading2, Image as ImageIcon, Languages, Link2, List,
  Loader2, Plus, Quote, Save, Sparkles, Trash2, Upload, X,
} from 'lucide-react';
import { analyzeWriting, buildFigureHtml, seoChecklist, slugify } from '@/lib/blogCms.mjs';

const input = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: '#172237', color: '#f8fafc', fontSize: '.9rem', outline: 'none' };
const label = { display: 'block', marginBottom: 6, color: '#cbd5e1', fontSize: '.74rem', fontWeight: 800, textTransform: 'uppercase' };
const panel = { padding: 16, border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, background: 'rgba(23,34,55,.45)' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 };
const tool = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: '#172237', color: '#dbeafe', fontSize: '.74rem', fontWeight: 700, cursor: 'pointer' };
const aiBtn = { ...tool, border: '1px solid rgba(129,140,248,.45)', background: 'rgba(79,70,229,.22)', color: '#c7d2fe' };

function Field({ title, hint, count, children }) {
  return <label><span style={label}>{title}</span>{children}{hint || count !== undefined ? <small style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 5, color: '#64748b' }}><span>{hint}</span>{count !== undefined ? <span>{count} characters</span> : null}</small> : null}</label>;
}

function Meter({ label: text, value, ok }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999, background: ok ? 'rgba(34,197,94,.14)' : 'rgba(148,163,184,.14)', color: ok ? '#86efac' : '#cbd5e1', fontSize: '.72rem', fontWeight: 700 }}>{text}: {value}</span>;
}

function parseAiJson(text) {
  const cleaned = String(text || '').replace(/^```(?:json)?/i, '').replace(/```$/g, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const match = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
    return null;
  }
}

function LanguageFields({ lang, blog, update, contentRefs, aiBusy, runAi, onBodyImageUpload }) {
  const key = lang.toLowerCase();
  const other = key === 'en' ? 'es' : 'en';
  const name = lang === 'EN' ? 'English' : 'Spanish';
  const titleKey = `title_${key}`;
  const contentKey = `content_${key}`;
  const [img, setImg] = useState(null); // { alt, caption, uploading, pos }
  const stats = analyzeWriting(blog[contentKey], blog[`focus_keyword_${key}`]);
  const titleWords = String(blog[titleKey] || '').trim().split(/\s+/).filter(Boolean).length;

  const ta = () => contentRefs.current[key];
  const setContent = (next, caret) => {
    update(contentKey, next);
    requestAnimationFrame(() => { const el = ta(); if (el && caret != null) { el.focus(); el.setSelectionRange(caret, caret); } });
  };
  const wrap = (before, after, placeholder) => {
    const el = ta(); const val = blog[contentKey] || '';
    const s = el ? el.selectionStart : val.length; const e = el ? el.selectionEnd : val.length;
    const sel = val.slice(s, e) || placeholder;
    setContent(val.slice(0, s) + before + sel + after + val.slice(e), s + before.length + sel.length + after.length);
  };
  const makeList = () => {
    const el = ta(); const val = blog[contentKey] || '';
    const s = el ? el.selectionStart : val.length; const e = el ? el.selectionEnd : val.length;
    const lines = (val.slice(s, e) || 'First point\nSecond point').split('\n').filter((l) => l.trim());
    const html = `\n<ul>\n${lines.map((l) => `  <li>${l.trim()}</li>`).join('\n')}\n</ul>\n`;
    setContent(val.slice(0, s) + html + val.slice(e), s + html.length);
  };
  const openImage = () => { const el = ta(); setImg({ alt: '', caption: '', uploading: false, pos: el ? el.selectionStart : (blog[contentKey] || '').length }); };
  const confirmImage = async (file) => {
    if (!file) return;
    if (!img.alt.trim()) { alert('Please write alt text (a short, specific description) before inserting the image.'); return; }
    setImg((c) => ({ ...c, uploading: true }));
    const url = await onBodyImageUpload(file);
    if (url) {
      const val = blog[contentKey] || ''; const pos = img.pos ?? val.length;
      const html = buildFigureHtml({ url, alt: img.alt.trim(), caption: img.caption.trim() });
      setContent(val.slice(0, pos) + html + val.slice(pos), pos + html.length);
      setImg(null);
    } else { setImg((c) => ({ ...c, uploading: false })); }
  };
  const suggestAlt = async () => {
    const text = await runAi(`alt-${key}`, () => aiText('alt', { lang: key, title: blog[titleKey], keyword: blog[`focus_keyword_${key}`], caption: img.caption || img.alt }));
    if (text) setImg((c) => ({ ...c, alt: text.replace(/^["']|["']$/g, '') }));
  };
  const aiText = runAi.__aiText; // helper passed through

  const draft = async () => {
    if ((blog[contentKey] || '').trim() && !window.confirm('Insert an AI draft at the cursor? Your current text is kept.')) return;
    const html = await runAi(`outline-${key}`, () => aiText('outline', { lang: key, title: blog[titleKey], keyword: blog[`focus_keyword_${key}`], topic: blog.excerpt_en || blog[`excerpt_${key}`] }));
    if (html) { const el = ta(); const val = blog[contentKey] || ''; const pos = el ? el.selectionStart : val.length; setContent(val.slice(0, pos) + '\n' + html.trim() + '\n' + val.slice(pos)); }
  };
  const improve = async () => {
    const el = ta(); const val = blog[contentKey] || '';
    const s = el ? el.selectionStart : 0; const e = el ? el.selectionEnd : 0;
    const sel = val.slice(s, e);
    if (!sel.trim()) { alert('Select a sentence or paragraph in the body first, then Improve.'); return; }
    const out = await runAi(`improve-${key}`, () => aiText('improve', { lang: key, selection: sel }));
    if (out) setContent(val.slice(0, s) + out.trim() + val.slice(e), s + out.trim().length);
  };
  const translateFrom = async () => {
    const source = blog[`content_${other}`] || '';
    if (!source.trim()) { alert(`Write the ${other === 'en' ? 'English' : 'Spanish'} body first.`); return; }
    const out = await runAi(`tr-${key}`, () => aiText('translate', { text: source, sourceLang: other, targetLang: key }));
    if (out) update(contentKey, out.trim());
    const srcTitle = blog[`title_${other}`] || '';
    if (srcTitle && !String(blog[titleKey] || '').trim()) {
      const t = await runAi(`trt-${key}`, () => aiText('translate', { text: srcTitle, sourceLang: other, targetLang: key }));
      if (t) update(titleKey, t.trim());
    }
  };

  return (
    <div style={panel}>
      <h3 style={{ margin: '0 0 14px', fontSize: '1rem' }}>{name}</h3>
      <div style={{ display: 'grid', gap: 14 }}>
        <Field title="Article title" hint="Aim for 8–12 words with your focus phrase." count={(blog[titleKey] || '').length}>
          <input required value={blog[titleKey] || ''} onChange={(e) => update(titleKey, e.target.value)} style={input} />
          <small style={{ color: titleWords >= 8 && titleWords <= 12 ? '#86efac' : '#64748b' }}>{titleWords} words</small>
        </Field>
        <Field title="Short introduction" hint="Shown on blog cards and used as the SEO fallback." count={(blog[`excerpt_${key}`] || '').length}>
          <textarea required value={blog[`excerpt_${key}`] || ''} onChange={(e) => update(`excerpt_${key}`, e.target.value)} style={{ ...input, minHeight: 92, resize: 'vertical' }} />
        </Field>
        <div>
          <span style={label}>Article body</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            <button type="button" style={tool} onClick={() => wrap('\n<h2>', '</h2>\n', 'Section heading')}><Heading2 size={13} /> H2</button>
            <button type="button" style={tool} onClick={() => wrap('<strong>', '</strong>', 'bold text')}><Bold size={13} /> Bold</button>
            <button type="button" style={tool} onClick={makeList}><List size={13} /> List</button>
            <button type="button" style={tool} onClick={() => wrap('<a href="https://">', '</a>', 'link text')}><Link2 size={13} /> Link</button>
            <button type="button" style={tool} onClick={() => wrap('\n<blockquote>', '</blockquote>\n', 'quote')}><Quote size={13} /> Quote</button>
            <button type="button" style={{ ...tool, borderColor: 'rgba(96,165,250,.5)', color: '#93c5fd' }} onClick={openImage}><ImageIcon size={13} /> Image</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            <button type="button" style={aiBtn} disabled={!!aiBusy} onClick={draft}>{aiBusy === `outline-${key}` ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} AI draft</button>
            <button type="button" style={aiBtn} disabled={!!aiBusy} onClick={improve}>{aiBusy === `improve-${key}` ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} Improve selection</button>
            <button type="button" style={aiBtn} disabled={!!aiBusy} onClick={translateFrom}>{aiBusy === `tr-${key}` ? <Loader2 size={13} className="spin" /> : <Languages size={13} />} Fill from {other.toUpperCase()}</button>
          </div>
          {img ? (
            <div style={{ ...panel, background: '#101a2b', marginBottom: 8, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong style={{ fontSize: '.85rem' }}>Insert image</strong><button type="button" onClick={() => setImg(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={15} /></button></div>
              <input placeholder="Alt text — specific description (required)" value={img.alt} onChange={(e) => setImg((c) => ({ ...c, alt: e.target.value }))} style={input} />
              <input placeholder="Caption shown under the image (optional)" value={img.caption} onChange={(e) => setImg((c) => ({ ...c, caption: e.target.value }))} style={input} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" style={aiBtn} disabled={!!aiBusy} onClick={suggestAlt}>{aiBusy === `alt-${key}` ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} Suggest alt text</button>
                <label style={{ ...tool, borderColor: 'rgba(96,165,250,.5)', color: '#93c5fd', opacity: img.uploading ? .6 : 1 }}>
                  {img.uploading ? <Loader2 size={13} className="spin" /> : <Upload size={13} />} {img.uploading ? 'Uploading…' : 'Choose & insert'}
                  <input type="file" accept="image/*" hidden disabled={img.uploading} onChange={(e) => confirmImage(e.target.files?.[0])} />
                </label>
                <small style={{ color: '#64748b' }}>Resized & compressed automatically.</small>
              </div>
            </div>
          ) : null}
          <textarea ref={(el) => { contentRefs.current[key] = el; }} required value={blog[contentKey] || ''} onChange={(e) => update(contentKey, e.target.value)} style={{ ...input, minHeight: 320, resize: 'vertical', fontFamily: 'ui-monospace, monospace', lineHeight: 1.55 }} />
          <small style={{ display: 'block', color: '#64748b', margin: '5px 0 8px' }}>HTML supported. Use the buttons above so you never type a tag.</small>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Meter label="Words" value={stats.words} ok={stats.words >= 300} />
            <Meter label="Keyword density" value={`${stats.density}%`} ok={stats.density > 0 && stats.density < 2} />
            <Meter label="Passive" value={`${stats.passivePct}%`} ok={stats.words >= 50 && stats.passivePct < 10} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SeoFields({ lang, blog, update, aiBusy, runAi }) {
  const key = lang.toLowerCase();
  const checks = seoChecklist(blog, key);
  const aiText = runAi.__aiText;
  const generate = async () => {
    const out = await runAi(`seo-${key}`, () => aiText('seo', { lang: key, title: blog[`title_${key}`], keyword: blog[`focus_keyword_${key}`], content: blog[`content_${key}`], topic: blog[`excerpt_${key}`] }));
    const data = parseAiJson(out);
    if (!data) { alert('The AI reply could not be read. Please try again.'); return; }
    if (data.focus_keyword) update(`focus_keyword_${key}`, String(data.focus_keyword));
    if (data.seo_title) update(`seo_title_${key}`, String(data.seo_title));
    if (data.seo_description) update(`seo_description_${key}`, String(data.seo_description));
    if (data.ai_summary) update(`ai_summary_${key}`, String(data.ai_summary));
  };
  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{lang === 'EN' ? 'English' : 'Spanish'} search details</h3>
        <button type="button" style={aiBtn} disabled={!!aiBusy} onClick={generate}>{aiBusy === `seo-${key}` ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} AI generate</button>
      </div>
      <div style={{ display: 'grid', gap: 14 }}>
        <Field title="Focus search phrase" hint="One phrase this article answers."><input value={blog[`focus_keyword_${key}`] || ''} onChange={(e) => update(`focus_keyword_${key}`, e.target.value)} style={input} /></Field>
        <Field title="SEO title" hint="Leave blank to use the article title." count={(blog[`seo_title_${key}`] || '').length}><input value={blog[`seo_title_${key}`] || ''} onChange={(e) => update(`seo_title_${key}`, e.target.value)} style={input} /></Field>
        <Field title="SEO description" hint="Under 160 characters, active voice, with the focus phrase." count={(blog[`seo_description_${key}`] || '').length}><textarea value={blog[`seo_description_${key}`] || ''} onChange={(e) => update(`seo_description_${key}`, e.target.value)} style={{ ...input, minHeight: 90, resize: 'vertical' }} /></Field>
        <Field title="Direct answer summary" hint="2–3 factual sentences that help readers and AI search engines."><textarea value={blog[`ai_summary_${key}`] || ''} onChange={(e) => update(`ai_summary_${key}`, e.target.value)} style={{ ...input, minHeight: 105, resize: 'vertical' }} /></Field>
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

function FaqEditor({ lang, langKey, blog, value, update, aiBusy, runAi }) {
  const entries = Array.isArray(value) ? value.map((entry) => ({ question: String(entry?.question || ''), answer: String(entry?.answer || '') })) : [];
  const set = (index, key, next) => update(entries.map((entry, at) => at === index ? { ...entry, [key]: next } : entry));
  const aiText = runAi.__aiText;
  const draftFaq = async () => {
    const out = await runAi(`faq-${langKey}`, () => aiText('faq', { lang: langKey, title: blog[`title_${langKey}`], keyword: blog[`focus_keyword_${langKey}`], content: blog[`content_${langKey}`], topic: blog[`excerpt_${langKey}`] }));
    const data = parseAiJson(out);
    if (!Array.isArray(data)) { alert('The AI reply could not be read. Please try again.'); return; }
    const clean = data.map((e) => ({ question: String(e?.question || ''), answer: String(e?.answer || '') })).filter((e) => e.question || e.answer);
    if (clean.length) update([...entries, ...clean]);
  };
  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{lang} FAQs</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={aiBtn} disabled={!!aiBusy} onClick={draftFaq}>{aiBusy === `faq-${langKey}` ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} AI draft</button>
          <button type="button" className="admin-btn" onClick={() => update([...entries, { question: '', answer: '' }])}><Plus size={14} /> Add</button>
        </div>
      </div>
      <p style={{ color: '#94a3b8', fontSize: '.78rem', margin: '0 0 12px' }}>Only add questions answered visibly on the article. They also become structured search data.</p>
      <div style={{ display: 'grid', gap: 10 }}>
        {entries.map((entry, index) => <div key={index} style={{ display: 'grid', gap: 7, padding: 10, background: '#101a2b', borderRadius: 8 }}><input aria-label={`${lang} FAQ question ${index + 1}`} placeholder="Question" value={entry.question} onChange={(e) => set(index, 'question', e.target.value)} style={input} /><textarea aria-label={`${lang} FAQ answer ${index + 1}`} placeholder="Answer" value={entry.answer} onChange={(e) => set(index, 'answer', e.target.value)} style={{ ...input, minHeight: 75, resize: 'vertical' }} /><button type="button" onClick={() => update(entries.filter((_, at) => at !== index))} className="admin-btn" style={{ justifySelf: 'end', color: '#fca5a5' }}><Trash2 size={14} /> Remove</button></div>)}
        {!entries.length ? <div style={{ color: '#64748b', fontSize: '.82rem' }}>No FAQs added.</div> : null}
      </div>
    </div>
  );
}

export default function BlogEditorModal({ blog, setBlog, onClose, onSave, saving, bucketImages, onImageUpload, onBodyImageUpload, onAi }) {
  const [tab, setTab] = useState('content');
  const [aiBusy, setAiBusy] = useState(null);
  const contentRefs = useRef({});

  const aiText = async (task, context) => {
    if (typeof onAi !== 'function') throw new Error('AI is not available.');
    return onAi(task, context);
  };
  // runAi wraps a task with busy state + error handling; it also carries the raw
  // aiText helper so the field components can build their own calls.
  const runAi = async (key, fn) => {
    if (aiBusy) return '';
    setAiBusy(key);
    try { return await fn(); }
    catch (err) { console.error(err); alert(`AI request failed: ${err.message}`); return ''; }
    finally { setAiBusy(null); }
  };
  runAi.__aiText = aiText;

  const update = (key, value) => setBlog((current) => {
    const next = { ...current, [key]: value };
    if (key === 'title_en' && current._slugAuto) next.slug = slugify(value);
    if (key === 'title_es' && current._slugEsAuto !== false) next.slug_es = slugify(value);
    return next;
  });
  const preview = useMemo(() => ({ en: `https://peptidescostarica.net/blog/${blog.slug || 'article-slug'}/`, es: `https://peptidescostarica.net/es/blog/${blog.slug_es || blog.slug || 'article-slug'}/` }), [blog.slug, blog.slug_es]);
  const tabs = [['content', '1. Article'], ['seo', '2. SEO & AI search'], ['publish', '3. FAQs & publish']];
  const bodyProps = { blog, update, contentRefs, aiBusy, runAi, onBodyImageUpload: onBodyImageUpload || (async () => '') };

  return (
    <div className="modal active" onClick={onClose} style={{ zIndex: 200 }}>
      <style>{`@keyframes blogspin{to{transform:rotate(360deg)}} .spin{animation:blogspin .8s linear infinite}`}</style>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1080, width: '94%', maxHeight: '94vh', overflowY: 'auto', background: '#0e1626', color: '#f8fafc' }}>
        <button className="close-modal" onClick={onClose} style={{ color: '#94a3b8' }}>&times;</button>
        <div style={{ marginBottom: 16 }}><span style={{ color: blog.published ? '#4ade80' : '#fbbf24', fontSize: '.75rem', fontWeight: 800 }}>{blog.published ? 'LIVE' : 'DRAFT'}</span><h2 style={{ margin: '3px 0 4px', fontSize: '1.35rem' }}>{blog.id ? 'Edit article' : 'Create article'}</h2><p style={{ margin: 0, color: '#94a3b8', fontSize: '.83rem' }}>One entry publishes to both websites. Peptidescostarica.net is the canonical search result.</p></div>
        <div role="tablist" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>{tabs.map(([id, text]) => <button key={id} type="button" onClick={() => setTab(id)} className="admin-btn" style={{ background: tab === id ? '#2563eb' : '#172237', color: '#fff' }}>{text}</button>)}</div>
        <form onSubmit={onSave} style={{ display: 'grid', gap: 16 }}>
          {tab === 'content' ? <><div style={grid}><Field title="English URL slug" hint="Keep this stable after publishing."><input required value={blog.slug || ''} onChange={(e) => setBlog((current) => ({ ...current, slug: slugify(e.target.value), _slugAuto: false }))} style={input} /></Field><Field title="Spanish URL slug"><input required value={blog.slug_es || ''} onChange={(e) => setBlog((current) => ({ ...current, slug_es: slugify(e.target.value), _slugEsAuto: false }))} style={input} /></Field></div><div style={grid}><LanguageFields lang="EN" {...bodyProps} /><LanguageFields lang="ES" {...bodyProps} /></div></> : null}
          {tab === 'seo' ? <div style={grid}><SeoFields lang="EN" blog={blog} update={update} aiBusy={aiBusy} runAi={runAi} /><SeoFields lang="ES" blog={blog} update={update} aiBusy={aiBusy} runAi={runAi} /></div> : null}
          {tab === 'publish' ? <><div style={grid}><FaqEditor lang="English" langKey="en" blog={blog} value={blog.faq_en} update={(value) => update('faq_en', value)} aiBusy={aiBusy} runAi={runAi} /><FaqEditor lang="Spanish" langKey="es" blog={blog} value={blog.faq_es} update={(value) => update('faq_es', value)} aiBusy={aiBusy} runAi={runAi} /></div><div style={{ ...panel, display: 'grid', gap: 14 }}><div style={grid}><Field title="Author"><input value={blog.author_name || ''} onChange={(e) => update('author_name', e.target.value)} style={input} /></Field><Field title="Category"><input value={blog.category || ''} onChange={(e) => update('category', e.target.value)} style={input} /></Field><Field title="Tags" hint="Comma-separated"><input value={(blog.tags || []).join(', ')} onChange={(e) => update('tags', e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean))} style={input} /></Field></div><Field title="Cover image"><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><input value={blog.image_url || ''} onChange={(e) => update('image_url', e.target.value)} placeholder="https://…" style={{ ...input, flex: '1 1 300px' }} /><input type="file" accept="image/*" id="blogImageUpload" onChange={onImageUpload} hidden /><button type="button" className="admin-btn admin-btn-primary" onClick={() => document.getElementById('blogImageUpload')?.click()}><Upload size={14} /> Upload</button></div><select value={bucketImages.some((image) => image.url === blog.image_url) ? blog.image_url : ''} onChange={(e) => update('image_url', e.target.value)} style={{ ...input, marginTop: 8 }}><option value="">Select an uploaded image…</option>{bucketImages.map((image) => <option key={image.name} value={image.url}>{image.name}</option>)}</select>{blog.image_url && blog.image_url !== 'Uploading...' ? <img src={blog.image_url} alt="" style={{ marginTop: 10, maxHeight: 150, borderRadius: 8, border: '1px solid rgba(255,255,255,.1)' }} /> : null}</Field><div><span style={label}>Public previews</span><div style={{ display: 'grid', gap: 5, fontSize: '.8rem' }}><a href={preview.en} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>{preview.en} <ExternalLink size={12} /></a><a href={preview.es} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>{preview.es} <ExternalLink size={12} /></a></div></div><label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, background: 'rgba(255,255,255,.05)', cursor: 'pointer' }}><input type="checkbox" checked={Boolean(blog.published)} onChange={(e) => update('published', e.target.checked)} style={{ transform: 'scale(1.25)' }} /><span><b style={{ color: blog.published ? '#4ade80' : '#f8fafc' }}>{blog.published ? 'Publish on both websites' : 'Keep as draft'}</b><small style={{ display: 'block', color: '#94a3b8', marginTop: 2 }}>{blog.published ? 'Saving makes this visible to customers.' : 'Only staff can see it in this CMS.'}</small></span></label></div></> : null}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', position: 'sticky', bottom: -20, background: '#0e1626', padding: '14px 0 4px', borderTop: '1px solid rgba(255,255,255,.08)' }}><button type="button" className="admin-btn" onClick={onClose}><X size={15} /> Cancel</button><button type="submit" disabled={saving} className="admin-btn admin-btn-primary"><Save size={15} /> {saving ? 'Saving…' : blog.published ? 'Save and publish' : 'Save draft'}</button></div>
        </form>
      </div>
    </div>
  );
}
