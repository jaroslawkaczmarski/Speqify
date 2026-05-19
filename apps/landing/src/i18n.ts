/**
 * Landing copy in both locales. PL is the source (Speqify product is Polish,
 * design `<html lang="pl">`); EN mirrors `Speqify EN.html`. The component reads
 * one dictionary; the markup is locale-agnostic.
 */
export type Locale = "pl" | "en";

export interface Dict {
  htmlLang: string;
  metaTitle: string;
  metaDesc: string;
  benefit: string[];
  nav: { how: string; features: string; compare: string; privacy: string };
  ctaHeader: string;
  hero: {
    eyebrow: string;
    h1: string;
    lead: string;
    ctaPrimary: string;
    ctaSecondary: string;
    checks: string[];
    mockUrl: string;
    mockSelector: string;
    mockVoice: string;
    mockStatus: string;
    mockChips: string[];
  };
  trust: { label: string; logos: string[] };
  problems: {
    eyebrow: string;
    h2: string;
    lead: string;
    instead: string;
    youGet: string;
    cards: { before: string; after: string }[];
  };
  how: {
    eyebrow: string;
    h2: string;
    lead: string;
    steps: { h: string; p: string; who: string }[];
  };
  features: { eyebrow: string; h2: string; items: { h: string; p: string }[] };
  state: {
    eyebrow: string;
    h2: string;
    lead: string;
    annotation: string;
    task: string;
    annNodes: string[];
    taskNodes: string[];
    annNote: string;
    taskNote: string;
  };
  compare: {
    eyebrow: string;
    h2: string;
    lead: string;
    colFeature: string;
    colSpeqify: string;
    colOther: string;
    rows: { f: string; s: string; o: string; sk: "yes" | "no" | "partial"; ok: "yes" | "no" | "partial" }[];
  };
  privacy: {
    eyebrow: string;
    h2: string;
    p: string;
    points: { strong: string; rest: string }[];
  };
  bottom: {
    eyebrow: string;
    h2: string;
    lead: string;
    placeholder: string;
    button: string;
    thanks: string;
    fine: string;
  };
  footer: {
    tagline: string;
    productH: string;
    product: string[];
    resourcesH: string;
    resources: string[];
    companyH: string;
    company: string[];
    rights: string;
    made: string;
  };
}

