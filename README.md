`[ Phase 1: GRILL ] ➔ [ Phase 2: PRD ] ➔ [ Phase 3: SLICING ] ➔ [ Phase 4: DEV ] ➔ [ Phase 5: REFACTOR ]`

### Phase 1: Die Idee "weichkochen" (Vorbereitung)

Bevor Code entsteht, wird die Idee auf Herz und Nieren geprüft.

1. **Tool starten:** Du nutzt den Ordner/Prompt **`grill-with-docs`** (oder das Skript `grill-me.md`).
2. **Das Verhör:** Du gibst deine grobe Idee ein. Die KI stellt dir nun so lange Detailfragen, bis alle logischen Lücken geschlossen sind.
3. **Das Ergebnis:** Es entsteht (oder aktualisiert sich) eine `CONTEXT.md`, die das gesamte Projektwissen und die Begriffe (Domain Model) fehlerfrei festhält.

### Phase 2: Das PRD schreiben (Die Blaupause)

Jetzt wird das Fundament betoniert.

1. **Tool starten:** Du nutzt den Ordner/Prompt **`to-prd`** (bzw. `to-prd.md`).
2. **Die Synthese:** Die KI schreibt das Product Requirements Document (PRD). Sie nutzt *ausschließlich* die Infos aus Phase 1.
3. **Inhalt:** Das PRD enthält User Stories, technische Hürden, Test-Strategien und – ganz wichtig – was *nicht* gebaut wird (*Out of Scope*).

### Phase 3: Slicing (Die Aufteilung)

Ein riesiges PRD überfordert jede KI und jeden Entwickler. Es wird zerlegt.

1. **Tool starten:** Du nutzt den Ordner/Prompt **`to-issues`**.
2. **In Scheiben schneiden:** Die KI schneidet das PRD in kleine, unabhängige Häppchen (**Vertical Slices**). Jedes Slice ist ein Ticket (Issue), das ein echtes, kleines Teil-Feature von der Datenbank bis zur UI abbildet.
3. **Das Ergebnis:** Du hast eine saubere, chronologische Liste von Tickets (z. B. in GitHub, Linear oder als Markdown-Liste im Projekt).

### Phase 4: Die Umsetzung (Hier steckst du gerade!)

Jetzt wird das Projekt Stück für Stück zum Leben erweckt. Du gehst die Ticket-Liste **einzeln** von oben nach unten durch.

*Für jedes einzelne Ticket wiederholst du diesen Mini-Kreislauf:*

1. **Tool starten:** Wähle **`tdd`** (für Core-Logik/Backend) oder **`implement`** (für einfache UI/No-Brainer).
2. **Der TDD-Loop (falls `tdd` gewählt):**
    - **Red:** Die KI schreibt einen automatisierten Test, der fehlschlägt.
    - **Green:** Die KI schreibt den Code, bis der Test grün wird.
    - **Refactor:** Die KI räumt den geschriebenen Code auf, während der Test grün bleibt.
3. **Deine Kontrolle (Zwischenergebnis):** Du stoppst die KI kurz, schaust dir den `git diff` im Editor an, prüfst den grünen Test im Terminal und wirfst einen Blick in den Browser (`npm run dev`).
4. **Fehler abfangen:**
    - Bleibt die KI in einer Fehlerschleife hängen? Nutze **`diagnosing-bugs`**.
    - Weißt du nicht, wie die Typen aussehen sollen? Nutze **`domain-modeling`**.
    - Hast du eine Architekturfrage? Nutze **`ask-matt`**.
5. **Abschluss:** Ticket fertig? Git-Commit machen. Nächstes Ticket vornehmen.

#### ! immer prüfen - ob Änderungen richtig impelmentiert

#### Frage wie Änderungen getestet werden können um manuell zu checken.

### Phase 5: Die Architektur-Pflege (Nachbereitung)

Wenn alle (oder eine größere Gruppe von) Issues abgehakt sind, wird aufgeräumt, damit das Projekt nicht im Chaos versinkt.

1. **Tool starten:** Du nutzt **`improve-codebase-architecture`** oder **`codebase-design`**.
2. **Der Hausputz:** Die KI analysiert den neu dazugekommenen Code global. Sie sucht nach Code-Duplikaten, zu komplexen Interfaces oder Architektur-Verstößen.
3. **Das Ergebnis:** Refactoring-Vorschläge werden umgesetzt, um die Codebasis sauber zu halten, bevor der Kreislauf für das nächste große Feature von vorne beginnt.
