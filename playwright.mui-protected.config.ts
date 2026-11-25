import {defineConfig} from '@playwright/test';
import {demoLoginOtpCompletedState} from './tests/e2e/demo-login-test-state';
const snapshots=process.env.MUI_SNAPSHOT_DIR;
if(!snapshots)throw new Error('MUI_SNAPSHOT_DIR required');
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'mui-v4-protected-home.spec.ts',
 timeout:150000,expect:{timeout:15000},workers:2,retries:0,reporter:'list',
 snapshotPathTemplate:snapshots+'/{projectName}/{arg}{ext}',
 use:{baseURL:'http://127.0.0.1:4173',browserName:'chromium',reducedMotion:'reduce',storageState:demoLoginOtpCompletedState,trace:'retain-on-failure'},
 projects:[320,375,768,1280,1920].map(width=>({name:'width-'+width,use:{viewport:{width,height:width<768?812:900}}})),
 webServer:{command:'npm run preview -- --port=4173 --host=127.0.0.1',url:'http://127.0.0.1:4173',timeout:60000,reuseExistingServer:false}
});