const pl: Dict = {
  htmlLang: "pl",
  metaTitle: "Speqify — zbieraj wymagania wprost na żywej aplikacji",
  metaDesc:
    "Recenzent klika element, mówi do mikrofonu, a AI zamienia notatki w gotowe tickety w Jira lub GitHub — według Twojego szablonu, w Twoim języku.",
  benefit: ["Polski · zgodność z RODO", "SDK w 5 minut", "Eksport do Jira i GitHub", "Beta zamknięta — dołącz"],
  nav: { how: "Jak to działa", features: "Funkcje", compare: "Porównanie", privacy: "Prywatność" },
  ctaHeader: "Dołącz do bety",
  hero: {
    eyebrow: "Visual feedback + głos + AI",
    h1: "Zbieraj wymagania wprost na żywej aplikacji.",
    lead: "Recenzent klika element, mówi do mikrofonu i kończy sesję. Speqify zapisuje selektor, XPath, HTML i konsolę, a AI zamienia notatki w gotowe tickety w Jira lub GitHub — według Twojego szablonu, w Twoim języku.",
    ctaPrimary: "Dołącz do zamkniętej bety",
    ctaSecondary: "Zobacz, jak to działa",
    checks: ["Bez karty kredytowej", "SDK w 5 minut", "Hosted w UE"],
    mockUrl: "app.twojprodukt.pl/dashboard/orders",
    mockSelector: 'button.app-btn[data-action="export"]',
    mockVoice: "„Po eksporcie raport powinien lądować na e-mailu PO oraz jako załącznik w Slacku — w tej chwili pobiera się tylko CSV…”",
    mockStatus: "submitted",
    mockChips: ["Chrome 124 · macOS", "XPath", "2 błędy JS"],
  },
  trust: {
    label: "Pilotują z nami zespoły z:",
    logos: ["FINTECH Co.", "Northstack", "Lumen Lab", "Velora", "Atlas SaaS"],
  },
  problems: {
    eyebrow: "Problem",
    h2: "Feedback bez kontekstu kosztuje sprinty.",
    lead: "Klient pisze „ten przycisk na stronie X jest źle”. Developer szuka, zgaduje, dopytuje. Speqify odbiera kontekst jednym kliknięciem — bo zbiera go w momencie, gdy recenzent widzi problem.",
    instead: "Zamiast",
    youGet: "Dostajesz",
    cards: [
      {
        before: "„ten przycisk na podstronie zamówień jest źle...”",
        after: 'Element button[data-action="export"], screenshot, XPath, ścieżka nawigacji i nagranie głosowe 0:42.',
      },
      {
        before: "„opisz wymaganie w jednym akapicie i wyślij w mailu”",
        after: "Notatka głosowa jako funkcja pierwszej klasy. PO mówi, AI transkrybuje i grupuje uwagi.",
      },
      {
        before: "„przepisz 40 maili z feedbackiem na tickety w Jira”",
        after: "Tytuł, opis, kryteria akceptacji, etykiety i sub-taski — według Twojego szablonu, gotowe do akceptacji.",
      },
    ],
  },
  how: {
    eyebrow: "Przepływ E2E",
    h2: "Cztery role, jeden przepływ.",
    lead: "Praca asynchroniczna — recenzent zgłasza wtedy, kiedy widzi problem; PO uruchamia analizę po sesji; developer dostaje gotowy ticket.",
    steps: [
      { h: "Konfiguracja", p: "SA podpina klucze AI i projekt. PO definiuje szablon zadań i mapowanie eksportu (Jira / GitHub / JSON / CSV).", who: "role · SA → PO" },
      { h: "Zgłoszenie", p: "Recenzent otwiera aplikację z nakładką SDK. Klika element, nagrywa głos, pisze tekst. Autosave offline, idempotentny Send.", who: "role · Recenzent" },
      { h: "Analiza AI", p: "PO uruchamia analizę po sesji: transkrypcja audio, zrzuty z vision i szablon trafiają do LLM. Adnotacje grupowane w spójne zadania.", who: "role · PO" },
      { h: "Review & eksport", p: "PO akceptuje, edytuje lub odrzuca propozycje. Idempotentny eksport: create-only, bez duplikatów w Twoim trackerze.", who: "role · PO → Dev" },
    ],
  },
  features: {
    eyebrow: "Funkcje",
    h2: "Wszystko, czego brakuje narzędziom do bug-reportingu.",
    items: [
      { h: "Adnotacje na elemencie", p: "Klik w UI zapisuje selektor CSS, XPath, fragment HTML, ścieżkę nawigacji i zrzut viewportu. Bez zgadywania, którego przycisku dotyczy uwaga." },
      { h: "Notatki głosowe", p: "Funkcja pierwszej klasy, nie dodatek. PO mówi swobodnie, recenzent nagrywa narrację ekranu — transkrypcja po sesji, w wybranym języku." },
      { h: "Kontekst techniczny", p: "Automatycznie: konsola, błędy JS, ostatnie żądania sieciowe, przeglądarka i OS. Plus kontekst aplikacji: build, środowisko, użytkownik, feature flags." },
      { h: "AI wg Twojego szablonu", p: "LLM grupuje uwagi i pisze: tytuł, opis, kryteria akceptacji (Given/When/Then), etykiety, sub-taski. Dokładnie według szablonu projektu — nie generyczne." },
      { h: "Eksport do Jira & GitHub", p: "Create-only, idempotentnie — bez duplikatów przy ponownym kliknięciu. Mapowanie pól per projekt. Backup do JSON i CSV w jednym kroku." },
      { h: "Tryb asynchroniczny", p: "Recenzent nie czeka na PO. PO nie czeka na recenzenta. Analiza AI uruchamiana po sesji — nie w czasie rzeczywistym, bez kosztu wzajemnego blokowania." },
    ],
  },
  state: {
    eyebrow: "Pod maską",
    h2: "Dwie maszyny stanów, zero zaskoczeń.",
    lead: "Każda adnotacja i każde zadanie ma jeden, jawny stan. Wiadomo, co się dzieje, kto za co odpowiada i co jest do zrobienia.",
    annotation: "Adnotacja",
    task: "Zadanie",
    annNodes: ["draft", "submitted", "processed"],
    taskNodes: ["generated", "accepted", "exported"],
    annNote: "Autosave offline w stanie draft. Idempotentny submit chroni przed duplikatami. processed = AI zwróciła kandydata na zadanie.",
    taskNote: "Propozycja AI w stanie generated. PO akceptuje lub edytuje → accepted. Eksport do Jira/GitHub kończy cykl: exported.",
  },
  compare: {
    eyebrow: "Porównanie",
    h2: "Speqify vs. visual feedback klasyczny.",
    lead: "Najbliższy analog rynkowy to Usersnap. Speqify ma inny kąt: zbieranie wymagań na żywej aplikacji, głos i AI piszące tickety.",
    colFeature: "Funkcja",
    colSpeqify: "Speqify",
    colOther: "Visual feedback klasyczny",
    rows: [
      { f: "Adnotacja na żywej aplikacji", s: "✓ Wbudowane", o: "✓ Wbudowane", sk: "yes", ok: "yes" },
      { f: "Notatki głosowe (pierwsza klasa)", s: "✓ Z transkrypcją AI", o: "— Brak lub załącznik", sk: "yes", ok: "no" },
      { f: "AI pisze tickety wg szablonu", s: "✓ Tytuł, opis, AC, sub-taski", o: "~ Streszczenia / sugestie", sk: "yes", ok: "partial" },
      { f: "Kontekst techniczny (konsola, sieć, build)", s: "✓ Automatycznie", o: "✓ Automatycznie", sk: "yes", ok: "yes" },
      { f: "Idempotentny eksport (Jira / GitHub)", s: "✓ Create-only, bez duplikatów", o: "~ Integracje, ale duplikaty się zdarzają", sk: "yes", ok: "partial" },
      { f: "Tryb asynchroniczny PO ↔ recenzent", s: "✓ Wbudowany przepływ", o: "~ Wymaga procesu zewnętrznego", sk: "yes", ok: "partial" },
      { f: "Hosting w UE, narzędzia RODO", s: "✓ Domyślnie", o: "~ Zależnie od planu", sk: "yes", ok: "partial" },
    ],
  },
  privacy: {
    eyebrow: "Prywatność & RODO",
    h2: "Wymagania zbierane na produkcie nie mogą wyciekać poza zespół.",
    p: "Zaprojektowane od podstaw pod europejskie wymagania zgodności. Bez kompromisów wymuszanych przez infrastrukturę spoza UE.",
    points: [
      { strong: "Zgoda przy pierwszym użyciu.", rest: "Recenzent wie, co i kiedy jest nagrywane." },
      { strong: "Scrubbing sekretów.", rest: "Tokeny, hasła i klucze API automatycznie usuwane z zrzutów i HTML-a." },
      { strong: "Blurowanie PII.", rest: "Narzędzia do zamazywania imion, adresów, numerów kart — manualne i automatyczne." },
      { strong: "Retencja i prawo do usunięcia.", rest: "Polityki retencji per projekt, jednoklik delete dla użytkownika końcowego." },
      { strong: "Dane w UE.", rest: "Hosting i przetwarzanie LLM w wybranym regionie europejskim." },
    ],
  },
  bottom: {
    eyebrow: "Beta zamknięta",
    h2: "Tak, chcę pisać mniej i dostarczać szybciej.",
    lead: "Zostaw firmowy adres e-mail. Wracamy w 1–2 dni roboczych z kluczem do SDK, przykładowym szablonem zadań Jira i 30-minutowym onboardingiem.",
    placeholder: "ty@firma.pl",
    button: "Dołącz do bety",
    thanks: "Dziękujemy — wracamy w 1–2 dni",
    fine: "Bez spamu. Twój adres nie trafi na żadną listę marketingową.",
  },
  footer: {
    tagline: "Zbieranie wymagań i feedbacku wprost na żywej aplikacji webowej. Polski produkt, hostowany w UE.",
    productH: "Produkt",
    product: ["Jak to działa", "Funkcje", "Porównanie", "Beta zamknięta"],
    resourcesH: "Zasoby",
    resources: ["Dokumentacja SDK", "Szablony zadań Jira", "Status systemu", "Changelog"],
    companyH: "Firma",
    company: ["Prywatność", "Regulamin", "DPA", "hello@speqify.io"],
    rights: "© 2026 Speqify. Wszelkie prawa zastrzeżone.",
    made: "Made in Poland · Hosted in EU",
  },
};

