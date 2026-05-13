# Cloudflare Costs And Limits

This file records the current cost assumptions checked against Cloudflare docs on 2026-05-12.

## R2 Storage

R2 is the main storage candidate for the photo archive.

Current official R2 limits:

- data storage per bucket: unlimited;
- number of objects per bucket: unlimited;
- maximum object size: 5 TiB per object;
- single-part upload: 5 GiB;
- multipart upload: up to 4.995 TiB;
- custom domains per bucket: 50.

For this project, 5-30 MB JPEG uploads and occasional 100 MB panoramas are comfortably within R2 limits.

## R2 Pricing

Current R2 Standard pricing:

```txt
Free tier: 10 GB-month / month
Storage after free tier: $0.015 / GB-month
Class A operations: 1M free / month, then $4.50 / million
Class B operations: 10M free / month, then $0.36 / million
Egress: free
```

Infrequent Access is cheaper for storage but charges retrieval and has a 30-day minimum. For this project, Standard storage is the safer default at first.

## Rough Storage Estimates

Assume per photo:

```txt
sourceJpeg: 5-30 MB private
display/expanded/download/thumb combined: 3-8 MB public
```

Example archive sizes:

```txt
5,000 photos x 8 MB average total  = 40 GB  -> about $0.45/month after free tier
5,000 photos x 20 MB average total = 100 GB -> about $1.35/month after free tier
10,000 photos x 20 MB average total = 200 GB -> about $2.85/month after free tier
20,000 photos x 20 MB average total = 400 GB -> about $5.85/month after free tier
```

Formula:

```txt
billable GB = max(total GB - 10 GB free, 0)
monthly storage cost = billable GB * $0.015
```

These estimates exclude operation costs, Workers costs, Cloudflare Images transformation costs, and any paid plan minimums.

## Operations Cost

Uploads and metadata writes are unlikely to be expensive for this project.

The more important variable is public image reads:

- R2 Class B reads include 10M free per month;
- after that, Standard Class B is $0.36 per million requests;
- static Cloudflare Pages asset requests are free/unlimited, but R2 object reads still count when served from R2.

Good caching and pre-generated public derivatives will keep this under control.

## Workers / Pages Functions

Pages Functions are billed as Workers.

Current Workers Paid plan:

```txt
minimum: $5/month
included: 10M requests/month
additional: $0.30/million requests
```

Workers Free includes limited requests, but the paid plan is the more realistic baseline once the admin, uploads, D1, R2, and image processing are active.

## D1

Current D1 paid inclusions are generous for this project:

```txt
25B rows read/month included
50M rows written/month included
5 GB storage included
extra storage: $0.75 / GB-month
```

Photo metadata will be tiny compared with image files, so D1 storage is not the cost driver.

## Cloudflare Access

Cloudflare Access has a free tier for teams under 50 users. That should be enough for the first owner-only admin.

## Cloudflare Images

Cloudflare Images transformations have a free monthly allowance, then paid unique transformations. Because this archive may contain thousands of images and many sizes, the project should prefer generating and storing the main derivatives in R2 rather than relying only on endless on-the-fly transformations.

Cloudflare image transformations can still be useful, but pre-generated `thumb`, `display`, `expanded`, and `downloadJpeg` give more control over cost and quality.

