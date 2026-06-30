---
title: Introduction
description: What Nesso is, why it exists, and the principles it is built on.
---

:::caution
This is an early-stage project. Some features are rough, some are not yet built.
:::

Nesso is an open-source app for building typed knowledge graphs for active learning. It is built on a specific claim about how understanding works and a specific critique of how most current tools approach it.

## The problem with passive learning tools

Passive learning is not a new problem, but AI has made it the default and amplified it at scale: you hand over a source and receive a summary, ask a question and receive an answer, or describe what you want to learn and receive a pre-built map. This is convenient, and pedagogically counterproductive. Decades of cognitive science converge on the same conclusion: deep understanding is not received; it is constructed. When the work of deciding how concepts relate is offloaded to a system, the process that produces comprehension is bypassed.

Alongside this, most learning platforms treat user data as a resource. In the context of learning, this data is uniquely sensitive: it reveals not just what someone has read, but how they reason, where they struggle, and how their understanding evolves over time. Capturing it passively, and often opaquely, is at odds with the interests of the people the tools claim to serve.

Finally, most platforms are proprietary silos: closed standards, locked formats, no way to inspect or extend them. Educators, developers, and learners themselves have no meaningful recourse when a platform makes choices they disagree with or stops serving their needs.

## What Nesso does instead

Nesso inverts the flow. The learner constructs their own knowledge structure: a typed concept graph that reflects how _they_ understand, not just what they have consumed. The act of deciding which relation holds between two concepts (does X _cause_ Y, or merely _enable_ it? is A an _instance of_ B, or a _subtype of_ it?) is where elaborative processing happens. The decision is the learning.

Algorithms work on what the learner has built, not on a generic curriculum. Spaced repetition is driven by graph structure: concepts with low stability or untested connections surface before well-reinforced ones. The review queue is always a function of the learner's own map.

An optional AI mentor, Socrates, can probe what you have built. It asks questions calibrated to your current graph rather than delivering answers. See [AI mentor (Socrates)](../guides/ai-mentor/) for setup and behaviour.

## Principles

**Constructivist by design.** Every feature is oriented around the learner doing cognitive work: drawing edges, labelling relations, writing definitions in their own words, self-rating recall. The system does not do this work for them.

**Open by default.** The code is MIT-licensed. The graph schema is documented, vocabulary-agnostic, and importable/exportable as plain JSON. The Nesso Learning Vocabulary it ships with is a declared, replaceable package. The MCP server makes the graph vocabulary available to any compatible client. Technical work done here is and will be intended to be useful beyond this application.

**Private by architecture.** In the web app, graphs are stored locally in your browser. In the desktop app, they are also saved as plain JSON files on your machine. Your graph content and definitions stay on your device. Mentor chat is session-only in the app. If you enable the mentor and use a remote AI endpoint, prompts are sent to that provider each turn. Optional telemetry (anonymous crash reports and aggregated usage events) is off by default and opt-in from settings. It never includes graph content, chat, or keys.

## What Nesso is not

Nesso is not a note-taking app. It does not replace a text editor, a spaced-repetition deck manager, or a general-purpose LLM interface. It is specifically a tool for the phase of learning where understanding a domain means deciding how its concepts relate to each other, and testing whether you can hold that structure under questioning.

It is also not a finished product. The codebase is publicly available for inspection and contribution.

---

The remainder of this documentation covers how to use the app and how to integrate with it programmatically. If you want to start immediately, [Getting started](../guides/getting-started/) has everything you need.
