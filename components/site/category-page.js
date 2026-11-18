import Link from 'next/link';
import CopyBlock from '@/components/site/copy-block';
import ListViewEvent from '@/components/site/list-view-event';
import Faq from '@/components/site/faq';
import ProductGrid from '@/components/site/product-grid';
import { CategoryTiles } from '@/components/site/blocks';
import { fromPrice } from '@/lib/site/data';
import { formatMoney, translator } from '@/lib/storefront/i18n.mjs';
import Breadcrumbs from '@/components/site/breadcrumbs';
import JsonLd from '@/components/site/json-ld';
import { SITE_URL } from '@/lib/indexing';
import { collectionNodes, faqNode } from '@/lib/site/structured-data.mjs';

/**
 * The prototype's category view (`catHTML`, "CATEGORY PAGES: SEO + CRO"):
 * header with the category's stats, the compounds in it, a bulk nudge,
 * buying notes and the promise, an FAQ, then the other categories. The live
 * page's own copy follows, so each URL keeps the words it ranks for.
 */

/** The prototype's per-category copy: what it is, what it is used for, its lead compound. */
const CATCOPY = {
  'peptides-for-weight-loss': ['Metabolic research compounds, including GLP-1 receptor agonists, dual and triple agonists and AMPK-pathway compounds, studied in models of energy balance and glucose regulation.', 'Popular for: incretin and receptor-binding research, comparative agonist studies, metabolic pathway models.', 'GLP-1 (retatrutide)'],
  'peptides-for-muscle-growth': ['Growth hormone secretagogues and GHRH analogues used in research on the GH axis, pulsatile release and receptor signalling.', 'Popular for: GHRH vs ghrelin-mimetic comparisons, combination studies, pulsatility models.', 'Tesamorelin'],
  'peptides-for-healing': ['Peptides studied in tissue repair, cell migration and angiogenesis models, from the gastric pentadecapeptide BPC-157 to thymosin beta-4 and its fragments.', 'Popular for: in-vitro migration assays, comparative TB-4 / TB-500 work, combination models.', 'BPC-157'],
  'peptides-for-skin': ['Copper peptides, signal peptides and antioxidants used in dermatological and cosmetic science research.', 'Popular for: collagen synthesis assays, copper-complex chemistry, formulation research.', 'GHK-Cu'],
  'copper-peptides': ['Copper-binding tripeptides and blends, led by GHK-Cu, the most studied copper peptide in the literature.', 'Popular for: copper-complex research, matrix and collagen assays, cosmetic formulation science.', 'GHK-Cu'],
  'collagen-peptides-costa-rica': ['Peptides used in research on collagen synthesis and extracellular matrix, including copper peptides and signal peptides.', 'Popular for: fibroblast assays, matrix remodelling research, formulation work.', 'GHK-Cu'],
  'peptides-for-anti-aging': ['Short bioregulator peptides, many first characterised in Russian research, studied for their effects on gene expression and tissue-specific signalling.', 'Popular for: telomerase research (Epithalon), thymic peptide studies, tissue-specific bioregulation models.', 'Epithalon'],
  'peptides-for-energy': ['Mitochondria-targeted peptides and coenzymes studied in cellular energy, oxidative stress and metabolic research.', 'Popular for: mitochondrial respiration assays, oxidative stress models, NAD+ metabolism research.', 'NAD+'],
  'peptide-for-cognitive-function': ['Neuropeptides and synthetic analogues studied in models of stress response, neurotrophic signalling and cognition.', 'Popular for: anxiolytic-model research (Selank), BDNF signalling (Semax), neuropeptide comparisons.', 'Selank'],
  'peptides-for-sleep': ['Neuropeptides studied in sleep architecture and circadian research, including delta sleep-inducing peptide (DSIP).', 'Popular for: sleep-stage models, circadian signalling research.', 'DSIP'],
  'peptide-for-cardiovascular-costa-rica': ['Mitochondria-targeted and vasoactive peptides studied in cardiovascular and endothelial research models.', 'Popular for: mitochondrial cardioprotection models (SS-31), vasoactive signalling (VIP).', 'SS-31'],
  'peptides-for-fertility': ['Reproductive signalling peptides and gonadotropins used in endocrine research on the HPG axis.', 'Popular for: kisspeptin signalling, gonadotropin research, melanocortin receptor studies.', 'Kisspeptin-10'],
  'hgh-human-growth-hormone': ['Somatropin and IGF-1 analogues for research on the growth hormone / IGF-1 axis.', 'Popular for: GH receptor signalling, IGF-1 pathway research.', 'HGH'],
  'peptides-for-bac-water': ['Bacteriostatic and sterile waters for reconstituting lyophilised research peptides.', 'Popular for: reconstitution of any lyophilised compound in our catalog.', 'BAC Water'],
};

/** WooCommerce category slugs whose marketing category has another slug. */
const WOO_TO_CATEGORY = {
  'bac-water': 'peptides-for-bac-water',
  'peptide-reconstitution': 'peptides-for-bac-water',
  'collagen-peptides': 'collagen-peptides-costa-rica',
  'peptide-for-cardiovascular': 'peptide-for-cardiovascular-costa-rica',
};

/** The marketing category a category URL slug shows. */
export function categorySlugFor(slug) {
  return WOO_TO_CATEGORY[slug] || slug;
}

