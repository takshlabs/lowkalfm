# Repository instructions

- Use ADS-STE100 Simplified Technical English.
- Commit completed production changes to the `main` branch.
- Push completed production changes to `origin/main`.
- Use the linked Vercel project `lowkalfm` for production deployment.
- Treat a push to `main` as a production release. Run the build and tests before the push.

## Production deployment

- The only production site URL is `https://lowkalfm.vercel.app`.
- Do not deploy Lowkal through OpenAI Sites or ChatGPT Sites. Do not use or share a `chatgpt.site` URL for Lowkal.
- The Vercel project is `lowkalfm` in the `takshlabs-projects` team.
- Cloudflare R2 is only the audio delivery service. It does not host the Lowkal site or CMS.
- Read `docs/deployment.md` before a production deployment.
