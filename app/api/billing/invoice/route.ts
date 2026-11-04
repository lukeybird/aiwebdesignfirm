import { auth } from '@/auth';
import { customerForUser, stripeRequest } from '@/lib/stripe-billing';
export async function GET(request: Request) {
  const user = (await auth())?.user;
  if (!user?.id) return new Response('Sign in required.', { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !/^in_[A-Za-z0-9]+$/.test(id)) return new Response('Invalid invoice.', { status: 400 });
  try {
    const customer = await customerForUser(user.id);
    const invoice = await stripeRequest<{ customer: string; invoice_pdf: string | null }>('invoices/' + id);
    if (!customer || invoice.customer !== customer) return new Response('Invoice not found.', { status: 404 });
    if (!invoice.invoice_pdf) return new Response('Invoice PDF not available.', { status: 404 });
    const url = new URL(invoice.invoice_pdf);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.stripe.com')) return new Response('Invoice unavailable.', { status: 502 });
    const pdf = await fetch(url, { cache: 'no-store', redirect: 'error' });
    if (!pdf.ok) return new Response('Invoice unavailable.', { status: 502 });
    return new Response(pdf.body, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="invoice-' + id + '.pdf"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new Response('Could not download invoice.', { status: 502 }); }
}
