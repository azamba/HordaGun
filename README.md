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

## Loja de upgrades

Cada zumbi morto dá moedas (tanque 4, chefão 40, os outros 1) e cada onda vencida dá um bônus. Entre as ondas abre a loja (teclas 1 a 6 compram, Enter começa a próxima onda):

| Upgrade | Efeito |
|---|---|
| Dano | +15% de dano em todas as armas (até nível 10) |
| Cadência | +10% de tiros por segundo (até nível 10) |
| +1 Atirador | mais um soldado no esquadrão |
| Munição | +50% de munição para cada arma que você tem |
| Caixotes | caixotes e painéis pedem 10% menos tiros (até nível 5) |
| Escudo | bloqueia um ataque de zumbi (até 3 de uma vez) |

## Rodar localmente

Abra o `index.html` no navegador. Os valores de equilíbrio do jogo (dano, cadência, munição, tiros para destravar cada arma) ficam no topo do `game.js`.
