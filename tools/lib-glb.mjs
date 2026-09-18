import fs from 'fs';
export function loadGLB(p){
  const b=fs.readFileSync(p); const total=b.readUInt32LE(8);
  let off=12,json=null,bin=null;
  while(off<total){const clen=b.readUInt32LE(off),ctype=b.readUInt32LE(off+4);
    if(ctype===0x4E4F534A)json=JSON.parse(b.slice(off+8,off+8+clen).toString('utf8'));
    else bin=b.slice(off+8,off+8+clen); off+=8+clen;}
  return {json,bin};
}
const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const CT={5120:['getInt8',1],5121:['getUint8',1],5122:['getInt16',2],5123:['getUint16',2],5125:['getUint32',4],5126:['getFloat32',4]};
export function readAccessor(json,bin,i){
  const a=json.accessors[i],n=NC[a.type],[fn,sz]=CT[a.componentType];
  const bv=json.bufferViews[a.bufferView];
  const dv=new DataView(bin.buffer,bin.byteOffset+(bv.byteOffset||0)+(a.byteOffset||0));
  const stride=bv.byteStride||n*sz;
  const out=a.componentType===5126?new Float32Array(a.count*n):new Float64Array(a.count*n);
  for(let e=0;e<a.count;e++)for(let c=0;c<n;c++)out[e*n+c]=dv[fn](e*stride+c*sz,true);
  return {data:out,n,count:a.count};
}
export const mul=(a,b)=>{const o=new Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;};
export function trs(n){
  if(n.matrix)return n.matrix.slice();
  const t=n.translation||[0,0,0],q=n.rotation||[0,0,0,1],s=n.scale||[1,1,1];
  const [x,y,z,w]=q;
  const m=[1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w),0,2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w),0,2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y),0,0,0,0,1];
  for(let c=0;c<3;c++)for(let r=0;r<3;r++)m[c*4+r]*=s[c];
  m[12]=t[0];m[13]=t[1];m[14]=t[2]; return m;
}
export const xfP=(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
export const xfV=(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2],m[1]*p[0]+m[5]*p[1]+m[9]*p[2],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]];
export function walk(json,cb){
  const scene=json.scenes[json.scene||0];
  const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const rec=(ni,parent)=>{const n=json.nodes[ni];const m=mul(parent,trs(n));
    if(n.mesh!==undefined)cb(ni,n,m);(n.children||[]).forEach(c=>rec(c,m));};
  scene.nodes.forEach(ni=>rec(ni,I));
}
