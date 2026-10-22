# Piphin Captura

Print de tela prático, com editor, e gravador de tela em MP4 com som. Módulo do [Piphin Hub](https://github.com/Ruiso-Outside/Piphin-Hub) (precisa do Hub 1.6.0; cerca de 300 KB).

## Print

| Atalho | O que faz |
|---|---|
| `PrtSc` | Escolhe uma área: a tela congela, você arrasta (Enter pega a tela toda, Esc cancela). |
| `Ctrl+PrtSc` | Tela inteira (o monitor onde está o mouse). |
| (pela lista) | Uma janela, mesmo atrás de outras. |

- Depois do print: **copia** (é só colar com Ctrl+V), **salva** em `Imagens\Piphin Capturas`, avisa e/ou abre o editor (tudo configurável).
- **Editor**: seta, retângulo, caneta, marca-texto, texto, números em sequência, **esconder** (pixelado, para senhas e nomes) e cortar. Dá para mover e apagar as marcações e desfazer. Atalhos: V, A, R, P, M, T, N, B, C; Ctrl+Z, Ctrl+C, Ctrl+S.

## Gravação

- `Alt+F9` começa e para.
- Grava o monitor do mouse, um monitor escolhido ou **uma janela**.
- Com o **som do PC** e/ou o **microfone** (misturados).
- MP4 **H.264 + AAC** codificado pela placa de vídeo (WebCodecs, pela [Mediabunny](https://mediabunny.dev), MPL-2.0). O vídeo vai direto para o arquivo, sem encher a memória.
- Qualidade Alta, Média ou Leve; 60 ou 30 FPS; resolução original, 1080p ou 720p; contagem 3, 2, 1.
- Uma barrinha no topo mostra o tempo, pausa e para. Ela **não aparece no vídeo**.
- Salva em `Vídeos\Piphin Capturas`.

## Galeria e IA

- **Galeria**: prints e gravações, para editar, assistir, copiar, mostrar na pasta, salvar como e apagar.
- **IA**: com o Piphin LLM, a IA tira um print, começa e para a gravação (com a sua confirmação) e lista as capturas.

## Estrutura

`module/backend.js` (atalhos, arquivos, prints e a gravação no disco).

`web/`:

| Arquivo | O que é |
|---|---|
| `index.html`, `js/app.js` | a tela |
| `js/editor.js` | o editor |
| `selector.html` | escolha da área |
| `recorder.html` | a barrinha que grava |

O Hub entrega o print em PNG e a tela/janela para gravar (`getDisplayMedia`, permissão `screenCapture`).

```
npm run icons    # ícones (Lucide) em web/icons.css
npm run icon     # icons/captura.png
npm run module   # dist/piphin-module-captura-<versão>.zip
```
