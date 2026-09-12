# LaunchSite — Codex Engineering Instructions

## Mission

LaunchSite is a production-minded SaaS application that helps small businesses create professional websites using AI.

The long-term product may include website generation, editing, hosting, custom domains, lead capture, analytics, quotes, invoices, bookings, CRM functionality, and other small-business tools.

Do not attempt to build the entire long-term platform at once.

The immediate objective is to build a stable, testable MVP.

## Developer Context

The product owner uses AI-assisted development and does not rely on memorizing code.

Therefore:

* Explain important architectural decisions in plain English.
* Do not assume the product owner understands undocumented implementation details.
* When providing terminal commands, provide complete commands.
* When environment variables are required, explain exactly where they belong.
* Do not tell the product owner to manually reconstruct large code snippets if you can safely modify the files yourself.
* Prefer complete implementations over fragmented examples.
* Keep the repository understandable for another developer or AI agent later.

## Engineering Principles

Treat this as a real commercial SaaS product, not a tutorial or throwaway demo.

Prioritize:

1. Security
2. Maintainability
3. Reliability
4. Simple architecture
5. Good UX
6. Accessibility
7. Performance
8. Testability

Avoid premature complexity.

Do not introduce microservices unless there is a compelling reason.

Do not add dependencies simply because they are popular.

Never hard-code secrets, API keys, passwords, or credentials.

Use environment variables for secrets.

Validate untrusted user input.

Do not silently remove functioning features while implementing unrelated changes.

Do not perform broad rewrites when a focused change will solve the problem.

## Git Safety

Before large architectural changes:

* inspect the existing project,
* understand current behavior,
* describe the intended change,
* preserve existing functionality whenever possible.

Do not overwrite environment files containing secrets.

Never commit `.env`, `.env.local`, private keys, or credentials.

Keep `.gitignore` correct.

Prefer small, meaningful commits or coherent groups of changes.

## Testing

Features are not considered finished simply because the page renders.

When practical:

* run linting,
* run type checks,
* run tests,
* exercise important workflows,
* test error states,
* check mobile layouts.

If a test fails, investigate rather than ignoring it.

If something cannot be tested automatically, explain what should be manually verified.

## UI Philosophy

LaunchSite should feel like a commercial product rather than a programming project.

The UI should be:

* modern,
* clean,
* responsive,
* approachable to nontechnical small-business owners,
* consistent,
* uncluttered.

Do not create giant walls of controls.

Prefer guided workflows.

Use clear language rather than developer terminology.

## MVP Scope

The first usable MVP should allow a user to:

1. Visit a professional landing page.
2. Create an account or sign in.
3. Create a website project.
4. Enter basic business information.
5. Choose a visual direction/template.
6. Generate appropriate website copy/content.
7. Preview the generated website.
8. Edit important generated text and business information.
9. Save changes.
10. Publish the site to a public LaunchSite-hosted URL.

Example:

`/sites/tulsa-mobile-mechanic`

Custom domains are NOT required for the initial MVP.

Advanced drag-and-drop editing is NOT required for the initial MVP.

Payments are NOT required for the first development milestone.

## Initial Technology Direction

Prefer:

* Next.js
* TypeScript
* React
* Tailwind CSS
* PostgreSQL
* a mature database ORM
* secure authentication
* Vercel for the web application
* Railway PostgreSQL where appropriate

Avoid creating a separate backend server unless the application actually needs one.

The architecture may evolve if a better technical reason emerges.

## Data Model Direction

The core entities will likely include:

User

WebsiteProject

BusinessProfile

SitePage

SiteSection

SiteTheme

PublishedSite

GenerationJob

Exact schema design should be kept simple during the MVP.

## AI Generation

AI must return predictable structured data rather than uncontrolled blobs of HTML whenever practical.

Generated website content should be represented as application data.

Example conceptual structure:

```json
{
  "businessName": "Example Plumbing",
  "tagline": "Reliable plumbing when you need it",
  "hero": {},
  "services": [],
  "about": {},
  "faq": [],
  "contact": {}
}
```

The application should render this structured data using controlled templates/components.

Do not allow AI-generated code to become the production website runtime.

## Security

Assume that LaunchSite will eventually contain real customer data.

Implement authorization checks so one customer cannot access another customer's projects.

Sanitize or safely render user-generated content.

Use server-side validation.

Rate-limit expensive or abuse-prone AI operations when those features are introduced.

Never expose private AI API keys to browser code.

## Scope Control

If a requested change would substantially increase complexity, explain the tradeoff before implementing it.

Do not implement these in the earliest MVP unless specifically requested:

* full drag-and-drop page builder,
* arbitrary custom JavaScript,
* plugin marketplace,
* ecommerce,
* email hosting,
* advanced CRM,
* mobile native applications,
* multi-user enterprise permissions,
* custom-domain automation.

These can become future milestones.

## Documentation

Keep the README current.

When introducing important architectural choices, document:

* what was chosen,
* why,
* how to run it,
* required environment variables,
* deployment implications.

The project should remain understandable if another AI coding agent opens the repository months later.

## Definition of Done

A feature is complete when:

* it works,
* its important error states are handled,
* it doesn't break existing functionality,
* TypeScript is healthy,
* linting is healthy,
* applicable tests pass,
* the relevant documentation is current.

When uncertain, favor the smallest reliable implementation that moves the MVP toward paying customers.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
