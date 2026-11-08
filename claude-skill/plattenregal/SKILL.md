---
name: plattenregal
description: Kennt das Plattenregal von Johannes (platten.johannessteu.de) mit allen Schallplatten, Stimmungen, Kurztexten, Anspieltipps und Künstlerprofilen, gelesen aus Supabase. Nutzen, wenn Johannes fragt, was er aus dem eigenen Regal auflegen soll (Dinner, Gäste, Party, Sonntagmorgen, Kochen, eine Stimmung, ein Anlass) oder etwas über die eigenen Platten wissen will, z. B. „haben wir was von …?“, „was passt zu …?“, „welche Platten sind neu?“, „was ist das ruhigste Album im Regal?“.
---

# Plattenregal

Johannes' Plattenregal liegt als Kopie in Supabase, im Projekt **bean-go** (Projekt-ID `iqxfvlhmaeysammntxis`). Lies es über den Supabase-Connector mit `execute_sql`.

- **Nur lesen.** Nie schreiben, nichts anlegen, ändern oder löschen. Die Tabellen werden automatisch aus der Website befüllt; Quelle der Wahrheit ist das Repo der Website, nicht Supabase.
- Die Tabellen `records`, `record_tracks` und `wantlist_items` im selben Projekt gehören zu einer anderen App (RecordZ) und sind **nicht** das Regal. Nur die `platten`-Tabellen verwenden.

## Tabellen

**`public.platten`**: eine Zeile pro Platte im Regal.

| Spalte | Inhalt |
|---|---|
| `id` | Discogs-Release-ID |
| `artist`, `title` | Künstler, Album |
| `year` | Jahr der Erstveröffentlichung; `pressing_year`: Jahr der Pressung im Regal |
| `genres`, `styles` | Discogs-Genres und -Stile (Englisch) |
| `format` | „LP“, „2×LP“, „7"“ … |
| `added_at` | wann die Platte ins Regal kam |
| `mood` | Stimmung in 2–4 Wörtern, z. B. „Lässig nach Mitternacht“ |
| `kicker` | Herkunft · aktiv seit · Kern-Genre |
| `about_record` | 2–3 Sätze zum Album |
| `about_artist` | 3–4 Sätze zum Act |
| `start_with` | Songs zum Anfangen: `[{t, why}]` |
| `facts`, `trivia` | Fakten `[{k, v}]` und belegte Hintergründe |
| `similar_artists` | verwandte Künstler `[{a, why}]` |
| `tracklist` | `[{position, title, duration}]`; Position A1, B2 … zeigt die Seite |
| `artist_slug` | Schlüssel in `platten_artists` (null bei Samplern) |
| `page_url` | Seite der Platte auf platten.johannessteu.de |

Platten ohne Notizen haben `mood`, `about_record` usw. leer; dann nur mit Künstler, Titel, Genre und Jahr arbeiten.

**`public.platten_artists`**: längere Künstlerprofile (`slug`, `name`, `summary`, `career`, `sound`, `highlights`, `discography`).

**`public.platten_sync`**: Stand der Kopie (`generated_at`, `synced_at`, Anzahl).

## Vorgehen

1. Erst den Überblick über das ganze Regal holen (gut 50 Zeilen, passt in einen Aufruf):

   ```sql
   select id, artist, title, year, genres, styles, format, mood, about_record
   from public.platten order by artist, title;
   ```

2. Für die Kandidaten die Details nachladen, z. B.:

   ```sql
   select artist, title, start_with, tracklist, about_artist, page_url
   from public.platten where id in (…);
   ```

3. Bei Fragen zu einem Künstler auch `platten_artists` lesen.

## Antworten

- **Nur Platten aus dem Regal vorschlagen.** Kaufideen nur, wenn Johannes ausdrücklich danach fragt.
- Für einen Anlass 3–6 Platten in einer sinnvollen Reihenfolge, etwa beim Dinner: Ankommen, Essen, später am Abend. Eine Plattenseite läuft etwa 20 Minuten; für einen langen Abend lieber ganze Seiten planen als einzelne Songs.
- Pro Platte: **Künstler – Titel** (Jahr), ein Satz, warum sie passt (aus `mood`, `about_record`, Genres), und womit man anfängt: ein Song aus `start_with` oder eine Seite aus der `tracklist`. Dazu den Link aus `page_url`.
- Nichts über die Platten erfinden, was nicht in den Daten steht. Allgemeines Musikwissen ist erlaubt, aber nicht als Eigenschaft einer bestimmten Pressung ausgeben.
- Auf Deutsch, kurz und konkret, wie ein Freund mit gutem Geschmack, nicht wie ein Katalog.

## Wenn der Connector fehlt

Ist kein Supabase-Connector verfügbar, sag das kurz und bitte Johannes, ihn für diesen Chat einzuschalten oder den Link https://platten.johannessteu.de/regal.json in den Chat zu geben. Die Datei enthält dasselbe als JSON (`records`, `artists`).
