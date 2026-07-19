# Audyt zgodności z oryginałem (FullScreenMario) — inwentaryzacja

Stan na: 2026-07-18. Trzy przejścia: pokrycie loadera vs JSON-y, fizyka gracza
i przepływ gry, zachowania wrogów i przedmiotów. Odniesienie: źródła FSM
(unitsize = 4 → wartości px = jednostki × 4).

Legenda: `[ ]` do zrobienia · `[x]` zrobione · `[~]` świadomie inaczej (decyzja designowa)

---

## P1 — Twarde bugi (zmieniają geometrię/kolizje poziomów)

- [x] **Makro `Fill` gubi `width`/`height` dzieci** — naprawione: Fill przekazuje
  wymiary; mur przy trampolinie w 2-1 (2×320px) znowu istnieje.
- [x] **`Fill` czyta `ywidth`, a JSON-y używają `yheight`** — naprawione
  (yheight z fallbackiem na ywidth).
- [ ] **Świat 3 to ponownie wczytane dane 2-1** (world3.js → world21Data).
  Prawdziwy FSM World 3-1 ("Overworld Night": HammerBros, trampolina,
  pnącze, mostki nad wodą, podziemie i nocna strefa chmur) nie istnieje
  u nas w ogóle. Do zbudowania z danych FSM (brak plików world3-x).

## P2 — Mechaniki mocno wpływające na "czucie" SMB

- [x] **Kamera scrolluje w lewo** — w SMB/FSM scroll jest jednokierunkowy
  (ekran nigdy nie cofa się; gracz zatrzymuje się na lewej krawędzi ekranu).
- [x] **Skorupa (Sandshrew) nie budzi się** — FSM: po 350 klatkach "wierci się",
  po 490 wstaje żywy wróg. U nas skorupa jest wieczna.
- [x] **Arbok wychodzi z rury nawet gdy gracz stoi obok** — FSM blokuje
  wyjście gdy środek gracza jest w strefie rura ±32px (sprawdzane co 7 klatek).
  Dodatkowo pauza między cyklami: FSM 35 klatek, u nas 150.
- [x] **Brak wielokrotnych monet z bloku** — FSM: blok z monetami wydaje
  monety przy kolejnych uderzeniach przez 245 klatek od pierwszego, potem
  gaśnie. U nas zawsze jedna moneta.
- [x] **Podbicie bloku nie zabija wroga stojącego na nim** — klasyk SMB
  (characterTouchesUp → killFlip wrogów na bloku, podskok przedmiotów).
- [x] **Brak 100 monet → 1-Up** (licznik BALLS rośnie w nieskończoność).
- [x] **Punktacja niezgodna** (moneta 200, flaga wg wysokości, łańcuchy do 1-UP; czas→punkty i fajerwerki nie dotyczą — limit czasu usunięty):
  - moneta 100 zamiast **200**,
  - flaga: 0 pkt zamiast progów wg wysokości chwytu (100/400/800/2000/5000),
  - brak eskalacji łańcucha stomp/skorupa (100→200→…→8000→1-UP),
  - brak przeliczenia pozostałego czasu na punkty (50/jednostkę) i fajerwerków
    (0/1/3/6 wg ostatniej cyfry czasu, po 500 pkt).

## P3 — Parametry i warianty zachowań do dostrojenia

- [x] Prędkości: Goomba/Koopa **0.84** px/f (u nas 1.1/1.3); squash 21 klatek
  (u nas 30); skorupa 8 px/f (u nas 9).
- [x] Cubone/HammerBro: FSM rzuca **serią 7 kości co 7 klatek**, pauza 70
  (u nas 3 co 35, pauza 90); skok -8.4 lub losowo **zeskok w dół przez
  platformę** (42 klatki no-collide) — u nas pojedynczy hop -5.
- [x] Trampolina: wybicie -8.5 + maszyna skoku przy trzymaniu (netto jak FSM). Oryginalny zapis: wybicie proporcjonalne do siły uderzenia
  (tension = yvel×0.77, wybicie = tension×-0.98, min 8) — u nas sztywne
  -8.5/-13.5 z bonusem za skok.
- [x] Paratroopa wariant "hopping" (jumping bez floating: skacze po ziemi,
  jumpheight 4.68, gravity/2.8) — u nas tylko pionowy lot.
- [x] Zubat/Lakitu: brak trybu "wyprzedza sprintującego gracza"
  (slide do player.right+32, prędkość maxspeed×1.4); FSM chowa się 21 klatek
  przed zrzutem jaja (u nas zrzut natychmiast).
