# Survey Platform - Research

## Teknik & Backend

### 1. Säkerhet - Admin-autentisering

**Problem:** Alla admin-sidor (`/admin/*`) och admin-API:er (`/api/courses`, `/api/surveys`, `/api/questions`, etc.) saknar helt autentisering. Vem som helst kan skapa kurser, importera frågor, se resultat och ta bort data.

**Nuläge i koden:**
- `src/app/admin/layout.tsx` - Bara en wrapper med styling, ingen auth-check
- Alla API-routes under `/api/` accepterar requests utan autentisering
- Student-session finns (`src/lib/student-session.ts`) med JWT via `jose`, men ingen admin-session

#### Rekommendation: NextAuth.js (Auth.js v5)

**Varför NextAuth framför Clerk eller custom JWT:**
- **Gratis och self-hosted** - Clerk kostar $25/mån efter 10k MAU, onödigt för en skolplattform
- **Redan i Next.js-ekosystemet** - Djup integration med App Router, middleware, server components
- **Flexibla providers** - Google/Microsoft (skolkonton), credentials (lösenord), eller magic link via e-post
- **Custom JWT finns redan** i projektet (`jose`) - NextAuth bygger vidare på samma koncept

**Konkret implementation:**

```bash
npm install next-auth@beta
```

```ts
// src/lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    // Google-inloggning (bra för skolor med Google Workspace)
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    // Enkel lösenordsinloggning som backup
    Credentials({
      credentials: {
        email: { label: "Email" },
        password: { label: "Lösenord", type: "password" },
      },
      async authorize(credentials) {
        // Verifiera mot databas - kräver bcrypt-hashade lösenord
        const admin = await prisma.admin.findUnique({
          where: { email: credentials.email as string },
        });
        if (admin && await verify(credentials.password, admin.passwordHash)) {
          return { id: String(admin.id), email: admin.email, name: admin.name };
        }
        return null;
      },
    }),
  ],
  pages: { signIn: "/admin/login" },
});
```

```ts
// src/middleware.ts - Skydda alla admin-routes
import { auth } from "@/lib/auth";

export default auth((req) => {
  const isAdmin = req.nextUrl.pathname.startsWith("/admin");
  const isAdminApi = req.nextUrl.pathname.startsWith("/api/courses")
    || req.nextUrl.pathname.startsWith("/api/questions")
    || req.nextUrl.pathname.startsWith("/api/topics");

  if ((isAdmin || isAdminApi) && !req.auth) {
    return Response.redirect(new URL("/admin/login", req.url));
  }
});

export const config = {
  matcher: ["/admin/:path*", "/api/courses/:path*", "/api/questions/:path*", "/api/topics/:path*"],
};
```

**Databasschema-tillägg:**
```prisma
model Admin {
  id           Int      @id @default(autoincrement())
  email        String   @unique
  name         String
  passwordHash String
  createdAt    DateTime @default(now())
}
```

**Publika routes som INTE ska skyddas:**
- `/api/surveys/[id]/respond` - Elever skickar svar
- `/api/auth/student-login` - Elevinloggning
- `/s/[shareCode]` - Publika enkätsidor

---

### 2. Databas - SQLite vs PostgreSQL

**Nuläge:**
- SQLite via Prisma (`prisma/schema.prisma` rad 5-7)
- Fungerar bra för development och small-scale (enskild lärare med <100 elever)

**SQLite-begränsningar vid skalning:**
| Problem | Effekt |
|---------|--------|
| Single writer lock | Bara en skrivning åt gången - problem vid 30+ elever som svarar samtidigt |
| Ingen concurrent access | MCP-servern och web-appen delar samma fil, kan ge SQLITE_BUSY |
| Filbaserad | Kan inte köras i serverless (Vercel) utan extra setup |
| Inga JSON-operationer | Begränsar framtida analysfunktioner |

#### Rekommendation: Neon PostgreSQL (serverless)

**Varför Neon framför Supabase:**
- **Gratis tier räcker gott** - 0.5 GB storage, 190 compute hours/mån
- **Serverless-native** - Perfekt för Vercel-deployment, skalar automatiskt till noll vid inaktivitet
- **Prisma stöd** - Byt bara `provider` och `url` i schema
- **Branching** - Kan ha dev/staging/prod-databaser gratis

**Migration är minimal:**

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"  // Ändra från "sqlite"
  url      = env("DATABASE_URL")
}
```

```bash
# .env
DATABASE_URL="postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/survey?sslmode=require"
```

```bash
npx prisma db push  # Skapar tabeller i Postgres
```

**Rekommendation:** Behåll SQLite för lokal utveckling (snabbt, inga beroenden), använd Postgres i production. Prisma hanterar skillnaden transparent.

---

### 3. Prestanda

**Nuläge-problem:**
- `export const dynamic = "force-dynamic"` används på admin-sidor - tvingar server-rendering varje gång
- Alla API-routes gör databas-queries utan caching
- Resultat-sidan (`/api/surveys/[id]/results`) hämtar ALLA responses med alla answers i en query - kan bli tungt

#### Rekommendationer:

**a) Server Components (redan delvis implementerat)**
Admin-sidorna använder redan Server Components korrekt (direkt Prisma-queries i page.tsx). Behöver inte ändras.

**b) Next.js `unstable_cache` / `cacheLife` för dyra queries:**

```ts
// src/app/admin/courses/[courseId]/surveys/[id]/results/page.tsx
import { unstable_cache } from "next/cache";

const getCachedResults = unstable_cache(
  async (surveyId: number) => {
    return prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: { include: { question: { include: { options: true } } } },
        responses: { include: { answers: true } },
      },
    });
  },
  ["survey-results"],
  { revalidate: 30, tags: ["survey-results"] }
);
```

**c) Revalidation vid nya svar:**
```ts
// I /api/surveys/[id]/respond/route.ts, efter att svar sparats:
import { revalidateTag } from "next/cache";
revalidateTag("survey-results");
```

**d) Databasoptimering - index:**
```prisma
model Answer {
  // ... befintliga fält
  @@index([responseId])
  @@index([questionId])
}

model Response {
  // ... befintliga fält
  @@index([surveyId])
  @@index([studentId])
}
```

**e) Redis - inte nödvändigt nu**
SQLite/Postgres-caching räcker för förväntad last (<1000 användare). Redis ökar komplexitet utan proportionell vinst i detta skede.

---

### 4. Realtidsuppdateringar

**Use case:** Läraren ser live-resultat medan elever svarar på en enkät.

#### Rekommendation: Server-Sent Events (SSE)

**Varför SSE framför WebSockets/Pusher:**
- **Enklare** - Unidirectional (server → klient), perfekt för live-resultat
- **Ingen extra infrastruktur** - Fungerar med vanliga HTTP, inga WebSocket-servrar
- **Gratis** - Pusher kostar pengar, SSE är inbyggt i webbläsaren
- **Next.js-kompatibelt** - Fungerar via Route Handlers

**Implementation:**

```ts
// src/app/api/surveys/[id]/results/stream/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const surveyId = Number(id);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Skicka initial data
      const results = await getResults(surveyId);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(results)}\n\n`));

      // Poll var 3:e sekund (enklare än pub/sub för denna skala)
      const interval = setInterval(async () => {
        const updated = await getResults(surveyId);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(updated)}\n\n`));
      }, 3000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

