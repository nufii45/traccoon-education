# Local Private demo runbook

## Start the app

```sh
cd /Users/imman/dev/traccoon-educ-web/apps/web
pnpm install
pnpm dev
```

Open the displayed local URL in Chrome on the demo Mac. Chrome is the primary
browser because the local model path uses WebGPU.

## First local-model warm-up

1. Connect the Mac to the internet for this one-time model download.
2. Import a small, text-based PDF. Avoid image-only scans and complex slide
   layouts for the demo.
3. Select one page, create the pantry, then choose **Generate local cards**.
4. The first attempt checks WebGPU, downloads
   `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` into browser-managed storage, and
   shows progress in the green generation panel.
5. Keep one source-linked card. If WebGPU or the model is unavailable, the app
   keeps the source unchanged and directs the learner to manual authoring.

The model assets need the internet only before the cache is warm. Generation
does not post PDF text, source chunks, prompts, cards, or answers to a cloud
inference endpoint.

## Three-minute rehearsal

1. Open the app and point out **Local Private mode** in the sidebar.
2. Import a text-based PDF and choose one to three pages deliberately.
3. Generate up to three cards. Show the model-progress state or the clearly
   labelled local model state. If the runtime is unavailable, use the manual
   authoring path rather than presenting synthetic generated cards.
4. Open a candidate card. Show its source page and exact quote, edit one field
   if useful, and keep the card.
5. Add one manual card or discard a weak candidate.
6. Start study mode, select an answer, check it, and point to the evidence
   quote. The answer attempt is retained in IndexedDB.
7. Reload the app. The pantry and kept cards should remain.
8. Use **Delete pantry**, then **Confirm local deletion**, to show data control.

## Offline check

After the app shell and model have loaded once:

1. Build the production version with `pnpm build`.
2. Serve or deploy that production build over HTTPS or localhost, visit it
   once, and wait for the service worker to install.
3. Disable the network, reload, and use an already imported pantry. The app
   shell and saved cards should return from local storage.
4. For an offline model-generation proof, import a new text-based PDF and run
   generation after confirming the model cache is warm.

## Verification commands

```sh
cd /Users/imman/dev/traccoon-educ-web/apps/web
pnpm test
pnpm build
pnpm lint
```

The automated suite covers card option and evidence invariants, source chunk
selection, unsupported-browser behavior without an inference request,
PDF-text normalization, and IndexedDB persistence and deletion. The model
warm-up, WebGPU generation, and network-inspector proof need to be run in the
actual Chrome demo profile.
