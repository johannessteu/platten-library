---
name: liner-notes
description: "Schreibt Plattennotizen für platten.johannessteu.de: recherchiert eine Platte aus dem Regal und legt data/notes/<id>.json an (Die Platte, Zuerst auflegen, Über den Act, Gut zu wissen, Wenn dir das gefällt). Nutzen, wenn Johannes Notizen für eine oder mehrere Platten will, „/liner-notes alle fehlenden“ sagt oder neue Platten aus dem Discogs-Sync beschreiben lassen möchte."
---

# Plattennotizen für platten.johannessteu.de

Eine angepasste Fassung des artist-profile-Skills: dieselbe Recherche-Sorgfalt, aber kurz, auf Deutsch und als JSON-Datei für die Website. Gelesen werden die Notizen von Gästen, die auf dem Handy in 30 Sekunden entscheiden, was sie auflegen. Erkläre also Zusammenhänge, aber knapp.

## 1. Welche Platten?

- Johannes nennt Discogs-Release-IDs → genau diese.
- „alle fehlenden“ oder keine Angabe → `npm run notes:todo -- --json`. Sind es mehr als fünf, sag kurz, wie viele es sind, und arbeite in Paketen.
- Lies zu jeder ID `data/records/<id>.json`: `artist`, `title`, `originalYear`, `labels`, `tracklist`. Das ist die Pressung im Regal; die Notizen beschreiben das Originalalbum.
- Compilations, Live-Alben und Sampler (`artist` = „Various“): Dann geht es um die Zusammenstellung oder den Abend. Abschnitte ohne Material kurz halten statt aufblähen.
- **Namensgleichheit**: Mehrere Acts können gleich heißen (Bruckner das Indie-Duo vs. Anton Bruckner). Die Record-Datei (Label, Jahr, Genres, Titelliste) entscheidet.

## 2. Recherche (immer, vor dem Schreiben)

- Schreib nicht aus dem Gedächtnis. Nutze WebSearch und WebFetch.
- Gute Quellen: Wikipedia (de/en), Discogs, laut.de, Musikexpress, Rolling Stone, Plattentests.de, AllMusic, Pitchfork, Label-Seiten, Interviews.
- Jahreszahlen, Label, Produktion und Studio gleichst du gegen mindestens zwei Quellen ab. Bei Widersprüchen: weglassen oder gröber formulieren („September 2013“ statt eines strittigen Tages).
- Erfinde **niemals** Chartplatzierungen, Zitate, Anekdoten oder Zahlen. Was nicht belegt ist, fliegt raus.
- Discogs blockt WebFetch oft (403). Dann reichen die Record-Datei im Repo und andere Quellen.
- Sehr kleine Acts mit wenig Material: ehrlich kurz bleiben.

## 3. Datei schreiben

`data/notes/<id>.json`, gültig gegen `schema/notes.schema.json`. Beispiel (gekürzt):

```json
{
  "kicker": "Sheffield · aktiv seit 2002 · Indie-Rock mit Wüstenrock-Riffs",
  "tag": "Lässig nach Mitternacht",
  "record": "Das fünfte Album der Arctic Monkeys und das, mit dem sie weltweit zu Headlinern wurden. …",
  "facts": [
    { "k": "Erschienen", "v": "September 2013" },
    { "k": "Label", "v": "Domino" },
    { "k": "Produktion", "v": "James Ford, Co-Produktion Ross Orton" }
  ],
  "start": [{ "t": "Do I Wanna Know?", "why": "Der Opener mit diesem Riff …" }],
  "band": "Gegründet 2002 in Sheffield von den Schulfreunden …",
  "trivia": ["Josh Homme von Queens of the Stone Age singt im Hintergrund bei „One for the Road“ und „Knee Socks“."],
  "similar": [{ "a": "The Strokes", "why": "Die Garage-Rock-Linie, aus der die frühen Arctic Monkeys kamen …" }],
  "sources": [{ "label": "Wikipedia: AM", "url": "https://en.wikipedia.org/wiki/AM_(Arctic_Monkeys_album)" }],
  "writtenAt": "2026-11-07"
}
```

Regeln pro Feld:

- **kicker**: „<Herkunft> · aktiv seit <Jahr> · <Kern-Genre in 2–4 Worten>“.
- **tag**: griffiges Schlagwort für die Stimmung, 2–4 Wörter, kein bloßes Genre.
- **record**: 2–3 Sätze, höchstens 480 Zeichen. Was ist das für ein Album, wo steht es in der Karriere, warum lohnt es sich?
- **facts**: nur belegte Werte des Originalalbums. Schlüssel aus: Erschienen, Label, Produktion, Aufgenommen, Länge, Gast. Höchstens fünf.
- **start**: 2–3 Songs **dieser** Platte, Titel exakt wie in der `tracklist` der Record-Datei, je ein Satz, warum genau dieser.
- **band**: 3–4 Sätze, höchstens 620 Zeichen: Herkunft, Werdegang, Wendepunkte, wofür der Act steht. Immer das *Warum* mitliefern.
- **trivia**: 2–3 belegte Fakten, je ein Satz (Cover, Gäste, Hintergründe zu Songs, Preise).
- **similar**: 3–4 Künstler, je ein Satz zur Verbindung (Sound, Szene, Personal). Steht ein wirklich verwandter Künstler im Regal (Feld `artist` in `data/records/*.json`), schreib ihn exakt so: Die Website verlinkt ihn dann als „Bei uns im Regal“. Nicht erzwingen. Schreib im `why` nicht, dass er im Regal steht (das zeigt der Button), und nenne nie den Act der Platte selbst: Weitere Platten desselben Acts listet die Website ohnehin.
- **sources**: 2–4 tatsächlich genutzte URLs mit kurzem Label („Wikipedia: AM“, „laut.de“).
- **writtenAt**: das heutige Datum, YYYY-MM-DD.

Stil: Deutsch, sachlich, mit Musikjournalisten-Kompetenz, aber ohne Feuilleton-Geschwurbel. Song- und Albumtitel im Fließtext in „…“. Keine Songtexte abschreiben, keine Emojis. Ein Abschnitt ohne belastbares Material wird kurz, statt mit Floskeln gefüllt zu werden.

## 4. Prüfen

Führ `npm run check` aus und behebe Fehler, bis es durchläuft. Die Längenlimits stehen im Schema.

## 5. Viele Platten

Bei mehreren Platten darfst du Subagents parallel einsetzen: eine Platte pro Agent, jeder schreibt nur seine eigene Datei und hält sich an diese Regeln. Lies danach selbst stichprobenartig gegen und lass `npm run check` laufen.

## 6. Abschluss

Committe nicht, außer Johannes bittet darum. Zum Schluss: Liste der geschriebenen Platten und ein Satz zu unsicheren Stellen (was du weggelassen hast und warum). Commit-Vorschlag: „Add liner notes for <Artist> – <Title>“ bzw. „Add liner notes for N records“.