- [x] Podoboo/Slugma: FSM interwał 70 + stały wznos 256px, potem grawitacja. Oryginalny zapis: FSM interwał 70, gravity/2.1, start -maxyvel (-7)
  — u nas 80, 0.4, -16.
- [x] Makro `Water` (lawa/woda w dziurach zamków 1-4/2-4) — pominięte;
  w FSM to zabójcza przeszkoda wypełniająca luki podłogi.
- [x] ScrollBlocker/ScrollEnabler (1-2) — blokada scrollowania sekcji.
- [x] Paratroopa: clamp `flyMaxY ≥ 40px nad ziemią` zmienia zakres lotu vs JSON.
- [x] Tarcie: FSM odejmuje dodatkowo decel 0.0007 (ruch) / 0.035 (bezruch)
  po mnożniku 0.98 — u nas tylko mnożnik (bezwładność ciut dłuższa).

### Decyzje designowe (świadome odejścia od oryginału)

- [~] **Limit czasu usunięty na stałe** — był zaimplementowany 1:1 (24 klatki
  na jednostkę, TIME UP = śmierć), wycofany decyzją projektu: za duży stres
  dla młodszych graczy.
- [x] Skaczące Magikarpy w 2-3 — poprawione na wierny wzór FSM: stały lot
  w górę bez grawitacji aż pod górę ekranu, potem łuk z grawitacją; kierunek
  w prawo (0..2.7 px/kl), spawn na całej szerokości ekranu.
- [x] Trampolina — wybicie z trzymanym skokiem włącza maszynę skoku
  (ciągła siła jak w FSM po sprężynie), co pozwala przeskoczyć mur w 2-1.

## P4 — Prezentacja / polish

- [x] Czarny ekran "WORLD X-Y × żyć" przed każdą planszą.
- [x] Tła `Pattern` (lekkie aproksymacje: chmury/krzaki/płotki per wzór) (BackRegular/BackCloud/BackFence) — chmury, płotki,
  krzaki z oryginalnych układów (u nas własne proceduralne tło).
- [x] Muzyka gwiazdki — szybki motyw 'star' przełącza się automatycznie
  na czas nietykalności i wraca po niej.
- [x] Bowser hard-mode rzuca młotkami — mechanizm gotowy (flaga hard), aktywuje się w przyszłych światach 6+.
- [~] Ceiling na sztywnej wysokości (FSM też używa stałego ceillev — OK); Bridge z deskami i poręczą [x]; Coral bez width (JSON go nie używa — OK); CastleLarge rysowane 1.5x [x]. Oryginalny zapis: Ceiling na sztywnej wysokości (ignoruje y z JSON-a); Bridge bez lin
  i słupków; Coral ignoruje `width`; CastleLarge rysowane jak CastleSmall.
- [~] DecorativeBack/Dot/CustomText (napisy "SUPER MARIO BROS" w 1-1) — pomijamy celowo (reskin Pokémon ma własne menu).
- [~] `locations`/`entry`/`exit` z JSON-ów nieczytane — akceptujemy architekturę (routing w world1/world2.js) — routing obszarów
  zahardkodowany w world1.js/world2.js (działa, ale nie wynika z danych).
- [~] Meta: zamiast zamku z flagą — Pokémon Center/Shop (reskin zamierzony).
- [~] Fire Stone nieruchomy jak FireFlower; Rare Candy ruchome jak Mushroom
  (drift 1.4 vs FSM 1.68 — blisko).

## Zgodne z FSM (zweryfikowane)

Stałe ruchu gracza (grawitacja 0.48, prędkości 5.4/7, accel 0.098/0.196,
friction 0.98), wzór skoku (jumpmod 1.056), pływanie (gravity/2.8, paddle
-3.36×14f, brak sprintu), crouch, poziomy obrażeń FIRE→BIG→SMALL→śmierć,
śmierć w przepaści i po czasie; Blooper (56/63, ±0.7, 0.021/0.035, +2/-1);
CheepCheep (-1/-0.667, flip startowy); skaczące Magikarpy (+0.286);
jajo Spiny (-8.4) i Pineco (0.84); Bowser/Gengar (pełny port: interwały
ognia 280/350/490, windup 14, płomień -2.52 z celowaniem co 32px, skok
-5.6/117, gravity/2.8, sinus /1.4, pościg 0.84, 5 trafień, topór+most);
gwiazdka/1-Up 1000 pkt; WarpWorld; CastleBlock+FireBar z parametrami;
Q-bloki z hidden; Pipe entrance/exit/piranha; PlatformGenerator.
