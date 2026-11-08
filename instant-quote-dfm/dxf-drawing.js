/* SAMUTA drawing-mode contour discovery, conservative: no quote without manual contour selection. */
(function(g){"use strict";
function analyze(text,unitsOverride){
const t=text.replace(/^\uFEFF/,"").split(/\r\n|\r|\n/),pairs=[];
for(let i=0;i+1<t.length;i+=2){const c=Number(t[i].trim());if(Number.isInteger(c))pairs.push([c,t[i+1].trim()]);}
const unitField=pairs.findIndex((x)=>x[0]===9&&x[1]==="$INSUNITS");
const unitFromFile=unitField>=0?Number(pairs[unitField+1]?.[1]):0;
const u=unitsOverride||unitFromFile,scale=({1:25.4,4:1,5:10,6:1000})[u];if(!scale)throw Error("Не определены единицы DXF. Выберите их вручную.");
let inEnt=false,ignore=0,objects=[],ignored=new Set();
const v=(a,k,d=NaN)=>{const s=a.find(x=>x[0]===k);return s?Number(s[1]):d};
function segment(points,layer){if(points.length<2||points.some(p=>p.some(q=>!Number.isFinite(q))))return;objects.push({points,layer});}
for(let i=0;i<pairs.length;i++){
const [c,tag]=pairs[i];
if(c===0&&tag==="SECTION"){inEnt=pairs[i+1]?.[1]==="ENTITIES";i++;continue}
if(c===0&&tag==="ENDSEC"){inEnt=false;continue}
if(!inEnt||c!==0)continue;
const a=[];while(i+1<pairs.length&&pairs[i+1][0]!==0)a.push(pairs[++i]);
const layer=a.find(x=>x[0]===8)?.[1]||"0";
if(v(a,67,0)===1){ignored.add("PAPER_SPACE");continue}
if(a.some(x=>x[0]===210&&Number(x[1])!==0)||a.some(x=>x[0]===220&&Number(x[1])!==0)){ignored.add("NONPLANAR");continue}
if(!["LINE","ARC","CIRCLE","LWPOLYLINE"].includes(tag)){ignored.add(tag);continue}
if(tag==="LINE"){segment([[v(a,10)*scale,v(a,20)*scale],[v(a,11)*scale,v(a,21)*scale]],layer);}
if(tag==="ARC"||tag==="CIRCLE"){
const x=v(a,10)*scale,y=v(a,20)*scale,r=v(a,40)*scale;
if(!(r>0&&[x,y].every(Number.isFinite)))continue;
const st=tag==="CIRCLE"?0:v(a,50)*Math.PI/180,en=tag==="CIRCLE"?2*Math.PI:v(a,51)*Math.PI/180;
let sweep=tag==="CIRCLE"?2*Math.PI:(en-st+2*Math.PI)%(2*Math.PI);
if(!(sweep>0))continue;
const n=Math.min(360,Math.max(12,Math.ceil(sweep/(Math.PI/144))));
const p=Array.from({length:n+1},(_,k)=>[x+r*Math.cos(st+sweep*k/n),y+r*Math.sin(st+sweep*k/n)]);
segment(p,layer);
}
if(tag==="LWPOLYLINE"){
const vs=[];let cur=null;
for(const [k,q] of a){if(k===10){cur={p:[Number(q)*scale,NaN],bulge:0};vs.push(cur)}else if(k===20&&cur&&!Number.isFinite(cur.p[1]))cur.p[1]=Number(q)*scale;else if(k===42&&cur)cur.bulge=Number(q)}
if(vs.length<2||vs.some(o=>o.p.some(n=>!Number.isFinite(n))))continue;
const closed=(v(a,70,0)&1)!==0,p=[];
function edge(a,b,bulge){if(Math.abs(bulge)<1e-10)return [a,b];const dx=b[0]-a[0],dy=b[1]-a[1],c=Math.hypot(dx,dy),theta=4*Math.atan(bulge);if(c<1e-9)return[a,b];const off=c/(2*Math.tan(theta/2)),cx=(a[0]+b[0])/2-dy/c*off,cy=(a[1]+b[1])/2+dx/c*off,r=Math.hypot(a[0]-cx,a[1]-cy),st=Math.atan2(a[1]-cy,a[0]-cx),N=Math.min(360,Math.max(2,Math.ceil(Math.abs(theta)/(Math.PI/144))));return Array.from({length:N+1},(_,j)=>[cx+r*Math.cos(st+theta*j/N),cy+r*Math.sin(st+theta*j/N)])}
for(let k=0;k<(closed?vs.length:vs.length-1);k++){p.push(...edge(vs[k].p,vs[(k+1)%vs.length].p,vs[k].bulge).slice(0,-1));}
if(closed)p.push(p[0]);else p.push(vs[vs.length-1].p);
segment(p,layer);
}
if(objects.length>15000)throw Error("Слишком много графических объектов. Сохраните упрощённую DXF-копию.");
}
const tol=.025,dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
let segments=objects.filter(o=>o.points.length>=2&&dist(o.points[0],o.points[o.points.length-1])>tol),loops=objects.filter(o=>o.points.length>=3&&dist(o.points[0],o.points[o.points.length-1])<=tol).map(o=>({points:o.points.slice(0,-1),layer:o.layer})),open=0;
const used=new Set();
for(let i=0;i<segments.length;i++){
if(used.has(i))continue;
const p=segments[i].points.slice(),layer=segments[i].layer;used.add(i);
let iterations=0, ambiguous=false;
while(dist(p[0],p[p.length-1])>tol&&iterations++<segments.length){
const candidates=[];
for(let j=0;j<segments.length;j++){if(used.has(j)||segments[j].layer!==layer)continue;const q=segments[j].points;let flip=false;
if(dist(p[p.length-1],q[0])<=tol)candidates.push([j,false]);
else if(dist(p[p.length-1],q[q.length-1])<=tol)candidates.push([j,true]);}
if(candidates.length!==1){if(candidates.length>1)ambiguous=true;break;}
const [idx,flip]=candidates[0],q=segments[idx].points;used.add(idx);p.push(...(flip?q.slice(0,-1).reverse():q.slice(1)));
}
if(!ambiguous&&dist(p[0],p[p.length-1])<=tol&&p.length>=4)loops.push({points:p.slice(0,-1),layer});else open++;
}
function shoelace(points){let a=0,per=0;for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length];a+=p[0]*q[1]-q[0]*p[1];per+=dist(p,q)}return {area:Math.abs(a)/2,perimeter:per}}
loops=loops.map((o,i)=>({...o,id:i,...shoelace(o.points)})).filter(o=>o.area>1e-5&&o.perimeter>1e-4);
loops.sort((a,b)=>b.area-a.area);loops=loops.slice(0,300).map((o,i)=>({...o,id:i}));
return {loops,open,ignored:[...ignored],units:u,total:objects.length,warning:"Контуры извлечены эвристически. Выберите только одну проекцию детали, включая её отверстия; проверьте размеры в CAD."};
}
function selectedGeometry(analysis,indices){
if(!Array.isArray(indices)||!indices.length)throw Error("Выберите наружный контур и внутренние вырезы.");
const picked=indices.map(i=>analysis.loops[i]).filter(Boolean);if(!picked.length)throw Error("Нет выбранных контуров");
function pointIn(poly,p){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){let a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
let area=0;for(let i=0;i<picked.length;i++){let depth=0;for(let j=0;j<picked.length;j++)if(i!==j&&picked[j].area>picked[i].area&&pointIn(picked[j].points,picked[i].points[0]))depth++;area+=(depth%2?-1:1)*picked[i].area}
if(area<=0)throw Error("Неположительная площадь: проверьте выбор внешнего контура и отверстий");
const p=picked.flatMap(o=>o.points);const b=[Math.min(...p.map(x=>x[0])),Math.min(...p.map(x=>x[1])),Math.max(...p.map(x=>x[0])),Math.max(...p.map(x=>x[1]))];
return {loops:picked,area_mm2:area,cut_mm:picked.reduce((s,x)=>s+x.perimeter,0),pierces:picked.length,dims:[b[2]-b[0],b[3]-b[1]],bounds:b,units:analysis.units,note:analysis.warning};
}
g.SamutaDrawing={analyze,selectedGeometry};
})(window);