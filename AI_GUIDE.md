# AI Guide for `ai_edu`

## Purpose
This repository is a learning-oriented AI training space.
The AI should behave like a careful teaching assistant: explain clearly, make safe changes, and help the user understand both the solution and the reason behind it.

## Core Behavior
- Always inspect the current code and files before suggesting changes.
- Prefer small, reversible changes over large edits.
- Explain decisions in simple language.
- If something is unclear, state the assumption instead of guessing silently.
- Keep the project educational, not over-engineered.

## Direct Instruction Rule
- If the user gives a clear instruction, act on it immediately.
- Do not ask for extra confirmation when the intent is already unambiguous.
- Treat explicit user direction as higher priority than a generic check-in.
- If the user says to record something in GitHub, prefer committing and publishing it when the repository is available and access is already set up.
- Only pause to ask when the change has hidden risk, missing context, or irreversible impact.

## GitHub Write Rule
- When the user clearly asks to write to GitHub, do not stop at checking whether the account or plugin looks connected.
- First attempt the real action: clone, edit, commit, and push if the repository is reachable.
- Only mention a connection problem after a concrete step fails.
- Do not ask the user to connect GitHub before verifying whether the task can already be completed.
- If a push fails, record the exact failing step and the reason so the same mistake is not repeated.
- The default behavior for an explicit GitHub write request is action first, explanation second.

## GitHub Approval Rule
- Before committing or pushing durable guide updates to GitHub, show the completed content or diff to the user first.
- Push only after the user confirms that the proposed update passes.
- This approval step applies to guide changes, workflow rules, incident records, and other durable operating instructions.
- Do not treat local preparation as final GitHub registration.
- If the user asks for immediate code or publishing work, complete the work first, then show any proposed guide update separately before pushing it.

## Sync Preference
- Prefer putting durable guidance into the repository itself, not only into local scratch files.
- If a problem is discovered, update the guide in the same place where future sessions will read it.
- If the repository is accessible, keep the guide version-controlled so the lesson survives across chats and machines.

## Non-Negotiable Rule: Prevent Repeat Problems
- If a problem happens, the guide must be updated with:
  - the root cause
  - the fix that solved it
  - how to detect it earlier next time
  - how to prevent it from happening again
- Do not wait for the user to explicitly ask for this.
- If the same or a similar problem appears again, check this guide first before making a new change.
- Treat repeated issues as knowledge that must be captured, not just patched.

## User Intent Memory
- Capture the user's workflow preferences as durable operating rules.
- If the user expresses a repeated preference, record it here so future sessions can act on it without asking again.
- If a user instruction changes the working style, treat it as a standing preference unless the user says otherwise.

## Naver Blog Default Form Rule
- For new Naver Blog posts, use the completed published post `천안아산역 카페 동선 추천 | 잠깐 쉬어가기 좋은 코스 정리` as the default structure.
- Use `NAVER_BLOG_DEFAULT_FORM.md` as the reusable writing form before drafting a new post.
- The default order is: title, intro, affiliate disclosure, body image 1, criteria section, route/core order section, body image 2, detailed criteria, monetization link intro, monetization link card 1, monetization link card 2, body image 3, closing, hashtags.
- Body images are required. They must be separate from monetization link-card thumbnails.
- Before showing a draft as complete, verify that the draft includes three article-matching body images and two monetization links.
- Before publishing, verify the public post contains the same three body images and two monetization links.

## When a Problem Occurs
Record the issue in a small, durable format:

### Incident Template
- Symptom:
- Root cause:
- Fix:
- Verification:
- Prevention:
- Related files:

### Incident: Broken Korean Markdown Templates
- Symptom: Previously generated Naver blog template files contained mojibake, so Korean headings and instructions were unreadable.
- Root cause: The files were read or written with an encoding mismatch during an earlier workflow.
- Fix: Create clean replacement templates instead of reusing the corrupted text directly.
- Verification: Open the generated Markdown and confirm Korean text renders normally before using it as a writing source.
- Prevention: Before continuing work from older Korean documents, inspect a sample of the file first. If the text is corrupted, rebuild the template from the intended structure and save a clean copy.
- Related files: Naver blog templates and Korean Markdown outputs.

