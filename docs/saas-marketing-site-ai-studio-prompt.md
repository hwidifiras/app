# We Discipline SaaS Marketing Site — Google AI Studio Prompt

Use the prompt below in Google AI Studio to generate a separate React + Vite
marketing website. The website is public and static; the existing Next.js
application remains the authenticated product.

## Recommended Domains

- Marketing website: `https://we-discipline.com`
- Product application: `https://app.we-discipline.com`
- Login link: `https://app.we-discipline.com/login`
- Future Tunisian domain: `https://we-discipline.tn` redirecting to
  `https://we-discipline.com`
- Current primary CTA: demo/contact form
- Future SaaS signup: `https://app.we-discipline.com/signup`

Do **not** connect public acquisition to the current `/register` route. It creates
a staff user inside the existing single club and is not a SaaS tenant signup.

## Prompt For Google AI Studio

```text
Build a production-ready, one-page SaaS marketing website using React, Vite,
TypeScript and Tailwind CSS.

PRODUCT
Product name: We Discipline
Category: club, gym, martial arts academy and sports school management SaaS
Primary audience: club owners, reception teams and administrators
Language: French
Market: French-speaking clubs, initially Tunisia

We Discipline centralizes:
- member registration and member files
- groups, disciplines, coaches and weekly schedules
- session planning and attendance check-in
- subscription plans and renewals
- payment collection, partial payments and unpaid balance tracking
- family offers and multi-discipline discounts
- operational dashboard and financial indicators
- internal alerts for unpaid balances and expiring subscriptions
- user roles, permissions and audit history

GOAL
Create a trustworthy, clear and conversion-focused SaaS landing page. It must
look like a real professional B2B product, not a generic AI template. The page
must be fast, accessible, mobile-first and visually consistent.

TECHNICAL REQUIREMENTS
- React + Vite + TypeScript
- Tailwind CSS
- No Next.js
- No backend implementation
- No authentication logic inside the marketing website
- No fake checkout
- All CTA destinations must come from one configuration file or Vite variables:
  VITE_APP_LOGIN_URL=https://app.we-discipline.com/login
  VITE_DEMO_URL=#contact
  VITE_SIGNUP_URL=#contact
- “Se connecter” redirects to VITE_APP_LOGIN_URL
- Pricing CTAs redirect to VITE_SIGNUP_URL
- Demo CTAs scroll to or open the contact section
- Keep components reusable and data-driven
- Use semantic HTML, keyboard navigation and visible focus states
- Respect prefers-reduced-motion
- Avoid heavy animation libraries
- Optimize for deployment on Netlify, Vercel, Cloudflare Pages or a static Nginx
  container
- Add a README with npm install, npm run dev and npm run build instructions
- Add an .env.example file

VISUAL DIRECTION
- Minimal, modern B2B SaaS design
- Balanced grids, equal card heights and strict visual symmetry
- No random gaps, masonry layout or oversized empty spaces
- Dark navy and clean off-white surfaces
- Primary color: professional blue
- Accent colors used sparingly for payments, attendance and alerts
- Rounded corners should be subtle and consistent
- Strong typographic hierarchy
- Desktop layout should feel dense but calm
- Mobile layout must remain readable with large touch targets
- Use Lucide React icons
- Create an abstract product dashboard mockup using HTML/CSS components, not an
  external screenshot
- Support light and dark mode

HEADER
- Sticky header
- We Discipline wordmark/logo placeholder
- Navigation anchors: Fonctionnalités, Solutions, Tarifs, FAQ
- Secondary CTA: “Se connecter”
- Primary CTA: “Demander une démo”
- Responsive mobile menu

HERO COPY
Eyebrow:
“Gestion de club, enfin centralisée”

Headline:
“Pilotez votre club sans perdre du temps dans les fichiers et les messages.”

Supporting text:
“We Discipline réunit inscriptions, abonnements, encaissements, planning et pointage
dans une interface simple pour la réception et la direction.”

Primary CTA:
“Demander une démo”

Secondary CTA:
“Voir les fonctionnalités”

Trust line:
“Conçu pour les salles de sport, dojos, académies et écoles sportives.”

Hero visual:
Create a polished dashboard preview containing four equal KPI cards, today’s
sessions, outstanding payments, attendance and quick reception actions. Keep
the mockup realistic, symmetrical and responsive.

PROBLEM SECTION
Title:
“Moins de tâches dispersées. Plus de contrôle.”

Present four common problems:
- dossiers membres éparpillés
- impayés difficiles à suivre
- pointage lent ou imprécis
- planning et abonnements déconnectés

Follow with:
“We Discipline transforme ces opérations quotidiennes en un seul parcours clair.”

FEATURES SECTION
Title:
“Tout ce dont la réception a besoin, au même endroit.”

Use six equal cards:
1. Inscriptions guidées
   “Créez le membre, son abonnement, son groupe et son premier règlement dans
   un parcours cohérent.”
2. Encaissements clairs
   “Suivez le montant dû, les paiements partiels et le solde restant.”
3. Pointage rapide
   “Marquez présents et absents depuis une vue adaptée au bureau comme au mobile.”
4. Planning maîtrisé
   “Organisez groupes, coachs, créneaux et séances sans doublons.”
5. Dossiers membres complets
   “Retrouvez abonnements, groupes, présence, foyer et historique depuis une fiche.”
6. Alertes utiles
   “Repérez les impayés et abonnements arrivant à échéance avant qu’ils ne deviennent urgents.”

WORKFLOW SECTION
Title:
“Une journée de réception, en quatre étapes.”

Steps:
1. Inscrire le membre
2. Affecter la formule et le groupe
3. Encaisser et suivre le solde
4. Pointer la séance et consulter l’activité

Add a compact visual flow connecting the four steps.

AUDIENCE SECTION
Title:
“Une vue adaptée à chaque responsabilité.”

Three equal columns:
- Réception: actions rapides, recherche, encaissement, pointage
- Direction: revenus, impayés, activité, contrôle opérationnel
- Équipe: permissions ciblées et interface simplifiée

BENEFITS / PROOF SECTION
Do not invent customer numbers, testimonials or legal certifications.
Use honest operational benefits instead:
- moins de double saisie
- visibilité immédiate sur les soldes
- parcours plus rapide à l’accueil
- historique conservé pour les actions sensibles

PRICING SECTION
Title:
“Des formules adaptées à votre club.”

Add a monthly/yearly visual toggle. The yearly prices can show “2 mois offerts”.
Clearly label all prices as indicative and keep them in editable data.

Plan 1 — Essentiel
Price: 49 TND / mois
Audience: petits clubs
Features:
- jusqu’à 150 membres actifs
- inscriptions et dossiers membres
- planning et pointage
- abonnements et encaissements
- 2 utilisateurs
CTA: “Demander une démo”

Plan 2 — Pro
Price: 99 TND / mois
Badge: “Le plus choisi”
Audience: clubs en croissance
Features:
- jusqu’à 500 membres actifs
- toutes les fonctions Essentiel
- offres famille et multi-discipline
- alertes et suivi des impayés
- rôles et permissions
- 8 utilisateurs
CTA: “Demander une démo”

Plan 3 — Sur mesure
Price: “Nous contacter”
Audience: réseaux et besoins spécifiques
Features:
- membres et utilisateurs adaptés au besoin
- accompagnement au déploiement
- import de données
- support prioritaire
- personnalisation et intégrations étudiées
CTA: “Parler à l’équipe”

Add below pricing:
“Les limites, tarifs et modalités seront confirmés lors de l’ouverture commerciale.”

SECURITY SECTION
Title:
“Vos opérations restent sous contrôle.”

Mention only capabilities supported or planned without overclaiming:
- accès par compte utilisateur
- rôles et permissions
- journal des actions sensibles
- sauvegardes et déploiement professionnel selon l’offre

Do not claim ISO, SOC 2, GDPR certification or guaranteed uptime.

FAQ SECTION
Include:
1. We Discipline convient-il aux dojos et académies multi-disciplines ?
2. Peut-on gérer les paiements partiels ?
3. Le pointage fonctionne-t-il sur mobile ?
4. Peut-on limiter les accès de chaque employé ?
5. Peut-on importer des membres existants ?
6. Comment démarrer ?

Suggested answers must be concise and honest. For import, say it is evaluated
during onboarding. For starting, direct users to request a demo.

CONTACT / FINAL CTA
Title:
“Prêt à simplifier la gestion quotidienne de votre club ?”

Text:
“Présentez-nous votre organisation. Nous vous montrerons comment We Discipline peut
s’adapter à votre réception, vos formules et votre planning.”

Add a frontend-only contact form:
- nom complet
- club
- email
- téléphone
- nombre approximatif de membres
- message

The form must not pretend to submit successfully without a backend. Implement
one configurable integration point:
VITE_CONTACT_ENDPOINT

If the variable is absent, show:
“Le formulaire sera bientôt disponible. Contactez-nous directement par email.”

Also expose:
VITE_CONTACT_EMAIL

FOOTER
- We Discipline summary
- links to Fonctionnalités, Tarifs, FAQ
- Se connecter
- Contact
- placeholders for Politique de confidentialité, Conditions d’utilisation and
  Mentions légales
- dynamic current year

SEO
- French page title and meta description
- Open Graph metadata
- favicon placeholder
- JSON-LD SoftwareApplication data without ratings or fabricated reviews
- meaningful section IDs and heading hierarchy

DELIVERABLE
Generate all project files, not only one component. The result must run with:
npm install
npm run dev
npm run build

Before finishing, verify:
- no TypeScript errors
- no horizontal scrolling at 320px
- pricing cards have equal heights on desktop
- all CTAs use configured destinations
- login never opens a fake modal
- the contact form clearly handles a missing endpoint
```

