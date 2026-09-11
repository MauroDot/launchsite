# LaunchSite

## Product Brief

### Working Name

LaunchSite

This is an internal working name and may change before commercial release.

---

## Vision

LaunchSite helps small-business owners establish a professional online presence without needing to understand website development.

A business owner describes their company, services, location, audience, and preferences.

LaunchSite transforms that information into a polished, editable, publishable business website.

The core experience should feel closer to answering a few intelligent questions than building a website manually.

---

## Core Product Promise

**Tell us about your business. We'll help turn it into a website.**

The user should not need to understand:

* HTML
* CSS
* hosting
* responsive design
* SEO metadata
* deployment
* web development terminology

LaunchSite handles those concerns.

---

## Target Customers

Initial target customers are solo operators and small local service businesses.

Examples include:

* mobile mechanics
* landscapers
* cleaners
* painters
* plumbers
* electricians
* handymen
* photographers
* pressure-washing businesses
* detailing businesses
* lawn-care businesses
* independent contractors

These customers often need a professional web presence but may not want to learn Wix, WordPress, hosting, themes, plugins, or web development.

---

## Problem

Small-business owners frequently know what their business does but do not know:

* how to structure a website,
* what copy to write,
* what pages are necessary,
* what calls-to-action to use,
* how to make the website mobile-friendly,
* how to publish or maintain it.

Traditional website builders still require the customer to effectively become the website designer.

LaunchSite aims to reduce that burden.

---

## MVP User Journey

### Step 1 — Landing Page

Visitor learns what LaunchSite does.

Primary CTA:

**Create My Website**

---

### Step 2 — Account

User creates an account or signs in.

---

### Step 3 — New Website

User selects:

**Create Website**

---

### Step 4 — Business Interview

LaunchSite asks for information such as:

* business name,
* type of business,
* short description,
* primary service area,
* phone number,
* email,
* services offered,
* years in business,
* preferred tone,
* desired call-to-action.

Not every field must be mandatory.

---

### Step 5 — Visual Direction

User selects from a small number of professional styles.

Example directions:

* Modern
* Bold
* Professional
* Friendly
* Minimal

This is deliberately simpler than exposing dozens of design controls.

---

### Step 6 — Website Generation

The system creates structured content for the business website.

Potential content:

* hero headline,
* supporting text,
* calls-to-action,
* services,
* about section,
* benefits,
* FAQ,
* contact section,
* SEO title,
* SEO description.

---

### Step 7 — Preview

User sees the actual website.

Responsive preview should support at least:

* desktop,
* mobile.

---

### Step 8 — Edit

User can edit important information without regenerating the entire site.

At minimum:

* business name,
* headlines,
* descriptions,
* services,
* contact details,
* calls-to-action.

---

### Step 9 — Publish

User chooses a unique slug.

Example:

`launchsite.app/sites/mauro-mobile-mechanic`

The public website becomes accessible.

---

## MVP Pages

### Public Product

* Home
* Pricing placeholder or early-access page
* Sign In
* Register

### Application

* Dashboard
* Create Website
* Website Editor
* Website Preview
* Account/Settings

### Customer Website

Initial generated sites should support:

* Home
* Services
* About
* Contact

They may initially be rendered as a polished single-page site while internally maintaining separate content sections.

---

## What Is NOT MVP

The initial version does not require:

* Wix-style freeform drag-and-drop
* custom domains
* ecommerce
* appointment scheduling
* invoice generation
* CRM
* team accounts
* native Android/iOS apps
* plugin ecosystem
* hundreds of templates
* advanced analytics
* full blogging platform

These may become later products or features.

---

## Business Model

Likely subscription SaaS.

Possible future plans:

### Trial

Build and preview a website.

### Starter

Approximately $15–$20/month.

Potential features:

* one published website,
* hosting,
* editing,
* AI content tools.

### Business

Approximately $25–$40/month.

Potential features:

* custom domain,
* analytics,
* lead tools,
* expanded AI generations,
* additional business features.

Pricing is provisional and should be validated against real customer demand.

---

## Long-Term Opportunity

LaunchSite can expand from a website generator into a lightweight small-business operating platform.

Potential modules:

Website
→ Leads
→ Customers
→ Quotes
→ Invoices
→ Payments
→ Scheduling
→ Reviews
→ Analytics

The website becomes the customer acquisition entry point.

The broader opportunity is helping small businesses operate online without assembling many unrelated software products.

---

## Technical Direction

### Frontend / Application

Next.js
React
TypeScript
Tailwind CSS

### Database

PostgreSQL

Initial hosting candidate:

Railway PostgreSQL

### Deployment

Vercel

### Source Control

GitHub

### AI

OpenAI API

AI output should preferably use structured schemas that the application validates and renders through controlled components.

### Payments

Stripe, later milestone.

---

## Architecture Principle

Do not let AI generate arbitrary production source code for every customer's website.

Instead:

Business Information

↓

AI Structured Content

↓

Validated Site Schema

↓

LaunchSite Components

↓

Published Website

This gives LaunchSite control over:

* security,
* visual quality,
* responsiveness,
* compatibility,
* accessibility,
* performance.

---

## Commercial Quality Standard

LaunchSite must eventually be good enough that we would feel comfortable asking a stranger to enter a credit card number and pay for it.

This means development decisions should account for:

* security,
* data isolation,
* reliability,
* backups,
* error handling,
* accessibility,
* privacy,
* performance,
* onboarding quality,
* mobile usability.

---

## Initial Success Metric

The first major success milestone is not revenue.

It is:

**A real small-business owner can create an account, describe their business, generate a respectable website, edit it, and publish it without developer assistance.**

Once this works reliably, commercialization and customer acquisition become the next priority.

---

## Product Philosophy

LaunchSite should not win by giving customers the most controls.

It should win by requiring the fewest decisions.

The customer is not trying to become a web designer.

The customer wants their business online.
