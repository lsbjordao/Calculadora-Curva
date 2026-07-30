"use strict";

const BASE_LESSONS=[
  {
    id:'integral-area',
    label:'Integral: área',
    summary:'Área sinalizada sob a curva, com intervalo ajustável.',
    steps:[
      {
        title:'Área positiva',
        text:'A integral em [0, 3] soma a área acima do eixo x. Para f(x)=x, o valor cresce como um triângulo.',
        focus:'Compare o sombreado com o valor numérico de ∫[0,3].',
        checkpoint:{
          prompt:'Checkpoint: mude o campo b da integral para 4.',
          success:'Evento executado: limite superior atualizado.',
          next:'Agora a área vale perto de 8, porque a integral de x em [0,b] é b²/2.',
          check:{type:'number-field',eq:0,field:'ib',value:4,tol:1e-9}
        },
        scene:{
          view:{cx:1.35,cy:1.45,scale:72},
          equations:[
            {text:'x',name:'reta positiva',showI:true,showA:true,ia:0,ib:3,dx:1.5},
            {text:'0',name:'eixo de referência',style:'dotted'}
          ]
        }
      },
      {
        title:'Área sinalizada',
        text:'Quando a curva fica abaixo do eixo x, a integral entra com sinal negativo. Em um período completo do seno, as áreas se cancelam.',
        focus:'Observe que ∫[0, 2π] de sin(x) fica perto de zero.',
        checkpoint:{
          prompt:'Checkpoint: mude b para 3.1416 e isole só o primeiro meio período.',
          success:'Evento executado: intervalo encurtado.',
          next:'A área não cancela mais; no intervalo [0,π], sin(x) acumula valor perto de 2.',
          check:{type:'number-field',eq:0,field:'ib',value:3.1416,tol:0.02}
        },
        scene:{
          view:{cx:3.15,cy:0,scale:66},
          equations:[
            {text:'sin(x)',name:'seno',showI:true,showA:true,ia:0,ib:6.2832},
            {text:'0',name:'eixo de referência',style:'dotted'}
          ]
        }
      },
      {
        title:'Acumulada',
        text:'A linha pontilhada mostra a integral acumulada. Ela sobe quando f é positiva, desce quando f é negativa e fica mais íngreme quando |f| aumenta.',
        focus:'Use o cursor sobre a curva para comparar f(x) e ∫f.',
        checkpoint:{
          prompt:'Checkpoint: mude o limite b da área definida para 3.',
          success:'Evento executado: nova área definida.',
          next:'A curva acumulada continua ancorada em 0, enquanto o sombreado usa o intervalo escolhido.',
          check:{type:'number-field',eq:0,field:'ib',value:3,tol:1e-9}
        },
        scene:{
          view:{cx:0,cy:0,scale:54},
          equations:[
            {text:'x^2-1',name:'função',showI:true,showA:true,ia:-1,ib:2},
            {text:'0',name:'eixo de referência',style:'dotted'}
          ]
        }
      }
    ]
  },
  {
    id:'derivatives',
    label:'Derivadas: tangente',
    summary:'Inclinação local, reta tangente e segunda derivada.',
    steps:[
      {
        title:'Inclinação local',
        text:'A derivada mede a inclinação instantânea. Em x=1, a parábola x² tem inclinação próxima de 2.',
        focus:'Altere o campo x para mover o ponto de tangência.',
        checkpoint:{
          prompt:'Checkpoint: mude o x da derivada para 2.',
          success:'Evento executado: ponto de tangência movido.',
          next:'Em x=2, a inclinação de x² fica perto de 4, como mostra a reta derivada 2x.',
          check:{type:'number-field',eq:0,field:'dx',value:2,tol:1e-9}
        },
        scene:{
          view:{cx:0,cy:0,scale:56},
          equations:[
            {text:'x^2',name:'parábola',showD:true,showA:true,dx:1},
            {text:'2x',name:'derivada esperada',style:'dashed'}
          ]
        }
      },
      {
        title:'Concavidade',
        text:'A segunda derivada resume a curvatura. Funções com f″ positiva ficam côncavas para cima na janela observada.',
        focus:'Compare f′ e f″ com os marcadores de extremos.',
        checkpoint:{
          prompt:'Checkpoint: mude o x da derivada para -1.',
          success:'Evento executado: ponto local movido.',
          next:'A primeira derivada muda com o ponto; a segunda derivada mostra a curvatura local.',
          check:{type:'number-field',eq:0,field:'dx',value:-1,tol:1e-9}
        },
        scene:{
          view:{cx:0,cy:0,scale:44},
          equations:[
            {text:'x^3-3x',name:'cúbica',showD:true,showD2:true,showA:true,dx:1},
            {text:'3x^2-3',name:'f′ conhecida',style:'dashed'}
          ]
        }
      },
      {
        title:'Normal',
        text:'A reta normal é perpendicular à tangente. Ela ajuda a ver que tangente e normal descrevem direções locais diferentes no mesmo ponto.',
        focus:'Ative e desative normal no controle da derivada.',
        checkpoint:{
          prompt:'Checkpoint: ative o botão normal no controle da derivada.',
          success:'Evento executado: reta normal exibida.',
          next:'Com tangente e normal juntas, o ponto local mostra duas direções perpendiculares.',
          check:{type:'equals',eq:0,field:'showNormal',value:true}
        },
        scene:{
          view:{cx:0,cy:0,scale:54},
          equations:[
            {text:'sin(x)',name:'seno',showD:true,showNormal:false,showA:true,dx:0.8}
          ]
        }
      }
    ]
  },
  {
    id:'limits-continuity',
    label:'Limites: continuidade',
    summary:'Saltos, furos removíveis e limites no infinito.',
    steps:[
      {
        title:'Furo removível',
        text:'A função não está definida em x=1, mas o limite existe. O gráfico se aproxima do mesmo valor pelos dois lados.',
        focus:'O marcador vazado mostra o valor que preencheria o furo.',
        checkpoint:{
          prompt:'Checkpoint: mude o ponto do limite para x=0.',
          success:'Evento executado: ponto de limite deslocado.',
          next:'Fora do furo, o limite coincide com o valor ordinário da função.',
          check:{type:'number-field',eq:0,field:'lx',value:0,tol:1e-9}
        },
        scene:{
          view:{cx:1,cy:2,scale:82},
          equations:[
            {text:'(x^2-1)/(x-1)',name:'furo em x=1',showL:true,showA:true,lx:1}
          ]
        }
      },
      {
        title:'Salto',
        text:'No degrau, os limites laterais são diferentes. Por isso, o limite bilateral no ponto de salto não existe.',
        focus:'Compare os valores esquerdo e direito no painel de leitura.',
        checkpoint:{
          prompt:'Checkpoint: mude o ponto do limite para x=1.',
          success:'Evento executado: saiu do ponto de salto.',
          next:'Em x=1, a função já está no patamar constante e o limite bilateral volta a existir.',
          check:{type:'number-field',eq:0,field:'lx',value:1,tol:1e-9}
        },
        scene:{
          view:{cx:0,cy:0.5,scale:92},
          equations:[
            {text:'piecewise(x < 0, -1, 1)',name:'degrau',showL:true,showA:true,lx:0}
          ]
        }
      },
      {
        title:'No infinito',
        text:'Algumas funções se aproximam de uma altura fixa quando x cresce muito. Isso aparece como uma assíntota horizontal.',
        focus:'Veja o limite x→+∞ destacado como linha horizontal.',
        checkpoint:{
          prompt:'Checkpoint: troque o limite para x→-∞.',
          success:'Evento executado: direção do infinito alterada.',
          next:'Comparar +∞ e -∞ ajuda a perceber quando os dois lados têm a mesma assíntota.',
          check:{type:'equals',eq:0,field:'lInf',value:'-'}
        },
        scene:{
          view:{cx:0,cy:1.1,scale:70},
          equations:[
            {text:'(2x+1)/(x+1)',name:'racional',showL:true,showA:true,lInf:'+'},
            {text:'2',name:'assíntota esperada',style:'dashed'}
          ]
        }
      }
    ]
  },
  {
    id:'parameters-transform',
    label:'Parâmetros: transformações',
    summary:'Famílias de curvas com controles deslizantes.',
    steps:[
      {
        title:'Parábola transformada',
        text:'Em a*(x-b)^2+c, a controla abertura, b desloca no eixo x e c desloca no eixo y.',
        focus:'Varie a, b e c para acompanhar o vértice.',
        checkpoint:{
          prompt:'Checkpoint: mude o parâmetro b para 1.',
          success:'Evento executado: vértice deslocado.',
          next:'O vértice acompanha b horizontalmente; c controla a altura desse vértice.',
          check:{type:'number-param',eq:0,param:'b',value:1,tol:1e-9}
        },
        scene:{
          view:{cx:0,cy:0,scale:48},
          equations:[
            {text:'a*(x-b)^2+c',name:'família quadrática',params:{a:1,b:0,c:0},showD:true,showA:true}
          ]
        }
      },
      {
        title:'Senoide',
        text:'Na senoide, a muda a amplitude, k muda a frequência, b desloca a fase e c move a linha média.',
        focus:'Use os sliders para transformar a onda sem reescrever a expressão.',
        checkpoint:{
          prompt:'Checkpoint: mude o parâmetro k para 2.',
          success:'Evento executado: frequência alterada.',
          next:'Com k=2, a onda completa ciclos mais rápido na mesma janela.',
          check:{type:'number-param',eq:0,param:'k',value:2,tol:1e-9}
        },
        scene:{
          view:{cx:0,cy:0,scale:46},
          equations:[
            {text:'a*sin(k*x+b)+c',name:'senoide parametrizada',params:{a:1,k:1,b:0,c:0},showD:true,showA:true},
            {text:'c',name:'linha média',params:{c:0},style:'dotted'}
          ]
        }
      },
      {
        title:'Crescimento',
        text:'Parâmetros também servem para comparar modelos de crescimento e saturação sem trocar de gráfico.',
        focus:'Mude k para ver a taxa crescer ou desacelerar.',
        checkpoint:{
          prompt:'Checkpoint: mude o parâmetro k da sigmoide para 2.',
          success:'Evento executado: transição mais rápida.',
          next:'A derivada fica mais concentrada perto do centro quando k aumenta.',
          check:{type:'number-param',eq:0,param:'k',value:2,tol:1e-9}
        },
        scene:{
          view:{cx:0,cy:1,scale:58},
          equations:[
            {text:'1/(1+exp(-k*(x-a)))',name:'sigmoide',params:{k:1,a:0},showD:true,showL:true,showA:true},
            {text:'a*exp(k*x)+c',name:'exponencial',params:{a:1,k:0.5,c:0},style:'dashed'}
          ]
        }
      },
      {
        title:'Transformação linear',
        text:'Uma matriz 2x2 transforma os vetores de base e o quadrado unitário. O determinante mede a mudança de área orientada.',
        focus:'Compare o quadrado original implícito nos eixos com o paralelogramo transformado.',
        checkpoints:[
          {
            prompt:'Checkpoint: mude o parâmetro b para 1.',
            success:'Evento executado: cisalhamento ampliado.',
            next:'O vetor A j se desloca mais para a direita e o determinante continua 1.',
            check:{type:'number-param',eq:0,param:'b',value:1,tol:1e-9}
          },
          {
            prompt:'Checkpoint: mude b para -1.',
            success:'Evento executado: cisalhamento no sentido oposto.',
            next:'O determinante continua 1; a área fica preservada mesmo com inclinação invertida.',
            check:{type:'number-param',eq:0,param:'b',value:-1,tol:1e-9}
          }
        ],
        scene:{
          view:{cx:0.8,cy:0.8,scale:92},
          equations:[
            {text:'matriz: [1,b; 0,1]',name:'cisalhamento',params:{b:0.6}}
          ]
        }
      }
    ]
  },
  {
    id:'analytic-geometry',
    label:'Geometria analítica',
    summary:'Pontos, distâncias, ponto médio, retas e interseções.',
    steps:[
      {
        title:'Distância entre pontos',
        text:'A distância entre dois pontos é o comprimento do segmento que liga as coordenadas. O vetor diferença aparece como delta no painel da curva.',
        focus:'Veja o segmento AB e o valor d(A,B) calculado automaticamente.',
        checkpoints:[
          {
            prompt:'Checkpoint: troque o ponto B para (6,8).',
            success:'Evento executado: distância recalculada.',
            next:'Como o delta dobrou de (3,4) para (6,8), a distância também dobra de 5 para 10.',
            check:{type:'geometry-distance',eq:1,value:10,tol:1e-9}
          },
          {
            prompt:'Checkpoint: adicione C=(-2,1) na linha de pontos.',
            success:'Evento executado: terceiro ponto criado.',
            next:'Agora a cena tem objetos nomeados suficientes para trocar o cálculo entre AB, AC e BC sem reescrever coordenadas.',
            check:{type:'geometry-point',eq:0,label:'C',x:-2,y:1,tol:1e-9}
          },
          {
            prompt:'Checkpoint: troque a distância para dist: A,C.',
            success:'Evento executado: cálculo reutilizando nomes.',
            next:'A linha de distância passou a depender dos objetos A e C definidos acima.',
            check:{type:'all',checks:[
              {type:'text-contains',eq:1,value:'dist: A,C'},
              {type:'geometry-distance',eq:1,value:2.2360679775,tol:1e-6}
            ]}
          }
        ],
        scene:{
          view:{cx:2,cy:2.8,scale:58},
          equations:[
            {text:'ponto: A=(0,0), B=(3,4)',name:'pontos'},
            {text:'dist: A,B',name:'distância AB'}
          ]
        }
      },
      {
        title:'Ponto médio',
        text:'O ponto médio fica exatamente na metade do segmento. Ele é calculado pela média das coordenadas x e y.',
        focus:'Compare M com os extremos A e B.',
        checkpoints:[
          {
            prompt:'Checkpoint: troque B para (4,2).',
            success:'Evento executado: ponto médio movido.',
            next:'M passa a ser (2,1), a média entre (0,0) e (4,2).',
            check:{type:'geometry-point',eq:1,label:'M',x:2,y:1,tol:1e-9}
          },
          {
            prompt:'Checkpoint: renomeie o resultado para N = medio(A,B).',
            success:'Evento executado: ponto médio nomeado como N.',
            next:'Nomear construções ajuda a reutilizar resultados em outras retas, segmentos e interseções.',
            check:{type:'all',checks:[
              {type:'text-contains',eq:1,value:'N = medio'},
              {type:'geometry-point',eq:1,label:'N',x:2,y:1,tol:1e-9}
            ]}
          }
        ],
        scene:{
          view:{cx:1.7,cy:1.2,scale:80},
          equations:[
            {text:'ponto: A=(0,0), B=(3,4)',name:'pontos'},
            {text:'M = medio(A,B)',name:'ponto médio'}
          ]
        }
      },
      {
        title:'Reta por dois pontos',
        text:'Dois pontos distintos definem uma única reta. O painel mostra a forma y = mx + b quando a reta não é vertical.',
        focus:'A reta passa pelos dois marcadores e se estende por toda a janela.',
        checkpoints:[
          {
            prompt:'Checkpoint: troque o segundo ponto para (2,4).',
            success:'Evento executado: inclinação alterada.',
            next:'A inclinação aumenta porque o mesmo avanço horizontal produz uma subida maior.',
            check:{type:'text-contains',eq:0,value:'(2,4)'}
          },
          {
            prompt:'Checkpoint: troque a reta para r = reta(A,B) se ainda não estiver assim.',
            success:'Evento executado: reta vinculada aos pontos nomeados.',
            next:'Agora mudar A ou B atualiza a reta sem editar a fórmula da reta.',
            check:{type:'text-contains',eq:1,value:'r = reta(A,B)'}
          }
        ],
        scene:{
          view:{cx:1,cy:1.4,scale:68},
          equations:[
            {text:'ponto: A=(0,0), B=(3,2)',name:'pontos'},
            {text:'r = reta(A,B)',name:'reta AB'}
          ]
        }
      },
      {
        title:'Interseção de retas',
        text:'A interseção resolve automaticamente o ponto comum entre duas retas. Retas paralelas não geram ponto real.',
        focus:'O marcador P aparece onde as duas direções se cruzam.',
        checkpoints:[
          {
            prompt:'Checkpoint: troque a segunda reta para line((0,2),(4,0)).',
            success:'Evento executado: interseção deslocada.',
            next:'P muda porque uma das retas passou a cortar a primeira em outra coordenada.',
            check:{type:'text-contains',eq:1,value:'(0,2),(4,0)'}
          },
          {
            prompt:'Checkpoint: nomeie a interseção como P = intersecao(r; line((0,2),(4,0))).',
            success:'Evento executado: ponto de interseção nomeado.',
            next:'Com P nomeado, ele pode virar entrada para novas construções.',
            check:{type:'text-contains',eq:1,value:'P = intersecao'}
          }
        ],
        scene:{
          view:{cx:1.7,cy:1.1,scale:78},
          equations:[
            {text:'r = reta((0,0),(3,3))',name:'reta r'},
            {text:'intersecao: r; line((0,3),(3,0))',name:'r ∩ s'}
          ]
        }
      }
    ]
  },
  {
    id:'conic-tools',
    label:'Cônicas: análise',
    summary:'Centro, raio, eixos, focos e diretrizes em cônicas usuais.',
    steps:[
      {
        title:'Circunferência',
        text:'A circunferência é reconhecida quando os coeficientes de x² e y² são iguais. O centro e o raio aparecem no painel.',
        focus:'O segmento pontilhado marca o raio a partir do centro.',
        checkpoints:[
          {
            prompt:'Checkpoint: troque 4 por 9 para aumentar o raio.',
            success:'Evento executado: raio alterado.',
            next:'O raio passa de 2 para 3 porque x² + y² = r².',
            check:{type:'geometry-distance',eq:0,value:3,tol:1e-9}
          },
          {
            prompt:'Checkpoint: desloque o centro usando (x-1)^2 + (y+1)^2 = 9.',
            success:'Evento executado: centro deslocado.',
            next:'O centro deixa a origem e passa para (1,-1), enquanto o raio continua 3.',
            check:{type:'geometry-point',eq:0,label:'C',x:1,y:-1,tol:1e-9}
          }
        ],
        scene:{
          view:{cx:0,cy:0,scale:66},
          equations:[
            {text:'conica: x^2 + y^2 = 4',name:'circunferência'}
          ]
        }
      },
      {
        title:'Elipse',
        text:'Na elipse, os semieixos indicam as larguras principal e secundária. Os focos ficam sobre o eixo maior.',
        focus:'Compare os focos F1 e F2 com o centro C.',
        checkpoints:[
          {
            prompt:'Checkpoint: troque x^2/9 por x^2/16.',
            success:'Evento executado: eixo maior alongado.',
            next:'O eixo maior cresce horizontalmente e os focos se afastam do centro.',
            check:{type:'text-contains',eq:0,value:'x^2/16'}
          },
          {
            prompt:'Checkpoint: troque y^2/4 por y^2/9.',
            success:'Evento executado: eixo menor também cresceu.',
            next:'Quando os semieixos se aproximam, os focos se aproximam do centro.',
            check:{type:'text-contains',eq:0,value:'y^2/9'}
          }
        ],
        scene:{
          view:{cx:0,cy:0,scale:54},
          equations:[
            {text:'conica: x^2/9 + y^2/4 = 1',name:'elipse'}
          ]
        }
      },
      {
        title:'Hipérbole',
        text:'A hipérbole tem centro, focos e eixo real. O sinal oposto entre os termos quadráticos separa os dois ramos.',
        focus:'Observe que os focos ficam fora do intervalo entre os vértices.',
        checkpoints:[
          {
            prompt:'Checkpoint: troque y^2/4 por y^2/9.',
            success:'Evento executado: eixo conjugado alterado.',
            next:'O formato abre com outra curvatura e os focos mudam de posição.',
            check:{type:'text-contains',eq:0,value:'y^2/9'}
          },
          {
            prompt:'Checkpoint: troque x^2/4 por x^2/9.',
            success:'Evento executado: eixo real alongado.',
            next:'O eixo real maior afasta os vértices e muda a distância focal.',
            check:{type:'text-contains',eq:0,value:'x^2/9'}
          }
        ],
        scene:{
          view:{cx:0,cy:0,scale:50},
          equations:[
            {text:'conica: x^2/4 - y^2/4 = 1',name:'hipérbole'}
          ]
        }
      },
      {
        title:'Parábola',
        text:'A parábola mostra vértice, foco, eixo e diretriz. A abertura depende da distância entre vértice e foco.',
        focus:'O foco F e a diretriz ficam em lados opostos do vértice.',
        checkpoints:[
          {
            prompt:'Checkpoint: troque y = x^2/2 por y = x^2/4.',
            success:'Evento executado: parábola mais aberta.',
            next:'A distância focal aumenta, então a curva abre mais lentamente.',
            check:{type:'text-contains',eq:0,value:'x^2/4'}
          },
          {
            prompt:'Checkpoint: troque para x = y^2/4.',
            success:'Evento executado: orientação horizontal.',
            next:'A diretriz passa a ser vertical e o foco se desloca no eixo x.',
            check:{type:'text-contains',eq:0,value:'x = y^2/4'}
          }
        ],
        scene:{
          view:{cx:0,cy:1.2,scale:72},
          equations:[
            {text:'conica: y = x^2/2',name:'parábola'}
          ]
        }
      }
    ]
  },
  {
    id:'linear-algebra',
    label:'Álgebra linear 2D',
    summary:'Vetores, matrizes 2x2, determinante e transformações do plano.',
    steps:[
      {
        title:'Vetor como deslocamento',
        text:'Um vetor pode ser visto como uma seta entre dois pontos. Suas componentes mostram deslocamento horizontal e vertical.',
        focus:'O painel mostra as componentes e o comprimento do vetor.',
        checkpoints:[
          {
            prompt:'Checkpoint: troque o ponto final para (3,2).',
            success:'Evento executado: vetor atualizado.',
            next:'As componentes passam a ser (3,2), partindo da origem.',
            check:{type:'text-contains',eq:0,value:'(3,2)'}
          },
          {
            prompt:'Checkpoint: troque o início para (1,1), mantendo o fim em (3,2).',
            success:'Evento executado: vetor como deslocamento entre pontos.',
            next:'O vetor desenhado agora representa o deslocamento de (1,1) até (3,2), não só uma seta saindo da origem.',
            check:{type:'text-contains',eq:0,value:'(1,1),(3,2)'}
          }
        ],
        scene:{
          view:{cx:1.2,cy:0.8,scale:90},
          equations:[
            {text:'vetor: (0,0),(2,1)',name:'vetor v'}
          ]
        }
      },
      {
        title:'Matriz identidade',
        text:'A identidade mantém os vetores de base no lugar. O quadrado unitário transformado continua quadrado.',
        focus:'A i e A j coincidem com as direções dos eixos.',
        checkpoints:[
          {
            prompt:'Checkpoint: troque a entrada superior direita para 0.5.',
            success:'Evento executado: identidade virou cisalhamento.',
            next:'A base j foi deslocada horizontalmente e o quadrado virou paralelogramo.',
            check:{type:'number-param',eq:0,param:'b',value:0.5,tol:1e-9}
          },
          {
            prompt:'Checkpoint: mude c para 0.5.',
            success:'Evento executado: a base i também inclinou.',
            next:'Agora as duas colunas da matriz participam da deformação do quadrado unitário.',
            check:{type:'number-param',eq:0,param:'c',value:0.5,tol:1e-9}
          }
        ],
        scene:{
          view:{cx:0.75,cy:0.75,scale:110},
          equations:[
            {text:'matriz: [a,b; c,d]',name:'identidade',params:{a:1,b:0,c:0,d:1}}
          ]
        }
      },
      {
        title:'Determinante',
        text:'O determinante mede quanto a matriz escala áreas. Quando ele é zero, o plano colapsa numa linha.',
        focus:'Compare a área do paralelogramo com o valor det no painel.',
        checkpoints:[
          {
            prompt:'Checkpoint: mude o parâmetro d para 0.',
            success:'Evento executado: determinante zerado.',
            next:'O paralelogramo colapsa e a transformação deixa de ser invertível.',
            check:{type:'computed-field',eq:0,path:'geometry.matrix.det',value:0,tol:1e-9}
          },
          {
            prompt:'Checkpoint: mude d para -1.',
            success:'Evento executado: orientação invertida.',
            next:'O determinante fica negativo, indicando inversão de orientação.',
            check:{type:'computed-field',eq:0,path:'geometry.matrix.det',value:-2,tol:1e-9}
          }
        ],
        scene:{
          view:{cx:0.8,cy:0.8,scale:100},
          equations:[
            {text:'matriz: [a,b; c,d]',name:'escala de área',params:{a:2,b:0,c:0,d:1}}
          ]
        }
      },
      {
        title:'Rotação',
        text:'A matriz [0,-1; 1,0] gira a base em 90 graus. O determinante 1 preserva área e orientação positiva.',
        focus:'Acompanhe para onde vão os vetores i e j.',
        checkpoints:[
          {
            prompt:'Checkpoint: troque -1 por 1.',
            success:'Evento executado: reflexão combinada.',
            next:'A área continua preservada em módulo, mas a orientação muda quando o determinante fica negativo.',
            check:{type:'text-contains',eq:0,value:'[0,1;'}
          },
          {
            prompt:'Checkpoint: troque a matriz para [0,1; -1,0].',
            success:'Evento executado: rotação no sentido oposto.',
            next:'A nova matriz preserva área, mas gira a base no sentido horário.',
            check:{type:'text-contains',eq:0,value:'[0,1; -1,0]'}
          }
        ],
        scene:{
          view:{cx:0,cy:0.6,scale:100},
          equations:[
            {text:'matriz: [0,-1; 1,0]',name:'rotação 90°'}
          ]
        }
      }
    ]
  },
  {
    id:'implicit-regions',
    label:'Regiões implícitas',
    summary:'Inequações explícitas, discos e relações f(x,y)=0 como regiões no plano.',
    steps:[
      {
        title:'Abaixo ou acima da curva',
        text:'Uma inequação explícita como y < x^2 - 1 preenche uma região inteira, não apenas a fronteira. A curva pontilhada ajuda a separar borda e área.',
        focus:'Compare a região sombreada com a parábola de referência.',
        checkpoint:{
          prompt:'Checkpoint: troque y < x^2 - 1 por y <= x^2 - 1.',
          success:'Evento executado: fronteira incluída.',
          next:'A região é quase a mesma, mas a borda deixa de ser estrita. Essa diferença importa quando a própria fronteira faz parte da solução.',
          check:{type:'text-contains',eq:0,value:'y <= x^2 - 1'}
        },
        scene:{
          view:{cx:0,cy:0,scale:64},
          equations:[
            {text:'y < x^2 - 1',name:'região abaixo'},
            {text:'x^2 - 1',name:'fronteira',style:'dashed'}
          ]
        }
      },
      {
        title:'Disco por inequação implícita',
        text:'Em x^2 + y^2 < 4, o app avalia a desigualdade em duas variáveis e sombreia o interior do círculo. A equação x^2 + y^2 = 4 fica como fronteira.',
        focus:'Veja que uma expressão com x e y descreve diretamente uma região do plano.',
        checkpoint:{
          prompt:'Checkpoint: troque o raio ao editar a região para x^2 + y^2 < 9.',
          success:'Evento executado: disco ampliado.',
          next:'Como 9 = 3^2, o raio do disco passou de 2 para 3.',
          check:{type:'text-contains',eq:0,value:'< 9'}
        },
        scene:{
          view:{cx:0,cy:0,scale:74},
          equations:[
            {text:'x^2 + y^2 < 4',name:'disco'},
            {text:'x^2 + y^2 = 4',name:'fronteira',style:'dashed'}
          ]
        }
      },
      {
        title:'Relação implícita periódica',
        text:'Nem toda curva precisa ser y=f(x). Em sin(x)=cos(y), x e y entram de forma simétrica na amostragem e a curva aparece como uma malha de relações possíveis.',
        focus:'Use o zoom para perceber o padrão repetido.',
        checkpoint:{
          prompt:'Checkpoint: troque cos(y) por sin(y).',
          success:'Evento executado: relação periódica alterada.',
          next:'A simetria muda: agora a relação compara a mesma função nos dois eixos.',
          check:{type:'text-contains',eq:0,value:'sin(x) = sin(y)'}
        },
        scene:{
          view:{cx:0,cy:0,scale:46},
          equations:[
            {text:'sin(x) = cos(y)',name:'relação periódica'}
          ]
        }
      }
    ]
  },
  {
    id:'riemann-methods',
    label:'Somas de Riemann',
    summary:'Aproximações de área por retângulos e trapézios antes da integral exata.',
    steps:[
      {
        title:'Poucos retângulos',
        text:'Uma Soma de Riemann troca área contínua por blocos. Com poucos subintervalos, o erro ainda é visível, especialmente em curvas que crescem.',
        focus:'Compare os retângulos com o sombreado da integral definida.',
        checkpoint:{
          prompt:'Checkpoint: aumente n para 16.',
          success:'Evento executado: partição refinada.',
          next:'Com mais subintervalos, os blocos acompanham melhor a curva e o erro diminui.',
          check:{type:'number-field',eq:0,field:'riemannN',value:16,tol:1e-9}
        },
        scene:{
          view:{cx:1.6,cy:2.2,scale:60},
          equations:[
            {text:'x^2',name:'integrando',showI:true,showR:true,ia:0,ib:3,riemannN:6,riemannMode:'left',showA:true},
            {text:'0',name:'eixo',style:'dotted'}
          ]
        }
      },
      {
        title:'Ponto médio e trapézio',
        text:'Mudar o modo de amostragem muda o erro. O ponto médio costuma melhorar retângulos; o trapézio usa a inclinação entre extremos.',
        focus:'O mesmo intervalo pode gerar estimativas diferentes sem mudar a função.',
        checkpoint:{
          prompt:'Checkpoint: troque o modo para trap.',
          success:'Evento executado: regra do trapézio ativada.',
          next:'O trapézio usa uma borda inclinada em cada subintervalo, aproximando melhor curvas suaves em muitos casos.',
          check:{type:'equals',eq:0,field:'riemannMode',value:'trap'}
        },
        scene:{
          view:{cx:0.8,cy:0.8,scale:88},
          equations:[
            {text:'cos(x)',name:'integrando',showI:true,showR:true,ia:0,ib:1.5708,riemannN:8,riemannMode:'mid',showA:true},
            {text:'0',name:'eixo',style:'dotted'}
          ]
        }
      },
      {
        title:'Área com sinal',
        text:'Quando o intervalo atravessa o eixo x, as partes abaixo entram negativas. Riemann e integral definida aproximam a soma algébrica, não só área geométrica.',
        focus:'A região antes de x=1 cancela parte da região depois de x=1.',
        checkpoint:{
          prompt:'Checkpoint: mude a para 1 e deixe só a parte positiva.',
          success:'Evento executado: intervalo positivo isolado.',
          next:'Ao começar em x=1, a contribuição negativa desaparece e a integral passa a medir só a área acima do eixo.',
          check:{type:'number-field',eq:0,field:'ia',value:1,tol:1e-9}
        },
        scene:{
          view:{cx:1,cy:0.2,scale:76},
          equations:[
            {text:'x-1',name:'muda de sinal',showI:true,showR:true,ia:0,ib:2,riemannN:10,riemannMode:'mid',showA:true},
            {text:'0',name:'eixo',style:'dotted'}
          ]
        }
      }
    ]
  },
  {
    id:'modeling-growth',
    label:'Modelagem de crescimento',
    summary:'Escolha de família, ajuste exponencial e saturação por parâmetros.',
    steps:[
      {
        title:'Comparar famílias',
        text:'O mesmo conjunto de pontos pode receber modelos diferentes. A reta resume tendência média; a parábola e a exponencial tentam capturar curvatura.',
        focus:'Olhe os pontos antes de escolher a família de ajuste.',
        checkpoint:{
          prompt:'Checkpoint: troque o ajuste linear para fitexp.',
          success:'Evento executado: família exponencial testada.',
          next:'Quando os incrementos crescem, o modelo exponencial pode explicar melhor a tendência global.',
          check:{type:'text-contains',eq:1,value:'fitexp'}
        },
        scene:{
          view:{cx:2,cy:4,scale:52},
          equations:[
            {text:'points: (0,1),(1,1.8),(2,3.1),(3,5.2),(4,8.5)',name:'dados'},
            {text:'fit: (0,1),(1,1.8),(2,3.1),(3,5.2),(4,8.5)',name:'ajuste linear',style:'dashed'},
            {text:'fit2: (0,1),(1,1.8),(2,3.1),(3,5.2),(4,8.5)',name:'ajuste quadrático',style:'dotted'}
          ]
        }
      },
      {
        title:'Saturação logística',
        text:'Nem todo crescimento continua para sempre. A logística cresce rápido no meio, mas se aproxima de um teto p.',
        focus:'Mude k para controlar a rapidez da transição.',
        checkpoint:{
          prompt:'Checkpoint: mude k para 2.',
          success:'Evento executado: transição mais abrupta.',
          next:'A curva fica mais íngreme perto do centro a, mas mantém o mesmo teto p.',
          check:{type:'number-param',eq:0,param:'k',value:2,tol:1e-9}
        },
        scene:{
          view:{cx:0,cy:2,scale:58},
          equations:[
            {text:'p/(1+exp(-k*(x-a)))',name:'logística',params:{p:4,k:1,a:0},showD:true,showL:true,lInf:'+',showA:true},
            {text:'p',name:'teto',params:{p:4},style:'dotted'}
          ]
        }
      },
      {
        title:'Modelo de potência',
        text:'Dados de escala muitas vezes seguem uma lei de potência. O ajuste fitpow procura uma expressão y≈a*x^b usando pontos positivos.',
        focus:'Compare o ajuste de potência com uma reta nos mesmos dados.',
        checkpoint:{
          prompt:'Checkpoint: troque fitpow para fit e compare.',
          success:'Evento executado: reta comparada ao modelo de potência.',
          next:'A reta perde a curvatura multiplicativa. Escolher modelo é parte da interpretação, não só do cálculo.',
          check:{type:'text-contains',eq:1,value:'fit:'}
        },
        scene:{
          view:{cx:2.4,cy:12,scale:24},
          equations:[
            {text:'points: (1,2),(2,8),(3,18),(4,32)',name:'dados de escala'},
            {text:'fitpow: (1,2),(2,8),(3,18),(4,32)',name:'potência',style:'dashed'}
          ]
        }
      }
    ]
  }
];

