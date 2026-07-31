---
name: Nested native Modals need their own KeyboardAvoidingView
description: A KAV outside a nested RN Modal does not reach inside it; forms inside nested modals get cut off by the keyboard on small screens.
---

# Nested Modal + keyboard

A React Native `<Modal>` renders in its own native window, OUTSIDE any parent
`KeyboardAvoidingView` — the parent KAV silently does nothing for content
inside a nested modal.

**Why:** the platform rename/add form (a Modal nested inside the AddEntry
modal, which itself has a KAV) had its bottom cut off by the keyboard on small
iPhones (reported Jul 31, 2026).

**How to apply:** any form-bearing Modal must wrap its own content in
`KeyboardAvoidingView` (`padding` on iOS, `height` on Android), even when a
parent screen already has one.
