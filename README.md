# Artikel Agents

AI-gestuurde artikel generator voor **ImpactVandaag** en **OpdrachtOverheid**.

## Wat doet het?

6 agents werken samen om automatisch kwalitatieve artikelen te schrijven:
1. **Intake Agent** - Stelt gerichte vragen totdat er genoeg input is
2. **Bronnen Agent** - Zoekt relevante overheidsdata en cijfers op
3. **Researcher** - Maakt een strategische briefing
4. **Writer** - Schrijft het volledige artikel
5. **Reviewer** - Controleert kwaliteit en past aan
6. **Humanizer** - Verwijdert AI-schrijfpatronen

## Gebruik

Open `index.html` in je browser, of bezoek de live versie via GitHub Pages.

## Websites

- [impactvandaag.nl](https://impactvandaag.nl) - Professionals in loondienst bij de overheid
- [opdrachtoverheid.nl](https://opdrachtoverheid.nl) - ZZP opdrachten bij de overheid

## Setup

Gebouwd met de Anthropic Claude API. Standaardmodel is **Claude Fable 5** (het slimste Claude-model), met automatische fallback naar Claude Opus 4.8. Google Gemini wordt ook ondersteund via dezelfde Cloudflare Worker.
