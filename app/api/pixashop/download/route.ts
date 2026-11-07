import { GET as billing } from '@/app/api/billing/route';
import { PIXASHOP_RELEASES, releaseAsset } from '@/lib/pixashop';
export async function GET(request: Request) {
  const no = (message: string, status: number) => Response.json({message}, {status, headers:{'Cache-Control':'no-store'}});
  if (process.env.PIXASHOP_ENABLED !== 'true') return no('PixaShop downloads are not available yet.',503);
  const access = await billing();
  if (!access.ok || !(await access.json()).hasAccess) return no('Sign in with an active trial or subscription to download PixaShop.',403);
  try {
    const response = await fetch(PIXASHOP_RELEASES, {headers:{Accept:'application/vnd.github+json','User-Agent':'PixaShop'},cache:'no-store',signal:AbortSignal.timeout(10_000)});
    if (!response.ok) return no('No verified PixaShop release is available yet.',503);
    const release = await response.json();
    if (release.draft || release.prerelease) return no('No stable PixaShop release is available yet.',503);
    const asset = releaseAsset(release.assets ?? [],new URL(request.url).searchParams.get('platform') ?? '');
    if (!asset) return no('A download for this platform is not available yet.',404);
    return new Response(null,{status:303,headers:{Location:asset.browser_download_url,'Cache-Control':'no-store'}});
  } catch { return no('Downloads are temporarily unavailable.',503); }
}
