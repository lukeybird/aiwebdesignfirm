import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { GET as getBilling } from '@/app/api/billing/route';
import WorkspaceNav from '@/components/auth/WorkspaceNav';
import Builder from './Builder';
export const metadata={title:'Website builder',robots:{index:false,follow:false}};
export default async function BuilderPage(){
 if(!(await auth())?.user?.id)redirect('/login');
 const billing=await(await getBilling()).json();
 return <main className="brand-shell"><WorkspaceNav/><Builder canBuild={Boolean(billing.hasAccess)}/></main>;
}
