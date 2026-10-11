import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const sha=(f:string)=>createHash('sha256').update(readFileSync(f)).digest('hex');
const paths={
  "src/components/office-ui/forms/AppTextField.tsx": "7c6a700bc4665115edf10afd2b439a9d867e2a8369994cb3975286b6af103aab",
  "src/components/office-ui/forms/AppPasswordField.tsx": "ea812d52fe05b68da8b5438bf92b6cd355a272446730cab18382164d82b92a27",
  "src/components/office-ui/forms/AppCheckbox.tsx": "d0f249c25e319fd93779cecd6f566dcaf1bed3f87961c5298ae5f6952eeb5633",
  "src/components/office-ui/forms/muiFieldSx.ts": "702c5dd5db3e9918e6a68fa40d17b1499cca7432c0e5a196099ef26b78e24f27"
};
test('Office MUI form controls are byte-identical to recovered source commit',()=>{
 for(const [path,expected] of Object.entries(paths))assert.equal(sha(path),expected,`form source drift ${path}`);
});