function baseLesson(id){
  const lesson=BASE_LESSONS.find(item=>item.id===id);
  if(!lesson) throw new Error('aula base ausente: '+id);
  return lesson;
}

function retitleBaseLesson(id, label, summary){
  return {...baseLesson(id), label, summary};
}

function rawLessonCheckpoints(step){
  if(Array.isArray(step?.checkpoints)) return step.checkpoints;
  return step?.checkpoint ? [step.checkpoint] : [];
}

function observationCheckpoint(step){
  const focus=step?.focus || 'compare a cena com a ideia central antes de avançar.';
  return {
    prompt:'Checkpoint de observação: '+focus,
    success:'Observação registrada.',
    next:'A etapa agora tem ação e leitura visual. Avance para a próxima cena.',
    action:'confirmar observação',
    check:{type:'ack'}
  };
}

function withObservationCheckpoints(lesson){
  return {
    ...lesson,
    steps:lesson.steps.map(step=>{
      const checkpoints=rawLessonCheckpoints(step);
      if(!checkpoints.length||checkpoints.some(item=>item?.check?.type==='ack')) return step;
      const {checkpoint:_checkpoint, checkpoints:_checkpoints, ...rest}=step;
      return {...rest, checkpoints:[...checkpoints, observationCheckpoint(step)]};
    })
  };
}