export default function CategoryPage({ lang, site, category, h1, copy, page }) {
  const t = translator(lang);
  const { links, categories, exchangeRate } = site;
  const name = t(category.name);
  const lower = name.toLowerCase();
  const [what, popular, lead] = CATCOPY[category.slug] || ['', '', ''];
  const compounds = category.compounds;
  const min = compounds.length
    ? Math.min(...compounds.map((compound) => fromPrice(compound).usd))
    : 0;
  const fromLabel = formatMoney(Math.round(min * exchangeRate), min, 'CRC');
  const faq = [
    [`What are ${lower}?`, what],
    [`How much do ${lower} cost in Colombia?`, `From ${fromLabel} per vial. 15% off 5+ vials and 20% off 10+ of the same product, applied automatically.`],
    ['Are these products tested?', 'Yes. Most products are tested by an independent laboratory before sale, and their Certificates of Analysis are published in our COA database.'],
    ['How fast is delivery?', '2–4 days anywhere in Colombia, from our own cold storage. No customs or import fees.'],
    ['Do you provide dosing information?', 'No. These products are supplied for laboratory research only. We don\'t provide dosing, protocols or medical advice.'],
  ].filter(([, answer]) => answer);
  const shownFaq = faq.map(([q, a]) => [t(q), t(a)]);
  const blocks = copy?.blocks || [];
  // This page's own URL (a category has a marketing and a WooCommerce URL).
  const url = (lang === 'es' ? page?.es : page?.en) || category.href;

  return (
    <div id="cat">
      <JsonLd
        nodes={[
          collectionNodes({ base: SITE_URL, url, name: h1, description: what ? t(what) : undefined, lang, products: compounds }),
          faqNode({ base: SITE_URL, url, lists: [shownFaq, ...blocks.map((block) => block.faq || [])] }),
        ]}
      />
      <section className="chead">
        <div className="wrap">
          <Breadcrumbs
            label={t('Breadcrumb')}
            url={url}
            items={[{ name: t('Home'), href: links.home }, { name: t('Categories'), href: links.shop }, { name }]}
          />
          <div className="chg">
            <div>
              <span className="ms big" aria-hidden="true">{category.icon}</span>
              <h1>{h1}</h1>
              <p>{`${t(what)} ${t(`${compounds.length} compounds in local stock, each with a batch Certificate of Analysis, delivered in 2–4 days.`)}`}</p>
              <small>{t(popular)}</small>
            </div>
            <div className="chstats">
              <div><b>{compounds.length}</b><small>{t('in stock')}</small></div>
              <div><b>{fromLabel}</b><small>{t('from, per vial')}</small></div>
              <div><b>−20%</b><small>{t('on 10+ vials')}</small></div>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap">
        <div className="cbar">
          <span><span className="ms">lab_profile</span>{t('COA on most products')}</span>
          <span><span className="ms">ac_unit</span>{t('Stored at 2–8 °C')}</span>
          <span><span className="ms">local_shipping</span>{t('2–4 day delivery')}</span>
          <span><span className="ms">redeem</span>{t('Free BAC Water')}</span>
        </div>

        <ListViewEvent listName={category.name || h1} compounds={compounds} />
        <ProductGrid compounds={compounds} id="cgrid" />

        <div className="midcta wide">
          <span className="ms">sell</span>
          <div>
            <b>{t(`Stocking up on ${lower}?`)}</b>
            <small>{t('15% off 5+ vials, 20% off 10+ of the same product. Applied automatically.')}</small>
          </div>
          <Link className="btn sm" href={links['bulk-discounts']}>{t('See savings')}</Link>
        </div>

        <section className="psec">
          <div className="split">
            <div className="prose">
              <h2 className="h2">{t(`Buying ${lower} in Colombia`)}</h2>
              <p>{t('Every compound in this category is held in local stock in Colombia, so there\'s no customs delay and no import fee. Vials are lyophilised (or liquid, where stated), stored at 2–8 °C on site from arrival to dispatch, and shipped with tracking in 2–4 days.')}</p>
              <p>
                {t('Most products are independently tested before sale. You\'ll find their Certificates of Analysis in our')}{' '}
                <Link href={links['lab-tests-coa-results']} style={{ textDecoration: 'underline' }}>{t('COA database')}</Link>
                {t(', and we\'ll send the COA for your exact batch on request.')}
              </p>
              {lead ? <p>{t('Most-ordered in this category:')} <b>{lead}</b>.</p> : null}
            </div>
            <div className="guar">
              <span className="ms f">workspace_premium</span>
              <div>
                <b>{t('The Peptidos Colombia promise')}</b>
                <p>{t('Every vial is stored cold and delivered fast. If a vial arrives damaged or doesn\'t match your order, tell us within 7 days with a photo and we replace it. No arguments.')}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="psec">
          <h2>{t(`${name} FAQ`)}</h2>
          <Faq items={shownFaq} />
        </section>

        {blocks.map((block) => (
          <CopyBlock block={block} t={t} lang={lang} key={block.title || block.paras[0]} />
        ))}

        <section className="psec">
          <h2>{t('Explore other categories')}</h2>
          <CategoryTiles categories={categories} t={t} />
        </section>
        <p className="disc">{t('For laboratory research use only. Not for human or veterinary use.')}</p>
      </div>
    </div>
  );
}
