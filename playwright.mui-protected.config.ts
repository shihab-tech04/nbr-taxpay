import {defineConfig} from '@playwright/test';
import {demoLoginOtpCompletedState} from './tests/e2e/demo-login-test-state';
const snapshots=process.env.MUI_SNAPSHOT_DIR;
const baselineDir=process.env.MUI_BASELINE_DIR;
if(!snapshots||!baselineDir)throw new Error('Exact Main build directory and snapshot directory required');
const storageState={...demoLoginOtpCompletedState,origins:[
 ...demoLoginOtpCompletedState.origins,
 ...demoLoginOtpCompletedState.origins.map(origin=>({...origin,origin:'http://127.0.0.1:4174'}))
]};
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'mui-v4-protected-home.spec.ts',
 timeout:240000,expect:{timeout:20000},workers:2,retries:0,reporter:'list',
 snapshotPathTemplate:snapshots+'/{projectName}/{arg}{ext}',
 use:{baseURL:'http://127.0.0.1:4173',browserName:'chromium',
 launchOptions:{args:['--disable-gpu','--disable-lcd-text','--disable-font-subpixel-positioning','--disable-skia-runtime-opts','--font-render-hinting=none','--force-color-profile=srgb','--num-raster-threads=1']},
 deviceScaleFactor:1,timezoneId:'Asia/Dhaka',reducedMotion:'reduce',storageState,trace:'retain-on-failure'},
 projects:[320,375,768,1280,1920].map(width=>({name:'width-'+width,use:{viewport:{width,height:width<768?812:900}}})),
 webServer:[
  {command:'npm run preview -- --port=4173 --host=127.0.0.1',url:'http://127.0.0.1:4173',timeout:60000,reuseExistingServer:false},
  {command:'npm run preview -- --port=4174 --host=127.0.0.1',cwd:baselineDir,url:'http://127.0.0.1:4174',timeout:60000,reuseExistingServer:false}
 ]
});