export const LESSONS=[
  {
    id:'parameters-transform',
    label:'Pré-cálculo: funções',
    summary:'Transformações, módulos, trigonometria e crescimento antes dos limites.',
    steps:[
      {
        title:'Transformação de parábola',
        text:'A revisão de pré-cálculo começa lendo famílias de funções. Em a*(x-b)^2+c, o parâmetro a muda a abertura, b move o vértice na horizontal e c move a altura.',
        focus:'Mude um parâmetro por vez e acompanhe o vértice antes de pensar em limite ou derivada.',
        checkpoint:{
          prompt:'Checkpoint: mude o parâmetro b para 1.',
          success:'Evento executado: vértice deslocado.',
          next:'O vértice acompanha b. Esse mesmo cuidado com deslocamentos aparece depois em limites, derivadas e integrais.',
          check:{type:'number-param',eq:0,param:'b',value:1,tol:1e-9}
        },
        scene:{
          view:{cx:0,cy:0,scale:48},
          equations:[
            {text:'a*(x-b)^2+c',name:'família quadrática',params:{a:1,b:0,c:0},showD:true,showA:true},
            {text:'c',name:'altura do vértice',params:{c:0},style:'dotted'}
          ]
        }
      },
      {
        title:'Módulo em camadas',
        text:'O exemplo f(x)=||x-2|-1| mostra uma função construída por etapas: reta, módulo, deslocamento e outro módulo. O gráfico final tem formato de W e continua sem saltos.',
        focus:'Compare os zeros e os cantos: continuidade não significa ausência de quinas.',
        checkpoint:{
          prompt:'Checkpoint: troque x-2 por x-3 na função final.',
          success:'Evento executado: W deslocado.',
          next:'A forma não muda; a transformação horizontal apenas move os pontos especiais para a direita.',
          check:{type:'text-contains',eq:0,value:'x-3'}
        },
        scene:{
          view:{cx:2,cy:0.8,scale:68},
          equations:[
            {text:'abs(abs(x-2)-1)',name:'f(x)=||x-2|-1|',showD:true,showL:true,showA:true,lx:1},
            {text:'abs(x-2)',name:'etapa intermediária',style:'dashed'},
            {text:'abs(x-2)-1',name:'deslocada',style:'dotted'}
          ]
        }
      },
      {
        title:'Senoide com parâmetros',
        text:'Trigonometria entra no cálculo como linguagem de periodicidade. Em a*sin(k*x+b)+c, a controla amplitude, k controla frequência, b desloca a fase e c move a linha média.',
        focus:'Use os controles para separar amplitude, frequência, fase e deslocamento vertical.',
        checkpoint:{
          prompt:'Checkpoint: mude o parâmetro k para 2.',
          success:'Evento executado: frequência alterada.',
          next:'Com k=2, a mesma janela mostra mais ciclos. Esse parâmetro será importante ao derivar e integrar funções trigonométricas.',
          check:{type:'number-param',eq:0,param:'k',value:2,tol:1e-9}
        },
        scene:{
          view:{cx:0,cy:0,scale:46},
          equations:[
            {text:'a*sin(k*x+b)+c',name:'senoide parametrizada',params:{a:1,k:1,b:0,c:0},showD:true,showA:true},
            {text:'c',name:'linha média',params:{c:0},style:'dotted'}
          ]
        }
      },
      {
        title:'Crescimento e escala',
        text:'Exponenciais e logaritmos aparecem sempre que há crescimento, decaimento ou mudança de escala. Comparar exp(x) e ln(x) ajuda a fixar domínio e comportamento global.',
        focus:'Observe que ln(x+a)+c precisa de domínio positivo, enquanto exp(k*x) existe em toda a reta.',
        checkpoint:{
          prompt:'Checkpoint: mude o parâmetro k da exponencial para 0.8.',
          success:'Evento executado: crescimento acelerado.',
          next:'A taxa de crescimento muda visualmente. Mais tarde, a derivada formaliza exatamente essa taxa.',
          check:{type:'number-param',eq:0,param:'k',value:0.8,tol:1e-9}
        },
        scene:{
          view:{cx:0,cy:1.1,scale:54},
          equations:[
            {text:'a*exp(k*x)+c',name:'exponencial',params:{a:1,k:0.4,c:0},showD:true,showA:true},
            {text:'ln(x+a)+c',name:'logaritmo',params:{a:1,c:0},showL:true,showA:true,style:'dashed'}
          ]
        }
      }
    ]
  },
  {
    id:'inverse-functions',
    label:'Funções inversas',
    summary:'Espelho em y=x, domínio/imagem e por que restringir domínio muda tudo.',
    steps:[
      {
        title:'Exponencial e logaritmo no espelho',
        text:'Uma função inversa desfaz a outra. No plano, exp(x) e ln(x) aparecem como reflexos em torno da reta y=x: trocar entrada e saída troca x por y.',
        focus:'Compare pontos correspondentes: se exp(1) fica perto de 2,718, então ln(2,718) volta para perto de 1.',
        checkpoint:{
          prompt:'Checkpoint: mude o ponto do limite do logaritmo para x=2.718.',
          success:'Evento executado: o logaritmo voltou perto de 1.',
          next:'O gráfico reforça a ideia de desfazer: a saída da exponencial vira entrada do logaritmo.',
          check:{type:'number-field',eq:1,field:'lx',value:2.718,tol:0.01}
        },
        scene:{
          view:{cx:1.25,cy:1.25,scale:66},
          equations:[
            {text:'exp(x)',name:'exponencial',showA:true,style:'solid'},
            {text:'ln(x)',name:'logaritmo',showL:true,showA:true,lx:1,style:'dashed'},
            {text:'x',name:'espelho y=x',style:'dotted'}
          ]
        }
      },
      {
        title:'Domínio vira imagem',
        text:'O logaritmo só aceita entradas positivas. Ao deslocar ln(x-a), a barreira vertical também desloca; isso mostra que domínio não é detalhe técnico, é parte da definição.',
        focus:'Mova a barreira a e veja onde o gráfico deixa de existir.',
        checkpoint:{
          prompt:'Checkpoint: mude o parâmetro a para 1.',
          success:'Evento executado: domínio deslocado.',
          next:'A curva começa à direita de x=1; a restrição do domínio virou informação visível.',
          check:{type:'number-param',eq:0,param:'a',value:1,tol:1e-9}
        },
        scene:{
          view:{cx:1.3,cy:0,scale:64},
          equations:[
            {text:'ln(x-a)+c',name:'log deslocado',params:{a:0,c:0},showL:true,showA:true,lx:2},
            {text:'x',name:'referência y=x',style:'dotted'}
          ]
        }
      },
      {
        title:'Quadrado só inverte depois do recorte',
        text:'A parábola inteira não tem inversa como função, porque uma mesma altura vem de dois valores de x. Quando olhamos só x>=0, sqrt(x) vira a volta natural de x^2.',
        focus:'Compare x^2 com sqrt(x) e a reta y=x; o recorte mental x>=0 é a parte decisiva.',
        checkpoint:{
          prompt:'Checkpoint: troque a parábola para x^2 {x >= 0}.',
          success:'Evento executado: domínio restringido.',
          next:'Depois do recorte, cada altura positiva corresponde a um único x e a inversa faz sentido como função.',
          check:{type:'text-contains',eq:0,value:'{x >= 0}'}
        },
        scene:{
          view:{cx:1.7,cy:1.7,scale:70},
          equations:[
            {text:'x^2',name:'quadrado'},
            {text:'sqrt(x)',name:'raiz quadrada',style:'dashed'},
            {text:'x',name:'espelho y=x',style:'dotted'}
          ]
        }
      }
    ]
  },
  retitleBaseLesson(
    'analytic-geometry',
    'Pré-cálculo: geometria',
    'Pontos, distância, ponto médio, retas e interseções antes das curvas de cálculo.'
  ),
  retitleBaseLesson(
    'conic-tools',
    'Pré-cálculo: cônicas',
    'Circunferência, elipse, hipérbole e parábola como repertório gráfico inicial.'
  ),
  {
    id:'limits-continuity',
    label:'Limites: tendência',
    summary:'Salto, furo, continuidade e infinito na ordem dos capítulos de limites.',
    steps:[
      {
        title:'Salto: preço do estacionamento',
        text:'O primeiro exemplo de limite é uma função que pula. Perto de 1 hora, a esquerda tende a 10 e a direita tende a 18; como os lados discordam, o limite bilateral não existe.',
        focus:'O limite olha a vizinhança do ponto. O valor exato no ponto não conserta um salto.',
        checkpoint:{
          prompt:'Checkpoint: mude o ponto do limite para x=3.',
          success:'Evento executado: segundo salto analisado.',
          next:'Em x=3 acontece a mesma ideia: os limites laterais representam patamares diferentes.',
          check:{type:'number-field',eq:0,field:'lx',value:3,tol:1e-9}
        },
        scene:{
          view:{cx:2,cy:16.5,scale:22},
          equations:[
            {text:'piecewise(x <= 1, 10, piecewise(x <= 3, 18, 25))',name:'preço por horas',showL:true,showA:true,lx:1},
            {text:'10',name:'patamar inicial',style:'dotted'},
            {text:'18',name:'patamar intermediário',style:'dotted'}
          ]
        }
      },
      {
        title:'Furo removível',
        text:'No exemplo f(x)=(x^2-9)/(x-3), com valor imposto f(3)=12, o gráfico se comporta como a reta x+3 perto de 3. O limite é 6, não 12.',
        focus:'Simplifique mentalmente x^2-9=(x-3)(x+3) e compare o furo com a reta tracejada.',
        checkpoint:{
          prompt:'Checkpoint: mude o ponto do limite para x=2.',
          success:'Evento executado: ponto regular analisado.',
          next:'Fora do furo, o limite coincide com o valor ordinário da reta x+3.',
          check:{type:'number-field',eq:0,field:'lx',value:2,tol:1e-9}
        },
        scene:{
          view:{cx:3,cy:6,scale:52},
          equations:[
            {text:'piecewise(x == 3, 12, (x^2-9)/(x-3))',name:'furo com valor imposto',showL:true,showA:true,lx:3},
            {text:'x+3',name:'reta simplificada',style:'dashed'}
          ]
        }
      },
      {
        title:'Continuidade: substituição direta',
        text:'Quando a função é contínua no ponto, calcular o limite é substituir. Polinômios, seno, cosseno, exponenciais e logaritmos valem assim dentro do domínio.',
        focus:'Compare um polinômio e cos(2x): nos dois casos o limite acompanha o valor da função.',
        checkpoint:{
          prompt:'Checkpoint: mude o ponto do limite do polinômio para x=0.',
          success:'Evento executado: substituição direta em outro ponto.',
          next:'Como não há salto, furo nem assíntota, o limite muda junto com o valor da função.',
          check:{type:'number-field',eq:0,field:'lx',value:0,tol:1e-9}
        },
        scene:{
          view:{cx:0.7,cy:0,scale:66},
          equations:[
            {text:'x^3+2x^2-3x+1',name:'polinômio contínuo',showL:true,showA:true,lx:1},
            {text:'cos(2x)',name:'trigonométrica contínua',showL:true,showA:true,lx:1.5708,style:'dashed'}
          ]
        }
      },
      {
        title:'Assíntota no infinito',
        text:'No exemplo (2x+1)/(x-3), dividir por x mostra que os termos 1/x e 3/x desaparecem no infinito. A curva se aproxima da reta y=2.',
        focus:'Compare a assíntota horizontal y=2 com a assíntota vertical em x=3.',
        checkpoint:{
          prompt:'Checkpoint: troque o limite para x→-∞.',
          success:'Evento executado: outro infinito comparado.',
          next:'Neste racional, +∞ e -∞ levam à mesma assíntota horizontal.',
          check:{type:'equals',eq:0,field:'lInf',value:'-'}
        },
        scene:{
          view:{cx:3,cy:2,scale:38},
          equations:[
            {text:'(2x+1)/(x-3)',name:'racional do exemplo',showL:true,showA:true,lInf:'+'},
            {text:'2',name:'assíntota horizontal',style:'dashed'},
            {text:'x = 3',name:'assíntota vertical',style:'dotted'}
          ]
        }
      }
    ]
  },
  {
    id:'derivatives',
    label:'Derivadas: tangente',
    summary:'Secante virando tangente, cantos, regra da cadeia e concavidade.',
    steps:[
      {
        title:'Secante virando tangente',
        text:'A derivada nasce do limite da inclinação da secante. Para f(x)=x^2 no ponto x=2, a inclinação-limite é 4, que aparece na reta tangente.',
        focus:'Mova o x da derivada para ver a inclinação local mudar ponto a ponto.',
        checkpoint:{
          prompt:'Checkpoint: mude o x da derivada para 1.',
          success:'Evento executado: tangente movida.',
          next:'Em x=1, a inclinação cai para perto de 2. A derivada de x^2 é 2x.',
          check:{type:'number-field',eq:0,field:'dx',value:1,tol:1e-9}
        },
        scene:{
          view:{cx:1.6,cy:3,scale:48},
          equations:[
            {text:'x^2',name:'parábola',showD:true,showA:true,dx:2},
            {text:'2x',name:'derivada esperada',style:'dashed'}
          ]
        }
      },
      {
        title:'Canto: quando não há tangente única',
        text:'Em f(x)=|x|, as secantes pela esquerda tendem a inclinação -1 e pela direita a 1. Como as direções não concordam, a derivada em 0 não existe.',
        focus:'Compare o ponto x=0 com pontos regulares à esquerda e à direita.',
        checkpoint:{
          prompt:'Checkpoint: mude o x da derivada para 1.',
          success:'Evento executado: ponto regular escolhido.',
          next:'Fora do canto, a função tem uma direção local única e a tangente volta a fazer sentido.',
          check:{type:'number-field',eq:0,field:'dx',value:1,tol:1e-9}
        },
        scene:{
          view:{cx:0,cy:0.4,scale:82},
          equations:[
            {text:'abs(x)',name:'módulo',showD:true,showL:true,showA:true,dx:0,lx:0}
          ]
        }
      },
      {
        title:'Regra da cadeia no gráfico',
        text:'O exemplo sin(4x^2) tem camadas: seno por fora e 4x^2 por dentro. A derivada 8x*cos(4x^2) combina a inclinação de cada camada.',
        focus:'Veja onde a derivada tracejada zera e compare com os topos e vales da curva.',
        checkpoint:{
          prompt:'Checkpoint: mude o x da derivada para 0.5.',
          success:'Evento executado: camada interna avaliada em outro ponto.',
          next:'A inclinação depende do cosseno externo e do fator 8x produzido pela camada interna.',
          check:{type:'number-field',eq:0,field:'dx',value:0.5,tol:1e-9}
        },
        scene:{
          view:{cx:0,cy:0,scale:70},
          equations:[
            {text:'sin(4x^2)',name:'função composta',showD:true,showA:true,dx:1},
            {text:'8x*cos(4x^2)',name:'derivada pela cadeia',style:'dashed'}
          ]
        }
      },
      {
        title:'Segunda derivada e concavidade',
        text:'A derivada segunda mede como a inclinação varia. Em x^4-3x^2, a concavidade muda conforme a curva deixa de abrir para baixo e passa a abrir para cima.',
        focus:'Use f′ e f″ para distinguir ponto crítico de mudança de concavidade.',
        checkpoint:{
          prompt:'Checkpoint: mude o x da derivada para 0.',
          success:'Evento executado: ponto crítico central destacado.',
          next:'A primeira derivada zera no centro; a segunda derivada informa a concavidade local.',
          check:{type:'number-field',eq:0,field:'dx',value:0,tol:1e-9}
        },
        scene:{
          view:{cx:0,cy:-1.2,scale:50},
          equations:[
            {text:'x^4-3x^2',name:'função',showD:true,showD2:true,showA:true,dx:1},
            {text:'4x^3-6x',name:'f′ conhecida',style:'dashed'}
          ]
        }
      }
    ]
  },
  {
    id:'optimization-applications',
    label:'Otimização: decisões',
    summary:'Máximos, mínimos e inflexões como perguntas que aparecem em problemas reais.',
    steps:[
      {
        title:'Lucro máximo',
        text:'Em uma aula de otimização, a pergunta não é só desenhar a parábola: é decidir onde ela atinge o melhor valor. O lucro L(x)=-x^2+8x-12 cresce até a derivada zerar e depois começa a cair.',
        focus:'Procure o ponto em que a tangente fica horizontal; ali a taxa marginal troca de sinal.',
        checkpoint:{
          prompt:'Checkpoint: mude o x da derivada para 4.',
          success:'Evento executado: máximo localizado.',
          next:'Em x=4 a inclinação é zero; antes disso o lucro cresce, depois disso diminui.',
          check:{type:'number-field',eq:0,field:'dx',value:4,tol:1e-9}
        },
        scene:{
          view:{cx:4,cy:4,scale:44},
          equations:[
            {text:'-x^2+8x-12',name:'lucro',showD:true,showA:true,dx:2},
            {text:'0',name:'equilíbrio',style:'dotted'}
          ]
        }
      },
      {
        title:'Mínimo como compromisso',
        text:'Minimizar (x-1)^2+(x-5)^2 é procurar o ponto que fica equilibrado entre dois alvos. A derivada zera exatamente no meio: x=3.',
        focus:'Veja que se afastar de um alvo ajuda um lado, mas piora o outro; o mínimo é o compromisso.',
        checkpoint:{
          prompt:'Checkpoint: mude o x da derivada para 3.',
          success:'Evento executado: mínimo encontrado.',
          next:'O ponto médio aparece como solução de uma pergunta de mínimo, não só como fórmula de geometria.',
          check:{type:'number-field',eq:0,field:'dx',value:3,tol:1e-9}
        },
        scene:{
          view:{cx:3,cy:8,scale:38},
          equations:[
            {text:'(x-1)^2+(x-5)^2',name:'soma de erros quadráticos',showD:true,showA:true,dx:1},
            {text:'8',name:'valor mínimo',style:'dashed'}
          ]
        }
      },
      {
        title:'Inflexão: crescimento muda de ritmo',
        text:'No modelo x^3-3x, a curva alterna concavidade. O ponto de inflexão não é necessariamente máximo nem mínimo; ele marca mudança no ritmo de crescimento.',
        focus:'Compare f′ e f″: a primeira fala da inclinação, a segunda fala da mudança da inclinação.',
        checkpoint:{
          prompt:'Checkpoint: mude o x da derivada para 0.',
          success:'Evento executado: inflexão destacada.',
          next:'A segunda derivada zera no ponto central, onde a concavidade muda de lado.',
          check:{type:'number-field',eq:0,field:'dx',value:0,tol:1e-9}
        },
        scene:{
          view:{cx:0,cy:0,scale:58},
          equations:[
            {text:'x^3-3x',name:'modelo cúbico',showD:true,showD2:true,showA:true,dx:-1},
            {text:'3x^2-3',name:'f′',style:'dashed'}
          ]
        }
      }
    ]
  },
  {
    id:'integral-area',
    label:'Integrais: acúmulo',
    summary:'Primitiva, Soma de Riemann, área com sinal e integral imprópria.',
    steps:[
      {
        title:'Primitiva: desfazer a derivada',
        text:'O primeiro exemplo do capítulo é ∫cos(x) dx = sin(x)+k. No gráfico, a área acumulada de cos(x) cresce exatamente como uma senoide deslocada pela constante escolhida.',
        focus:'Compare a integral acumulada de cos(x) com a curva tracejada sin(x).',
        checkpoint:{
          prompt:'Checkpoint: mude o limite b da integral para 3.1416.',
          success:'Evento executado: intervalo estendido até π.',
          next:'De 0 até π, a área positiva e a negativa de cos(x) se cancelam no acumulado líquido.',
          check:{type:'number-field',eq:0,field:'ib',value:3.1416,tol:0.02}
        },
        scene:{
          view:{cx:1.6,cy:0,scale:64},
          equations:[
            {text:'cos(x)',name:'integrando',showI:true,showA:true,ia:0,ib:1.5708},
            {text:'sin(x)',name:'primitiva esperada',style:'dashed'}
          ]
        }
      },
      {
        title:'Soma de Riemann como área',
        text:'A integral definida nasce de somar aproximações em subintervalos. A cena usa f(x)=x+2 em [0,4]: o sombreado marca a integral e os blocos mostram a Soma de Riemann.',
        focus:'Aumente n para ver a aproximação ficar mais fina; depois troque o método e compare retângulos com trapézios.',
        checkpoints:[
          {
            prompt:'Checkpoint: mude n da Soma de Riemann para 16.',
            success:'Evento executado: partição refinada.',
            next:'Com mais subintervalos, cada bloco fica mais estreito e a aproximação acompanha melhor a área.',
            check:{type:'number-field',eq:0,field:'riemannN',value:16,tol:1e-9}
          },
          {
            prompt:'Checkpoint: troque o método da Soma de Riemann para trap.',
            success:'Evento executado: trapézios comparados.',
            next:'Trapézios usam os dois extremos de cada subintervalo; para funções lineares, batem exatamente com a área.',
            check:{type:'equals',eq:0,field:'riemannMode',value:'trap'}
          }
        ],
        scene:{
          view:{cx:2,cy:3.5,scale:54},
          equations:[
            {text:'x+2',name:'função positiva',showI:true,showR:true,showA:true,ia:0,ib:4,riemannN:8,riemannMode:'mid'},
            {text:'0',name:'eixo de referência',style:'dotted'}
          ]
        }
      },
      {
        title:'Área com sinal',
        text:'A integral definida mede acúmulo líquido. Para f(x)=x-1 em [0,2], a área abaixo do eixo entra negativa e a área acima entra positiva.',
        focus:'Separe mentalmente [0,1] e [1,2] antes de chamar o resultado de área total.',
        checkpoint:{
          prompt:'Checkpoint: mude o limite a para 1 e isole só a parte positiva.',
          success:'Evento executado: trecho positivo isolado.',
          next:'Agora o sombreado não tem cancelamento: ele representa a área geométrica do trecho acima do eixo.',
          check:{type:'number-field',eq:0,field:'ia',value:1,tol:1e-9}
        },
        scene:{
          view:{cx:1,cy:0,scale:76},
          equations:[
            {text:'x-1',name:'muda de sinal',showI:true,showA:true,ia:0,ib:2},
            {text:'0',name:'eixo de referência',style:'dotted'}
          ]
        }
      },
      {
        title:'Área impropria: converge ou cresce?',
        text:'O exemplo ∫[1,+∞] 1/x^2 dx converge para 1. Aqui empurramos b para a direita e vemos que a área adicional fica cada vez menor.',
        focus:'A curva decai rápido o bastante para a área estabilizar.',
        checkpoint:{
          prompt:'Checkpoint: mude o limite b para 10.',
          success:'Evento executado: cauda ampliada.',
          next:'Mesmo indo mais longe, a área se aproxima de 1 em vez de crescer sem limite.',
          check:{type:'number-field',eq:0,field:'ib',value:10,tol:1e-9}
        },
        scene:{
          view:{cx:3,cy:0.5,scale:78},
          equations:[
            {text:'1/(x^2)',name:'cauda convergente',showI:true,showL:true,showA:true,ia:1,ib:4,lInf:'+'},
            {text:'0',name:'eixo de referência',style:'dotted'}
          ]
        }
      }
    ]
  },
  retitleBaseLesson(
    'linear-algebra',
    'Álgebra linear 2D',
    'Vetores, matrizes e determinantes como preparação para Jacobianos e gradientes.'
  ),
  {
    id:'parametric-polar',
    label:'Paramétricas e polares',
    summary:'Curvas percorridas por parâmetro e curvas descritas por raio e ângulo.',
    steps:[
      {
        title:'Circunferência parametrizada',
        text:'Em curvas paramétricas, x e y dependem de t. A circunferência x=cos(t), y=sin(t) é o exemplo básico: t percorre a curva.',
        focus:'Reduza o intervalo de t para ver que a mesma fórmula pode desenhar só um arco.',
        checkpoint:{
          prompt:'Checkpoint: mude t máximo para 3.1416.',
          success:'Evento executado: meia circunferência isolada.',
          next:'O intervalo do parâmetro controla quanto da curva é percorrido.',
          check:{type:'number-field',eq:0,field:'tmax',value:3.1416,tol:0.02}
        },
        scene:{
          view:{cx:0,cy:0,scale:98},
          equations:[
            {text:'(cos(t), sin(t))',name:'circunferência',tmin:0,tmax:6.2832}
          ]
        }
      },
      {
        title:'Cúspide paramétrica',
        text:'Na curva x=t^2, y=t^3, o ponto t=0 tem dx/dt=0 e dy/dt=0. A partícula para e a curva forma um bico.',
        focus:'Compare o trecho antes e depois de t=0: a orientação importa.',
        checkpoint:{
          prompt:'Checkpoint: mude t mínimo para 0.',
          success:'Evento executado: ramo direito isolado.',
          next:'Ao cortar o intervalo, você remove metade do percurso e preserva só um ramo da curva.',
          check:{type:'number-field',eq:0,field:'tmin',value:0,tol:1e-9}
        },
        scene:{
          view:{cx:1.3,cy:0,scale:82},
          equations:[
            {text:'(t^2, t^3)',name:'cúspide',tmin:-2,tmax:2}
          ]
        }
      },
      {
        title:'Cardioide polar',
        text:'Em polares, o ponto é definido por distância r e ângulo theta. A cardioide r=1+cos(theta) surge porque o raio respira enquanto o ângulo gira.',
        focus:'Acompanhe como r muda com theta em vez de pensar em y=f(x).',
        checkpoint:{
          prompt:'Checkpoint: mude θ máximo para 3.1416.',
          success:'Evento executado: metade da cardioide exibida.',
          next:'Em polares, escolher bem o intervalo angular é parte essencial do problema.',
          check:{type:'number-field',eq:0,field:'thmax',value:3.1416,tol:0.02}
        },
        scene:{
          view:{cx:0.5,cy:0,scale:72},
          equations:[
            {text:'r = 1 + cos(theta)',name:'cardioide',thmin:0,thmax:6.2832}
          ]
        }
      },
      {
        title:'Uma pétala da rosácea',
        text:'Para áreas polares, o cuidado central é escolher um intervalo que percorra exatamente a região desejada. Em r=cos(2theta), um intervalo curto isola uma pétala.',
        focus:'Troque o intervalo angular antes de pensar na integral de área polar.',
        checkpoint:{
          prompt:'Checkpoint: mude θ máximo para 0.7854.',
          success:'Evento executado: uma pétala isolada.',
          next:'Esse é o mesmo cuidado do livro: os limites angulares determinam se você conta uma pétala ou a curva toda.',
          check:{type:'number-field',eq:0,field:'thmax',value:0.7854,tol:0.02}
        },
        scene:{
          view:{cx:0,cy:0,scale:95},
          equations:[
            {text:'r = cos(2*theta)',name:'rosácea',thmin:-0.7854,thmax:6.2832}
          ]
        }
      }
    ]
  },
  {
    id:'taylor-series',
    label:'Séries e Taylor',
    summary:'Somas parciais, polinômios de Taylor e aproximação local.',
    steps:[
      {
        title:'Série geométrica como aproximação',
        text:'Antes de Taylor, o livro constrói a ideia de série por somas parciais. Perto de x=0, 1+x+x^2+x^3 aproxima 1/(1-x).',
        focus:'A aproximação é local: perto de 0 funciona melhor do que perto da assíntota x=1.',
        checkpoint:{
          prompt:'Checkpoint: acrescente +x^4 à última soma parcial.',
          success:'Evento executado: mais um termo na aproximação.',
          next:'Cada termo novo aumenta o intervalo visual em que a soma parcial acompanha a função.',
          check:{type:'text-contains',eq:3,value:'+x^4'}
        },
        scene:{
          view:{cx:0,cy:1,scale:72},
          equations:[
            {text:'1/(1-x)',name:'soma infinita',showL:true,showA:true,lx:0},
            {text:'1+x',name:'S1',style:'dotted'},
            {text:'1+x+x^2',name:'S2',style:'dashed'},
            {text:'1+x+x^2+x^3',name:'S3'}
          ]
        }
      },
      {
        title:'Taylor do seno',
        text:'Taylor usa valor, inclinação, concavidade e derivadas superiores para construir polinômios que imitam uma função perto do centro. Para sin(x), P1, P3 e P5 coincidem melhor perto de 0.',
        focus:'Afaste o olhar da origem e veja onde cada polinômio começa a se soltar da função.',
        checkpoint:{
          prompt:'Checkpoint: acrescente -x^7/5040 ao polinômio P5.',
          success:'Evento executado: grau maior na aproximação.',
          next:'O novo termo melhora a aproximação perto da origem, mas Taylor continua sendo uma ferramenta local.',
          check:{type:'text-contains',eq:3,value:'x^7/5040'}
        },
        scene:{
          view:{cx:0,cy:0,scale:76},
          equations:[
            {text:'sin(x)',name:'função alvo',showA:true},
            {text:'x',name:'P1',style:'dotted'},
            {text:'x - x^3/6',name:'P3',style:'dashed'},
            {text:'x - x^3/6 + x^5/120',name:'P5'}
          ]
        }
      },
      {
        title:'Taylor da exponencial',
        text:'Para e^x, o polinômio de Maclaurin de grau 3 é 1+x+x^2/2+x^3/6. Ele aproxima muito bem valores pequenos, como e^0.1.',
        focus:'Compare a curva real com o polinômio e observe a diferença crescendo longe de 0.',
        checkpoint:{
          prompt:'Checkpoint: acrescente +x^4/24 ao polinômio.',
          success:'Evento executado: aproximação de grau 4.',
          next:'Adicionar termos reduz o erro perto do centro, que é a ideia operacional de Taylor.',
          check:{type:'text-contains',eq:1,value:'+x^4/24'}
        },
        scene:{
          view:{cx:0,cy:1.2,scale:68},
          equations:[
            {text:'exp(x)',name:'exponencial',showA:true},
            {text:'1+x+x^2/2+x^3/6',name:'P3',style:'dashed'}
          ]
        }
      }
    ]
  },
  {
    id:'data-regression',
    label:'Cálculo computacional',
    summary:'Ajuste de modelos com dados, resíduos e escolha de família.',
    steps:[
      {
        title:'Ajustando uma reta aos dados',
        text:'Na ponte computacional, ajustar uma reta significa escolher parâmetros que minimizam erro quadrático. Primeiro olhe os pontos; depois compare o ajuste linear.',
        focus:'A reta é boa quando a tendência dos pontos é aproximadamente linear.',
        checkpoint:{
          prompt:'Checkpoint: troque fit para fit2 e compare com uma parábola.',
          success:'Evento executado: família quadrática testada.',
          next:'Mudar a família altera o erro possível. A pergunta certa é qual modelo explica melhor os dados sem exagerar.',
          check:{type:'text-contains',eq:1,value:'fit2'}
        },
        scene:{
          view:{cx:1.5,cy:2.5,scale:82},
          equations:[
            {text:'points: (0,1),(1,2),(2,2.8),(3,4.1)',name:'dados'},
            {text:'fit: (0,1),(1,2),(2,2.8),(3,4.1)',name:'ajuste linear',style:'dashed'}
          ]
        }
      },
      {
        title:'Quando a curva é exponencial',
        text:'Alguns dados crescem de forma multiplicativa. O ajuste exponencial transforma a leitura em y≈a*e^(b*x), uma família central em crescimento e decaimento.',
        focus:'Compare o ajuste exponencial com a reta mental que você usaria nos mesmos pontos.',
        checkpoint:{
          prompt:'Checkpoint: troque fitexp para fit e veja a diferença.',
          success:'Evento executado: modelo linear comparado.',
          next:'A reta não acompanha bem uma sequência que dobra a cada passo. Escolher a família é parte da modelagem.',
          check:{type:'text-contains',eq:1,value:'fit:'}
        },
        scene:{
          view:{cx:1.5,cy:4,scale:52},
          equations:[
            {text:'points: (0,1),(1,2),(2,4),(3,8)',name:'crescimento dobrando'},
            {text:'fitexp: (0,1),(1,2),(2,4),(3,8)',name:'ajuste exponencial',style:'dashed'}
          ]
        }
      }
    ]
  },
  {
    id:'stats-descriptive',
    label:'Estatística: resumo e dispersão',
    summary:'Média, mediana, desvio-padrão e quartis a partir de uma lista de valores.',
    steps:[
      {
        title:'Centro: média e mediana',
        text:'A linha stats: resume uma lista de valores. Compare a média (x̄) com a mediana: com dados quase simétricos elas ficam próximas.',
        focus:'Leia x̄ e a mediana no painel da linha stats.',
        checkpoint:{
          prompt:'Checkpoint: acrescente o valor extremo 42 ao final da lista (…,23,42).',
          success:'Evento executado: outlier adicionado.',
          next:'A média subiu bem mais que a mediana — a média é sensível a valores extremos.',
          check:{type:'text-contains',eq:0,value:'42'}
        },
        scene:{
          view:{cx:0,cy:0,scale:38},
          equations:[
            {text:'stats: 4,8,8,15,16,23',name:'amostra'}
          ]
        }
      },
      {
        title:'Dispersão: amostra vs população',
        text:'O desvio-padrão mede o espalhamento. Em uma amostra usamos n−1 (s); para a população inteira usamos n (σ).',
        focus:'Observe s e s² no painel.',
        checkpoint:{
          prompt:'Checkpoint: clique no botão amostra para alternar para população.',
          success:'Evento executado: desvio populacional ativado.',
          next:'Com n (população) o desvio fica um pouco menor que com n−1 (amostra).',
          check:{type:'equals',eq:0,field:'statsPop',value:true}
        },
        scene:{
          view:{cx:0,cy:0,scale:38},
          equations:[
            {text:'stats: 4,8,8,15,16,23,42',name:'amostra'}
          ]
        }
      },
      {
        title:'Quartis e IQR',
        text:'Q1 e Q3 cortam os 25% inferiores e superiores; o IQR=Q3−Q1 é robusto a outliers, ao contrário da amplitude.',
        focus:'Compare amplitude e IQR no painel.',
        checkpoint:{
          prompt:'Checkpoint: adicione o valor extremo 90 à lista para testar a robustez do IQR.',
          success:'Evento executado: valor extremo adicionado.',
          next:'A amplitude disparou, mas o IQR quase não mudou — por isso o IQR descreve melhor a dispersão típica.',
          check:{type:'text-contains',eq:0,value:'90'}
        },
        scene:{
          view:{cx:0,cy:0,scale:38},
          equations:[
            {text:'stats: 4,8,8,15,16,23,42',name:'amostra'}
          ]
        }
      }
    ]
  },
  {
    id:'stats-histograms',
    label:'Estatística: histogramas',
    summary:'Número de classes, frequência relativa e a curva normal sobre os dados.',
    steps:[
      {
        title:'Número de classes (bins)',
        text:'Um histograma agrupa valores em classes. Poucas classes escondem a forma; muitas, fragmentam.',
        focus:'Veja como a forma muda com o número de bins.',
        checkpoint:{
          prompt:'Checkpoint: ajuste o campo bins para 6.',
          success:'Evento executado: 6 classes.',
          next:'Com 6 classes a distribuição fica legível, nem grossa demais nem fragmentada.',
          check:{type:'number-field',eq:0,field:'histBins',value:6,tol:1e-9}
        },
        scene:{
          view:{cx:4,cy:2,scale:42},
          equations:[
            {text:'hist: 1,2,2,3,3,3,4,4,4,4,5,5,5,6,6,7',name:'dados'}
          ]
        }
      },
      {
        title:'Frequência relativa',
        text:'No modo densidade, a altura vira a fração dos dados em cada classe; as alturas somam 1.',
        focus:'Observe as alturas mudarem de contagem para fração.',
        checkpoint:{
          prompt:'Checkpoint: ative o botão densidade.',
          success:'Evento executado: frequência relativa.',
          next:'Agora as barras representam proporções — útil para comparar conjuntos de tamanhos diferentes.',
          check:{type:'equals',eq:0,field:'histDensity',value:true}
        },
        scene:{
          view:{cx:4,cy:0.2,scale:60},
          equations:[
            {text:'hist: 1,2,2,3,3,3,4,4,4,4,5,5,5,6,6,7',name:'dados',histBins:6}
          ]
        }
      },
      {
        title:'Curva normal',
        text:'A curva normal N(x̄, σ) sobreposta mostra o quanto os dados se aproximam de um sino simétrico.',
        focus:'Compare as barras com a curva sobreposta.',
        checkpoint:{
          prompt:'Checkpoint: ative o botão normal.',
          success:'Evento executado: curva normal sobreposta.',
          next:'Quando as barras seguem a curva, a distribuição é aproximadamente normal.',
          check:{type:'equals',eq:0,field:'histNormal',value:true}
        },
        scene:{
          view:{cx:4,cy:0.2,scale:60},
          equations:[
            {text:'hist: 1,2,2,3,3,3,4,4,4,4,5,5,5,6,6,7',name:'dados',histBins:6,histDensity:true}
          ]
        }
      }
    ]
  },
  {
    id:'stats-correlation',
    label:'Estatística: correlação',
    summary:'Coeficiente r, reta de regressão e o significado de r² sobre uma nuvem de pontos.',
    steps:[
      {
        title:'Nuvem de pontos e r',
        text:'Para dados (x,y), a linha stats: traz o coeficiente de correlação r, entre −1 e 1.',
        focus:'Crie o resumo e leia o valor de r.',
        checkpoint:{
          prompt:'Checkpoint: na segunda linha, escreva stats: (1,2.1),(2,3.9),(3,6.2),(4,7.8),(5,10.1)',
          success:'Evento executado: resumo de correlação criado.',
          next:'r perto de 1 indica relação linear positiva forte.',
          check:{type:'text-contains',eq:1,value:'stats:'}
        },
        scene:{
          view:{cx:3,cy:6,scale:34},
          equations:[
            {text:'points: (1,2.1),(2,3.9),(3,6.2),(4,7.8),(5,10.1)',name:'dados'},
            {text:'',name:'resumo'}
          ]
        }
      },
      {
        title:'Reta de regressão',
        text:'A reta de mínimos quadrados resume a tendência. Compare-a com a reta y≈ax+b mostrada no resumo.',
        focus:'Compare o coeficiente angular da reta com a inclinação do resumo.',
        checkpoint:{
          prompt:'Checkpoint: na terceira linha, escreva fit: (1,2.1),(2,3.9),(3,6.2),(4,7.8),(5,10.1)',
          success:'Evento executado: reta de regressão criada.',
          next:'O fit linear mostra r e R²; R² é a fração da variação explicada pela reta.',
          check:{type:'text-contains',eq:2,value:'fit:'}
        },
        scene:{
          view:{cx:3,cy:6,scale:34},
          equations:[
            {text:'points: (1,2.1),(2,3.9),(3,6.2),(4,7.8),(5,10.1)',name:'dados'},
            {text:'stats: (1,2.1),(2,3.9),(3,6.2),(4,7.8),(5,10.1)',name:'resumo'},
            {text:'',name:'regressão'}
          ]
        }
      },
      {
        title:'Força da relação',
        text:'Mover um ponto para longe da reta reduz r e R². Quanto mais dispersos os pontos, mais fraca a correlação.',
        focus:'Veja r cair ao introduzir um ponto fora da tendência.',
        checkpoint:{
          prompt:'Checkpoint: mude o terceiro ponto dos dados para (3,0).',
          success:'Evento executado: ponto deslocado.',
          next:'r caiu bastante: um único ponto fora da tendência enfraquece a correlação.',
          check:{type:'text-contains',eq:0,value:'(3,0)'}
        },
        scene:{
          view:{cx:3,cy:5,scale:30},
          equations:[
            {text:'points: (1,2.1),(2,3.9),(3,6.2),(4,7.8),(5,10.1)',name:'dados'},
            {text:'stats: (1,2.1),(2,3.9),(3,6.2),(4,7.8),(5,10.1)',name:'resumo'}
          ]
        }
      }
    ]
  },
  baseLesson('implicit-regions'),
  baseLesson('riemann-methods'),
  baseLesson('modeling-growth')
].map(withObservationCheckpoints);

