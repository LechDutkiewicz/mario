# Testy plansz

Dwa testy — uruchamiaj po każdej zmianie w planszach lub mechanice.

```bash
node tests/level-audit.mjs          # statyczny, kilka sekund, bez przeglądarki
node tests/browser-test.mjs         # prawdziwa gra w Chromium, kilka minut
node tests/browser-test.mjs --quick # krótszy przebieg bota (~1 min)
node tests/route-8-4.mjs            # przejście całej trasy 8-4 prawdziwą fizyką (~1 min)
node tests/screenshots.mjs          # 16 stałych ujęć do porównań wizualnych (PNG)
node tests/contact-sheet.mjs        # arkusze sprite'ów (gracz, wrogowie, bossowie, przedmioty)
```

Oba kończą się kodem `0`, gdy wszystko jest w porządku, i `1`, gdy coś znajdą
(z listą problemów).

**`level-audit.mjs`** — buduje każdą planszę i każdy jej pod-obszar (62) i sprawdza:
czy postać nie pojawia się w ścianie, czy wrogowie i monety nie są zakopani w blokach,
zdublowane bloki, rury zablokowane blokiem, obecność mety oraz czy da się
doskoczyć od startu do mety (flaga / Ultra Ball / rura wyjściowa), z uwzględnieniem
prawdziwej fizyki skoku i ścian po drodze. Wpisy `INFO` są informacyjne.

**`browser-test.mjs`** — uruchamia prawdziwą grę w bezgłowym Chromium i sprawdza:
przebieg bota przez wszystkie 32 plansze (brak wyjątków i NaN), wszystkie
pod-obszary, każdą postać w każdej formie, przejście każdej planszy do następnej
(8-4 → finał), labirynt 8-4, checkpointy i wyjścia z sekcji podwodnych.
Wymaga Playwrighta (`npm i -D playwright` albo instalacja globalna); ścieżkę do
Chromium można podać w zmiennej `CHROMIUM_PATH`.

**`route-8-4.mjs`** — przeprowadza gracza skryptem przez właściwą trasę 8-4
(ściana startowa i lawa, winda nad długą lawą, rura T2, ukryty blok i rura T3,
przeskok nad lawą do T4, korytarz podwodny, finałowa lawa, Ultra Ball) na
prawdziwej fizyce. Gracz jest odporny na wrogów (jak w `browser-test`), ale lawa
i przepaście zabijają, więc test sprawdza geometrię poziomu. Kończy się kodem `1`,
gdy trasy nie da się przejść.

**`screenshots.mjs`** i **`contact-sheet.mjs`** — narzędzia do porównań
wizualnych przed/po (zrzuty 16 ujęć i arkusze sprite'ów; `--root` renderuje
inny checkout tym samym skryptem).
