---
title: "One Thing: a private, persistent AI plan for the task that feels too big"
tags: hf26challenge, ai, opensource, productivity
---

This is a submission for the **Hacktoberfest Weekend Challenge: Build for a Friend**.

## What I built

**One Thing** takes a task list that feels hard to enter and turns it into a few small actions, sized to the time and energy the person has today. A person can save the plan to their account, leave, and find it again later. They can export one plan or their whole library, and delete a plan when it is no longer useful.

Project: [add public source repository]

Live demo: [add public site URL]

## Who it is for

I started with the idea of helping someone who gets stuck when their to-do list feels bigger than their energy. That is an initial design assumption, not a confirmed story about a particular friend. Before publishing, I want to put the app in front of one real person and replace this paragraph with the problem they actually described and what they thought after trying it. I have not recorded a real handoff or feedback yet.

## How it works

The frontend is static. Supabase Auth identifies the signed-in account. When the person asks for a plan, a Supabase Edge Function checks the account, forwards the task to Backboard, and saves the task and result in Postgres. The browser lists only that account's rows.

The ownership boundary is in the database: row-level security checks `auth.uid() = user_id` for reads and writes. The Edge Function verifies the user token and saves with that user's JWT. The Backboard API key stays in server-side secrets. The function disables Backboard memory and stores the returned thread ID so Delete can remove both the saved row and its Backboard conversation.

## Why this architecture

I used [Rehearsal](https://dev.to/aditya_shirsatrao_7ada043/rehearsal-i-built-an-english-coach-that-runs-on-my-laptop-with-the-internet-unplugged-lpg) as a reference for making a challenge project specific, demonstrable, and honest about its trade-offs. Rehearsal runs a model locally and can work offline. One Thing follows a different need: a public app that remembers a person's plans when they return.

That choice has a real privacy cost. A task is sent to Backboard and the model provider configured by the site operator, and the task plus result are stored in Supabase. Database rules keep other ordinary signed-in users from reading or changing those rows, but this is not end-to-end encryption: the service operators may have access under their own systems and policies. I tell users not to enter highly sensitive details.

## Why open AI mattered

Backboard is the API layer; the model is configured separately. The current server configuration selects Backboard's Featherless provider and the open-weight `Qwen/Qwen2.5-7B-Instruct` model ([model card and Apache-2.0 license](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct)). The model choice remains replaceable in server configuration, and the prompt that shapes the plan is code we can inspect and change. Backboard documents Featherless as its open-source-model provider and lets each message name its provider and model ([message API](https://docs.backboard.io/concepts/messages), [provider/model catalog](https://docs.backboard.io/api-reference/models/list)).

This is not the offline or no-cost approach from Rehearsal. Each generation depends on the network and may use API credits or incur provider costs. The reason to choose it here is that it supports a public, low-setup experience; the open-weight model can be swapped or self-hosted later instead of treating a closed model as the only option.

## What I still need to measure

Before calling this finished, I need to deploy it, confirm that two separate accounts cannot see each other's plans, verify that delete removes both copies, and ask a real friend whether the generated first step is useful. The database isolation uses Supabase row-level security ([policy docs](https://supabase.com/docs/guides/database/postgres/row-level-security)). I have not run those checks yet, so I will add the results and a real demo link before submitting.

**Disclosure:** AI assisted with the code and this write-up. #hf26challenge