function cloneEquation(eq){
  return {...eq, params:eq.params ? {...eq.params} : undefined};
}

export function getLesson(id){
  return LESSONS.find(lesson=>lesson.id===id) || LESSONS[0];
}

export function clampStepIndex(lesson, index){
  const n=Number(index);
  if(!lesson||!lesson.steps?.length) return 0;
  if(!Number.isFinite(n)) return 0;
  return Math.min(Math.max(Math.trunc(n),0),lesson.steps.length-1);
}

export function lessonScene(step){
  const scene=step?.scene || {};
  return {
    view:scene.view ? {...scene.view} : null,
    equations:Array.isArray(scene.equations) ? scene.equations.map(cloneEquation) : []
  };
}

export function lessonCheckpoints(step){
  if(Array.isArray(step?.checkpoints)) return step.checkpoints;
  return step?.checkpoint ? [step.checkpoint] : [];
}

function closeTo(value, target, tol){
  return Number.isFinite(value) && Number.isFinite(target) && Math.abs(value-target)<=tol;
}

function hasOwn(obj,key){
  return Object.prototype.hasOwnProperty.call(obj,key);
}

function checkNumber(value, check){
  const n=Number(value);
  if(!Number.isFinite(n)) return false;
  const tol=Number.isFinite(check.tol) ? check.tol : 1e-6;
  if(hasOwn(check,'value')) return closeTo(n,Number(check.value),tol);
  if(hasOwn(check,'min')&&n<Number(check.min)-tol) return false;
  if(hasOwn(check,'max')&&n>Number(check.max)+tol) return false;
  if(hasOwn(check,'greaterThan')&&!(n>Number(check.greaterThan))) return false;
  if(hasOwn(check,'lessThan')&&!(n<Number(check.lessThan))) return false;
  return true;
}

