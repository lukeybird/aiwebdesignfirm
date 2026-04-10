/**
 * Shared visual tokens for aiWebDF marketing surfaces (home, /book, etc.).
 */
export type ContactTheme = {
  sectionBg: string;
  sectionBorder: string;
  blurTop: string;
  blurBottom: string;
  radial: string;
  leftFeatureShell: string;
  leftFeatureShadowHover: string;
  leftFeatureIcon: string;
  leftFeatureText: string;
  formGlowMotion: string;
  formGlowStatic: string;
  formCard: string;
  formBlobTL: string;
  formBlobBR: string;
  divider: string;
  formHeaderSub: string;
  label: string;
  input: string;
  error: string;
  submit: string;
  successRing: string;
  successTitle: string;
  successSub: string;
  successBtn: string;
  successIcon: string;
};

export const CONTACT_SECTION_THEME: ContactTheme = {
  sectionBg: 'bg-gradient-to-b from-[#050a14] via-[#070d18] to-[#0a0a0f]',
  sectionBorder: 'border-[#0066ff]/25',
  blurTop: 'bg-[#0066ff]/28',
  blurBottom: 'bg-[#00d4ff]/20',
  radial: 'bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(0,102,255,0.2),transparent)]',
  leftFeatureShell:
    'bg-gradient-to-br from-[#0066ff]/35 to-[#00d4ff]/18 border border-[#00d4ff]/35',
  leftFeatureShadowHover:
    'shadow-[0_0_20px_-6px_rgba(0,102,255,0.5)] group-hover:shadow-[0_0_28px_-4px_rgba(0,212,255,0.45)]',
  leftFeatureIcon: 'text-[#7dd3fc]',
  leftFeatureText: 'text-cyan-100/85',
  formGlowMotion: 'bg-gradient-to-b from-[#0066ff]/40 via-[#00d4ff]/28 to-[#0052cc]/15',
  formGlowStatic: 'bg-gradient-to-br from-[#0066ff]/22 via-[#00d4ff]/12 to-transparent',
  formCard:
    'bg-gradient-to-b from-[#0a1525] via-[#060d18] to-[#050810] border-2 border-[#0066ff]/60 shadow-[0_0_64px_-10px_rgba(0,102,255,0.45),0_0_28px_-10px_rgba(0,212,255,0.25)] ring-1 ring-[#00d4ff]/22',
  formBlobTL: 'bg-[#00d4ff]/12',
  formBlobBR: 'bg-[#0066ff]/18',
  divider: 'bg-gradient-to-r from-transparent via-[#00d4ff]/35 to-transparent',
  formHeaderSub: 'text-[#7dd3fc]/90',
  label: 'text-[#a5f3fc]/90',
  input:
    'bg-black/50 border-[#0066ff]/35 text-white text-base placeholder:text-cyan-200/20 h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-[#00d4ff]/70 focus-visible:border-[#00d4ff]/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
  error: 'text-cyan-200',
  submit:
    'w-full h-14 rounded-xl text-lg font-black uppercase tracking-wide bg-gradient-to-r from-[#0066ff] to-[#00d4ff] hover:from-[#0052cc] hover:to-[#00bfff] text-black shadow-[0_0_40px_-6px_rgba(0,212,255,0.75),0_0_20px_-8px_rgba(0,102,255,0.4)] border border-[#00d4ff]/35 hover:scale-[1.01] active:scale-[0.99] transition-all duration-500 disabled:opacity-60 disabled:hover:scale-100',
  successRing:
    'bg-gradient-to-br from-[#00d4ff]/28 to-[#0066ff]/28 border border-[#00d4ff]/45',
  successTitle:
    'text-transparent bg-clip-text bg-gradient-to-r from-white to-[#a5f3fc]',
  successSub: 'text-cyan-200/60',
  successBtn:
    'border-[#00d4ff]/40 text-cyan-200 hover:bg-[#061428]/55 hover:text-white',
  successIcon: 'text-[#00d4ff]',
};

export const SECTION_GUTTER_X = 'px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20';
export const SECTION_PAD_Y = 'py-20 sm:py-24 md:py-28';
export const FOOTER_PAD_Y = 'py-16 sm:py-20 md:py-24';
export const TYPE_SECTION_TITLE =
  'text-3xl sm:text-4xl md:text-5xl font-bold font-heading tracking-tight';
export const TYPE_BODY = 'text-base sm:text-lg leading-relaxed text-gray-400';
export const FORM_LABEL =
  'text-xs sm:text-sm font-bold uppercase tracking-[0.12em] block mb-2 transition-colors duration-500';
export const FORM_BRAND_TITLE =
  'text-xl sm:text-2xl md:text-3xl font-black font-heading tracking-tight text-white';
export const FORM_BRAND_SUB =
  'text-xs sm:text-sm font-bold uppercase tracking-[0.18em] mt-0.5 transition-colors duration-500';
export const TYPE_META = 'text-xs sm:text-sm font-medium tracking-wide';
