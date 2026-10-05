---
title: "One Thing: a private, persistent AI plan for the task that feels too big"
tags: hf26challenge, ai, opensource, productivity
---

This is a submission for the **Hacktoberfest Weekend Challenge: Build for a Friend**.

## What I built

**One Thing** takes a task list that feels hard to enter and turns it into a few small actions, sized to the time and energy the person has today. It creates a private anonymous browser session automatically, so there is no email or password form. Plans remain available in that browser profile when the person returns. This is browser-profile privacy rather than personal identity: anyone using that profile can see its plans, and clearing the browser data or switching devices loses access. People can export one plan or their whole library, and delete a plan when it is no longer useful.

Project: https://github.com/Rohitisavailable/one-thing

Live demo: https://one-thing-3y6j.onrender.com/

## Who it is for

I started with the idea of helping someone who gets stuck when their to-do list feels bigger than their energy. That is an initial design assumption, not a confirmed story about a particular friend. Before publishing, I want to put the app in front of one real person and replace this paragraph with the problem they actually described and what they thought after trying it. I have not recorded a real handoff or feedback yet.

## How it works

The frontend is static. Supabase Auth creates an anonymous identity for the browser without asking the visitor to sign up. When they ask for a plan, a Supabase Edge Function verifies that session, forwards the task to Backboard, and saves the task and result in Postgres. The browser lists only rows belonging to that anonymous identity.

The ownership boundary is in the database: row-level security checks `auth.uid() = user_id` for reads and writes. The Edge Function verifies the browser session and saves with its JWT. The Backboard API key stays in server-side secrets. The function disables Backboard memory and stores the returned thread ID so Delete can remove both the saved row and its Backboard conversation. If someone clears site data or switches devices, their anonymous identity and saved plans cannot be recovered.

## Why this architecture

One Thing is designed for someone who wants a public app that remembers their plans when they return. That convenience comes with a clear trade-off: task data is sent to hosted services rather than processed entirely on the person's device.

That choice has a real privacy cost. A task is sent to Backboard and the model provider configured by the site operator, and the task plus result are stored in Supabase. Database rules keep other anonymous browser sessions from reading or changing those rows, but this is not end-to-end encryption: the service operators may have access under their own systems and policies. I tell users not to enter highly sensitive details.

## Why open AI mattered

Backboard is the API layer; the model is configured separately. The current server configuration selects Backboard's Featherless provider and the open-weight `Qwen/Qwen2.5-7B-Instruct` model ([model card and Apache-2.0 license](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct)). The model choice remains replaceable in server configuration, and the prompt that shapes the plan is code we can inspect and change. Backboard documents Featherless as its open-source-model provider and lets each message name its provider and model ([message API](https://docs.backboard.io/concepts/messages), [provider/model catalog](https://docs.backboard.io/api-reference/models/list)).

Each generation depends on the network and may use API credits or incur provider costs. The reason to choose this approach is that it supports a public, low-setup experience; the open-weight model can be swapped or self-hosted later instead of treating a closed model as the only option.

## What I still need to measure

Before calling this finished, I need to deploy the no-sign-in version, confirm that two separate browser sessions cannot see each other's plans, verify that delete removes both copies, and ask a real friend whether the generated first step is useful. The database isolation uses Supabase row-level security ([policy docs](https://supabase.com/docs/guides/database/postgres/row-level-security)). I have not run those checks yet, so I will add the results and a real handoff before submitting.

**Disclosure:** AI assisted with the code and this write-up. #hf26challenge