function getPathValue(obj,path){
  if(!path) return undefined;
  return String(path).split('.').reduce((acc,key)=>{
    if(acc==null) return undefined;
    return acc[key];
  },obj);
}

function labelMatches(actual, expected){
  return String(actual||'').toLowerCase()===String(expected||'').toLowerCase();
}

function findGeometryPoint(eq, label){
  const points=Array.isArray(eq?.geometry?.points) ? eq.geometry.points : [];
  if(label) return points.find(point=>labelMatches(point.label,label)) || null;
  return points[0] || null;
}

function segmentLength(segment){
  if(!segment?.a||!segment?.b) return NaN;
  return Math.hypot(Number(segment.b.x)-Number(segment.a.x),Number(segment.b.y)-Number(segment.a.y));
}

function geometryDistance(eq, check){
  const segments=Array.isArray(eq?.geometry?.segments) ? eq.geometry.segments : [];
  const segment=check.label ? segments.find(item=>labelMatches(item.label,check.label)) : segments[0];
  return segmentLength(segment);
}

function riemannN(eq){
  return Number.isInteger(eq?.riemannN) ? Math.min(Math.max(eq.riemannN,1),120) : 8;
}

function riemannEstimate(eq){
  if(typeof eq?.fn!=='function') return NaN;
  const a=Number(eq.ia), b=Number(eq.ib), n=riemannN(eq);
  if(!Number.isFinite(a)||!Number.isFinite(b)) return NaN;
  if(a===b) return 0;
  const dx=(b-a)/n;
  let total=0;
  for(let i=0;i<n;i++){
    const x0=a+i*dx, x1=x0+dx;
    if(eq.riemannMode==='trap'){
      const y0=eq.fn(x0), y1=eq.fn(x1);
      if(!Number.isFinite(y0)||!Number.isFinite(y1)) return NaN;
      total+=(y0+y1)*0.5*dx;
    } else {
      const sample=eq.riemannMode==='left' ? x0 : eq.riemannMode==='right' ? x1 : (x0+x1)/2;
      const y=eq.fn(sample);
      if(!Number.isFinite(y)) return NaN;
      total+=y*dx;
    }
  }
  return total;
}

