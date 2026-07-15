# Changelog

Alle updates van de ImpactVandaag Artikel Agents app.

## vBetere artikelinhoud: sterkere prompts, lengte-bewaking en bugfixes — 15 July 2026
- Alle zes agent-prompts flink verbeterd voor betere artikelen:
  - Writer krijgt nu duidelijke eisen voor kop, opening, tussenkoppen, concrete cijfers/voorbeelden en bronvermelding in de tekst — en mag geen feiten meer verzinnen
  - Reviewer beoordeelt streng met scores per criterium (o.a. concreetheid en feiten-check tegen de bronnen)
  - Humanizer herkent meer AI-patronen (drieklanken, "Kortom"-afsluiters, symmetrische paragrafen) en voegt menselijk ritme toe
  - Bronnen Agent geeft zekerheid per feit aan en levert een "check voor publicatie"-lijstje voor de redactie
  - Researcher kiest nu één scherpe invalshoek met argumentatielijn en structuurvoorstel
  - Intake vraagt door op concrete voorbeelden en cijfers voordat het artikel start
- Nieuwe lengte-bewaking: wijkt het eindartikel meer dan 15% af van het gewenste aantal woorden, dan volgt automatisch één extra redactieslag
- Bugfix: aangepaste website-instellingen (doelgroep, jargon, verboden woorden, tone of voice) kwamen nooit in de agent-prompts terecht — nu wel
- Bugfix: in de dagelijkse run kregen de Nieuws-, Evergreen-, Bronnen- en Researcher-agents een veel te krap tokenbudget, waardoor hun output werd afgekapt (Fable 5 telt denkwerk mee) — budgetten fors verhoogd
- Opgeslagen agent-prompts van een oudere generatie worden automatisch geüpgraded naar de nieuwe prompts (let op: eerdere handmatige prompt-aanpassingen worden daarbij éénmalig vervangen)
- Na het opslaan van website-instellingen worden de agent-prompts direct opnieuw opgebouwd én opgeslagen

## vCode opgesplitst in aparte bestanden — 15 July 2026
- De code is opgesplitst in drie bestanden: `index.html` (structuur), `styles.css` (opmaak) en `app.js` (logica)
- Geen functionele wijzigingen — de app werkt precies zoals eerst

## vMooiere UI en betere UX — 15 July 2026
- Workflow toont nu totale voortgang ("Stap 2 van 5" met voortgangsbalk)
- Actieve agent-stap krijgt een zachte pulserende gloed; afgeronde stappen een vinkje
- Lange agent-output is uitklapbaar met "klik om alles te tonen"
- Toast-meldingen onderin beeld (o.a. "Artikel gekopieerd" en "Artikel klaar! 🎉") i.p.v. blokkerende alerts
- Typing-indicator met verende bolletjes in de intake-chat
- Chat-invoerveld groeit automatisch mee met je tekst
- Knoppen met subtiele hover-lift, zachtere schaduwen op kaarten, nette scrollbars
- Voortgangsbalk intake met gradient en glans-animatie
- Mobiel/smalle vensters: zijbalk klapt om naar horizontale balk, artikel en beoordeling passen zich aan
- Toegankelijkheid: duidelijke focus-ringen en respect voor "verminderde beweging"-voorkeur

## vClaude Fable 5 en slimmere app — 15 July 2026
- Claude Fable 5 is nu het standaardmodel (slimste Claude-model); Opus 4.8 en Haiku 4.5 als alternatieven
- Oude/verlopen model-namen worden automatisch geüpgraded naar de nieuwe generatie
- Slimmere API-laag: automatische retries bij overbelasting en fallback naar Opus 4.8 als Fable 5 een verzoek weigert
- Bugfix: opgeslagen instellingen (o.a. API key) werden bij elke page-load gewist — nu niet meer
- Live timer per agent-stap ("Bezig... 12s" en "Klaar ✓ · 45s")
- Actief AI-model zichtbaar in de header
- Model-veld in beveiligde instellingen heeft nu suggesties en vult automatisch aan bij providerwissel
- Ruimer tokenbudget voor Writer/Reviewer/Humanizer (Fable 5 denkt mee in het outputbudget)

## vBevat artikel archief en dagelijks maitljes sturen is er uit weggehaald. Ook is versiegeschiedenis aan de pagina van github toegevoegd. — 29 May 2026
- Artikel archief
- Dagelijks maitlje sturen eruit gehaald
- Versiegeschiedenis