```tsx
// I ResultsCharts eller results-sidan (klient):
useEffect(() => {
  const es = new EventSource(`/api/surveys/${surveyId}/results/stream`);
  es.onmessage = (event) => {
    setResults(JSON.parse(event.data));
  };
  return () => es.close();
}, [surveyId]);
```

**Begränsning:** SSE med polling fungerar för <50 samtida tittare. Vid större skala, överväg Redis Pub/Sub eller Ably/Pusher.

---

### 5. Testning

**Nuläge:** Projektet har INGA tester. Inga test-dependencies, inget test-script i package.json.

#### Rekommendation: Vitest + Playwright

**Varför Vitest framför Jest:**
- Snabbare (native ESM, Vite-baserad)
- Bättre TypeScript-stöd utan konfiguration
- Kompatibelt med Jest-syntax (enkel migration)

**Setup:**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom playwright @playwright/test
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

**Prioriterade tester att skriva:**

1. **API-routes (unit/integration)** - Mest kritiskt
```ts
// src/app/api/surveys/[id]/respond/__tests__/route.test.ts
import { POST } from "../route";

describe("POST /api/surveys/[id]/respond", () => {
  it("rejects invalid student number", async () => {
    const req = new Request("http://localhost/api/surveys/1/respond", {
      method: "POST",
      body: JSON.stringify({ studentNumber: -1, courseCode: "ABC", answers: [] }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(400);
  });

  it("prevents duplicate responses", async () => {
    // ... test att samma elev inte kan svara två gånger
  });
});
```

2. **CSV-import (unit)** - Parser-logik
3. **SurveyForm (komponent)** - Formulärvalidering
4. **E2E med Playwright** - Full flow: skapa kurs → importera frågor → skapa enkät → svara → se resultat

**Package.json-tillägg:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:e2e": "playwright test",
    "test:coverage": "vitest --coverage"
  }
}
```

---

### 6. API-design och validering

**Nuvarande problem:**
- Ingen input-validering utöver basic null-checks
- Inkonsekvent felhantering (ibland objekt, ibland strängar)
- Ingen rate limiting
- MCP-servern använder Zod men web-API:erna gör det inte

#### Rekommendation: Zod-validering i alla API-routes

**Zod finns redan** i mcp-server (`"zod": "^4.3.6"`). Lägg till i huvudprojektet:

```bash
npm install zod
```

**Exempel - validera survey-respond:**
```ts
// src/lib/validators.ts
import { z } from "zod";

export const respondSchema = z.object({
  studentNumber: z.number().int().positive("Elevnummer måste vara positivt"),
  courseCode: z.string().min(1, "Kurskod krävs").transform(s => s.toUpperCase().trim()),
  answers: z.array(z.object({
    questionId: z.number().int().positive(),
    value: z.string().min(1, "Svar krävs"),
  })).min(1, "Minst ett svar krävs"),
});

export const createCourseSchema = z.object({
  name: z.string().min(1, "Namn krävs").max(100).transform(s => s.trim()),
});

export const createSurveySchema = z.object({
  title: z.string().min(1).max(200).transform(s => s.trim()),
  description: z.string().max(1000).optional().default(""),
  questionIds: z.array(z.number().int().positive()).min(1, "Välj minst en fråga"),
});
```

**Standardiserat felformat:**
```ts
// src/lib/api-helpers.ts
import { ZodError } from "zod";

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Valideringsfel", details: error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: "Internt serverfel" },
    { status: 500 }
  );
}
```

**Rate limiting** (viktigt för publika endpoints):
```bash
npm install @upstash/ratelimit @upstash/redis
# Alternativt en enkel in-memory lösning:
```

```ts
// Enkel in-memory rate limiter (tillräcklig för single-server)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(ip: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}
```

---

### 7. MCP-server - Förbättringsmöjligheter

**Nuläge:** MCP-servern (`mcp-server/`) har 5 tools och 3 resources. Bra grund men saknar felhantering och flera användbara verktyg.

#### Förbättringar:

**a) Felhantering saknas helt:**
```ts
// Nuvarande - crash vid ogiltigt ID:
const result = await getResults(survey_id);

// Bättre:
server.tool(
  "get_results",
  "Hämta detaljerade resultat för en enkät",
  { survey_id: z.number().int().positive().describe("Enkätens ID") },
  async ({ survey_id }) => {
    try {
      const result = await getResults(survey_id);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Fel: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);
```

**b) Nya tools att lägga till:**

| Tool | Beskrivning | Värde |
|------|-------------|-------|
| `manage_students` | Lägg till/ta bort elever i en kurs | Slipper admin-UI för detta |
| `delete_survey` | Ta bort en enkät | Cleanup |
| `export_results_csv` | Exportera resultat som CSV | Dataanalys |
| `compare_surveys` | Jämför resultat mellan två enkäter | Progression |
| `list_surveys` | Lista alla enkäter i en kurs | Navigation |
| `update_question` | Redigera en befintlig fråga | Rättelser |

**c) Resource-templates har bugg:**
```ts
// server.ts rad 99-104 - URI-parsing med regex är fragil:
const match = uri.href.match(/courses\/(\d+)\/topics/);
const courseId = match ? Number(match[1]) : 0;  // Returnerar 0 vid fel istället för error
```

Borde använda MCP SDK:s inbyggda URI-template-parsing eller åtminstone returnera ett tydligt felmeddelande.

**d) Saknar prompts:**
MCP-protokollet stöder `prompts` - fördefinierade prompt-templates. Användbart för:
```ts
server.prompt(
  "analyze_survey",
  "Analysera en enkäts resultat och ge pedagogiska rekommendationer",
  { survey_id: z.number().describe("Enkätens ID") },
  async ({ survey_id }) => {
    const results = await summarizeResults(Number(survey_id));
    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Analysera följande enkätresultat och ge konkreta pedagogiska rekommendationer:\n\n${results}`,
        },
      }],
    };
  }
);
```

---

### 8. CI/CD och Deployment

**Nuläge:** Inga CI/CD-pipelines, ingen Docker, ingen deployment-konfiguration.

#### Rekommendation: Vercel + GitHub Actions

**Varför Vercel:**
- Zero-config för Next.js
- Gratis hobby tier räcker för en skolplattform
- Automatisk preview-deploy för varje PR
- Edge Runtime stöd

**GitHub Actions för CI:**

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
      - run: npm run test
      - run: npm run build

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

**Docker (för self-hosting):**

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

Kräver `output: "standalone"` i `next.config.ts`:
```ts
const nextConfig: NextConfig = {
  output: "standalone",
};
```

**Railway** som alternativ till Vercel om man vill ha Postgres + app i samma plattform (gratis tier: $5 kredit/mån).

---

### 9. Dataexport

**Nuläge:** Ingen exportfunktion. Resultat kan bara ses i admin-UI eller via MCP.

#### Rekommendation: CSV-export via API-route + UI-knapp

**API-route:**

```ts
// src/app/api/surveys/[id]/export/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const survey = await prisma.survey.findUnique({
    where: { id: Number(id) },
    include: {
      questions: {
        include: { question: true },
        orderBy: { order: "asc" },
      },
      responses: {
        include: { student: true, answers: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!survey) return new Response("Not found", { status: 404 });

  const questions = survey.questions.map((sq) => sq.question);

  // CSV-header
  const headers = ["Elevnummer", "Tidpunkt", ...questions.map((q) => q.text)];

  // CSV-rader
  const rows = survey.responses.map((r) => {
    const answerMap = new Map(r.answers.map((a) => [a.questionId, a.value]));
    return [
      r.student.number,
      r.createdAt.toISOString(),
      ...questions.map((q) => answerMap.get(q.id) || ""),
    ];
  });

  const csvContent = [
    headers.map(escCsv).join(","),
    ...rows.map((row) => row.map(escCsv).join(",")),
  ].join("\n");

  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="enkät-${survey.id}-resultat.csv"`,
    },
  });
}