function checkSatisfied(check,equations,context={}){
  if(!check||!Array.isArray(equations)) return false;
  if(check.type==='all'){
    return Array.isArray(check.checks)&&check.checks.every(item=>checkSatisfied(item,equations,context));
  }
  if(check.type==='any'){
    return Array.isArray(check.checks)&&check.checks.some(item=>checkSatisfied(item,equations,context));
  }
  if(check.type==='not'){
    return !checkSatisfied(check.check,equations,context);
  }
  if(check.type==='ack'){
    return context.kind==='ack';
  }
  const eq=equations[Number.isInteger(check.eq) ? check.eq : 0];
  if(!eq) return false;
  if(check.type==='number-field'){
    return checkNumber(eq[check.field],check);
  }
  if(check.type==='number-param'){
    return checkNumber(eq.params?.[check.param],check);
  }
  if(check.type==='computed-field'){
    return checkNumber(getPathValue(eq,check.path),check);
  }
  if(check.type==='geometry-distance'){
    return checkNumber(geometryDistance(eq,check),check);
  }
  if(check.type==='geometry-point'){
    const point=findGeometryPoint(eq,check.label);
    if(!point) return false;
    const tol=Number.isFinite(check.tol) ? check.tol : 1e-6;
    const xOk=!hasOwn(check,'x') || closeTo(Number(point.x),Number(check.x),tol);
    const yOk=!hasOwn(check,'y') || closeTo(Number(point.y),Number(check.y),tol);
    return xOk&&yOk;
  }
  if(check.type==='function-value'){
    const x=Number(check.x);
    if(!Number.isFinite(x)||typeof eq.fn!=='function') return false;
    return checkNumber(eq.fn(x),check);
  }
  if(check.type==='riemann-error'){
    const target=Number(check.target);
    const maxError=Number(check.maxError);
    if(!Number.isFinite(target)||!Number.isFinite(maxError)) return false;
    return Math.abs(riemannEstimate(eq)-target)<=maxError;
  }
  if(check.type==='equals'){
    return eq[check.field]===check.value;
  }
  if(check.type==='text-contains'){
    const text=String(eq.text||'').toLowerCase();
    const value=String(check.value||'').toLowerCase();
    return text.includes(value) || text.replace(/\s+/g,'').includes(value.replace(/\s+/g,''));
  }
  return false;
}

