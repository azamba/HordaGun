# HordaGun

Jogo de tiro contra hordas de zumbis, feito em HTML5 Canvas. Não precisa instalar nada.

**▶ Jogar online:** https://azamba.github.io/HordaGun/

No celular, aponte a câmera para o QR code:

<img src="qrcode.svg" alt="QR code para jogar no celular" width="200">

## Como jogar

- **Mover o esquadrão:** mouse, dedo na tela ou ← →
- **Atirar:** segure o botão esquerdo do mouse, a tecla Espaço ou o dedo na tela
- **Trocar de arma:** teclas 1 a 7, rodinha do mouse, Q/E ou toque no inventário
- **Caixotes:** atire neles até zerar o contador para ganhar uma arma nova. Se você já tem a arma, o caixote dá munição
- **Painéis azuis:** atire neles para ganhar mais atiradores
- **M** liga/desliga o som, **P** pausa

## Armas

| Tecla | Arma | Destaque |
|---|---|---|
| 1 | Pistola | munição infinita |
| 2 | Escopeta | 5 projéteis abertos |
| 3 | Minigun | 12 tiros por segundo |
| 4 | Laser | atravessa até 4 zumbis |
| 5 | Bazuca | dano em área |
| 6 | Mísseis teleguiados | perseguem os zumbis mais próximos |
| 7 | Lança-chamas | curto alcance, queima vários de uma vez |

## Rodar localmente

Abra o `index.html` no navegador. Os valores de equilíbrio do jogo (dano, cadência, munição, tiros para destravar cada arma) ficam no topo do `game.js`.
