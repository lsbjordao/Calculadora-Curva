"use strict";

export const PRESETS=[
  {
    id:'fund-limits',
    label:'Fundamentos: limites',
    view:{cx:0,cy:0.65,scale:105},
    equations:[
      {text:'sin(x)/x',showL:true,showA:true},
      {text:'(1-cos(x))/(x^2)',showL:true,showA:true},
      {text:'(exp(x)-1)/x',showL:true,showA:true},
      {text:'ln(1+x)/x',showL:true,showA:true}
    ]
  },
  {
    id:'fund-continuity',
    label:'Fundamentos: continuidade',
    view:{cx:0,cy:0.2,scale:70},
    equations:[
      {text:'x^2',showL:true,showA:true},
      {text:'abs(x)',showD:true,showL:true,showA:true},
      {text:'sign(x)',showL:true,showA:true},
      {text:'(x^2-1)/(x-1)',showL:true,showA:true}
    ]
  },
  {
    id:'fund-derivatives',
    label:'Fundamentos: derivadas',
    view:{cx:0,cy:0,scale:48},
    equations:[
      {text:'x',showD:true,showA:true},
      {text:'x^2',showD:true,showA:true},
      {text:'x^3',showD:true,showA:true},
      {text:'sqrt(x)',showD:true,showL:true,showA:true},
      {text:'1/x',showD:true,showL:true,showA:true}
    ]
  },
  {
    id:'fund-function-derivative',
    label:'Fundamentos: f e f′',
    view:{cx:0,cy:0,scale:45},
    equations:[
      {text:'x^2',showA:true},
      {text:'2x',showA:true,style:'dashed'},
      {text:'x^3',showA:true},
      {text:'3x^2',showA:true,style:'dashed'},
      {text:'sin(x)',showA:true},
      {text:'cos(x)',showA:true,style:'dashed'}
    ]
  },
  {
    id:'fund-integrals',
    label:'Fundamentos: integrais',
    view:{cx:0,cy:0,scale:48},
    equations:[
      {text:'1',showI:true,showA:true},
      {text:'x',showI:true,showA:true},
      {text:'x^2',showI:true,showA:true},
      {text:'sin(x)',showI:true,showA:true}
    ]
  },
  {
    id:'fund-ftc',
    label:'Fundamentos: TFC',
    view:{cx:0,cy:0,scale:46},
    equations:[
      {text:'2x',showI:true,showA:true},
      {text:'x^2',showA:true,style:'dashed'},
      {text:'cos(x)',showI:true,showA:true},
      {text:'sin(x)',showA:true,style:'dashed'},
      {text:'exp(x)',showI:true,showA:true}
    ]
  },
  {
    id:'fund-concavity',
    label:'Fundamentos: concavidade',
    view:{cx:0,cy:0,scale:45},
    equations:[
      {text:'x^2',showD:true,showA:true},
      {text:'-x^2',showD:true,showA:true},
      {text:'x^3',showD:true,showA:true},
      {text:'x^4-2x^2',showD:true,showA:true}
    ]
  },
  {
    id:'fund-near-zero',
    label:'Fundamentos: perto de zero',
    view:{cx:0,cy:0,scale:135},
    equations:[
      {text:'sin(x)',showD:true,showL:true,showA:true},
      {text:'x',showL:true,showA:true,style:'dashed'},
      {text:'tan(x)',showL:true,showA:true},
      {text:'1-cos(x)',showL:true,showA:true}
    ]
  },
  {
    id:'param-parabola',
    label:'Parâmetros: parábola',
    view:{cx:0,cy:0,scale:42},
    equations:[
      {text:'a*x^2+b*x+c',params:{a:1,b:0,c:0},showD:true,showA:true},
      {text:'2a*x+b',params:{a:1,b:0},showA:true,style:'dashed'},
      {text:'a*(x-b)^2+c',params:{a:1,b:0,c:0},showD:true,showA:true}
    ]
  },
  {
    id:'param-line',
    label:'Parâmetros: reta',
    view:{cx:0,cy:0,scale:45},
    equations:[
      {text:'m*x+b',params:{m:1,b:0},showD:true,showI:true,showA:true},
      {text:'m',params:{m:1},showA:true,style:'dashed'},
      {text:'(m/2)*x^2+b*x',params:{m:1,b:0},showA:true,style:'dotted'}
    ]
  },
  {
    id:'param-trig',
    label:'Parâmetros: senoide',
    view:{cx:0,cy:0,scale:44},
    equations:[
      {text:'a*sin(k*x+b)+c',params:{a:1,k:1,b:0,c:0},showD:true,showA:true},
      {text:'a*k*cos(k*x+b)',params:{a:1,k:1,b:0},showA:true,style:'dashed'},
      {text:'c',params:{c:0},showA:true,style:'dotted'}
    ]
  },
  {
    id:'param-growth',
    label:'Parâmetros: crescimento',
    view:{cx:0,cy:1,scale:55},
    equations:[
      {text:'a*exp(k*x)+c',params:{a:1,k:0.5,c:0},showD:true,showA:true},
      {text:'1/(1+exp(-k*(x-a)))',params:{k:1,a:0},showD:true,showL:true,showA:true},
      {text:'ln(x+a)+c',params:{a:1,c:0},showD:true,showL:true,showA:true}
    ]
  },
  {
    id:'param-transform',
    label:'Parâmetros: transformações',
    view:{cx:0,cy:0,scale:50},
    equations:[
      {text:'a*(x-b)^2+c',params:{a:1,b:0,c:0},showD:true,showA:true},
      {text:'a*abs(x-b)+c',params:{a:1,b:0,c:0},showD:true,showL:true,showA:true},
      {text:'a*sqrt(abs(x-b))+c',params:{a:1,b:0,c:0},showD:true,showL:true}
    ]
  },
  {
    id:'powers',
    label:'Potências essenciais',
    view:{cx:0,cy:0,scale:42},
    equations:[
      {text:'x',showA:true},
      {text:'x^2',showD:true,showI:true,showA:true},
      {text:'x^3',showD:true,showA:true},
      {text:'abs(x)',showD:true,showL:true,showA:true}
    ]
  },
  {
    id:'trig',
    label:'Trigonometria',
    view:{cx:0,cy:0,scale:42},
    equations:[
      {text:'sin(x)',showD:true,showI:true,showA:true},
      {text:'cos(x)',showD:true,showA:true},
      {text:'tan(x)',showL:true,showA:true,style:'dashed'}
    ]
  },
  {
    id:'rational',
    label:'Assíntotas e furos',
    view:{cx:0,cy:0,scale:48},
    equations:[
      {text:'1/x',showL:true,showA:true},
      {text:'1/(x^2)',showL:true,showA:true,style:'dashed'},
      {text:'(x^2-1)/(x-1)',showL:true,showA:true},
      {text:'x/(x^2-1)',showL:true,showA:true,style:'dotted'}
    ]
  },
  {
    id:'growth',
    label:'Exp, log e crescimento',
    view:{cx:0,cy:1.2,scale:50},
    equations:[
      {text:'exp(x)',showD:true,showA:true},
      {text:'2^x',showD:true},
      {text:'ln(x)',showD:true,showL:true,showA:true},
      {text:'log(x)',showL:true}
    ]
  },
  {
    id:'calculus',
    label:'Derivada e integral',
    view:{cx:0,cy:0,scale:42},
    equations:[
      {text:'x^3-3x',showD:true,showI:true,showA:true},
      {text:'3x^2-3',showA:true,style:'dashed'},
      {text:'sin(x)',showD:true,showI:true},
      {text:'exp(-x^2)',showI:true,showA:true}
    ]
  },
  {
    id:'waves',
    label:'Ondas compostas',
    view:{cx:0,cy:0,scale:48},
    equations:[
      {text:'sin(x)+0.35sin(3x)',showD:true,showA:true},
      {text:'cos(2x)',showD:true},
      {text:'sin(x)*cos(4x)',showA:true,style:'dashed'}
    ]
  },
  {
    id:'piecewise-basics',
    label:'Partes: cálculo básico',
    view:{cx:0,cy:0.15,scale:65},
    equations:[
      {text:'piecewise(x < 0, -1, 1)',showL:true,showA:true},
      {text:'piecewise(x < 0, -x, x)',showD:true,showL:true,showA:true},
      {text:'piecewise(x < 0, x^2, x)',showD:true,showL:true,showA:true},
      {text:'piecewise(x < 1, x^2, 2x-1)',showD:true,showL:true,showA:true}
    ]
  },
  {
    id:'piecewise-models',
    label:'Partes: modelos',
    view:{cx:0,cy:0.45,scale:70},
    equations:[
      {text:'piecewise(x < -1, -1, piecewise(x < 1, x, 1))',showL:true,showA:true},
      {text:'piecewise(x < 0, 0, 1-exp(-x))',showD:true,showL:true,showA:true},
      {text:'piecewise(x < 0, 0, x^2)',showD:true,showI:true,showA:true},
      {text:'piecewise(x < 0, sin(x), x)',showD:true,showL:true,showA:true}
    ]
  },
  {
    id:'discrete',
    label:'Quebras e degraus',
    view:{cx:0,cy:0,scale:45},
    equations:[
      {text:'floor(x)',showL:true,showA:true},
      {text:'ceil(x)',showL:true,style:'dashed'},
      {text:'sign(x)',showL:true,showA:true},
      {text:'abs(x)',showD:true,showL:true}
    ]
  },
  {
    id:'gaussian',
    label:'Gaussianas e sino',
    view:{cx:0,cy:0.35,scale:78},
    equations:[
      {text:'exp(-x^2)',showD:true,showI:true,showA:true},
      {text:'x*exp(-x^2)',showD:true,showA:true},
      {text:'exp(-0.5x^2)',showI:true,showA:true},
      {text:'(x^2-1)*exp(-x^2)',showA:true,style:'dashed'}
    ]
  },
  {
    id:'damped',
    label:'Oscilações amortecidas',
    view:{cx:0,cy:0,scale:42},
    equations:[
      {text:'exp(-0.15x^2)*sin(6x)',showD:true,showA:true},
      {text:'sin(x)/x',showL:true,showA:true},
      {text:'cos(x)/(1+x^2)',showD:true,showA:true},
      {text:'exp(-0.15x^2)',showA:true,style:'dotted'}
    ]
  },
  {
    id:'fourier',
    label:'Somas tipo Fourier',
    view:{cx:0,cy:0,scale:45},
    equations:[
      {text:'sin(x)',showD:true},
      {text:'sin(x)+sin(3x)/3',showD:true,showA:true},
      {text:'sin(x)+sin(3x)/3+sin(5x)/5',showD:true,showA:true},
      {text:'sin(x)+sin(3x)/3+sin(5x)/5+sin(7x)/7',showA:true}
    ]
  },
  {
    id:'rich-polynomials',
    label:'Polinômios ricos',
    view:{cx:0,cy:0,scale:38},
    equations:[
      {text:'x^4-5x^2+4',showD:true,showA:true},
      {text:'x^5-5x^3+4x',showD:true,showA:true},
      {text:'x^6-5x^4+4x^2',showD:true,showA:true},
      {text:'0.2x^3-x',showI:true,showA:true,style:'dashed'}
    ]
  },
  {
    id:'saturation',
    label:'Saturação e sigmoidais',
    view:{cx:0,cy:0.5,scale:70},
    equations:[
      {text:'1/(1+exp(-x))',showD:true,showL:true,showA:true},
      {text:'tanh(x)',showD:true,showL:true,showA:true},
      {text:'atan(x)',showD:true,showL:true,showA:true},
      {text:'x/(1+abs(x))',showL:true,showA:true,style:'dashed'}
    ]
  },
  {
    id:'singular-famous',
    label:'Singularidades famosas',
    view:{cx:0,cy:0,scale:40},
    equations:[
      {text:'tan(x)',showL:true,showA:true},
      {text:'sec(x)',showL:true,showA:true,style:'dashed'},
      {text:'1/sin(x)',showL:true,showA:true,style:'dotted'},
      {text:'ln(abs(x))',showL:true,showA:true}
    ]
  },
  {
    id:'corners',
    label:'Cantos e cúspides',
    view:{cx:0,cy:0.4,scale:64},
    equations:[
      {text:'abs(x)',showD:true,showL:true,showA:true},
      {text:'cbrt(x)',showD:true,showL:true,showA:true},
      {text:'abs(sin(x))',showD:true,showL:true,showA:true},
      {text:'sqrt(abs(x))',showD:true,showL:true,showA:true}
    ]
  },
  {
    id:'pretty-exploration',
    label:'Exploração visual',
    view:{cx:0,cy:0,scale:45},
    equations:[
      {text:'sin(x^2)',showD:true,showA:true},
      {text:'cos(x^2)',showD:true,showA:true},
      {text:'sin(x)*sin(3x)',showA:true},
      {text:'sin(x)+0.4cos(7x)',showD:true,showA:true}
    ]
  },
  {
    id:'data-regression',
    label:'Dados e regressão',
    view:{cx:1,cy:3.5,scale:42},
    equations:[
      {text:'fit1: (0,1.1),(1,2.9),(2,5.1),(3,6.8),(4,9.2)'},
      {text:'fit2: (-2,4.2),(-1,1.1),(0,0.1),(1,0.9),(2,4.1)',style:'dashed'},
      {text:'fitexp: (0,1),(1,2),(2,4),(3,8)',style:'dotted'},
      {text:'fitpow: (1,2),(2,8),(3,18),(4,32)'}
    ]
  },
  {
    id:'riemann-methods',
    label:'Somas de Riemann',
    view:{cx:1.6,cy:2.4,scale:56},
    equations:[
      {text:'x^2',showI:true,showR:true,ia:0,ib:3,riemannN:6,riemannMode:'left'},
      {text:'x^2',showR:true,ia:0,ib:3,riemannN:6,riemannMode:'right',style:'dashed'},
      {text:'x^2',showR:true,ia:0,ib:3,riemannN:6,riemannMode:'mid',style:'dotted'},
      {text:'0',style:'dotted'}
    ]
  },
  {
    id:'local-linearization',
    label:'Linearização local',
    view:{cx:0,cy:0,scale:82},
    equations:[
      {text:'sin(x)',showD:true,showD2:true,showNormal:true,dx:0.8,showA:true},
      {text:'sin(0.8)+cos(0.8)*(x-0.8)',style:'dashed'},
      {text:'x - x^3/6',style:'dotted'},
      {text:'x',style:'dotted'}
    ]
  },
  {
    id:'implicit-regions',
    label:'Regiões implícitas',
    view:{cx:0,cy:0,scale:68},
    equations:[
      {text:'x^2 + y^2 < 4'},
      {text:'x^2 + y^2 = 4',style:'dashed'},
      {text:'sin(x) = cos(y)',style:'dotted'},
      {text:'x*y = 1'}
    ]
  },
  {
    id:'data-model-choice',
    label:'Escolha de modelo',
    view:{cx:2,cy:4,scale:48},
    equations:[
      {text:'points: (0,1),(1,1.8),(2,3.1),(3,5.2),(4,8.5)'},
      {text:'fit: (0,1),(1,1.8),(2,3.1),(3,5.2),(4,8.5)',style:'dotted'},
      {text:'fit2: (0,1),(1,1.8),(2,3.1),(3,5.2),(4,8.5)',style:'dashed'},
      {text:'fitexp: (0,1),(1,1.8),(2,3.1),(3,5.2),(4,8.5)'}
    ]
  },
  {
    id:'limits-infinity',
    label:'Limites no infinito',
    view:{cx:0,cy:0,scale:55},
    equations:[
      {text:'(2x+1)/(x+1)',showL:true,lInf:'+',showA:true},
      {text:'atan(x)',showL:true,lInf:'-',showA:true},
      {text:'exp(-x)',showL:true,lInf:'+'},
      {text:'x/sqrt(x^2+1)',showL:true,lInf:'-'}
    ]
  },
  {
    id:'regions-pieces',
    label:'Inequações e partes',
    view:{cx:0,cy:0,scale:55},
    equations:[
      {text:'y < x^2'},
      {text:'y >= sin(x)',style:'dashed'},
      {text:'x^2 {-2 < x < 2}'},
      {text:'{x < 0: -x, x >= 0: x}',style:'dotted'}
    ]
  },
  {
    id:'parametric-curves',
    label:'Curvas paramétricas',
    view:{cx:0,cy:0,scale:80},
    equations:[
      {text:'(cos(t), sin(t))',tmin:0,tmax:6.2832},
      {text:'(cos(3t), sin(2t))',tmin:0,tmax:6.2832,style:'dashed'},
      {text:'(t*cos(t)/6, t*sin(t)/6)',tmin:0,tmax:18.85,style:'dotted'}
    ]
  },
  {
    id:'polar-curves',
    label:'Curvas polares',
    view:{cx:0,cy:0,scale:60},
    equations:[
      {text:'r = 1 + cos(theta)',thmin:0,thmax:6.2832},
      {text:'r = cos(3*theta)',thmin:0,thmax:6.2832,style:'dashed'},
      {text:'r = theta/3',thmin:0,thmax:18.85,style:'dotted'}
    ]
  },
  {
    id:'implicit-conics',
    label:'Cônicas implícitas',
    view:{cx:0,cy:0,scale:60},
    equations:[
      {text:'x^2 + y^2 = 4'},
      {text:'x^2 - y^2 = 1',style:'dashed'},
      {text:'x*y = 1',style:'dotted'}
    ]
  },
  {
    id:'analytic-geometry',
    label:'Geometria analítica',
    view:{cx:0.8,cy:1.3,scale:62},
    equations:[
      {text:'ponto: A=(0,0), B=(3,4), C=(-2,1)'},
      {text:'dist: A,B'},
      {text:'M = medio(A,B)',style:'dotted'},
      {text:'r = reta(A,B)'},
      {text:'intersecao: r; line((-2,4),(4,0))',style:'dashed'}
    ]
  },
  {
    id:'conic-analysis',
    label:'Análise de cônicas',
    view:{cx:0,cy:0,scale:58},
    equations:[
      {text:'conica: x^2 + y^2 = 4'},
      {text:'conica: x^2/9 + y^2/4 = 1',style:'dashed'},
      {text:'conica: x^2 - y^2 = 1',style:'dotted'},
      {text:'conica: y = x^2/2'}
    ]
  },
  {
    id:'cone-sections-3d',
    label:'Seções do cone e circunferência',
    view:{cx:0,cy:0,scale:58},
    equations:[
      {text:'secao: h,angulo(q),a,d,p,b',params:{h:2,q:0,a:1,d:0,p:0,b:0.75},name:'Circunferência: plano horizontal'},
      {text:'secao: h,angulo(q),a,d,p,b',params:{h:2,q:27,a:1,d:0,p:0,b:0.75},name:'Elipse: plano oblíquo',visible:false},
      {text:'secao: h,angulo(q),a,d,p,b',params:{h:2,q:45,a:1,d:0,p:0,b:0.75},name:'Parábola: plano paralelo à geratriz',visible:false},
      {text:'secao: h,angulo(q),a,d,p,b',params:{h:2,q:58,a:1,d:0,p:0,b:0.75},name:'Hipérbole: plano inclinado',visible:false}
    ]
  },
  {
    id:'cone-hyperbola-planes-3d',
    label:'Hipérbole e planos (3D)',
    view:{cx:0,cy:0,scale:58},
    equations:[
      {text:'secao: h,angulo(q),a,d,p,b',params:{h:2,q:58,a:1,d:0,p:0,b:0.75},name:'Cone duplo + plano secante + hipérbole'},
      {text:'secao: h,angulo(q),a,d,p,b',params:{h:2,q:0,a:1,d:0,p:0,b:0.75},name:'Comparar com seção circular',visible:false},
      {text:'secao: h,angulo(q),a,d,p,b',params:{h:2,q:27,a:1,d:0,p:0,b:0.75},name:'Comparar com seção elíptica',visible:false}
    ]
  },
  {
    id:'linear-algebra',
    label:'Álgebra linear 2D',
    view:{cx:0.8,cy:0.8,scale:84},
    equations:[
      {text:'vetor: (0,0),(2,1)'},
      {text:'matriz: [a,b; c,d]',params:{a:1,b:0,c:0,d:1}},
      {text:'matriz: [1,b; 0,1]',params:{b:0.6},style:'dashed'},
      {text:'matriz: [0,-1; 1,0]',style:'dotted'},
      {text:'matriz: [1.4,0; 0,0.7]'}
    ]
  },
  {
    id:'linear-algebra-advanced',
    label:'Álgebra linear expandida',
    view:{cx:0,cy:0,scale:60},
    equations:[
      {text:'calc: det([1,2;3,4])'},
      {text:'cross([1,0,0],[0,1,0])'},
      {text:'linsolve([[2,1],[1,3]],[5,10])'},
      {text:'calc: sum(i,1,n,i)',params:{n:10}},
      {text:'seq: i,1,n,i^2',params:{n:5}}
    ]
  },
  {
    id:'data-histograms',
    label:'Histogramas',
    view:{cx:3.4,cy:2.8,scale:74},
    equations:[
      {text:'hist: 1,1,2,2,2,3,3,4,5,5,5,6'},
      {text:'hist: 1,2,2,3,4,4,4,5,5,6,6,6',style:'dashed'},
      {text:'points: (1,2),(2,3),(3,2),(4,3),(5,4),(6,3)',style:'dotted'}
    ]
  },
  {
    id:'sequences-sums',
    label:'Sequências e somatórios',
    view:{cx:4.5,cy:18,scale:14},
    equations:[
      {text:'seq: i,1,n,i^2',params:{n:8}},
      {text:'seq: i,1,n,2i+1',params:{n:8},style:'dashed'},
      {text:'sum(i,1,n,i)',params:{n:8}},
      {text:'sum(i,1,n,i^2)',params:{n:8}}
    ]
  },
  {
    id:'curve-intersections',
    label:'Interseções de curvas',
    view:{cx:0,cy:0,scale:58},
    equations:[
      {text:'sin(x)'},
      {text:'cos(x)',style:'dashed'},
      {text:'intersec: sin(x), cos(x)'},
      {text:'x^2-1',style:'dotted'},
      {text:'intersec: x^2-1, 0'}
    ]
  },
  {
    id:'data-logistic-log-fits',
    label:'Ajustes logarítmico e sigmoidal',
    view:{cx:1.2,cy:2.6,scale:58},
    equations:[
      {text:'points: (1,1),(2,2),(3,2.3),(4,2.6),(6,3)'},
      {text:'fitlog: (1,1),(2,2),(3,2.3),(4,2.6),(6,3)',style:'dashed'},
      {text:'points: (-4,0.1),(-2,0.6),(0,2.5),(2,4.4),(4,4.9)',style:'dotted'},
      {text:'fitsig: (-4,0.1),(-2,0.6),(0,2.5),(2,4.4),(4,4.9)'}
    ]
  },
  {
    id:'data-residuals',
    label:'Resíduos de ajuste',
    view:{cx:3,cy:10,scale:30},
    equations:[
      {text:'points: seq(i,1,n,i^2+sin(i)/3)',params:{n:6}},
      {text:'fit2: seq(i,1,n,i^2+sin(i)/3)',params:{n:6},style:'dashed'},
      {text:'sum(i,1,n,((i^2+sin(i)/3)-fit2(seq(j,1,n,j^2+sin(j)/3),i))^2)',params:{n:6}},
      {text:'fit(seq(i,1,n,i^2+sin(i)/3),x)',params:{n:6},style:'dotted'}
    ]
  },
  {
    id:'data-model-comparison',
    label:'Comparação de modelos',
    view:{cx:3,cy:4,scale:42},
    equations:[
      {text:'points: seq(i,1,n,2+0.7i+0.18i^2+sin(i)/2)',params:{n:9}},
      {text:'fit: seq(i,1,n,2+0.7i+0.18i^2+sin(i)/2)',params:{n:9},style:'dotted'},
      {text:'fit2: seq(i,1,n,2+0.7i+0.18i^2+sin(i)/2)',params:{n:9},style:'dashed'},
      {text:'compare: seq(i,1,n,2+0.7i+0.18i^2+sin(i)/2)',params:{n:9}},
      {text:'resid: fit2, seq(i,1,n,2+0.7i+0.18i^2+sin(i)/2)',params:{n:9},style:'dotted'}
    ]
  },
  {
    id:'linear-algebra-computation',
    label:'Determinantes e sistemas',
    view:{cx:0,cy:0,scale:60},
    equations:[
      {text:'calc: det([[a,0],[0,d]])',params:{a:2,d:3}},
      {text:'calc: det([[1,2,3],[0,1,4],[5,6,0]])'},
      {text:'cross([1,0,0],[0,1,0])'},
      {text:'linsolve([[2,1],[1,3]],[5,10])'}
    ]
  },
  {
    id:'data-advanced',
    label:'Dados e regressão avançada',
    view:{cx:2,cy:4,scale:48},
    equations:[
      {text:'points: (0,1),(1,1.8),(2,3.1),(3,5.2),(4,8.5)'},
      {text:'fitlog: (1,1),(2,2),(3,2.3),(4,2.6)',style:'dashed'},
      {text:'fitsig: (-4,0.1),(-2,0.6),(0,2.5),(2,4.4),(4,4.9)',style:'dotted'},
      {text:'hist: 1,1,2,2,2,3,3,4,5,5,5,5'},
      {text:'intersec: ln(x), 1',style:'dashed'}
    ]
  },
  {
    id:'algebra-vectors',label:'Vetores e projeções',view:{cx:1,cy:1,scale:60},
    equations:[
      {text:'calc: dot([a,b],[1,2])',params:{a:3,b:4}},
      {text:'calc: norm([a,b])',params:{a:3,b:4}},
      {text:'calc: angle([1,0],[1,1])'},
      {text:'calc: proj([3,4],[1,0])'},
      {text:'produto: (0,0),(3,4); (0,0),(1,0)'}
    ]
  },
  {
    id:'algebra-matrices',label:'Calculadora matricial',view:{cx:0,cy:0,scale:60},
    equations:[
      {text:'let M = [[a,b],[c,d]]',params:{a:1,b:2,c:3,d:4}},
      {text:'calc: matmul(@M,[[2,0],[1,2]])'},
      {text:'calc: inv(@M)'},
      {text:'calc: rref(@M)'},
      {text:'calc: transpose([[1,2,3],[4,5,6]])'}
    ]
  },
  {
    id:'algebra-systems',label:'Sistemas: três classificações',view:{cx:1,cy:1,scale:70},
    equations:[
      {text:'calc: solveinfo([[1,1],[1,a]],[2,b])',params:{a:2,b:3},showAlgebraSystem:true},
      {text:'calc: solveinfo([[1,1],[2,2]],[1,2])',visible:false},
      {text:'calc: solveinfo([[1,1],[2,2]],[1,3])',visible:false}
    ]
  },
  {
    id:'algebra-decompositions',label:'QR, SVD e mínimos quadrados',view:{cx:0,cy:0,scale:65},
    equations:[
      {text:'calc: qr([[1,2],[3,4],[5,6]])'},
      {text:'calc: svd([[a,b],[0,d]])',params:{a:2,b:1,d:1},showAlgebraTransform:true},
      {text:'calc: lu([[0,2],[1,3]])'},
      {text:'calc: pinv([[1,2],[2,4]])'},
      {text:'calc: lstsq([[1,0],[1,1],[1,2]],[1,2,2])'}
    ]
  },
  {
    id:'algebra-eigenvectors',label:'Direções próprias e multiplicidade',view:{cx:0,cy:0,scale:65},
    equations:[
      {text:'matriz: [a,b; c,d]',params:{a:2,b:1,c:0,d:3}},
      {text:'calc: eiginfo([[2,1],[0,2]])'},
      {text:'calc: eiginfo([[2,0],[0,2]])'}
    ]
  }
];