export function checkpointComplete(step, equations, checkpointIndex=0, context={}){
  const checkpoint=lessonCheckpoints(step)[checkpointIndex];
  return checkSatisfied(checkpoint?.check,equations,context);
}

export function getLessonCheckpointProgress(progress, lessonId, stepIndex){
  const lesson=getLesson(lessonId);
  const index=clampStepIndex(lesson,stepIndex);
  const total=lessonCheckpoints(lesson.steps[index]).length;
  const raw=Number(progress?.checkpoints?.[lesson.id]?.[index]);
  if(!Number.isFinite(raw)) return 0;
  return Math.min(Math.max(Math.trunc(raw),0),total);
}

export function setLessonCheckpointProgress(progress, lessonId, stepIndex, count){
  const lesson=getLesson(lessonId);
  const index=clampStepIndex(lesson,stepIndex);
  const total=lessonCheckpoints(lesson.steps[index]).length;
  const value=Math.min(Math.max(Math.trunc(Number(count)||0),0),total);
  if(!progress.checkpoints) progress.checkpoints={};
  if(!progress.checkpoints[lesson.id]) progress.checkpoints[lesson.id]={};
  if(value>0) progress.checkpoints[lesson.id][index]=value;
  else delete progress.checkpoints[lesson.id][index];
  if(!Object.keys(progress.checkpoints[lesson.id]).length) delete progress.checkpoints[lesson.id];
  return value;
}

