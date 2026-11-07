import { auth } from '@/auth';
import Activate from './Activate';
export const metadata={title:'Activate PixaShop — AIWebDesignFirm'};
export default async function Page() {
  const user=(await auth())?.user;
  return <main style={{maxWidth:620,margin:'80px auto',padding:24}}><a href="/pixashop">PixaShop</a><h1>Activate your desktop</h1>{user?<Activate/>:<p><a href="/login?callbackUrl=%2Fpixashop%2Factivate">Sign in to activate PixaShop</a></p>}<p><a href="/settings">Manage subscription</a></p><small>by AIWebDesignFirm</small></main>;
}
