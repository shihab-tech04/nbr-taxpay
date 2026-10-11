import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const sha=(f:string)=>createHash('sha256').update(readFileSync(f)).digest('hex');
const paths={
  "src/components/office-ui/auth/LoginSlide.tsx": "03c76f0df6ffaa2cd8e12b2a43c68362c2b12f34d5f1ac36da01606799b233d4",
  "src/components/office-ui/auth/LoginSlider.tsx": "5978cd9baa426da73ac2f47a82554f98eaf7f898b22f3c540659e1c40fc088cd",
  "src/components/office-ui/auth/LoginBrandPanel.tsx": "ffe3d2950b313f763527a7af377432db271397cde90bae584815a57d5bf76f63",
  "public/office-auth/office-slide-file-returns.png": "152e2d3a9898eb09b40b50e7a80271369e7335aa1dfaffa4d02c3623bebc611b",
  "public/office-auth/office-slide-track-approvals.png": "182945fe662303201ac3b86b18f225dcba4d8791aa58b547d973d34a614c4eaf",
  "public/office-auth/office-slide-stay-updated.png": "4d1b980858de69c33ddda886c39828bc7f2df55a593d11b1e60a5a2939d6673a"
};
test('Office source login components and artwork are byte-identical to recovered 8a952327',()=>{
 for(const [path,expected] of Object.entries(paths))assert.equal(sha(path),expected,`source drift: ${path}`);
});