export function normalizeLessonProgress(raw={}){
  const first=LESSONS[0];
  if(!first) return {lessonId:'',stepIndex:0,checkpointIndex:0,checkpoints:{}};
  const source=raw&&typeof raw==='object' ? raw : {};
  const lesson=getLesson(source.lessonId);
  const progress={lessonId:lesson.id,stepIndex:clampStepIndex(lesson,source.stepIndex),checkpointIndex:0,checkpoints:{}};
  const saved=source.checkpoints&&typeof source.checkpoints==='object' ? source.checkpoints : {};
  LESSONS.forEach(item=>{
    const itemSaved=saved[item.id];
    if(!itemSaved||typeof itemSaved!=='object') return;
    item.steps.forEach((step,index)=>{
      const total=lessonCheckpoints(step).length;
      const value=Math.min(Math.max(Math.trunc(Number(itemSaved[index])||0),0),total);
      if(value>0) setLessonCheckpointProgress(progress,item.id,index,value);
    });
  });
  const total=lessonCheckpoints(lesson.steps[progress.stepIndex]).length;
  const rawCheckpoint=Number(source.checkpointIndex);
  const savedCheckpoint=getLessonCheckpointProgress(progress,lesson.id,progress.stepIndex);
  const active=Number.isFinite(rawCheckpoint)
    ? Math.min(Math.max(Math.trunc(rawCheckpoint),0),total)
    : savedCheckpoint;
  progress.checkpointIndex=Math.max(savedCheckpoint,active);
  if(progress.checkpointIndex>0){
    setLessonCheckpointProgress(progress,lesson.id,progress.stepIndex,progress.checkpointIndex);
  }
  return progress;
}

export function countCompletedLessonSteps(progress, lesson){
  const item=lesson || LESSONS[0];
  if(!item?.steps) return 0;
  return item.steps.reduce((total,step,index)=>{
    const checkpoints=lessonCheckpoints(step).length;
    return total + (checkpoints>0&&getLessonCheckpointProgress(progress,item.id,index)>=checkpoints ? 1 : 0);
  },0);
}