## Integration With The Existing Application

### Phase 1 — Safe Now

1. Deploy the generated Vite site as the public website.
2. Keep the existing Next.js application on `app.we-discipline.com`.
3. Link “Se connecter” directly to `https://app.we-discipline.com/login`.
4. Link all acquisition and pricing buttons to the demo/contact section.
5. Keep `ALLOW_PUBLIC_REGISTER=false`.

The two applications do not need to share code, cookies or databases. A normal
HTTPS redirect is sufficient for login.

### Phase 2 — Real SaaS Signup

Before exposing “Créer mon compte”, the product needs:

- `Club` or `Tenant` model
- `clubId` on all business records
- owner signup instead of staff signup
- tenant-scoped authorization on every page and API
- SaaS plan and subscription status
- checkout and payment-provider webhooks
- trial, cancellation and failed-payment handling
- club provisioning and first-admin creation
- tenant-aware password reset and invitations

The future signup flow should be:

1. Visitor selects a plan on the marketing site.
2. Redirect to `https://app.we-discipline.com/signup?plan=pro`.
3. Create the club owner account and club workspace.
4. Confirm email or complete checkout.
5. Create the SaaS subscription from a verified server webhook.
6. Redirect to the application onboarding guide.

Never trust a price or active-plan status coming from the Vite frontend. Plan
validation, checkout creation and account provisioning must happen in the
Next.js backend.

## Hosting Notes

The Vite marketing site can be hosted independently as static files. The current
Next.js application remains in its Docker deployment. Typical DNS/proxy setup:

```text
we-discipline.com      -> static Vite marketing site
www.we-discipline.com  -> redirect to we-discipline.com
app.we-discipline.com  -> existing Next.js Docker application
we-discipline.tn       -> future redirect to we-discipline.com
```

This separation allows the marketing design to change freely without risking
the operational club application.
