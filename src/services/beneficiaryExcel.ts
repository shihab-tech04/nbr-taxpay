/** Browser XLSX read/write for the two-column beneficiary template.
 * No scripts, macros, CSV, external parser, executable formulas or network dependencies.
 */
export interface SpreadsheetRecord { tin:string; name:string; sourceRow:number; }
const enc=new TextEncoder();
function u16(a:Uint8Array,o:number){return a[o]|(a[o+1]<<8);}
function u32(a:Uint8Array,o:number){return (a[o]|(a[o+1]<<8)|(a[o+2]<<16)|(a[o+3]<<24))>>>0;}
function little16(v:number){return [v&255,(v>>>8)&255];}
function little32(v:number){return [v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];}
function utf8(s:string){return enc.encode(s);}
function xml(s:string){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function crc32(bytes:Uint8Array) {
  let crc=0xffffffff;
  for (const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function zipStored(files:{name:string;content:string}[]):Blob {
  const pieces:Uint8Array[]=[];const directory:Uint8Array[]=[];let offset=0;
  for(const f of files){
    const name=utf8(f.name),data=utf8(f.content),crc=crc32(data);
    const local=Uint8Array.from([...little32(0x04034b50),...little16(20),...little16(0),...little16(0),0,0,0,0,...little32(crc),...little32(data.length),...little32(data.length),...little16(name.length),0,0,...name]);
    pieces.push(local,data);
    directory.push(Uint8Array.from([...little32(0x02014b50),20,0,20,0,0,0,0,0,0,0,0,0,...little32(crc),...little32(data.length),...little32(data.length),...little16(name.length),0,0,0,0,0,0,0,0,0,0,0,0,...little32(offset),...name]));
    offset+=local.length+data.length;
  }
  const central=directory.reduce((sum,b)=>sum+b.length,0);
  const end=Uint8Array.from([...little32(0x06054b50),0,0,0,0,...little16(files.length),...little16(files.length),...little32(central),...little32(offset),0,0]);
  return new Blob([...pieces,...directory,end] as BlobPart[],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export function beneficiaryTemplate():Blob {
  return zipStored([
    {name:'[Content_Types].xml',content:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},
    {name:'_rels/.rels',content:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name:'xl/workbook.xml',content:'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Beneficiaries" sheetId="1" r:id="rId1"/></sheets></workbook>'},
    {name:'xl/_rels/workbook.xml.rels',content:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name:'xl/styles.xml',content:'<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/></cellXfs></styleSheet>'},
    {name:'xl/worksheets/sheet1.xml',content:'<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="20" customWidth="1" style="1"/></cols><sheetData><row r="1"><c r="A1" s="1" t="inlineStr"><is><t>'+xml('TIN')+'</t></is></c><c r="B1" t="inlineStr"><is><t>'+xml('User Name')+'</t></is></c></row></sheetData></worksheet>'},
  ]);
}
function parseXml(s:string):Document {
  const xmlDoc=new DOMParser().parseFromString(s,'application/xml');
  if(xmlDoc.getElementsByTagName('parsererror').length)throw new Error('The Excel file contains malformed worksheet data.');
  return xmlDoc;
}
function descendants(element:Document|Element,name:string):Element[]{
  return Array.from(element.getElementsByTagName('*')).filter(n=>n.localName===name);
}
async function inflate(data:Uint8Array,method:number):Promise<Uint8Array>{
  if(method===0)return data;
  if(method!==8)throw new Error('Unsupported Excel compression method.');
  if(typeof DecompressionStream==='undefined')throw new Error('Excel decompression is not supported in this browser.');
  const stream=new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const out=new Uint8Array(await new Response(stream).arrayBuffer());
  if(out.length>8_000_000)throw new Error('The Excel file is too large.');
  return out;
}
async function unzip(buffer:ArrayBuffer):Promise<Map<string,string>> {
  const bytes=new Uint8Array(buffer),text=new TextDecoder(),result=new Map<string,string>();
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(u32(bytes,i)===0x06054b50){end=i;break;}}
  if(end<0)throw new Error('This is not a valid XLSX file.');
  const entries=u16(bytes,end+10),central=u32(bytes,end+16);
  if(entries>500)throw new Error('Too many files in the Excel workbook.');
  let pos=central;
  for(let i=0;i<entries;i++){
    if(pos+46>bytes.length||u32(bytes,pos)!==0x02014b50)throw new Error('Invalid Excel ZIP directory.');
    const method=u16(bytes,pos+10),compressed=u32(bytes,pos+20),uncompressed=u32(bytes,pos+24);
    const nameLength=u16(bytes,pos+28),extraLength=u16(bytes,pos+30),commentLength=u16(bytes,pos+32),localOffset=u32(bytes,pos+42);
    const name=text.decode(bytes.slice(pos+46,pos+46+nameLength));
    if(uncompressed>8_000_000)throw new Error('Excel worksheet exceeds the size limit.');
    if(localOffset+30>bytes.length||u32(bytes,localOffset)!==0x04034b50)throw new Error('Invalid Excel worksheet ZIP entry.');
    const dataOffset=localOffset+30+u16(bytes,localOffset+26)+u16(bytes,localOffset+28);
    if(dataOffset+compressed>bytes.length)throw new Error('Incomplete Excel worksheet ZIP data.');
    if((name==='xl/sharedStrings.xml'||name==='xl/workbook.xml'||name==='xl/_rels/workbook.xml.rels'||/^xl\/worksheets\/[^/]+\.xml$/.test(name))&&uncompressed<=8_000_000){
      result.set(name,text.decode(await inflate(bytes.subarray(dataOffset,dataOffset+compressed),method)));
    }
    pos+=46+nameLength+extraLength+commentLength;
  }
  return result;
}
export async function parseBeneficiaryWorkbook(file:File):Promise<SpreadsheetRecord[]> {
  if(!/\.xlsx$/i.test(file.name))throw new Error('Upload an .xlsx Excel workbook. Convert older .xls files to .xlsx first.');
  if(file.size>2_000_000)throw new Error('Excel files must be 2 MB or smaller.');
  const parts=await unzip(await file.arrayBuffer());
  const workbook=parts.get('xl/workbook.xml'),relationships=parts.get('xl/_rels/workbook.xml.rels');
  if(!workbook||!relationships)throw new Error('The Excel workbook is incomplete.');
  const first=descendants(parseXml(workbook),'sheet')[0];
  if(!first)throw new Error('The Excel workbook has no worksheets.');
  const relationId=first.getAttribute('r:id')||first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
  const relation=descendants(parseXml(relationships),'Relationship').find(e=>e.getAttribute('Id')===relationId);
  const target=relation?.getAttribute('Target')||'worksheets/sheet1.xml';
  if(target.includes('..')||/^https?:/i.test(target))throw new Error('Unsupported external worksheet reference.');
  const sheetName=target.startsWith('/xl/')?target.slice(1):'xl/'+target.replace(/^\/?/,'');
  const sheet=parts.get(sheetName);
  if(!sheet)throw new Error('Cannot read the first worksheet. Use the downloaded template.');
  const shared=parts.get('xl/sharedStrings.xml');
  const strings=shared?descendants(parseXml(shared),'si').map(n=>descendants(n,'t').map(x=>x.textContent||'').join('')):[];
  const rows=descendants(parseXml(sheet),'row');
  if(rows.length>1001)throw new Error('Import a maximum of 1,000 beneficiaries at a time.');
  const parsed=rows.map((row,i)=>{
    const cells=new Map<string,string>();
    for(const cell of descendants(row,'c')){
      const col=(cell.getAttribute('r')||'').replace(/\d/g,'').toUpperCase();
      if(!['A','B'].includes(col))continue;
      if(descendants(cell,'f').length)throw new Error('Formula cells are not supported. Paste values into the template.');
      const typ=cell.getAttribute('t');
      const val=typ==='inlineStr'?descendants(cell,'t').map(n=>n.textContent||'').join(''):(descendants(cell,'v')[0]?.textContent||'');
      cells.set(col,typ==='s'?(strings[Number(val)]||''):val);
    }
    return {tin:(cells.get('A')||'').trim(),name:(cells.get('B')||'').trim(),sourceRow:Number(row.getAttribute('r'))||i+1};
  }).filter(row=>row.tin||row.name);
  const header=parsed.shift();
  if(!header||header.tin.toLowerCase()!=='tin'||!['user name','name'].includes(header.name.toLowerCase()))throw new Error('First row must contain TIN and User Name in columns A and B.');
  return parsed;
}
