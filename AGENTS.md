# AfinApp

Afinador de notas em tempo real para aulas de canto, em português (pt-BR).
Roda 100% no navegador, sem servidor, sem build, sem dependências obrigatórias
e sem enviar nada para a rede (exceto uma fonte musical opcional via CDN).
É um **PWA instalável** (manifest + service worker) publicado no GitHub Pages.

## O que o app faz

- Captura o microfone e detecta a **frequência fundamental** da voz cantada
  (a mais baixa da série harmônica, NÃO o pico mais forte do espectro —
  requisito central do usuário: em vozes femininas/infantis o 2º harmônico
  costuma dominar, e um detector de pico erraria a oitava).
- Mostra a nota em tempo real de três formas:
  1. **Pauta** (clave de Sol ou de Fá, com o desenho da nota: haste,
     acidentes, linhas suplementares);
  2. **Teclado de piano** (A1–C6, tecla da nota acende com cor por classe
     de altura; teclas clicáveis tocam a nota como referência);
  3. **Painel de leitura** (nome da nota em solfejo, Hz, desvio em cents,
     régua de afinação, medidores de sinal/nitidez) — opcional.
- Histórico das notas cantadas (opcional), referência de afinação A4
  ajustável (415–465 Hz), clave automática por registro da voz (com histerese).

## Como rodar / testar manualmente

- Abrir `index.html` com dois cliques funciona no Chrome/Edge (`file://` é
  contexto seguro para `getUserMedia`).
- Se o navegador bloquear o microfone em `file://`, servir por HTTP:
  `python -m http.server 8000` na pasta do projeto e abrir
  `http://localhost:8000`.
- **Não existe microfone utilizável em automação de navegador.** Para testar
  a detecção sem cantar, injete um oscilador direto no analisador pelo console
  (DevTools) — ver seção "Como testar sem microfone" abaixo.
- Publicação: GitHub Pages (push para `main`). Via HTTPS o navegador oferece
  instalação como app; instalado, o app abre 100% offline (service worker).

## Estrutura

O app em si é um **arquivo único**: todo o código está em `index.html`
(`<style>` no `<head>`, `<script>` no fim do `<body>`). Não introduzir build,
bundler nem quebrar o arquivo em módulos sem pedir ao usuário.

Arquivos de apoio do PWA (ver seção "PWA" abaixo): `manifest.webmanifest`,
`sw.js` e `icons/` (SVGs-fonte + PNGs gerados).

Seções do script, em ordem:

1. **Parâmetros e estado** — constantes de detecção e variáveis globais
   (`audioCtx`, `analyser`, `vizMode`, `effClef`, `a4`, `shownNote`, etc.).
2. **Notas** — `noteInfo(midi)`, tabela `PC` (grafia sustenido/bemol),
   solfejo pt-BR, índice diatônico.
3. **Pauta (SVG)** — `staffSVG()`, `yDia()`, viewBox adaptativo.
4. **Piano** — `buildPiano()`, `miniStaff()`, `keyPath()`, sistema de teclas
   acesas (`PC_COLOR`, `refreshKey`, `litKey`, `pressed`), síntese
   (`noteOn`/`noteOff`), ponteiros com glissando (`ptrSet`/`keyAt`/`ptrEnd`).
5. **Áudio** — `ensureCtx()`, `mpm()` (detecção de pitch), `loop()` (rAF).
6. **Exibição** — `updateDisplay()` (mediana + cents + histerese de clave),
   `setIdle()`, `logHistory()`, `setStatus()`.
7. **Microfone** — `startMic()`/`stopMic()`/`micBtn()` (interruptor).
8. **Eventos e preferências** — listeners, `savePrefs`/`loadPrefs`.

## PWA (instalação e uso offline)

- `manifest.webmanifest` (nome, cores, `display:standalone`, ícones) +
  `sw.js` (service worker) + PNGs em `icons/`. Todas as URLs são relativas
  de propósito, para funcionar em qualquer subcaminho (GitHub Pages serve
  em `usuario.github.io/repo/`).
- `sw.js` é cache-first; a constante `V` é o nome do cache. Ele precacheia
  o app e, a melhor esforço, a fonte Bravura. **Ao publicar mudanças,
  aumente `V`** (ex.: `afinapp-v2`): o cache antigo é descartado no
  `activate` e a próxima visita baixa tudo de novo.
- Registro do SW no fim do script do `index.html`, condicionado a
  `location.protocol !== 'file:'` (em `file://` o app funciona igual,
  só não há instalação/offline).
- Ícones: desenho em `icons/icon.svg` (purpose "any") e
  `icons/icon-maskable.svg` (mesmo desenho dentro da zona segura central,
  raio 40%). Regenerar os PNGs com Chrome headless, ajustando
  `--window-size` e o nome do arquivo de saída:

  ```
  "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new \
    --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=512,512 \
    --screenshot="C:\caminho\icons\icon-512.png" \
    "file:///C:/caminho/icons/icon.svg"
  ```

## Detecção de pitch (algoritmo MPM) — não alterar sem motivo forte

