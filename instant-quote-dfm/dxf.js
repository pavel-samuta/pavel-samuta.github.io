/* SAMUTA DXF 2D parser v1.1. Local, no network. Supported: LINE, ARC, CIRCLE, closed LWPOLYLINE. */
(function(global){"use strict";
function parse(text,override){
 const rows=text.replace(/^\uFEFF/,"").split(/\r\n|\r|\n/),tok=[];
 for(let i=0;i+1<rows.length;i+=2){const c=Number(rows[i].trim());if(!Number.isInteger(c))throw Error("Некорректные коды DXF");tok.push([c,rows[i+1].trim()]);}
 if(!tok.some(x=>x[0]===0&&x[1]==="SECTION"))throw Error("Файл не похож на текстовый DXF. Сохраните ASCII DXF.");
 let units=0;for(let i=0;i+1<tok.length;i++)if(tok[i][0]===9&&tok[i][1]==="$INSUNITS"){if(tok[i+1][0]===70)units=Number(tok[i+1][1]);break;}
 let use=override||units,scale=({1:25.4,4:1,5:10,6:1000})[use];
 if(!scale)throw Error("Единицы DXF не определены: выберите мм, см, м или дюймы.");
 const groups=[],chains=[],unsupported=new Set();let inEntities=false,count=0;
 function value(a,c,def){const x=a.find(v=>v[0]===c);return x?Number(x[1]):def}
 function finite2(p){return p.length===2&&p.every(Number.isFinite)}
 function addLoop(p){if(p.length<3||p.some(x=>!finite2(x)))throw Error("Некорректный замкнутый контур");if(p.length>25000)throw Error("Слишком много сегментов в контуре");groups.push(p);}
 function arcBetween(a,b,bulge){
  if(Math.abs(bulge)<1e-10)return [a,b];
  const dx=b[0]-a[0],dy=b[1]-a[1],c=Math.hypot(dx,dy),angle=4*Math.atan(bulge);
  if(c<1e-9)throw Error("Нулевая дуга в полилинии");
  const offset=c/(2*Math.tan(angle/2)),cx=(a[0]+b[0])/2-dy/c*offset,cy=(a[1]+b[1])/2+dx/c*offset;
  const alpha=Math.atan2(a[1]-cy,a[0]-cx),radius=Math.hypot(a[0]-cx,a[1]-cy),N=Math.max(3,Math.ceil(Math.abs(angle)/(Math.PI/144)));
  const p=[a];for(let i=1;i<N;i++){const x=alpha+angle*i/N;p.push([cx+radius*Math.cos(x),cy+radius*Math.sin(x)])}p.push(b);return p;
 }
 for(let i=0;i<tok.length;i++){
  const [code,name]=tok[i];
  if(code===0&&name==="SECTION"){if(tok[i+1]?.[0]===2){inEntities=tok[i+1][1]==="ENTITIES";i++;}continue}
  if(code===0&&name==="ENDSEC"){inEntities=false;continue}
  if(!inEntities||code!==0)continue;
  const parts=[];while(i+1<tok.length&&tok[i+1][0]!==0)parts.push(tok[++i]);
  const ignored=["TEXT","MTEXT","DIMENSION","LEADER","MLEADER","POINT","HATCH"];
  if(ignored.includes(name))continue;
  if(!["LWPOLYLINE","LINE","CIRCLE","ARC"].includes(name)){unsupported.add(name);continue}
  count++;if(count>10000)throw Error("DXF содержит более 10 тысяч контурных элементов");
  if(parts.some(x=>x[0]===210&&Number(x[1])!==0)||parts.some(x=>x[0]===220&&Number(x[1])!==0)||parts.some(x=>x[0]===230&&Number(x[1])!==1))throw Error("Обнаружена неплоская система координат DXF: требуется CAD-проверка");
  if(value(parts,67,0)===1)throw Error("Обнаружены объекты в пространстве листа: экспортируйте плоскую геометрию Model Space");
  if(name==="LWPOLYLINE"){
   if(value(parts,38,0)!==0)throw Error("У полилинии ненулевая отметка Z");
   if(!(value(parts,70,0)&1))throw Error("DXF содержит незамкнутую полилинию");
   const vs=[];let last=null;
   for(const [c,v] of parts){if(c===10){last={p:[Number(v)*scale,null],bulge:0};vs.push(last)}else if(c===20&&last&&last.p[1]===null)last.p[1]=Number(v)*scale;else if(c===42&&last)last.bulge=Number(v)}
   if(vs.length<3||vs.some(v=>!finite2(v.p)))throw Error("Недостаточно координат полилинии");
   const pts=[];for(let k=0;k<vs.length;k++)pts.push(...arcBetween(vs[k].p,vs[(k+1)%vs.length].p,vs[k].bulge).slice(0,-1));addLoop(pts);
  }else if(name==="CIRCLE"){
   const cx=value(parts,10,NaN)*scale,cy=value(parts,20,NaN)*scale,r=value(parts,40,NaN)*scale;
   if(![cx,cy,r].every(Number.isFinite)||r<=0)throw Error("Некорректная окружность DXF");
   addLoop(Array.from({length:288},(_,j)=>[cx+r*Math.cos(2*Math.PI*j/288),cy+r*Math.sin(2*Math.PI*j/288)]));
  }else if(name==="LINE"){
   const a=[value(parts,10,NaN)*scale,value(parts,20,NaN)*scale],b=[value(parts,11,NaN)*scale,value(parts,21,NaN)*scale];if(!finite2(a)||!finite2(b))throw Error("Некорректная линия");
   chains.push([a,b]);
  }else if(name==="ARC"){
   const cx=value(parts,10,NaN)*scale,cy=value(parts,20,NaN)*scale,r=value(parts,40,NaN)*scale,st=value(parts,50,NaN)*Math.PI/180,en=value(parts,51,NaN)*Math.PI/180;
   if(![cx,cy,r,st,en].every(Number.isFinite)||r<=0)throw Error("Некорректная дуга");
   let sw=(en-st+2*Math.PI)%(2*Math.PI);if(sw<1e-9)throw Error("Нулевая дуга");
   const N=Math.ceil(sw/(Math.PI/144));chains.push(Array.from({length:N+1},(_,j)=>[cx+r*Math.cos(st+sw*j/N),cy+r*Math.sin(st+sw*j/N)]));
  }
 }
 if(unsupported.size)throw Error("DXF содержит неподдерживаемые объекты: "+[...unsupported].slice(0,5).join(", ")+". Упростите файл до контуров LINE/ARC/CIRCLE/LWPOLYLINE.");
 if(groups.length===0&&chains.length===0)throw Error("В разделе ENTITIES нет поддерживаемых контуров");
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),tol=.025;let pending=chains.slice();
 while(pending.length){
  let p=pending.shift().slice(),changed=true,steps=0;
  while(changed){changed=false;if(++steps>15000)throw Error("Сложное соединение линий");
   for(let i=0;i<pending.length;i++){const q=pending[i],first=p[0],last=p[p.length-1];
    if(dist(last,q[0])<=tol){p.push(...q.slice(1));pending.splice(i,1);changed=true;break}
    if(dist(last,q[q.length-1])<=tol){p.push(...q.slice(0,-1).reverse());pending.splice(i,1);changed=true;break}
    if(dist(first,q[q.length-1])<=tol){p.unshift(...q.slice(0,-1));pending.splice(i,1);changed=true;break}
    if(dist(first,q[0])<=tol){p.unshift(...q.slice(1).reverse());pending.splice(i,1);changed=true;break}
   }
  }
  if(dist(p[0],p[p.length-1])>tol)throw Error("В DXF есть разомкнутые контуры LINE/ARC. Замкните их в CAD.");
  p.pop();addLoop(p);
 }
 function area(p){let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1]}return a/2}
 function perim(p){let s=0;for(let i=0;i<p.length;i++)s+=dist(p[i],p[(i+1)%p.length]);return s}
 function contains(poly,p){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
 const loops=groups.map(points=>({points,area:Math.abs(area(points)),perimeter:perim(points)}));
 let sum=0;for(let i=0;i<loops.length;i++){const sample=loops[i].points[0];let depth=0;for(let j=0;j<loops.length;j++)if(i!==j&&loops[j].area>loops[i].area&&contains(loops[j].points,sample))depth++;sum+=(depth%2?-1:1)*loops[i].area}
 if(sum<=1e-6)throw Error("Вычисленная площадь DXF неположительная: проверьте вложенные контуры");
 let xmin=Infinity,ymin=Infinity,xmax=-Infinity,ymax=-Infinity;
 for(const loop of loops)for(const p of loop.points){xmin=Math.min(xmin,p[0]);xmax=Math.max(xmax,p[0]);ymin=Math.min(ymin,p[1]);ymax=Math.max(ymax,p[1])}
 return {loops,area_mm2:sum,cut_mm:loops.reduce((s,x)=>s+x.perimeter,0),pierces:loops.length,dims:[xmax-xmin,ymax-ymin],bounds:[xmin,ymin,xmax,ymax],units:use,note:"2D DXF: площадь учитывает вложенные отверстия. Пересечения и самопересечения контуров автоматически не проверяются."};
}
global.SamutaDXF={parse};
})(window);