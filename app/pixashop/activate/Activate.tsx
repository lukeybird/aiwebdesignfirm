'use client';
import { useState } from 'react';
export default function Activate() {
  const [code,setCode]=useState(''); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);
  async function action(name:string) {
    setBusy(true); setMessage('');
    try {
      const r=await fetch('/api/pixashop/device',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:name,code})});
      const data=await r.json();setMessage(data.message || 'Please try again.');
    } catch {setMessage('Connection failed. Please try again.');} finally {setBusy(false);}
  }
  return <div>
    <form onSubmit={e=>{e.preventDefault();void action('activate');}}>
      <label htmlFor="device-code">Code shown in your PixaShop application</label>
      <input id="device-code" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} maxLength={14} required style={{display:'block',padding:12,margin:'12px 0',color:'#172521',border:'1px solid #aaa',borderRadius:8}} />
      <p>Only approve a code displayed on a device you control. This connects that device to your subscription.</p>
      <button disabled={busy} type="submit" style={{padding:12,margin:'16px 0',background:'#172e38',color:'white',borderRadius:8}}>{busy?'Checking…':'Activate this device'}</button>
    </form>
    <p role="status">{message}</p>
    <details style={{marginTop:32}}><summary>Device access</summary><p>Sign out all your PixaShop installations. You can activate your own devices again afterward.</p><button disabled={busy} onClick={()=>void action('revoke-all')}>Sign out all devices</button></details>
  </div>;
}
