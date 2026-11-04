import Link from 'next/link';
export default function Brand({ href = '/' }: { href?: string }) {
  return <Link href={href} className="brand-wordmark" aria-label="AI Web Design Firm home"><span aria-hidden="true" className="brand-symbol"><span /><span /><span /></span><span>AI Web Design<span className="brand-wordmark-light"> Firm</span></span></Link>;
}