function escCsv(val: unknown): string {
  const s = String(val ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"` : s;
}
```

**UI-knapp på resultat-sidan:**
```tsx
<a
  href={`/api/surveys/${surveyId}/export`}
  download
  className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
>
  Exportera CSV
</a>
```

**Excel-stöd (framtida):** Använd `exceljs` eller `xlsx` om Excel-format behövs. CSV räcker för de flesta skolbehov och kan öppnas direkt i Excel/Google Sheets.

---

### Sammanfattning - Prioriteringsordning

| Prioritet | Åtgärd | Effort | Impact |
|-----------|--------|--------|--------|
| **1. Kritisk** | Admin-autentisering (NextAuth) | Medium | Hög - Säkerhetsbrist |
| **2. Hög** | Zod-validering i API:er | Låg | Hög - Förhindrar buggar |
| **3. Hög** | Grundläggande tester (Vitest) | Medium | Hög - Kvalitetssäkring |
| **4. Medium** | CSV-export | Låg | Medium - Direkt användarnytta |
| **5. Medium** | MCP-server felhantering | Låg | Medium - Robusthet |
| **6. Medium** | PostgreSQL (Neon) | Låg | Medium - Skalbarhet |
| **7. Låg** | SSE live-resultat | Medium | Låg - Nice-to-have |
| **8. Låg** | CI/CD (GitHub Actions) | Låg | Medium - DevOps |
| **9. Låg** | Docker | Låg | Låg - Flexibilitet |

---

## UX & Design

### 1. Användarflöden

#### Lärarflödet (nuläge)
Läraren landar direkt på `/admin` (kursöversikt) och kan skapa kurser, lägga till frågor, skapa enkäter/quiz, och se resultat. Flödet är: Skapa kurs -> Lägg till frågor (manuellt/CSV) -> Skapa enkät -> Dela länk -> Se resultat.

**Problem & förbättringsförslag:**

- **Ingen steg-för-steg-guide vid första kursen.** En ny lärare som skapar sin första kurs möts av en tom dashboard utan vägledning om nästa steg. *Förslag:* Lägg till ett "Kom igång"-kort med checklistesteg (1. Importera frågor, 2. Skapa en enkät, 3. Dela med elever) som visas tills läraren gjort alla stegen minst en gång.
- **Inget sätt att redigera eller ta bort frågor/enkäter.** Tabellerna saknar edit- och delete-knappar. Om läraren skriver fel finns det ingen väg tillbaka utan att gå via databasen. *Förslag:* Lägg till redigerings- och raderingsfunktionalitet med bekräftelsedialog.
- **Inget sätt att duplicera enkäter.** Lärare behöver ofta återanvända enkäter mellan klasser. *Förslag:* "Duplicera enkät"-knapp på enkätlistan.
- **Delningslänken visas bara som text (`/s/abc123`).** Läraren måste själv konstruera hela URL:en. *Förslag:* Visa full URL + kopiera-till-urklipp-knapp + QR-kod-generering för klassrummet.
- **Ingen preview av enkäten innan den delas.** Läraren ser inte hur elever upplever formuläret. *Förslag:* "Förhandsgranska"-knapp som öppnar elevvyn i nytt fönster.
- **Enkäter kan inte stängas/pausas.** Det finns ingen möjlighet att stoppa svar efter deadline. *Förslag:* Lägg till status (Aktiv/Stängd) samt valfritt slutdatum.

#### Elevflödet (nuläge)
Eleven öppnar en delad länk (`/s/{shareCode}`), anger elevnummer och kurskod, besvarar frågorna, och ser bekräftelse (eller quizresultat).

**Problem & förbättringsförslag:**

- **Eleven måste ange kurskod och elevnummer varje gång.** Detta skapar friktion, speciellt vid upprepade enkäter. *Förslag:* Spara senaste elevnummer och kurskod i localStorage/cookie så fälten är förifyllda vid nästa besök.
- **Ingen progressindikator i enkäten.** Vid långa enkäter vet eleven inte hur långt hen kommit. *Förslag:* Lägg till en progress bar eller "Fråga 3 av 10" överst.
- **Inget skydd mot att tappa sina svar.** Om eleven av misstag stänger webbläsaren försvinner alla svar. *Förslag:* Autospara svar i sessionStorage och återställ vid omladdning.
- **Inget felmeddelande om eleven redan svarat.** API:et returnerar ett generiskt "Något gick fel" om duplikat-constraint triggas. *Förslag:* Tydligt meddelande: "Du har redan svarat på denna enkät."
- **Loginflödet (`/login`) leder till `/`** som redirectar till `/admin`. Elevlogin leder alltså till admin-panelen. *Förslag:* Elevlogin bör leda till en elevportal med "Mina enkäter" istället för admin.

---

### 2. Mobilanpassning

**Nuläge:**
- `SurveyForm` använder `max-w-2xl mx-auto px-4` vilket fungerar hyfsat på mobil.
- Admin-layouten saknar helt mobilanpassning: sidebaren (`w-56 min-h-screen`) är alltid synlig och det finns ingen hamburger-meny.
- Tabeller i frågebank/enkätlista har horisontell overflow utan `overflow-x-auto` wrapper.
- Dashboard-statistikkorten använder `grid-cols-4` utan responsiva breakpoints.
- Formuläret i SurveyForm har `grid-cols-2` för elevnummer/kurskod utan responsiv fallback.

**Konkreta förbättringsförslag:**

- **Sidebar -> Responsive drawer.** Dölj sidebaren på skärmar < 768px. Lägg till en hamburger-ikon i en topbar som togglar en slide-over-meny. Alternativt: använd en bottom tab bar på mobil (vanligt i EdTech-appar).
- **Statistik-grid:** Ändra `grid-cols-4` till `grid-cols-2 md:grid-cols-4` så korten stackas parvis på mobil.
- **Tabeller:** Wrappa alla `<table>` i `<div className="overflow-x-auto">` eller omdesigna som cards/list-items på mobil med `hidden md:table-cell` för sekundära kolumner.
- **SurveyForm-inputgrid:** Ändra `grid-cols-2` till `grid-cols-1 sm:grid-cols-2` så elevnummer och kurskod stackas vertikalt på smal skärm.
- **Touch-targets:** Knappar som `py-2 px-4 text-sm` är nära minimumgränsen (44x44px). Öka padding till minst `py-3 px-6` på mobil, speciellt för submit-knappar.
- **Viewport meta-tag:** Kontrollera att `<meta name="viewport" content="width=device-width, initial-scale=1">` finns (Next.js lägger till detta automatiskt, men det bör verifieras).

---

### 3. Tillgänglighet (a11y / WCAG)

**Kritiska problem:**

1. **`<html lang="en">` fast gränssnittet är på svenska.** Måste ändras till `lang="sv"` för att skärmläsare ska använda rätt uttal och språkmotor. (WCAG 3.1.1, nivå A)

2. **Saknade `htmlFor`/`id` på labels.** I SurveyForm, login-sidan och frågeformuläret är `<label>` och `<input>` inte programmatiskt kopplade via `htmlFor`/`id` (labels wrappar inte heller inputs i alla fall). Skärmläsare kan inte associera etiketter med fält. *Förslag:* Lägg till `id` på alla inputs och `htmlFor` på labels, alternativt wrappa input inuti label konsekvent.

3. **Ingen fokushantering vid dynamiskt innehåll.** När skapformuläret för enkäter togglas (`showCreate`), flyttas inte fokus till det nya innehållet. Tangentbordsanvändare och skärmläsare kan missa det. *Förslag:* Använd `useRef` + `focus()` efter toggle, samt `aria-expanded` på toggle-knappen.

4. **Tabeller saknar `<caption>` eller `aria-label`.** Frågebankstabellen, enkättabellen etc. har inga beskrivande namn. *Förslag:* Lägg till `<caption className="sr-only">Lista över frågor i frågebanken</caption>`.

5. **Kontrastproblem:**
   - `text-gray-400` på `bg-white` ger ca 3.2:1 kontrast (misslyckas WCAG AA 4.5:1 för normaltext). Förekommer på datum, kurskod-text och hjälptexter.
   - `text-gray-500` (ca 4.6:1) klarar sig knappt men bör höjas till `text-gray-600` för margin.
   - `bg-yellow-100 text-yellow-700` (quiz-badge) kan vara gränsfall. Testa med kontrastverktyg.

6. **Radioknappar i SurveyForm saknar synlig fokusring.** Den nativa radio-knappen med `accent-blue-600` har otydlig fokusmarkering i vissa webbläsare. *Förslag:* Lägg till `focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`.

7. **Felmeddelanden kopplas inte till fält.** Felmeddelanden visas visuellt nära fälten, men kopplas inte med `aria-describedby`. Skärmläsare annonserar inte automatiskt felen. *Förslag:* Använd `aria-describedby` + `role="alert"` eller `aria-live="polite"` på feltexter.

8. **Inget "skip to main content"-länk.** I kurs-layouten med sidebar saknas en snabblänk för att hoppa förbi navigeringen. *Förslag:* Lägg till en visuellt dold men fokusbar "Hoppa till innehåll"-länk överst.

9. **`alert()` används för bekräftelser.** Browser-alerts är tillgängliga men ger dålig UX. *Förslag:* Ersätt med inline-bekräftelser (toast-meddelanden med `role="status"` och `aria-live="polite"`).

10. **Diagram (Recharts) saknar textalternativ.** Stapeldiagrammen i ResultsCharts har ingen alternativ textrepresentation för skärmläsare. *Förslag:* Lägg till en `<table>` med `className="sr-only"` som visar samma data i tabellform, eller använd `aria-label` på SVG-containern.

---

### 4. Onboarding

**Nuläge:** Det finns ingen onboarding. Nya lärare landar på en tom kurslista. Nya elever förväntas veta sin kurskod och sitt elevnummer.

**Förbättringsförslag:**

- **Lärare:**
  - **Tom-tillstånd med instruktioner.** Det befintliga tom-tillståndet ("Inga kurser skapade ännu") bör utökas med en kort guide: "Välkommen! Börja med att skapa en kurs. Du kan sedan importera frågor och skapa enkäter."
  - **Interaktiv checklista.** Visa en checklista på kursdashboarden: "Skapa ämne [x], Lägg till frågor [x], Skapa enkät [ ], Dela med elever [ ]". Markera automatiskt när stegen är genomförda.
  - **Tooltip/guided tour.** Överväg en enkel "tips"-komponent som pekar ut viktiga funktioner (t.ex. "Klicka här för att importera frågor från CSV") första gången.
  - **Förklarande text vid CSV-import.** Visa ett exempelutdrag av CSV-formatet samt en nedladdbar mall-fil.

- **Elever:**
  - **Tydlig landningssida vid delad länk.** Enkätens titel och beskrivning bör framhävas tydligare innan eleven börjar svara.
  - **Hjälptext vid elevnummer/kurskod.** Lägg till en "Var hittar jag detta?"-tooltip: "Fråga din lärare om kurskoden. Ditt elevnummer är detsamma som ditt klassnummer."
  - **Välkomstmeddelande vid quiz.** Före quiz bör eleven informeras om att deras resultat visas direkt efter inskickning.

---

### 5. Feedback och bekräftelser

**Nuläge vid inskickat svar:**
- Enkät (SURVEY): En enkel bock-ikon och "Tack för ditt svar! Dina svar har skickats in."
- Quiz (QUIZ): Visar poäng (t.ex. "3/5, 60% rätt") med detaljerad genomgång av varje fråga (rätt/fel).

**Problem & förbättringsförslag:**

- **Ingen animation eller visuell transition.** Bytet från formulär till bekräftelse sker abrupt. *Förslag:* Lägg till en kort fade/slide-animation (t.ex. med CSS transitions eller `framer-motion`) för att ge feedback att något hänt.
- **Inget sätt att se eller spara sina svar.** Eleven kan inte gå tillbaka och se vad de svarade. *Förslag:* Lägg till "Visa mina svar"-knapp som expanderar en sammanfattning.
- **Bekräftelsesidan har ingen CTA.** Efter att eleven svarat finns ingenting att göra. *Förslag:* Lägg till "Tillbaka till kursen" eller "Stäng fönstret" beroende på kontext.
- **Ingen realtidsvalidering.** Fel visas först vid submit. *Förslag:* Validera elevnummer/kurskod inline medan eleven skriver (visuell indikering, inte blockerande).
- **Admin-sidan ger ingen bekräftelse vid skapande.** När läraren skapar en enkät eller importerar frågor stängs bara formuläret. *Förslag:* Visa en toast/banner: "Enkäten 'Matematik prov 3' skapades! Delningslänk: ..."
- **Quizresultatvyn saknar sammanfattande feedback.** Eleven ser bara siffror. *Förslag:* Lägg till kontextuell text: "Bra jobbat!" (>80%), "Nästan! Försök igen" (50-80%), "Öva mer på dessa frågor" (<50%).

---

### 6. Modern UX-praxis (EdTech-benchmarking)

**Jämförelse med Google Forms, Mentimeter, Kahoot:**

| Funktion | Google Forms | Mentimeter | Kahoot | Survey-platform |
|---|---|---|---|---|
| Realtidsresultat | Ja | Ja (live) | Ja (live) | Nej (manuell refresh) |
| Mobiloptimerad | Ja | Ja | Ja | Delvis |
| Drag & drop-ordning | Ja | Ja | Ja | Nej |
| Preview | Ja | Ja | Ja | Nej |
| Frågetyper | 10+ | 15+ | 8+ | 2 (MC + fritext) |
| Exportera resultat | CSV, Sheets | Excel, PDF | Excel | Nej |
| Anonyma svar | Valfritt | Ja | Nej | Nej (kräver elevnr) |
| Timer/tidsgräns | Nej | Ja | Ja | Nej |
| Visuella teman | Ja | Ja | Ja | Nej |
| Samarbete (dela redigering) | Ja | Ja | Nej | Nej |

**Prioriterade förbättringar (inspirerade av konkurrenter):**

1. **Realtidsuppdatering av resultat.** Lägg till polling (setInterval) eller WebSocket/SSE så att läraren ser svar strömma in live, likt Mentimeter. Detta är en killer feature i klassrummet.
2. **Export av resultat.** Lägg till "Exportera till CSV/Excel"-knapp på resultatvyn. Absolut nödvändigt för lärare som behöver dokumentera.
3. **Fler frågetyper.** Överväg: Skala/Likert (1-5), Sann/Falsk, Kort fritext vs Lång fritext, Bildbaserade frågor.
4. **Drag & drop för frågeordning.** Istället för att frågor läggs till i den ordning de väljs, ge läraren möjlighet att ändra ordningen.
5. **Timer för quiz.** Lägg till valfri tidsgräns per quiz (t.ex. 10 minuter), med nedräkning synlig för eleven.
6. **Visuella teman/anpassning.** Ge läraren möjlighet att lägga till en rubrikbild eller byta färgtema. Gör plattformen mindre "developer tool" och mer "klassrumsverktyg".

---

### 7. Komponentdesign - Förbättringsförslag

#### SurveyForm (`src/components/SurveyForm.tsx`)

- **Separera state-hantering från presentation.** Komponenten har ~240 rader med blandad logik och JSX. *Förslag:* Extrahera en custom hook `useSurveyForm()` som hanterar svar, validering och submit.
- **Progress bar.** Lägg till en visuell framstegsindikator som visar hur stor andel av frågorna som besvarats.
- **Bekräftelsevyn bör vara en separat komponent** (`SurveyComplete.tsx`) för att minska komplexitet och underlätta testning.
- **Lägg till laddningstillstånd.** En spinner eller skeleton screen vid submit istället för bara disabled-knapp.
- **Radio-knappar bör ha större klickyta.** Wrappa varje alternativ i ett kort/box (`p-3 border rounded hover:border-blue-300`) istället för bara en label med liten text.

#### ResultsCharts (`src/components/ResultsCharts.tsx`)

- **Responsivt diagramhöjd.** Höjden `h-64` är fast. Använd en dynamisk höjd baserat på antal svarsalternativ eller min/max constraints.
- **Färgpalett.** Använd en mer tillgänglig färgpalett som fungerar för färgblinda. Undvik att förlita sig enbart på grön/röd för rätt/fel. Lägg till mönster eller ikoner.
- **Tomt tillstånd.** Om en fråga har 0 svar, visa ett tydligt meddelande istället för ett tomt diagram.
- **Tabellalternativ.** Ge möjlighet att växla mellan diagram- och tabellvy med en toggle-knapp.

#### Sidebar / CourseSidebar (`src/components/Sidebar.tsx`, `CourseSidebar.tsx`)

- **Ikoner.** Lägg till ikoner bredvid navigeringslänkar (t.ex. Lucide React-ikoner) för snabbare visuell scanning. Dashboard = LayoutDashboard, Frågebank = FileQuestion, Enkäter = ClipboardList, Elever = Users.
- **Aktiv-markering.** Nuvarande `bg-gray-700` är subtil. Lägg till en vänsterkant-accent: `border-l-3 border-blue-400` på aktiv länk.
- **Kollapsbar sidebar.** Ge möjlighet att fälla ihop sidebaren till bara ikoner, speciellt på surfplattor.
- **Användarprofil/utloggning.** Sidebaren saknar information om vem som är inloggad och möjlighet att logga ut. Lägg till detta i bottensektionen.
- **CourseSidebar "Alla kurser"-länk** bör vara mer framträdande (knapstil istället för liten text).

#### Generella designsystem-förbättringar

- **Designtokens.** Definiera återanvändbara färger, spacing och border-radius som Tailwind-presets istället för att hårdkoda värden. T.ex. en primary-färg som kan bytas globalt.
- **Konsekvent komponentbibliotek.** Skapa en `Button`-komponent med varianter (primary, secondary, danger, ghost) för att eliminera upprepning av `bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50`.
- **Loading states.** Alla datahämtande sidor bör ha skeleton screens istället för bara text "Laddar...". Se `CourseResultsPage` som enda sida med laddningstext.
- **Empty states.** Förbättra alla tomma tillstånd med illustrationer eller ikoner och tydliga call-to-actions.
- **Toast-system.** Ersätt alla `alert()`-anrop med ett globalt toast/notification-system (t.ex. react-hot-toast eller en egen enkel implementation).
- **Bekräftelsedialoger.** Alla destruktiva handlingar (ta bort fråga, ta bort enkät) bör ha en modal med "Är du säker?"-text. Bygg en återanvändbar `ConfirmDialog`-komponent.
- **Dark mode.** CSS:en definierar dark mode-variabler i `globals.css` men dessa används inte av komponenterna (allt är hårdkodat med `bg-white`, `text-gray-500` etc.). Antingen ta bort dark mode-deklarationen eller implementera den konsekvent med Tailwind `dark:`-prefix.

---

### UX-prioriteringsordning

| Prioritet | Åtgärd | Effort | Impact |
|-----------|--------|--------|--------|
| **1. Kritisk** | `lang="sv"` i HTML + a11y-labels (WCAG A) | Låg | Hög - Tillgänglighet |
| **2. Kritisk** | Kontrastfix (`text-gray-400` -> `text-gray-600`) | Låg | Hög - WCAG AA |
| **3. Hög** | Responsiv sidebar (mobil hamburger-meny) | Medium | Hög - Mobilanvändare |
| **4. Hög** | Kopiera delningslänk + QR-kod | Låg | Hög - Direkt lärarnytta |
| **5. Hög** | Progress bar i SurveyForm | Låg | Hög - Elevupplevelse |
| **6. Medium** | Toast-system (ersätt alert()) | Låg | Medium - Professionell känsla |
| **7. Medium** | Onboarding-checklista på dashboard | Medium | Medium - Nya användare |
| **8. Medium** | Redigera/ta bort frågor och enkäter | Medium | Hög - Grundfunktion |
| **9. Låg** | Animationer vid formulär-submit | Låg | Låg - Polish |
| **10. Låg** | Dark mode (implementera eller ta bort) | Medium | Låg - Nice-to-have |

---

## Pedagogik & Lärande

### 1. Formativ bedömning - stöd för löpande lärande

#### Nuläge i plattformen
Plattformen har idag två lägen: **SURVEY** (enkät) och **QUIZ** (rätt/fel). Quiz-läget ger summativ feedback (poäng, rätt/fel) men saknar formativa element som stödjer elevens lärprocess över tid.

#### Rekommendationer

**a) Inför "Formativt quiz-läge"**
- Lägg till ett tredje läge: `FORMATIVE` där fokus ligger på lärande snarare än poäng
- Visa inte bara rätt/fel utan **förklaringar** till varje svar (nytt fält `explanation` på `Question`-modellen)
- Låt eleven försöka igen på frågor de svarade fel på (retry-mekanik)
- Visa inte totalpoäng direkt, utan fokusera på "vad kan du lära dig härnäst?"

**b) Spåra kunskapsutveckling över tid**
- Koppla elevsvar till topics och visa progression per ämnesområde
- Skapa en "kunskapskarta" per elev som visar styrkor och utvecklingsområden
- Implementera spaced repetition genom att automatiskt föreslå frågor inom svaga områden

**c) Diagnostiska frågor före/efter undervisning**
- Stöd för att köra samma frågeuppsättning som för-test och efter-test
- Visa läraren en diff-vy: "Så här förändrades förståelsen efter undervisningen"

> **Forskning:** En avhandling från Stockholms universitet (2024) visar att digitala verktyg främjar elevers delaktighet i lärandet när de används inom en genomtänkt pedagogisk ram. Verktygen i sig ger ingen förändring - det är den pedagogiska designen som avgör.

---

### 2. Feedback-loopar - återkoppling till elever

#### Nuläge
Quiz-läget ger omedelbar feedback efter inlämning (rätt/fel + rätt svar). Enkät-läget ger ingen feedback alls.

#### Rekommendationer

**a) Differentierad feedback beroende på syfte**
| Syfte | Feedbacktyp | Tidpunkt |
|-------|-------------|----------|
| Kunskapskontroll (quiz) | Rätt/fel + förklaring | Omedelbart |
| Djupförståelse (formativt) | Processfeedback + ledtrådar | Omedelbart med möjlighet att försöka igen |
| Kursutvärdering (enkät) | Sammanfattning till klassen | Fördröjd (efter stängning) |
| Självskattning | Jämförelse med klass-snitt | Fördröjd |

**b) Feedback-kvalitet viktigare än timing**
- Forskning (Ryan, 2024; Medical Education) visar att omedelbar och fördröjd feedback är lika effektiva för prestation vid formativa flervalsfrågor
- Fokusera på att ge **detaljerad, konceptuell feedback** snarare än bara rätt/fel
- Implementera fältet `explanation` per fråga som visas efter svar
- Ge feedback på ämnesområdesnivå: "Du behöver repetera X" snarare än bara "3/5 rätt"

**c) Feedback-loop för läraren**
- Realtidsvy under pågående quiz (live-resultat per fråga)
- Identifiera "problematiska frågor" där >50% svarar fel - signal till läraren att repetera
- Export av resultat per ämnesområde för att planera framtida undervisning

> **Forskning:** Studier (Tandfonline, 2025) visar att tidsenlig feedback är viktig för att undvika motivationsförlust, men att feedbackens substans och leverans är ännu viktigare. Personlig, högkvalitativ feedback förbättrar signifikant motivation och läranderesultat.

---

### 3. Anonymitet vs. identifiering

#### Nuläge
Elever identifieras via **elevnummer + kurskod**. Inga namn lagras i systemet. Läraren kan se individuella svar kopplat till elevnummer.

#### Analys

| Aspekt | Identifierat (nuvarande) | Anonymt | Pseudonymt |
|--------|--------------------------|---------|------------|
| Formativ nytta | Hög - läraren kan följa upp individuellt | Låg | Medel |
| Ärlighet i utvärdering | Lägre - elever kan censurera sig | Hög | Medel-Hög |
| GDPR-komplexitet | Medel | Låg | Låg |
| Motivationseffekt | Hög vid quiz | Neutral | Neutral |

#### Rekommendationer

**a) Inför anonymitetsval per enkät/quiz**
- Lägg till fält `anonymity` på Survey-modellen: `IDENTIFIED` | `ANONYMOUS` | `TEACHER_ONLY`
- `IDENTIFIED`: Som idag (elevnummer synligt i resultat)
- `ANONYMOUS`: Inga elevnummer sparas, bara aggregerade svar
- `TEACHER_ONLY`: Elevnummer sparas men visas bara för läraren, inte i klassredovisning

**b) GDPR för minderåriga (under 16)**

**Rättslig grund:** Skolan behöver i normalfallet *inte* samtycke för att behandla elevdata om det sker som en del av skolans uppdrag (rättslig grund: allmänt intresse/myndighetsutövning enligt art. 6.1 e GDPR). Men:

- **Elevnummer** räknas troligen som pseudonymiserade personuppgifter (indirekt identifiering via klasslista)
- **IMY (Integritetsskyddsmyndigheten)** betonar att personuppgifter som rör barn är särskilt skyddsvärda
- **Barn under 13 år**: Vårdnadshavarens samtycke bör alltid inhämtas vid samtyckesberoende behandling
- **Barn 13-16 år**: Bedöms i varje enskilt fall om barnet kan förstå konsekvenserna
- **DOS-lagen** (implementerad juni 2025) ställer krav på digital tillgänglighet för offentlig sektor

**Konkreta åtgärder:**
1. Dokumentera i en DPIA (Data Protection Impact Assessment) vilka uppgifter som samlas in
2. Implementera automatisk radering av svar efter kursslut (konfigurerbar retentionstid)
3. Minimera datainsamling - lagra inte mer än nödvändigt
4. Informera elever/vårdnadshavare om vilken data som samlas (informationsplikt)
5. Erbjud data-export per elev (rätt till registerutdrag)
6. Undvik att lagra IP-adresser eller annan metadata som inte behövs

> **Källa:** IMY:s vägledning om personuppgifter i skola och förskola; Skolverkets GDPR-sidor.

---

### 4. Motivation och engagemang - gamification

#### Nuläge
Plattformen har en grundläggande quiz-funktion med poängvisning (X/Y rätt, procent) och visuell feedback (stjärna vid bra resultat). Inga gamification-element som badges, streaks eller leaderboards.

#### Forskning

En metaanalys av Kurnaz (2025, Psychology in the Schools) om gamification i K-12-utbildning visar:
- **Effektstorlek g = 0.654** på elevers motivation (medelstor positiv effekt)
- Positiv effekt på både inre och yttre motivation
- **Spelberättelse (game fiction)** och **social interaktion** är de starkaste moderatorerna
- Kombination av **tävling + samarbete** ger bäst effekt på beteendemässiga läranderesultat

#### Rekommendationer - med varningar

**Genomför (låg risk, hög nytta):**
- Visa **framstegsindikator** per ämnesområde (progress bars per topic)
- Visa **streak** (antal quiz i rad som besvarats) - främjar kontinuitet
- Erbjud **"personligt bästa"** - jämförelse med egna tidigare resultat snarare än med andra

**Genomför med försiktighet:**
- **Badges/märken** för milstolpar (t.ex. "Besvarade 10 quiz", "100% rätt på ett quiz") - håll dem processorienterade, inte bara resultatbaserade
- **Klass-utmaningar** ("Kan klassen nå 80% snitt på detta ämne?") - kollektiv målsättning snarare än individuell tävling

**Undvik:**
- **Offentliga leaderboards** med individuella resultat - skapar stress, skam och yttre motivation som underminerar inre motivation
- **Poäng som betygsunderlag** - gamification-poäng ska vara separata från formell bedömning
- **Belöningsinflation** - för många badges minskar deras värde

> **Viktigt:** Forskning visar att gamification-effekter kan avta över tid (novelty effect). Designa för långsiktig nytta, inte kortsiktig wow-effekt.

---

### 5. Adaptivt lärande

#### Nuläge
Plattformen har ingen adaptiv funktionalitet. Alla elever får samma frågor i samma ordning.

#### Rekommendationer

**Nivå 1 - Enkel anpassning (realistisk att bygga):**
- **Slumpvis frågeordning** - minska fusk genom att variera ordningen per elev
- **Frågepool per topic** - läraren skapar fler frågor än som visas, systemet väljer slumpmässigt
- **Svårighetsgradering** - nytt fält `difficulty` (1-3) på Question-modellen
- **Anpassad repetition** - baserat på elevens historik, föreslå quiz med frågor från svaga områden

**Nivå 2 - Mellanliggande anpassning:**
- **Branching logic** - om eleven svarar fel på en fråga, visa en enklare följdfråga inom samma ämne
- **Dynamisk svårighetsjustering** - börja med medelfrågor, öka/minska svårighet baserat på svar
- **Diagnostisk startnivå** - kort pre-test som bestämmer vilken nivå eleven börjar på

**Nivå 3 - Avancerad (framtida):**
- AI-baserad analys av svarmönster
- Individuella lärvägar baserade på kunskapsgraf
- Prediktiv modell som identifierar elever som riskerar att hamna efter

> **Forskning:** En systematisk review (PMC, 2024) visar att adaptivt lärande har positiv effekt oavsett undervisningsform, men allra bäst effekt i kombination med fysisk undervisning (face-to-face) - 10.6% högre resultat på slutprov jämfört med enbart online.

**Konkret datamodellsändring:**
```prisma
model Question {
  // befintliga fält...
  difficulty    Int      @default(2)  // 1=lätt, 2=medel, 3=svår
  explanation   String?               // Förklaring som visas efter svar
}
```

---

### 6. Klassrumsdynamik - hur plattformen används i praktiken

#### Typiska användningsscenarier

**Scenario A: "Exit ticket" (5 min, slutet av lektion)**
- Läraren delar en kort quiz (3-5 frågor) via delningskod
- Eleverna svarar på sina mobiler/Chromebooks
- Läraren ser realtidsresultat och identifierar missuppfattningar
- **Krav på plattformen:** Snabb åtkomst, mobilanpassat, realtidsvy

**Scenario B: Diagnos inför nytt arbetsområde (10 min)**
- Formativt quiz för att kartlägga förkunskaper
- Läraren ser vilka delområden klassen redan behärskar
- **Krav:** Resultat per topic, inte bara per fråga

**Scenario C: Kursutvärdering (anonymt)**
- Elever ger feedback på undervisningen
- Bör vara anonymt för ärliga svar
- **Krav:** Anonymitetsläge, fri text-frågor, aggregerade resultat

**Scenario D: Gemensam genomgång av quiz (15 min)**
- Läraren visar klassens resultat på storskärm
- Diskuterar frågor där många svarade fel
- **Krav:** Presentationsläge utan elevnummer synliga, diagramvy

#### Rekommendationer för klassrumsanvändning

**a) Lärarvy under pågående quiz ("Live Dashboard")**
- Visa antal elever som svarat i realtid
- Visa resultat per fråga allteftersom svar kommer in
- "Stäng quiz"-knapp som förhindrar fler svar

**b) Presentationsläge**
- Fullskärmsvy av resultat optimerad för projektor
- Visa en fråga i taget med stapeldiagram
- Dölj elevnummer, visa bara aggregerade resultat
- Knapp: "Visa rätt svar" (avslöjas på lärarens kommando)

**c) QR-kod för snabb åtkomst**
- Generera QR-kod automatiskt från delningslänken
- Eleven scannar med mobilen och landar direkt i quizet
- Minskar tid för "alla ska hitta rätt sida"

---

### 7. Frågetyper som saknas

#### Nuvarande frågetyper
1. `MULTIPLE_CHOICE` - flerval med en rätt (radioknapp)
2. `FREE_TEXT` - fritextsvar

#### Rekommenderade nya frågetyper

| Frågetyp | Beskrivning | Pedagogiskt värde | Prioritet |
|----------|-------------|-------------------|-----------|
| **LIKERT_SCALE** | Skala 1-5 eller 1-7 (t.ex. "Hur väl förstår du X?") | Självskattning, kursutvärdering | Hög |
| **MULTIPLE_ANSWER** | Flerval med *flera* rätta svar (checkboxar) | Mer nyanserad kunskapskontroll | Hög |
| **RANKING** | Rangordna alternativ genom drag-and-drop | Prioritering, processförståelse | Medel |
| **IMAGE_CHOICE** | Välj bland bilder istället för text | Lägre tröskel för yngre elever, visuellt lärande | Medel |
| **MATCHING** | Para ihop begrepp (drag-and-drop) | Begreppsförståelse, vokabulär | Medel |
| **TRUE_FALSE** | Sant/falskt påstående | Snabb formativ kontroll | Låg (variant av MC) |
| **NUMERIC** | Numeriskt svar (med tolerans) | Matematik, naturvetenskap | Medel |
| **FILL_IN_BLANK** | Lucktext | Språk, faktakunskap | Låg |

#### Prioriterade tillägg

**Fas 1 (enklast, störst nytta):**
- `LIKERT_SCALE` - behövs för kursutvärderingar och självskattning
- `MULTIPLE_ANSWER` - minimal ändring i befintlig MC-logik, stor pedagogisk skillnad

**Fas 2:**
- `RANKING` - kräver drag-and-drop UI
- `MATCHING` - kräver ny datamodell för par-kopplingar
- `NUMERIC` - kräver toleransvärde för rättning

**Datamodellsändring för frågetyper:**
```
// Utöka Question.type till:
// MULTIPLE_CHOICE | MULTIPLE_ANSWER | FREE_TEXT | LIKERT_SCALE |
// RANKING | IMAGE_CHOICE | MATCHING | NUMERIC | TRUE_FALSE
```

---

### 8. Tillgänglighet för elever med olika behov

#### Nuläge
Plattformen har grundläggande responsiv design men saknar specifika tillgänglighetsanpassningar.

#### Rekommendationer

**a) Grundläggande tillgänglighet (WCAG 2.1 AA)**
- Tillräcklig **kontrast** (minst 4.5:1 för text) - kontrollera befintliga grå nyanser
- **Tangentbordsnavigation** - alla frågor och knappar ska vara nåbara med Tab/Enter
- **ARIA-labels** på alla interaktiva element
- **Fokusindikator** som syns tydligt vid tangentbordsnavigation
- **Skip-to-content**-länk

**b) Stöd för NPF (neuropsykiatriska funktionsnedsättningar)**
- **Tydlig struktur:** Visa en fråga per sida (alternativt läge) istället för alla frågor samtidigt - minskar kognitiv belastning
- **Progress-indikator:** "Fråga 3 av 10" - ger förutsägbarhet
- **Tidsinställning:** Undvik nedräkningstimer - skapar ångest. Om timer krävs, gör den valfri per elev
- **Visuellt lugn:** Minimera animationer, rörliga element och blinkande
- **Konsekvent layout:** Samma struktur på alla frågesidor

**c) Stöd för läs- och skrivsvårigheter (dyslexi)**
- **Text-till-tal (TTS):** Integrera uppläsning av frågetexter (Web Speech API)
- **Anpassningsbart typsnitt:** Erbjud val av typsnitt (t.ex. OpenDyslexic eller andra dyslexivänliga)
- **Justerbar textstorlek:** Utan att bryta layouten
- **Undvik VERSALER** i längre texter och instruktioner
- **Tydlig radavstånd** (minst 1.5x) och breda marginaler

**d) Stöd för synnedsättning**
- Kompatibelt med skärmläsare (VoiceOver, NVDA, JAWS)
- Alt-text på alla bilder och diagram
- Resultatdiagram ska ha textbaserat alternativ (inte bara visuellt)

**e) Förlängd tid**
- Inför möjlighet att ge individuella elever extra tid om tidsbegränsning används
- Läraren kan sätta per-elev-anpassningar i elevhanteringen

> **Juridiskt:** Enligt Diskrimineringsombudsmannen (DO) har skolor skyldighet att tillgängliggöra läromedel. DOS-lagen (2025) kräver WCAG 2.1 AA-efterlevnad för offentliga digitala tjänster. SPSM (Specialpedagogiska skolmyndigheten) ger vägledning om tillgängliga digitala läromedel.

---

### 9. Forskning - digitala bedömningsverktyg i skolan

#### Sammanfattning av aktuell forskning

**Formativ bedömning med digitala verktyg**
- En enkätundersökning från Umeå universitet (2025) visar att lärare har god förståelse för formativ bedömnings syfte och ser digitala verktyg som stöd för snabb återkoppling och överblick
- Forskning från Stockholms universitet (2024) visar att digitala resurser kan främja interaktion mellan lärare, elever och material, samt möjliggöra individanpassad feedback
- **Centralt fynd:** Digitala verktyg utan genomtänkt pedagogik kan ge *sämre* resultat - verktyget är medlet, inte målet

**Gamification i K-12**
- Metaanalys av Kurnaz (2025): Effektstorlek g = 0.654 på motivation
- Spelberättelse och social interaktion är de starkaste moderatorerna
- Kombination av tävling + samarbete mest effektivt
- Forskningsgap: Långtidseffekter av gamification saknas

**Adaptivt lärande**
- Scoping review (PMC, 2024, 69 artiklar 2012-2024): Positiv effekt på lärande oavsett modalitet
- Bäst effekt i kombination med fysisk undervisning (+10.6% på slutprov)
- Fokuserar nu på: algoritmisk design för personalisering + kommunikation av data till lärare

**Feedback och timing**
- Ryan (2024, Medical Education): Omedelbar och fördröjd feedback lika effektiva vid formativa flervalsfrågor
- Tandfonline (2025): Feedbackens kvalitet och personalisering viktigare än timing
- Omedelbar feedback bäst för motivation, fördröjd feedback bäst för djupare bearbetning

**GDPR och elevdata i Sverige**
- IMY betonar att barns personuppgifter är särskilt skyddsvärda
- Skolans behandling av elevdata vilar ofta på rättslig grund (allmänt intresse), inte samtycke
- Pseudonymisering (elevnummer utan namn) minskar risk men eliminerar inte GDPR-krav
- DOS-lagen (juni 2025) kräver digital tillgänglighet för offentliga tjänster

#### Konsekvenser för plattformen

1. **Prioritera pedagogisk design framför tekniska features** - varje funktion ska ha ett tydligt lärandesyfte
2. **Bygg för läraren, inte bara eleven** - lärarens insyn i data och möjlighet att agera på den är nyckeln
3. **Feedback > Poäng** - satsa på kvalitativ feedback snarare än bara rätt/fel-siffror
4. **Tillgänglighet från start** - retrofitting är dyrt, bygg in WCAG-stöd från början
5. **Dataminimering** - samla bara in data som har pedagogiskt syfte
6. **Adaptivitet stegvis** - börja med enkel slumpning och svårighetsgradering, bygg ut gradvis

#### Nyckelkällor

- Stockholms universitet (2024): Digitala resursers påverkan på delaktighet i lärmiljöer
- Umeå universitet (2025): Formativ bedömning i svenskundervisningen
- Kurnaz (2025): Meta-analysis of gamification's impact on student motivation in K-12 (Psychology in the Schools)
- Ryan (2024): Immediate and delayed feedback in formative multiple-choice testing (Medical Education)
- IMY: Personuppgifter i skola och förskola
- Skolverket: GDPR och skyddade personuppgifter
- SPSM: Riktlinjer för tillgängligt webbinnehåll (WCAG)
- PMC (2024): Personalized adaptive learning - scoping review
