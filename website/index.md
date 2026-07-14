---
layout: home

hero:
  name: better-content
  text: Edit your pages. Keep your data.
  tagline: An inline-edit CMS engine that persists to your own database through a small adapter seam. Framework-agnostic core, React binding, MIT.
  image:
    src: /logo.svg
    alt: better-content
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: How it works
      link: /guide/how-it-works
    - theme: alt
      text: Live demo
      link: https://better-content-playground.vercel.app

features:
  - title: Own your data
    details: Content is rows in your Postgres or Firestore, reached through a 7-method DataAdapter you can implement in an afternoon. No hosted service, no lock-in.
  - title: Inline editing first
    details: Headless contentEditable primitives with data-cms-* styling hooks. Visitors edit the live page, not an admin panel.
  - title: Framework-agnostic engine
    details: The core is a plain external store, getSnapshot and subscribe. React binds to it in one small file. Nothing in core imports a framework.
  - title: Every seam has a name
    details: Transport, DataAdapter, StorageAdapter, AuthAdapter. Swap REST for direct adapter calls, Postgres for Firestore, without touching the engine.
  - title: Deferred edits, optimistic ops
    details: Field edits buffer locally and flush on save. Item operations apply instantly and roll back on failure.
  - title: See your data while you build
    details: A framework-free dev inspector shows your collections live, refreshed on every save, in any framework.
---
