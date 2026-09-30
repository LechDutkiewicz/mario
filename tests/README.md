# Testy plansz

Dwa testy — uruchamiaj po każdej zmianie w planszach lub mechanice.

```bash
node tests/level-audit.mjs          # statyczny, kilka sekund, bez przeglądarki
node tests/browser-test.mjs         # prawdziwa gra w Chromium, kilka minut
node tests/browser-test.mjs --quick # krótszy przebieg bota (~1 min)
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
