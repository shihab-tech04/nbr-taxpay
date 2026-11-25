import {useRef, useState} from 'react';
import {useTaxState} from '../../services/taxState';
import {useAccountIdentity} from '../../services/accountIdentity';
import {PublicHelpChat} from '../layout/PublicHelpChat';
import {copy} from './home2/i18n';
import {useMediaQuery, type Home2Action} from './home2/shared';
import {DesktopView} from './home2/views/DesktopView';
import {MobileView} from './home2/views/MobileView';
import './home2.css';

type Props = {onSearch: (reference:string)=>void; onOtherTax:()=>void; sliderPaused:boolean};
export function Home2Layout({onSearch,onOtherTax,sliderPaused}:Props){
  const {language,setLanguage,navigate,openAllTaxPayments,previewAccount}=useTaxState();
  const {user}=useAccountIdentity();
  const signedIn=Boolean(user||previewAccount);
  const desktop=useMediaQuery('(min-width: 960px)');
  const [helpRequest,setHelpRequest]=useState(0);
  const helpTrigger=useRef<HTMLElement|null>(null);
  const onAction=(action:Home2Action)=>{
    const origin={fromHome2:true};
    switch(action){
      case 'home': navigate('home-2'); break;
      case 'original': navigate('landing'); break;
      case 'pay': openAllTaxPayments(); break;
      case 'other': onOtherTax(); break;
      case 'login': navigate(signedIn?'taxpayer_home':'taxpayer_login',origin); break;
      case 'guide': navigate('user_guide'); break;
      case 'report': navigate('incident'); break;
      case 'help': helpTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setHelpRequest(n=>n+1);break;
      case 'certificates': navigate(signedIn?'certificates':'verify',origin);break;
      case 'history': case 'again': navigate('history',origin);break;
      case 'drafts': navigate('taxpayer_home',origin);break;
      case 'corrections': navigate('corrections',origin);break;
      case 'status': navigate('verify',origin);break;
      case 'receipts': navigate('user_guide',{category:'records'});break;
      case 'security': navigate('user_guide',{category:'security'});break;
      case 'nbr': window.open('https://nbr.gov.bd/','_blank','noopener,noreferrer');break;
    }
  };
  const View=desktop?DesktopView:MobileView;
  return <div data-testid="home2-root" data-design="uploaded-mobile-bento" data-viewport={desktop?'desktop':'mobile'} className="home2-import-root" lang={language}>
    <div data-home2-view><View c={copy[language]} onToggleLang={()=>setLanguage(language==='en'?'bn':'en')} onAction={onAction} onSearch={onSearch} signedIn={signedIn} sliderPaused={sliderPaused}/></div>
    <PublicHelpChat externalOpenRequest={helpRequest} externalTrigger={helpTrigger} hideLauncher/>
  </div>;
}