`mpm()` implementa o McLeod Pitch Method sobre a janela temporal
(`analyser.getFloatTimeDomainData`, `fftSize = 2048`, ~43 ms):

- NSDF = 2·r(τ)/m(τ) com somas de energia prefixadas (`eprefix`).
- Coleta picos locais de τ; escolhe o **primeiro** pico com valor ≥ 0.90 do
  máximo global (= maior periodicidade forte = frequência fundamental).
- Interpolação parabólica para precisão sub-amostra.
- Portões: `RMS_GATE = 0.004`, `CLARITY_GATE = 0.60`, faixa aceita
  midi 33–86 (A1–D6); `PITCH_MIN_F = 55`, `PITCH_MAX_F = 1300`.
- Suavização: mediana das últimas 5 leituras válidas (`histRaw`);
  ~7 frames sem voz → estado ocioso (`setIdle`).
- Objetivo de responsividade: nota nova visível em < ~100 ms.

## Teoria musical usada no código

- Notação científica: **Dó4 = dó central (midi 60)**; midi = 69 +
  12·log2(f/A4).
- Solfejo: `SOLF = ['Dó','Ré','Mi','Fá','Sol','Lá','Si']`.
- Grafia por classe de altura (tabela `PC`): C♯, E♭, F♯, G♯, B♭
  (bemol preferido para Mi♭/Si♭). Acidentes Unicode: ♯ ♭, claves 𝄞 𝄢.
- Índice diatônico `dia = oct*7 + letra` (C=0…B=6). Geometria da pauta:
  - Clave de Sol: linha de baixo = Mi4 → `ref = 30`; clave de Fá: linha de
    baixo = Sol2 → `ref = 18`. Linha de cima = `ref+8`.
  - `yDia(d) = yB - (d-ref)·(gap/2)`; `STAFF = {gap:26, yB:170, xN:590, xC:100}`.
  - Linhas suplementares abaixo a cada 2 passos até a nota; acima idem
    a partir de `ref+10`. Haste à direita/para cima quando
    `dia <= ref+4`, senão à esquerda/para baixo.
- Clave automática (modo Auto): mediana das últimas ~40 notas; troca para Fá
  se mediana ≤ 57 (Lá3) e para Sol se ≥ 60 (Dó4) — histerese proposital.
- **Fonte musical**: Bravura via CDN (`@font-face`, `redist/woff`) com
  métrica SMuFL: `font-size = 4·gap` e baseline na linha da clave
  (2ª de baixo no Sol; 2ª de cima no Fá). Sem Bravura (offline), usa fonte
  do sistema com métricas calibradas à mão (`FB` na pauta; em `miniStaff`,
  `fs = 3.3·gap`/`3.6·gap` e offsets `−0.8·gap`/`+0.23·gap`). Quando
  `bravura` muda após o load da fonte, `staffSVG()` e `buildPiano()` são
  re-executados e a tecla acesa reaplicada.

## Piano — constantes e convenções

- Faixa: `PMIN = 33` (Lá1) a `PMAX = 84` (Dó6); 31 brancas + 21 pretas.
- Geometria: `WKW=36, PAD=6, WKH=196, BKH=122, BKW=22`; pretas centradas na
  fronteira com a branca seguinte + `BK_OFF` estético; `viewBox` recalculado
  em `buildPiano()`; `#piano` em CSS: largura 100% (full-bleed, sem card),
  `max-height: 62vh`, `touch-action:none`.
- **Cor da tecla acesa = classe de altura, a partir de Dó** (requisito do
  usuário; tabela `PC_COLOR`, índice = midi%12):
  Dó `rgb(237,29,29)`, Dó♯ `rgb(237,133,29)`, Ré `rgb(237,237,29)`,
  Ré♯ `rgb(133,237,29)`, Mi `rgb(29,237,29)`, Fá `rgb(29,237,133)`,
  Fá♯ `rgb(29,237,237)`, Sol `rgb(29,133,237)`, Sol♯ `rgb(29,29,237)`,
  Lá `rgb(133,29,237)`, Lá♯ `rgb(237,29,237)`, Si `rgb(237,29,133)`.
  A cor é aplicada como `style.fill` inline no `<path>` da tecla.
- Dois sistemas independentes de tecla acesa: `detMidi` (detecção de voz) e
  `pressed` (clique/toque). Ambos passam por `refreshKey(m)`, que é
  idempotente — sempre chamar `refreshKey`, nunca mexer nas classes direto.
- **Mini-pauta só nas teclas brancas**, na parte baixa
  (`MS.wBottom = 166`, rótulo em `y = 190`), com a nota na posição correta.
  Clave apenas em duas teclas-marco: a primeira do teclado (Lá1, região de
  Fá) e Dó4 (primeira da região de Sol). Notas < 60 leem em Fá, ≥ 60 em Sol.
  Clave na mesma cor da nota (`#77839a`), não mais clara.