const PRESET_DETAILS={
  'algebra-vectors':['Álgebra linear','Produto escalar, norma, ângulo em radianos e projeção.'],
  'algebra-matrices':['Álgebra linear','Variáveis reativas, multiplicação, inversa, posto e transposta.'],
  'algebra-systems':['Álgebra linear','Mova as retas pelos parâmetros e compare solução única, infinitas e inconsistência.'],
  'algebra-decompositions':['Álgebra linear','Fatores ortogonais, resíduos, pseudoinversa e mínimos quadrados.'],
  'algebra-eigenvectors':['Álgebra linear','Direções invariantes, autovalores repetidos e matrizes não diagonalizáveis.'],
  'fund-limits':['Fundamentos','Limites notáveis perto de zero e aproximações clássicas.'],
  'fund-continuity':['Fundamentos','Compara funções contínuas, cantos, saltos e furos removíveis.'],
  'fund-derivatives':['Fundamentos','Mostra inclinação local em funções elementares.'],
  'fund-function-derivative':['Fundamentos','Coloca funções e derivadas conhecidas lado a lado.'],
  'fund-integrals':['Fundamentos','Integrais acumuladas de funções básicas.'],
  'fund-ftc':['Fundamentos','Mostra pares f e F ligados pelo Teorema Fundamental do Cálculo.'],
  'fund-concavity':['Fundamentos','Extremos, crescimento e concavidade em exemplos mínimos.'],
  'fund-near-zero':['Fundamentos','Compara aproximações locais quando x está perto de zero.'],
  'param-parabola':['Parâmetros','Explore concavidade, vértice e deslocamento de parábolas.'],
  'param-line':['Parâmetros','Inclinação, intercepto e integral de uma reta.'],
  'param-trig':['Parâmetros','Amplitude, frequência, fase e deslocamento vertical de uma senoide.'],
  'param-growth':['Parâmetros','Taxa de crescimento, saturação e deslocamentos.'],
  'param-transform':['Parâmetros','Transformações de escala e translação em famílias simples.'],
  powers:['Fundamentos','Potências essenciais para zeros, derivadas e integrais.'],
  trig:['Funções elementares','Seno, cosseno e tangente com derivadas e assíntotas.'],
  rational:['Limites e assíntotas','Racionais com assíntotas verticais e furos removíveis.'],
  growth:['Funções elementares','Exponenciais e logaritmos com domínio e crescimento.'],
  calculus:['Cálculo visual','Extremos, derivada e integral na mesma cena.'],
  waves:['Visual','Ondas combinadas e oscilações simples.'],
  'piecewise-basics':['Funções por partes','Saltos, cantos, continuidade e encaixes suaves em uma mesma família.'],
  'piecewise-models':['Funções por partes','Saturação, rampa, resposta acumulada e transições definidas por condição.'],
  discrete:['Descontinuidades','Degraus, saltos e limites laterais.'],
  gaussian:['Cálculo visual','Curvas suaves, simetria e áreas acumuladas.'],
  damped:['Visual','Oscilações com amortecimento e limites removíveis.'],
  fourier:['Visual','Somas de harmônicos e aproximações ondulatórias.'],
  'rich-polynomials':['Cálculo visual','Polinômios com muitos zeros, extremos e concavidade.'],
  saturation:['Limites e assíntotas','Sigmoidais e funções com saturação horizontal.'],
  'singular-famous':['Limites e assíntotas','Singularidades clássicas e domínios quebrados.'],
  corners:['Descontinuidades','Cantos, cúspides e pontos sem derivada.'],
  'pretty-exploration':['Visual','Funções expressivas para explorar zoom e oscilação.'],
  'data-regression':['Dados','Ajustes por mínimos quadrados: reta, parábola, exponencial e potência sobre pontos.'],
  'riemann-methods':['Cálculo visual','Compara somas pela esquerda, direita e ponto médio com a integral definida.'],
  'local-linearization':['Cálculo visual','Tangente, normal e aproximações locais ao redor de um ponto escolhido.'],
  'implicit-regions':['Regiões e partes','Discos, fronteiras e relações trigonométricas desenhadas como f(x,y)=0 ou f(x,y)<0.'],
  'data-model-choice':['Dados','Compara reta, parábola e exponencial sobre o mesmo conjunto de pontos.'],
  'limits-infinity':['Limites e assíntotas','Limites quando x→+∞ e x→−∞, com assíntotas horizontais.'],
  'regions-pieces':['Regiões e partes','Inequações sombreadas, restrição de domínio e função por partes em chaves.'],
  'parametric-curves':['Paramétricas e polares','Círculo, Lissajous e espiral definidos por (x(t), y(t)).'],
  'polar-curves':['Paramétricas e polares','Cardióide, rosácea e espiral em coordenadas polares r(θ).'],
  'implicit-conics':['Implícitas','Círculo, hipérboles e a relação xy=1 traçadas por f(x,y)=0.'],
  'analytic-geometry':['Geometria','Pontos, distância, ponto médio, reta por dois pontos e interseção.'],
  'conic-analysis':['Geometria','Cônicas com centro, raio, focos, diretrizes e eixos quando detectáveis.'],
  'cone-sections-3d':['Cônicas e quádricas','Cone duplo 3D recortado por um plano: circunferência, elipse, parábola e hipérbole. Ative uma linha por vez e ajuste k.'],
  'cone-hyperbola-planes-3d':['Cônicas e quádricas','Hipérbole como seção 3D de um cone duplo por um plano oblíquo; compare inclinações com as demais linhas.'],
  'linear-algebra':['Álgebra linear','Vetores, matrizes 2x2, determinante e transformação do quadrado unitário.'],
  'linear-algebra-advanced':['Álgebra linear','Determinante NxN, cross 3D, linsolve, somatório e sequências.'],
  'data-histograms':['Dados','Compara histogramas e pontos para mostrar a sintaxe hist:.'],
  'sequences-sums':['Sequências e séries','Sequências discretas com seq: e somatórios simbólicos com sum(...).'],
  'curve-intersections':['Geometria','Marca automaticamente cruzamentos entre funções na janela visível.'],
  'data-logistic-log-fits':['Dados','Modelos de ajuste logarítmico e sigmoidal sobre dados.'],
  'data-residuals':['Dados','Usa seq(...), fit2(...) e sum(...) para calcular erro quadrático de um ajuste.'],
  'data-model-comparison':['Dados','Compara modelos por R², RMSE, MAE e SSE, e mostra resíduos do ajuste.'],
  'linear-algebra-computation':['Álgebra linear','Resultados algébricos com determinante, produto vetorial e solução linear.'],
  'data-advanced':['Dados','Regressões logarítmica e sigmoidal, histograma e interseções automáticas.']
};

PRESETS.forEach(preset=>{
  const [category,description]=PRESET_DETAILS[preset.id] || ['Outros',''];
  preset.category=category;
  preset.description=description;
});

export function getPreset(id){
  return PRESETS.find(p=>p.id===id) || PRESETS[0];
}