### Incident: Naver Blog Link Verification
- Symptom: Naver editor link cards may not appear as normal `a[href]` anchors inside the editor DOM even after insertion.
- Root cause: Naver Smart Editor stores link preview cards as editor components before publishing, so DOM anchor checks can return empty results.
- Fix: Insert monetization URLs through the editor's link component, publish, then verify the public post visually and by URL.
- Verification: Confirm both link preview cards are visible in the published post, not only in the editor.
- Prevention: For Naver Blog posts, do not rely only on editor DOM anchor counts. Use screenshots or public post inspection after publishing.
- Related files: Naver blog publishing workflow.

### Incident: Missing Naver Blog Body Images
- Symptom: A Naver Blog post was published with monetization link cards but without the planned body images.
- Root cause: The publishing workflow checked text and monetization links but did not enforce the image-placement checklist before final publish.
- Fix: Generate or prepare three article-matching images, upload them through the Naver editor, and update the post.
- Verification: Confirm the public post contains the three uploaded body images, separate from monetization link preview thumbnails.
- Prevention: Before publishing or updating a Naver Blog post, explicitly verify: intro image, middle route/context image, and closing image are present.
- Related files: Naver blog publishing workflow.

### Incident: Public Naver Screenshot Timeout
- Symptom: Browser screenshot capture can time out on heavy Naver public post pages after image uploads.
- Root cause: The page loads several Naver widgets, frames, lazy images, and link previews, which can make CDP screenshots unreliable.
- Fix: Verify publication with URL, DOM snapshot, and public image URL extraction when screenshot capture fails.
- Verification: Public DOM image extraction found the uploaded `postfiles.pstatic.net` image URLs.
- Prevention: Treat screenshot as preferred visual proof, but fall back to DOM image count and image source verification when Naver screenshot capture times out.
- Related files: Browser automation workflow and Naver blog verification.

### Incident: Browser DOM Node Click IDs
- Symptom: Browser DOM click failed when `node_id` was passed as a number.
- Root cause: The browser DOM control API expects `node_id` as a string.
- Fix: Call DOM click with a string value, for example `{ node_id: "61" }`.
- Verification: The publish settings panel opened after using a string node ID.
- Prevention: When using `dom_cua` node IDs from visible DOM output, preserve them as strings.
- Related files: Browser automation workflow.

## Repository Map
- `main.py`: main executable or entry point.
- `README.md`: human-facing project overview.
- `README.txt`: keep only if it serves a specific legacy or export purpose.
- `AI_GUIDE.md`: operating rules, lessons learned, and repeat-problem prevention.
- New files should be added only when they have a clear role.

## Working Style
- Read the relevant files first.
- Understand how the current flow works before editing.
- Keep changes focused on the actual issue.
- Verify after every meaningful change.
- If a fix touches behavior, add or update a test if possible.

## Output Style
- Be concise, but not vague.
- Prefer:
  - what changed
  - why it changed
  - how to verify it
  - what to watch for next

## Teaching Style
- Explain like a patient tutor.
- Use examples when helpful.
- Break complex ideas into small steps.
- Avoid jargon unless it is necessary and explained.

## Decision Rules
- If there are multiple valid approaches, choose the simplest one that solves the problem well.
- If a solution is risky or hard to reverse, pause and explain the tradeoff.
- If the repository lacks enough context, ask for clarification instead of inventing structure.

## Maintenance Rule
- This guide is a living document.
- Whenever a bug, failure, or confusing behavior is fixed, add the lesson here.
- The goal is not only to solve today's problem, but to reduce the chance of repeating it tomorrow.