- **Glissando**: sem `setPointerCapture`; em `pointermove` resolve a tecla
  com `document.elementFromPoint(x,y).closest('#piano g[data-midi]')` e
  troca a nota (`ptrSet`). Multitoque OK (mapa `ptrs` por pointerId).
  Soltar fora do teclado → silencia mas mantém o ponteiro vivo (re-entra
  tocando). `pointerup`/`pointercancel` tratados no svg E no `window`.
- Síntese (`noteOn`): 6 parciais senoidais (ganhos 1, .45, .22, .11, .05,
  .03), detune `h·2.5` cents, envelope com ataque 12 ms, decaimento lento
  tipo piano e release 300 ms no `noteOff`. Liga ao `destination` (é som de
  referência para cantar junto).

## Convenções de UI (decisões explícitas do usuário — respeitar)

- App em **largura total** da tela; teclado full-bleed **sem borda/card**;
  pauta centralizada com `width:min(96vw,1100px)`.
- Todos os controles na **barra do topo**: Microfone (interruptor
  ligado/desligado, estado só pela cor), modos (Auto / Clave de Sol /
  Clave de Fá / Piano), Leitura, Histórico, Referência.
- **Botões sem ícones/emoji** e com estado padronizado: ativo =
  borda accent `#7db3ff`, texto `#bcd7ff`, fundo `#1d2c49`
  (`.btn.on` e `.seg button.on`).
- **Sem linha de status** no uso normal: `setStatus()` só exibe erros de
  microfone (`kind='err'`); demais mensagens ficam ocultas.
- **Referência compacta**: colapsada mostra só o rótulo; clique expande
  −/valor/+ (`setA4Open`). Padrão: colapsada.
- Painéis de Leitura e Histórico são opcionais (botões-erruptor no topo).
- Todos os textos visíveis em **pt-BR**; comentários de código em português.
- O emoji 🎼 no título é branding, não botão — manter é opcional.

## Preferências (localStorage)

Chave `afinador-canto` (nome histórico, mantido de propósito para não
resetar preferências existentes). Schema JSON:
`{ v: vizMode('auto'|'sol'|'fa'|'piano'), r: leitura visível, h: histórico
visível, a: A4 em Hz (415–465), o: painel de referência aberto }`.
Toda mudança de preferência deve chamar `savePrefs()`.
**Defaults de primeiro uso** (sem chave salva): modo Piano, Leitura e
Histórico ocultos; qualquer mudança do usuário é persistida e passa a valer.

## Como testar sem microfone (importante)

O loop de detecção lê do `analyser`; qualquer fonte conectada a ele serve.
No console da página (ou via automação com `evaluate`):

```js
ensureCtx();                                   // cria ctx + analyser + loop
const o = audioCtx.createOscillator(), g = audioCtx.createGain();
g.gain.value = 0.2; o.type = 'sine';
o.frequency.value = 261.63;                    // Dó4
o.connect(g); g.connect(analyser); o.start();
// depois: o.stop(); o.disconnect();
```

Ligar o oscilador em modo Piano deve acender `g[data-midi="60"]` com
`style.fill = rgb(237,29,29)`; mudar para 329.63 → Mi4 verde etc.

## Estratégia de verificação (o que já funcionou bem)

- **Asserções geométricas no DOM são determinísticas e preferíveis** a
  análise de imagem: conferir `cy` de elipses, `y1` de linhas, `viewBox`,
  `style.fill` de teclas. Ex.: Dó4 na clave de Sol fica EXATAMENTE sobre a
  1ª linha suplementar (mesmo `y`).
- Análise visual de screenshot é útil para layout geral, mas imprecisa em
  elementos pequenos (mini-pautas) — não confiar cegamente.
- Testar glissando disparando `PointerEvent` (`pointerdown`/`pointermove`/
  `pointerup`) com `clientX/Y` reais (centro do `getBoundingClientRect` da
  tecla) no svg `#piano`; observar `pressed`, `held` e os fills.
- Servidor local para automação: `python -m http.server 8642` (o navegador
  embutido não navega em `file://`).
- PWA: com o servidor local no ar, `await navigator.serviceWorker.ready`
  resolve, `caches.keys()` lista `afinapp-v*` e a chave da fonte Bravura
  aparece entre as URLs em cache; parar o servidor e recarregar deve
  carregar o app normalmente (offline via SW).
- Ao mudar algo em `buildPiano`/`staffSVG`, verificar: contagem de teclas
  (52: 31 brancas + 21 pretas), claves exatamente 2 (midi 33 e 60),
  pautas só em brancas, e a tecla acesa após `litKey`/reload de fonte.

## Limitações conhecidas

- `getUserMedia` pendura sem resposta em navegadores de automação (o prompt
  de permissão não responde) — testar mic só manualmente.
- Sem internet na 1ª visita, a clave usa a fonte do sistema (Segoe UI
  Symbol no Windows): aceitável, métricas próprias calibradas. Com o PWA
  (SW ativo), a Bravura fica em cache após a primeira carga online e o
  uso offline passa a renderizar com ela.
- Em telas muito estreitas as teclas ficam pequenas (teclado completo
  A1–C6 escala para a largura).
- O microfone capta o som da nota de referência tocada (esperado na prática
  de canto; serve de confirmação visual).
