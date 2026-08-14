# Photo Background Worker

Self-hosted background removal for Rejected Treasures. It accepts only resized JPEG/PNG/WebP previews; original product files never leave SharePoint-bound intake.

```bash
docker build -t rejected-photo-worker .
docker run --rm -p 8080:8080 -e BACKGROUND_REMOVAL_API_TOKEN=replace-me rejected-photo-worker
```

Configure the web app with `BACKGROUND_REMOVAL_API_URL=http://localhost:8080/remove` and the same token. Production should use HTTPS and a private, access-controlled deployment.

Before commercial deployment, review the `rembg` package and selected model licenses as part of the release checklist.