const en: Dict = {
  htmlLang: "en",
  metaTitle: "Speqify — collect requirements right on your live app",
  metaDesc:
    "A reviewer clicks an element, talks to the mic, and AI turns the notes into ready Jira or GitHub tickets — in your template, in your language.",
  benefit: ["Polish-made · GDPR-ready", "SDK in 5 minutes", "Export to Jira & GitHub", "Closed beta — join in"],
  nav: { how: "How it works", features: "Features", compare: "Compare", privacy: "Privacy" },
  ctaHeader: "Join the beta",
  hero: {
    eyebrow: "Visual feedback + voice + AI",
    h1: "Collect requirements right on your live app.",
    lead: "A reviewer clicks an element, speaks into the mic, and ends the session. Speqify captures the selector, XPath, HTML and console, and AI turns the notes into ready Jira or GitHub tickets — in your template, in your language.",
    ctaPrimary: "Join the closed beta",
    ctaSecondary: "See how it works",
    checks: ["No credit card", "SDK in 5 minutes", "Hosted in the EU"],
    mockUrl: "app.yourproduct.com/dashboard/orders",
    mockSelector: 'button.app-btn[data-action="export"]',
    mockVoice: "“After export the report should land in the PO's email and as a Slack attachment — right now it only downloads a CSV…”",
    mockStatus: "submitted",
    mockChips: ["Chrome 124 · macOS", "XPath", "2 JS errors"],
  },
  trust: {
    label: "Teams piloting with us:",
    logos: ["FINTECH Co.", "Northstack", "Lumen Lab", "Velora", "Atlas SaaS"],
  },
  problems: {
    eyebrow: "Problem",
    h2: "Feedback without context costs sprints.",
    lead: "A client writes “that button on page X is wrong”. The developer searches, guesses, asks back. Speqify captures the context in one click — because it grabs it the moment the reviewer sees the problem.",
    instead: "Instead of",
    youGet: "You get",
    cards: [
      {
        before: "“that button on the orders page is wrong...”",
        after: 'Element button[data-action="export"], a screenshot, XPath, the navigation path and a 0:42 voice note.',
      },
      {
        before: "“describe the requirement in one paragraph and email it”",
        after: "Voice notes as a first-class feature. The PO speaks, AI transcribes and groups the remarks.",
      },
      {
        before: "“rewrite 40 feedback emails into Jira tickets”",
        after: "Title, description, acceptance criteria, labels and sub-tasks — in your template, ready to accept.",
      },
    ],
  },
  how: {
    eyebrow: "End-to-end flow",
    h2: "Four roles, one flow.",
    lead: "Asynchronous by design — the reviewer reports when they see the problem; the PO runs analysis after the session; the developer gets a ready ticket.",
    steps: [
      { h: "Setup", p: "SA wires AI keys and the project. PO defines the task template and export mapping (Jira / GitHub / JSON / CSV).", who: "roles · SA → PO" },
      { h: "Report", p: "The reviewer opens the app with the SDK overlay. Clicks an element, records voice, writes text. Offline autosave, idempotent Send.", who: "role · Reviewer" },
      { h: "AI analysis", p: "After the session the PO runs analysis: audio transcription, vision screenshots and the template go to the LLM. Annotations grouped into coherent tasks.", who: "role · PO" },
      { h: "Review & export", p: "PO accepts, edits or rejects the proposals. Idempotent export: create-only, no duplicates in your tracker.", who: "roles · PO → Dev" },
    ],
  },
  features: {
    eyebrow: "Features",
    h2: "Everything bug-reporting tools are missing.",
    items: [
      { h: "Element-level annotations", p: "A UI click captures the CSS selector, XPath, HTML fragment, navigation path and a viewport screenshot. No guessing which button the remark is about." },
      { h: "Voice notes", p: "A first-class feature, not an add-on. The PO speaks freely, the reviewer narrates the screen — transcription after the session, in the chosen language." },
      { h: "Technical context", p: "Automatically: console, JS errors, recent network requests, browser and OS. Plus app context: build, environment, user, feature flags." },
      { h: "AI in your template", p: "The LLM groups remarks and writes: title, description, acceptance criteria (Given/When/Then), labels, sub-tasks. Exactly per the project template — not generic." },
      { h: "Export to Jira & GitHub", p: "Create-only, idempotent — no duplicates on a repeat click. Per-project field mapping. JSON and CSV backup in one step." },
      { h: "Asynchronous mode", p: "The reviewer doesn't wait for the PO. The PO doesn't wait for the reviewer. AI analysis runs after the session — not in real time, no mutual blocking cost." },
    ],
  },
  state: {
    eyebrow: "Under the hood",
    h2: "Two state machines, zero surprises.",
    lead: "Every annotation and every task has one explicit state. You know what's happening, who owns what, and what's left to do.",
    annotation: "Annotation",
    task: "Task",
    annNodes: ["draft", "submitted", "processed"],
    taskNodes: ["generated", "accepted", "exported"],
    annNote: "Offline autosave in the draft state. Idempotent submit prevents duplicates. processed = AI returned a task candidate.",
    taskNote: "AI proposal in the generated state. PO accepts or edits → accepted. Export to Jira/GitHub closes the cycle: exported.",
  },
  compare: {
    eyebrow: "Compare",
    h2: "Speqify vs. classic visual feedback.",
    lead: "The closest market analog is Usersnap. Speqify takes a different angle: requirements gathering on the live app, voice, and AI writing the tickets.",
    colFeature: "Feature",
    colSpeqify: "Speqify",
    colOther: "Classic visual feedback",
    rows: [
      { f: "Annotation on the live app", s: "✓ Built in", o: "✓ Built in", sk: "yes", ok: "yes" },
      { f: "Voice notes (first class)", s: "✓ With AI transcription", o: "— None or attachment", sk: "yes", ok: "no" },
      { f: "AI writes tickets per template", s: "✓ Title, description, AC, sub-tasks", o: "~ Summaries / suggestions", sk: "yes", ok: "partial" },
      { f: "Technical context (console, network, build)", s: "✓ Automatic", o: "✓ Automatic", sk: "yes", ok: "yes" },
      { f: "Idempotent export (Jira / GitHub)", s: "✓ Create-only, no duplicates", o: "~ Integrations, but duplicates happen", sk: "yes", ok: "partial" },
      { f: "Async PO ↔ reviewer mode", s: "✓ Built-in flow", o: "~ Needs an external process", sk: "yes", ok: "partial" },
      { f: "EU hosting, GDPR tooling", s: "✓ By default", o: "~ Plan dependent", sk: "yes", ok: "partial" },
    ],
  },
  privacy: {
    eyebrow: "Privacy & GDPR",
    h2: "Requirements collected on the product must not leak beyond the team.",
    p: "Designed from the ground up for European compliance. No compromises forced by non-EU infrastructure.",
    points: [
      { strong: "Consent on first use.", rest: "The reviewer knows what is recorded and when." },
      { strong: "Secret scrubbing.", rest: "Tokens, passwords and API keys auto-stripped from screenshots and HTML." },
      { strong: "PII blurring.", rest: "Tools to redact names, addresses, card numbers — manual and automatic." },
      { strong: "Retention & right to erasure.", rest: "Per-project retention policies, one-click delete for the end user." },
      { strong: "Data in the EU.", rest: "Hosting and LLM processing in the chosen European region." },
    ],
  },
  bottom: {
    eyebrow: "Closed beta",
    h2: "Yes, I want to write less and ship faster.",
    lead: "Leave a company email. We come back within 1–2 business days with an SDK key, a sample Jira task template and a 30-minute onboarding.",
    placeholder: "you@company.com",
    button: "Join the beta",
    thanks: "Thank you — we'll be back in 1–2 days",
    fine: "No spam. Your address won't go on any marketing list.",
  },
  footer: {
    tagline: "Requirements and feedback gathering right on your live web app. Polish-made, hosted in the EU.",
    productH: "Product",
    product: ["How it works", "Features", "Compare", "Closed beta"],
    resourcesH: "Resources",
    resources: ["SDK docs", "Jira task templates", "System status", "Changelog"],
    companyH: "Company",
    company: ["Privacy", "Terms", "DPA", "hello@speqify.io"],
    rights: "© 2026 Speqify. All rights reserved.",
    made: "Made in Poland · Hosted in EU",
  },
};

export const DICT: Record<Locale, Dict> = { pl, en };
