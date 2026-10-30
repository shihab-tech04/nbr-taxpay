import test from 'node:test';
import assert from 'node:assert/strict';
import {beneficiaryTemplate} from '../src/services/beneficiaryExcel';

test('beneficiary XLSX template has correct ZIP offsets and exactly two column headers', async()=>{
  const bytes=new Uint8Array(await beneficiaryTemplate().arrayBuffer());
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const u16=(offset:number)=>view.getUint16(offset,true);
  const u32=(offset:number)=>view.getUint32(offset,true);
  let eocd=-1;
  for(let i=bytes.length-22;i>=0;i--){if(u32(i)===0x06054b50){eocd=i;break;}}
  assert.ok(eocd>0,'ZIP end record');
  const count=u16(eocd+10),size=u32(eocd+12),start=u32(eocd+16);
  assert.equal(count,5);
  assert.equal(start+size,eocd);
  let pos=start;
  const parts=new Map<string,string>();
  for(let i=0;i<count;i++){
    assert.equal(u32(pos),0x02014b50);
    const nameLength=u16(pos+28),extraLength=u16(pos+30),commentLength=u16(pos+32),localOffset=u32(pos+42);
    const name=new TextDecoder().decode(bytes.subarray(pos+46,pos+46+nameLength));
    assert.equal(u32(localOffset),0x04034b50);
    const dataOffset=localOffset+30+u16(localOffset+26)+u16(localOffset+28);
    const dataLength=u32(pos+20);
    parts.set(name,new TextDecoder().decode(bytes.subarray(dataOffset,dataOffset+dataLength)));
    pos+=46+nameLength+extraLength+commentLength;
  }
  assert.equal(pos,eocd);
  assert.ok(parts.has('[Content_Types].xml'));
  assert.ok(parts.get('xl/worksheets/sheet1.xml')?.includes('<t>TIN</t>'));
  assert.ok(parts.get('xl/worksheets/sheet1.xml')?.includes('<t>User Name</t>'));
  assert.equal(parts.get('xl/worksheets/sheet1.xml')?.includes('<f>'),false);
});
