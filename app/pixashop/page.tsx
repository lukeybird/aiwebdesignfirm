import { GET as billing } from '@/app/api/billing/route';
export const metadata={title:'PixaShop — by AIWebDesignFirm',description:'A desktop workspace for layered image editing.'};
export default async function Page() {
  const result=await billing();const access=result.ok && (await result.json()).hasAccess;
  const enabled=process.env.PIXASHOP_ENABLED==='true';
  return <main style={{maxWidth:960,margin:'70px auto',padding:28}}>
    <a href="/">AIWebDesignFirm</a><h1 style={{fontSize:'clamp(48px,8vw,88px)',letterSpacing:'-.06em'}}>PixaShop</h1><p>by AIWebDesignFirm</p>
    <p style={{fontSize:22}}>Your desktop workspace for layers, masks, photo edits and original designs.</p>
    <p>Based on PhotoCraft. This first release is being prepared and tested.</p>
    {enabled && access?<section><h2>Download your desktop app</h2>{[['mac','macOS — Apple Silicon and Intel'],['windows','Windows — 64-bit portable'],['linux','Linux — 64-bit']].map(([id,label])=><p key={id}><a href={'/api/pixashop/download?platform='+id}>{label}</a></p>)}<p><a href="/pixashop/activate">Activate a device</a></p></section>:<section><h2>{enabled?'Start with your account':'Desktop downloads are being prepared'}</h2><p>{enabled?'An active trial or subscription unlocks the desktop app.':'Installers are not available yet. Activation opens after the first release is verified.'}</p>{enabled&&<a href="/start">Start your 7-day trial</a>}</section>}
    <h2>Updates included</h2><p>The desktop checks for PixaShop releases. When an update is available, save your work and download the new installer.</p><p><a href="/settings">Manage billing</a> · <a href="/pixashop/activate">Device access</a></p><small>by AIWebDesignFirm</small>
  </main>;
}
